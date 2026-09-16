import { describe, it, expect, vi } from 'vitest';
import { Ok, Err, isOk, isErr, unwrap, unwrapOr, map, mapErr, tryCatch, fromPromise } from '../utils/result.js';
import { priorityEngine } from '../services/priority.service.js';
import {
  agentTraceEmitter,
  computeToolFingerprint,
  generateSpanId,
  AgentLoopDetectedError,
} from '../services/ai/agent/orchestrator-stream.js';
import {
  assembleTurnContext,
  loadSessionHistory,
  AGENT_SYSTEM_INSTRUCTION,
} from '../services/ai/agent/orchestrator-context.js';
import { getAiProvider } from '../services/ai/core/factory.js';
import { MockAiProvider } from '../services/ai/core/providers/mock.provider.js';

describe('Phase 5: Code Quality & Functional Result Architecture', () => {
  describe('Result Monad (result.ts)', () => {
    it('creates and identifies Ok results', () => {
      const res = Ok({ id: 'task-1', priority: 0.95 });
      expect(res.ok).toBe(true);
      expect(isOk(res)).toBe(true);
      expect(isErr(res)).toBe(false);
      expect(unwrap(res)).toEqual({ id: 'task-1', priority: 0.95 });
      expect(unwrapOr(res, { id: 'fallback', priority: 0 })).toEqual({
        id: 'task-1',
        priority: 0.95,
      });
    });

    it('creates and identifies Err results', () => {
      const error = new Error('Database timeout');
      const res = Err(error);
      expect(res.ok).toBe(false);
      expect(isOk(res)).toBe(false);
      expect(isErr(res)).toBe(true);
      expect(() => unwrap(res)).toThrow('Database timeout');
      expect(unwrapOr(res, { fallback: true })).toEqual({ fallback: true });
    });

    it('transforms Ok values with map and preserves Err', () => {
      const okRes = Ok(10);
      const mappedOk = map(okRes, (x) => x * 2);
      expect(unwrap(mappedOk)).toBe(20);

      const errRes = Err(new Error('fail'));
      const mappedErr = map(errRes, (x: number) => x * 2);
      expect(isErr(mappedErr)).toBe(true);
    });

    it('transforms Err values with mapErr and preserves Ok', () => {
      const errRes = Err('raw error');
      const mapped = mapErr(errRes, (e) => new Error(String(e).toUpperCase()));
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error.message).toBe('RAW ERROR');
      }

      const okRes = Ok(42);
      const mappedOk = mapErr(okRes, (e) => new Error(String(e)));
      expect(unwrap(mappedOk)).toBe(42);
    });

    it('safely catches synchronous exceptions with tryCatch', () => {
      const okTry = tryCatch(() => JSON.parse('{"status":"ready"}'));
      expect(isOk(okTry)).toBe(true);
      expect(unwrap(okTry)).toEqual({ status: 'ready' });

      const errTry = tryCatch(() => JSON.parse('{invalid-json}'));
      expect(isErr(errTry)).toBe(true);
      if (isErr(errTry)) {
        expect(errTry.error).toBeInstanceOf(Error);
      }
    });

    it('safely wraps asynchronous promises with fromPromise', async () => {
      const okPromise = fromPromise(Promise.resolve(['item1', 'item2']));
      const okResult = await okPromise;
      expect(isOk(okResult)).toBe(true);
      expect(unwrap(okResult)).toEqual(['item1', 'item2']);

      const errPromise = fromPromise(Promise.reject(new Error('Network disconnected')));
      const errResult = await errPromise;
      expect(isErr(errResult)).toBe(true);
      if (isErr(errResult)) {
        expect(errResult.error.message).toBe('Network disconnected');
      }
    });
  });

  describe('PriorityService with Safe Result Return Types', () => {
    it('returns Ok result when calculating score and ranking tasks safely', () => {
      const testTasks = [
        {
          id: '1',
          userId: 'user-1',
          title: 'Immediate server outage',
          description: null,
          importance: 0.9,
          estimatedMinutes: 60,
          dependencies: [],
          dueAt: new Date(Date.now() + 3600 * 1000), // in 1 hr
        },
        {
          id: '2',
          userId: 'user-1',
          title: 'Review weekly newsletter',
          description: null,
          importance: 0.3,
          estimatedMinutes: 30,
          dependencies: [],
          dueAt: new Date(Date.now() + 86400 * 1000 * 7), // in 7 days
        },
      ];

      const rankedResult = priorityEngine.rankTasksSafe(testTasks);
      expect(isOk(rankedResult)).toBe(true);
      const ranked = unwrap(rankedResult);
      expect(ranked.length).toBe(2);
      expect(ranked[0]!.id).toBe('1');
      expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    });
  });

  describe('Modular Orchestrator Architecture Separation', () => {
    it('computes deterministic tool fingerprints and span IDs in orchestrator-stream', () => {
      const fp1 = computeToolFingerprint('query_emails', { filter: 'unread', limit: 10 });
      const fp2 = computeToolFingerprint('query_emails', { limit: 10, filter: 'unread' });
      const fp3 = computeToolFingerprint('query_emails', { filter: 'starred', limit: 10 });

      expect(fp1).toBe(fp2); // Keys ordered deterministically
      expect(fp1).not.toBe(fp3);

      const spanId = generateSpanId();
      expect(spanId.length).toBe(8);
      expect(typeof spanId).toBe('string');
    });

    it('emits formatted events and handles trace errors in orchestrator-stream', () => {
      const loopErr = new AgentLoopDetectedError('Repeated identical call detected');
      expect(loopErr.name).toBe('AgentLoopDetectedError');
      expect(loopErr.message).toContain('Repeated identical call');

      const events: any[] = [];
      const listener = (evt: any) => events.push(evt);
      agentTraceEmitter.on('test_event', listener);
      agentTraceEmitter.emit('test_event', { spanId: 'span123', status: 'ok' });
      expect(events.length).toBe(1);
      expect(events[0].spanId).toBe('span123');
      agentTraceEmitter.off('test_event', listener);
    });

    it('exports modular context assembler and system instruction', () => {
      expect(AGENT_SYSTEM_INSTRUCTION).toContain('Streamline');
      expect(typeof assembleTurnContext).toBe('function');
      expect(typeof loadSessionHistory).toBe('function');
    });
  });

  describe('AI Factory Test Defaults & Mock Isolation', () => {
    it('instantiates MockAiProvider when running in test environment or mock mode', () => {
      const provider = getAiProvider();
      expect(provider).toBeInstanceOf(MockAiProvider);
      expect(provider.name).toBe('mock');
    });
  });
});
