import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import type {
  AiProvider,
  AiGenerateTextOptions,
  AiStructuredJsonOptions,
  AiStreamTextOptions,
  AiEmbeddingOptions,
} from '../types.js';

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultEmbeddingModel: string;

  constructor(options?: {
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    defaultEmbeddingModel?: string;
  }) {
    this.name = options?.name || 'openai';
    this.apiKey = options?.apiKey || env.OPENAI_API_KEY || env.GROQ_API_KEY || '';
    this.baseUrl = (options?.baseUrl || env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.defaultModel = options?.defaultModel || (this.name === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
    this.defaultEmbeddingModel = options?.defaultEmbeddingModel || 'text-embedding-3-small';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey || this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1'));
  }

  async generateText(options: AiGenerateTextOptions): Promise<string> {
    const model = options.models?.[0] || this.defaultModel;
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible generateText failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateStructuredJson<T = any>(options: AiStructuredJsonOptions<T>): Promise<T> {
    const model = options.models?.[0] || this.defaultModel;
    const messages: Array<{ role: string; content: string }> = [];

    const systemInstructions = (options.systemPrompt || '') +
      '\nIMPORTANT: Return ONLY valid JSON matching the requested structure without any markdown backticks or commentary.';

    messages.push({ role: 'system', content: systemInstructions });
    messages.push({ role: 'user', content: options.prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible generateStructuredJson failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content) as T;
  }

  async streamText(
    options: AiStreamTextOptions,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const model = options.models?.[0] || this.defaultModel;
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.3,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible streamText failed (${response.status}): ${errText}`);
    }

    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') break;

        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk(delta);
            }
          } catch {
            // Non-fatal parse warning for partial SSE packets
          }
        }
      }
    }

    return fullText;
  }

  async generateEmbedding(text: string, options?: AiEmbeddingOptions): Promise<number[]> {
    const model = options?.model || this.defaultEmbeddingModel;
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        dimensions: options?.dimensions,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible generateEmbedding failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    return data.data?.[0]?.embedding || [];
  }
}
