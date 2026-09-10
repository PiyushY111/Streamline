import { env } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';
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

  async chatWithTools(options: {
    messages: import('../types.js').AiChatMessage[];
    systemInstruction?: string;
    tools?: import('../types.js').AiToolDefinition[];
    temperature?: number;
    models?: string[];
  }): Promise<import('../types.js').AiChatTurnResponse> {
    const model = options.models?.[0] || this.defaultModel;
    const messages: any[] = [];

    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }

    for (const m of options.messages) {
      if (m.role === 'user') {
        messages.push({ role: 'user', content: m.content || '' });
      } else if (m.role === 'model') {
        const msgObj: any = { role: 'assistant', content: m.content || null };
        if (m.toolCalls && m.toolCalls.length > 0) {
          msgObj.tool_calls = m.toolCalls.map((tc, idx) => ({
            id: tc.id || `call_${idx}_${Date.now()}`,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args || {}),
            },
          }));
        }
        messages.push(msgObj);
      } else if (m.role === 'tool') {
        messages.push({
          role: 'tool',
          tool_call_id: m.toolCalls?.[0]?.id || `call_${m.toolName || 'tool'}`,
          content: typeof m.toolResult === 'string' ? m.toolResult : JSON.stringify(m.toolResult || {}),
        });
      }
    }

    const payload: any = {
      model,
      messages,
      temperature: options.temperature ?? 0.2,
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible chatWithTools failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const msg = data.choices?.[0]?.message;

    const toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }> = [];
    if (msg?.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function?.name,
          args: parsedArgs,
        });
      }
    }

    return {
      text: msg?.content || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

