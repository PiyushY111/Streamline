import { GoogleGenAI } from '@google/genai';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import type {
  AiProvider,
  AiGenerateTextOptions,
  AiStructuredJsonOptions,
  AiStreamTextOptions,
  AiEmbeddingOptions,
} from '../types.js';
import {
  PRIMARY_FLASH_MODEL,
  FALLBACK_FLASH_MODELS,
  generateContentWithFallback,
  getGeminiClient,
} from '../gemini.client.js';

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  isAvailable(): boolean {
    return Boolean(env.GEMINI_API_KEY && getGeminiClient());
  }

  async generateText(options: AiGenerateTextOptions): Promise<string> {
    const client = getGeminiClient();
    if (!client) {
      throw new Error('Gemini client not available (missing GEMINI_API_KEY)');
    }

    const models = options.models || [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS];
    const contents: any[] = [];
    if (options.systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: `${options.systemPrompt}\n\n${options.prompt}` }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: options.prompt }] });
    }

    const response = await generateContentWithFallback(client, models, {
      contents,
      config: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
    });

    return response.text || '';
  }

  async generateStructuredJson<T = any>(options: AiStructuredJsonOptions<T>): Promise<T> {
    const client = getGeminiClient();
    if (!client) {
      throw new Error('Gemini client not available (missing GEMINI_API_KEY)');
    }

    const models = options.models || [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS];
    const contents: any[] = [];
    if (options.systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: `${options.systemPrompt}\n\n${options.prompt}` }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: options.prompt }] });
    }

    const response = await generateContentWithFallback(client, models, {
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: options.schema,
      },
    });

    return JSON.parse(response.text || '{}') as T;
  }

  async streamText(
    options: AiStreamTextOptions,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const client = getGeminiClient();
    if (!client) {
      throw new Error('Gemini client not available (missing GEMINI_API_KEY)');
    }

    const candidateModels = options.models || [
      PRIMARY_FLASH_MODEL,
      ...FALLBACK_FLASH_MODELS,
      'gemini-3.7-flash',
      'gemini-3.5-flash',
    ];

    let fullText = '';
    let succeeded = false;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
          config: {
            temperature: options.temperature,
          },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            fullText += chunk.text;
            onChunk(chunk.text);
          }
        }
        succeeded = true;
        break;
      } catch (err: any) {
        lastError = err;
        logger.warn({ model, err: err.message }, 'Gemini streaming attempt failed, trying next candidate');
      }
    }

    if (!succeeded) {
      // Final non-streaming fallback
      try {
        const response = await client.models.generateContent({
          model: PRIMARY_FLASH_MODEL,
          contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
        });
        if (response.text) {
          fullText = response.text;
          onChunk(response.text);
          return fullText;
        }
      } catch (fallbackErr: any) {
        throw lastError || fallbackErr;
      }
    }

    return fullText;
  }

  async generateEmbedding(text: string, options?: AiEmbeddingOptions): Promise<number[]> {
    const client = getGeminiClient();
    if (!client) {
      throw new Error('Gemini client not available (missing GEMINI_API_KEY)');
    }

    const model = options?.model || 'text-embedding-004';
    try {
      const response = await client.models.embedContent({
        model,
        contents: text,
      });

      const resAny = response as any;
      const values: number[] = resAny.embedding?.values || resAny.embeddings?.[0]?.values || [];
      if (!values || values.length === 0) {
        throw new Error('No embedding vector values returned from Gemini');
      }
      return values;
    } catch (err: any) {
      logger.error({ err: err.message, model }, 'Failed to generate vector embedding with Gemini');
      throw err;
    }
  }

  async chatWithTools(options: {
    messages: import('../types.js').AiChatMessage[];
    systemInstruction?: string;
    tools?: import('../types.js').AiToolDefinition[];
    temperature?: number;
    models?: string[];
  }): Promise<import('../types.js').AiChatTurnResponse> {
    const client = getGeminiClient();
    if (!client) {
      throw new Error('Gemini client not available (missing GEMINI_API_KEY)');
    }

    const candidateModels = options.models || [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS];

    const contents = options.messages.map((m) => {
      if (m.role === 'user') {
        return { role: 'user', parts: [{ text: m.content || '' }] };
      }
      if (m.role === 'model') {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.args || {},
              },
            });
          }
        }
        return { role: 'model', parts: parts.length > 0 ? parts : [{ text: '' }] };
      }
      if (m.role === 'tool') {
        return {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.toolName || 'tool',
                response: { output: m.toolResult },
              },
            },
          ],
        };
      }
      return { role: 'user', parts: [{ text: m.content || '' }] };
    });

    const config: any = {
      temperature: options.temperature ?? 0.2,
    };

    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    if (options.tools && options.tools.length > 0) {
      config.tools = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const response = await generateContentWithFallback(client, candidateModels, {
      contents,
      config,
    });

    const toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }> = [];
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const fc of response.functionCalls) {
        toolCalls.push({
          name: fc.name,
          args: (fc.args as Record<string, unknown>) || {},
        });
      }
    }

    return {
      text: response.text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

