import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  requestContext,
  runWithContext,
  getRequestId,
  getCurrentUserId,
  getCurrentSessionId,
} from '../utils/context.js';
import { Counter, Gauge, Histogram, MetricsRegistry, getPrometheusMetrics } from '../utils/metrics.js';
import { startSpan, withActiveSpan, telemetryRegistry, generateTraceId, generateSpanId } from '../utils/telemetry.js';
import { checkLiveness, checkReadiness, checkHealth } from '../controllers/health.controller.js';
import { db } from '../db/client.js';
import { redisConnection } from '../queues/index.js';

describe('Phase 6: Observability & Operability Suite', () => {
  describe('AsyncLocalStorage Request Context (context.ts)', () => {
    it('returns system-background default when outside context', () => {
      expect(getRequestId()).toBe('system-background');
      expect(getCurrentUserId()).toBeUndefined();
      expect(getCurrentSessionId()).toBeUndefined();
    });

    it('propagates requestId, userId, and sessionId within runWithContext', () => {
      runWithContext(
        {
          requestId: 'req-corr-12345',
          userId: 'user-abc',
          sessionId: 'sess-xyz',
        },
        () => {
          expect(getRequestId()).toBe('req-corr-12345');
          expect(getCurrentUserId()).toBe('user-abc');
          expect(getCurrentSessionId()).toBe('sess-xyz');
        },
      );
    });

    it('isolates nested asynchronous context executions', async () => {
      await runWithContext({ requestId: 'parent-req' }, async () => {
        expect(getRequestId()).toBe('parent-req');

        await runWithContext({ requestId: 'child-req' }, async () => {
          expect(getRequestId()).toBe('child-req');
        });

        expect(getRequestId()).toBe('parent-req');
      });
    });
  });

  describe('Prometheus Metrics Registry (metrics.ts)', () => {
    let testRegistry: MetricsRegistry;

    beforeEach(() => {
      testRegistry = new MetricsRegistry();
    });

    it('records and formats counter metrics with labels', () => {
      const counter = new Counter('test_requests_total', 'Total test requests');
      counter.inc({ method: 'GET', status: '200' }, 1);
      counter.inc({ method: 'POST', status: '201' }, 2);

      const prometheusOutput = counter.toPrometheus();
      expect(prometheusOutput).toContain('# HELP test_requests_total Total test requests');
      expect(prometheusOutput).toContain('# TYPE test_requests_total counter');
      expect(prometheusOutput).toContain('test_requests_total{method="GET",status="200"} 1');
      expect(prometheusOutput).toContain('test_requests_total{method="POST",status="201"} 2');
    });

    it('sets, increments, and decrements gauge metrics', () => {
      const gauge = new Gauge('test_active_connections', 'Active test connections');
      gauge.set(10);
      expect(gauge.get()).toBe(10);
      gauge.inc(undefined, 5);
      expect(gauge.get()).toBe(15);
      gauge.dec(undefined, 3);
      expect(gauge.get()).toBe(12);

      const prometheusOutput = gauge.toPrometheus();
      expect(prometheusOutput).toContain('# TYPE test_active_connections gauge');
      expect(prometheusOutput).toContain('test_active_connections 12');
    });

    it('computes histogram buckets, counts, and sums', () => {
      const histogram = new Histogram('test_latency_seconds', 'Test latency', [0.1, 0.5, 1.0]);
      histogram.observe(0.05, { route: '/api/tasks' });
      histogram.observe(0.45, { route: '/api/tasks' });
      histogram.observe(0.85, { route: '/api/tasks' });

      const prometheusOutput = histogram.toPrometheus();
      expect(prometheusOutput).toContain('# TYPE test_latency_seconds histogram');
      expect(prometheusOutput).toContain('test_latency_seconds_bucket{route="/api/tasks",le="0.1"} 1');
      expect(prometheusOutput).toContain('test_latency_seconds_bucket{route="/api/tasks",le="0.5"} 2');
      expect(prometheusOutput).toContain('test_latency_seconds_bucket{route="/api/tasks",le="1"} 3');
      expect(prometheusOutput).toContain('test_latency_seconds_bucket{route="/api/tasks",le="+Inf"} 3');
      expect(prometheusOutput).toContain('test_latency_seconds_count{route="/api/tasks"} 3');
    });

    it('exports complete Prometheus text format via getPrometheusMetrics()', () => {
      const output = getPrometheusMetrics();
      expect(output).toContain('# HELP streamline_http_requests_total');
      expect(output).toContain('# HELP streamline_circuit_breaker_trips_total');
      expect(output).toContain('# HELP streamline_dlq_size');
    });
  });

  describe('OpenTelemetry Distributed Tracing (telemetry.ts)', () => {
    it('generates compliant trace and span IDs', () => {
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      expect(traceId.length).toBe(32);
      expect(spanId.length).toBe(16);
    });

    it('tracks span lifecycles, attributes, and events', () => {
      const span = startSpan('ai.turn_evaluation', {
        kind: 'CLIENT',
        attributes: {
          'gen_ai.system': 'gemini',
          'gen_ai.request.model': 'gemini-3.5-flash-lite',
        },
      });

      span.setAttribute('agent.tool_name', 'get_tasks');
      span.addEvent('tool_dispatched', { target: 'database' });
      const completedSpan = span.end();

      expect(completedSpan.name).toBe('ai.turn_evaluation');
      expect(completedSpan.kind).toBe('CLIENT');
      expect(completedSpan.statusCode).toBe('OK');
      expect(completedSpan.attributes['gen_ai.system']).toBe('gemini');
      expect(completedSpan.attributes['agent.tool_name']).toBe('get_tasks');
      expect(completedSpan.durationMs).toBeGreaterThanOrEqual(0);
      expect(completedSpan.events.length).toBe(1);
    });

    it('captures exceptions cleanly with recordException', () => {
      const span = startSpan('db.query');
      span.recordException(new Error('Connection lost'));
      const completed = span.end();

      expect(completed.statusCode).toBe('ERROR');
      expect(completed.statusMessage).toBe('Connection lost');
      expect(completed.events.some((e) => e.name === 'exception')).toBe(true);
    });

    it('executes functions inside active tracing span using withActiveSpan', async () => {
      const result = await withActiveSpan(
        'service.process_order',
        async (span) => {
          span.setAttribute('order_id', 'ord-999');
          return { success: true };
        },
        { kind: 'INTERNAL' },
      );

      expect(result.success).toBe(true);
      const recent = telemetryRegistry.getRecentSpans(5);
      const orderSpan = recent.find((s) => s.name === 'service.process_order');
      expect(orderSpan).toBeDefined();
      expect(orderSpan?.attributes.order_id).toBe('ord-999');
    });
  });

  describe('Health Probes (health.controller.ts)', () => {
    it('returns 200 OK for fast liveness probe', () => {
      const req: any = {};
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json: vi.fn(),
      };

      checkLiveness(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          uptime: expect.any(Number),
          timestamp: expect.any(String),
        }),
      );
    });

    it('returns ready status when dependencies are healthy', async () => {
      vi.spyOn(db, 'execute').mockResolvedValue([] as any);
      vi.spyOn(redisConnection, 'ping').mockResolvedValue('PONG');

      const req: any = {};
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json: vi.fn(),
      };

      await checkReadiness(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          dependencies: expect.objectContaining({
            postgres: expect.objectContaining({ status: 'up' }),
            redis: expect.objectContaining({ status: 'up' }),
          }),
        }),
      );
    });

    it('returns 503 degraded when a dependency is unreachable', async () => {
      vi.spyOn(db, 'execute').mockRejectedValue(new Error('Connection refused'));
      vi.spyOn(redisConnection, 'ping').mockResolvedValue('PONG');

      const req: any = {};
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json: vi.fn(),
      };

      await checkReadiness(req, res);
      expect(res.statusCode).toBe(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          dependencies: expect.objectContaining({
            postgres: expect.objectContaining({ status: 'down' }),
            redis: expect.objectContaining({ status: 'up' }),
          }),
        }),
      );
    });

    it('returns comprehensive diagnostics across all services in checkHealth', async () => {
      vi.spyOn(db, 'execute').mockResolvedValue([] as any);
      vi.spyOn(redisConnection, 'ping').mockResolvedValue('PONG');

      const req: any = {};
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json: vi.fn(),
      };

      await checkHealth(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          services: expect.objectContaining({
            postgres: expect.objectContaining({ status: 'healthy' }),
            redis: expect.objectContaining({ status: 'healthy' }),
            gemini: expect.any(Object),
          }),
        }),
      );
    });
  });
});
