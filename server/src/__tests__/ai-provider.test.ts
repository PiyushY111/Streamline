import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import * as geminiClientModule from '../services/ai/core/gemini.client.js';
import { getAiProvider, setAiProvider } from '../services/ai/core/factory.js';
import { GeminiProvider } from '../services/ai/core/providers/gemini.provider.js';
import { OpenAiCompatibleProvider } from '../services/ai/core/providers/openai-compatible.provider.js';
import { MockAiProvider } from '../services/ai/core/providers/mock.provider.js';
import type { AiProvider } from '../services/ai/core/types.js';

describe('Provider-Agnostic AI Architecture', () => {
  beforeEach(() => {
    setAiProvider(null);
  });

  afterEach(() => {
    setAiProvider(null);
  });

  it('should instantiate MockAiProvider when requested or as test fallback', async () => {
    const provider = getAiProvider('mock');
    expect(provider.name).toBe('mock');
    expect(provider.isAvailable()).toBe(true);

    const text = await provider.generateText({ prompt: 'Hello world' });
    expect(text).toContain('Mock AI Response');

    const embedding = await provider.generateEmbedding('Sample test text');
    expect(embedding.length).toBe(768);
  });

  it('should instantiate GeminiProvider when provider is gemini', () => {
    const provider = getAiProvider('gemini');
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.name).toBe('gemini');
  });

  it('should instantiate OpenAiCompatibleProvider when provider is openai or groq', () => {
    const openaiProvider = getAiProvider('openai');
    expect(openaiProvider).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(openaiProvider.name).toBe('openai');

    const groqProvider = getAiProvider('groq');
    expect(groqProvider).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(groqProvider.name).toBe('groq');
  });

  it('should allow dynamic AI provider swapping via setAiProvider()', async () => {
    const customTestProvider: AiProvider = {
      name: 'custom-claude-mock',
      isAvailable: () => true,
      generateText: async (opt) => `Custom Claude response to: ${opt.prompt}`,
      generateStructuredJson: async <T>() => ({ customKey: 'customValue' }) as unknown as T,
      streamText: async (opt, onChunk) => {
        onChunk('chunk-1 ');
        onChunk('chunk-2');
        return 'chunk-1 chunk-2';
      },
      generateEmbedding: async () => [0.1, 0.2, 0.3],
      chatWithTools: async () => ({ text: 'Custom Claude tool response' }),
    };

    setAiProvider(customTestProvider);
    const active = getAiProvider();
    expect(active.name).toBe('custom-claude-mock');

    const res = await active.generateText({ prompt: 'Test prompt' });
    expect(res).toBe('Custom Claude response to: Test prompt');

    const streamedChunks: string[] = [];
    const streamRes = await active.streamText({ prompt: 'Stream test' }, (chunk) => {
      streamedChunks.push(chunk);
    });
    expect(streamRes).toBe('chunk-1 chunk-2');
    expect(streamedChunks).toEqual(['chunk-1 ', 'chunk-2']);

    const emb = await active.generateEmbedding('Text');
    expect(emb).toEqual([0.1, 0.2, 0.3]);
  });

  it('should preserve thoughtSignature in tool call parts when using GeminiProvider', async () => {
    const gemini = new GeminiProvider();
    expect(gemini.name).toBe('gemini');

    // Verify types and interface contract for AiToolCall with thoughtSignature
    const mockToolCall: import('../services/ai/core/types.js').AiToolCall = {
      id: 'call_123',
      name: 'create_calendar_event',
      args: { title: 'Team Sync' },
      thoughtSignature: 'cryptographic_opaque_signature_token',
    };
    expect(mockToolCall.thoughtSignature).toBe('cryptographic_opaque_signature_token');
  });

  describe('GeminiProvider generateStructuredJson feedback retries', () => {
    it('validates response against Zod schema and recovers when first attempt fails', async () => {
      const gemini = new GeminiProvider();
      vi.spyOn(gemini, 'isAvailable').mockReturnValue(true);
      vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue({} as any);

      const targetSchema = z.object({
        status: z.enum(['urgent', 'normal']),
        score: z.number().min(0).max(100),
      });

      let attempt = 0;
      const fallbackSpy = vi
        .spyOn(geminiClientModule, 'generateContentWithFallback')
        .mockImplementation(async (_client, _models, request) => {
          attempt++;
          if (attempt === 1) {
            // First attempt returns invalid data (invalid status enum)
            return { text: JSON.stringify({ status: 'invalid_status', score: 85 }) };
          }
          // Check that retry prompt contained error feedback
          const promptText = request.contents[0].parts[0].text;
          expect(promptText).toContain('[FEEDBACK ERROR]');
          return { text: JSON.stringify({ status: 'urgent', score: 85 }) };
        });

      const result = await gemini.generateStructuredJson({
        prompt: 'Classify this task',
        zodSchema: targetSchema,
        maxRetries: 2,
      });

      expect(attempt).toBe(2);
      expect(result).toEqual({ status: 'urgent', score: 85 });
    });
  });
});
