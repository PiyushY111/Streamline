import type { Content, EmbedContentResponse, FunctionCall, GenerateContentConfig, Part, Schema } from '@google/genai';
import { env } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';
import { toError } from '../../../../utils/errors.js';
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

/** Some Gemini API responses include a legacy snake_case `thought_signature` field not in the current SDK types. */
type PartWithLegacyThoughtSignature = Part & { thought_signature?: string };
type FunctionCallWithLegacyThoughtSignature = FunctionCall & {
  thoughtSignature?: string;
  thought_signature?: string;
};

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
    const contents: Content[] = [];
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

  async generateStructuredJson<T = unknown>(options: AiStructuredJsonOptions<T>): Promise<T> {
    const client = getGeminiClient();
    if (!client) {
      throw new Error('Gemini client not available (missing GEMINI_API_KEY)');
    }

    const models = options.models || [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS];
    const maxRetries = options.maxRetries ?? 2;
    let currentPrompt = options.prompt;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const contents: Content[] = [];
        if (options.systemPrompt) {
          contents.push({ role: 'user', parts: [{ text: `${options.systemPrompt}\n\n${currentPrompt}` }] });
        } else {
          contents.push({ role: 'user', parts: [{ text: currentPrompt }] });
        }

        const response = await generateContentWithFallback(client, models, {
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: options.schema as GenerateContentConfig['responseSchema'],
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens,
          },
        });

        const rawText = response.text || '{}';
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawText);
        } catch (rawJsonErr: unknown) {
          const jsonErr = toError(rawJsonErr);
          if (attempt < maxRetries) {
            logger.warn(
              { attempt, error: jsonErr.message },
              'Gemini JSON parse failed, retrying with correction feedback',
            );
            currentPrompt = `${options.prompt}\n\n[FEEDBACK ERROR]: Your previous output was malformed JSON: ${jsonErr.message}. Output strictly valid JSON conforming to the schema.`;
            continue;
          }
          throw jsonErr;
        }

        if (options.zodSchema) {
          const parseResult = options.zodSchema.safeParse(parsedJson);
          if (!parseResult.success) {
            const formattedIssues = JSON.stringify(parseResult.error.format());
            if (attempt < maxRetries) {
              logger.warn(
                { attempt, formattedIssues },
                'Gemini output failed Zod schema validation, retrying with feedback',
              );
              currentPrompt = `${options.prompt}\n\n[FEEDBACK ERROR]: Your previous JSON output failed schema validation:\n${formattedIssues}\nPlease correct all validation errors and return strictly valid JSON matching the schema.`;
              continue;
            }
            throw new Error(`Structured JSON validation failed after ${maxRetries} retries: ${formattedIssues}`);
          }
          return parseResult.data;
        }

        return parsedJson as T;
      } catch (rawErr: unknown) {
        lastError = rawErr;
        if (attempt >= maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Structured JSON generation failed');
  }

  async streamText(options: AiStreamTextOptions, onChunk: (chunk: string) => void): Promise<string> {
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
    let lastError: Error | null = null;

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
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
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
      } catch (rawFallbackErr: unknown) {
        const fallbackErr = toError(rawFallbackErr);
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

    const targetDims = options?.dimensions || 768;
    const modelCandidates = [options?.model || 'gemini-embedding-001', 'gemini-embedding-2', 'text-embedding-004'];

    let lastError: Error | null = null;
    for (const model of modelCandidates) {
      try {
        // `embedding` (singular) isn't in the SDK's current EmbedContentResponse type but has
        // been observed from some API versions/backends; kept as a fallback alongside the
        // documented `embeddings` (plural) field.
        const response: EmbedContentResponse & { embedding?: { values?: number[] } } = await client.models.embedContent(
          {
            model,
            contents: text,
            config: {
              outputDimensionality: targetDims,
            },
          },
        );

        const values: number[] = response.embedding?.values || response.embeddings?.[0]?.values || [];
        if (values && values.length > 0) {
          return values.length > targetDims ? values.slice(0, targetDims) : values;
        }
      } catch (rawErr: unknown) {
        lastError = toError(rawErr);
      }
    }

    logger.error({ err: lastError?.message }, 'Failed to generate vector embedding with Gemini');
    throw lastError || new Error('No embedding vector values returned from Gemini');
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
        const parts: Part[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            const functionCall: FunctionCall = { name: tc.name, args: tc.args || {} };
            if (tc.id) {
              functionCall.id = tc.id;
            }
            const partObj: Part = { functionCall };
            if (tc.thoughtSignature) {
              partObj.thoughtSignature = tc.thoughtSignature;
            }
            parts.push(partObj);
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

    const config: GenerateContentConfig = {
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
            // AiToolDefinition.parameters is a provider-agnostic JSON-Schema-shaped object;
            // it is already constructed to conform to Gemini's Schema shape at the call sites.
            parameters: t.parameters as unknown as Schema,
          })),
        },
      ];
    }

    const response = await generateContentWithFallback(client, candidateModels, {
      contents,
      config,
    });

    const toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }> =
      [];
    const candidateParts = response.candidates?.[0]?.content?.parts || [];
    for (const part of candidateParts) {
      if (part.functionCall) {
        const legacyPart = part as PartWithLegacyThoughtSignature;
        const legacyFunctionCall = part.functionCall as FunctionCallWithLegacyThoughtSignature;
        const thoughtSignature =
          part.thoughtSignature ||
          legacyPart.thought_signature ||
          legacyFunctionCall.thoughtSignature ||
          legacyFunctionCall.thought_signature;

        toolCalls.push({
          id: part.functionCall.id,
          name: part.functionCall.name || '',
          args: part.functionCall.args || {},
          thoughtSignature,
        });
      }
    }

    if (toolCalls.length === 0 && response.functionCalls && response.functionCalls.length > 0) {
      for (const fc of response.functionCalls) {
        toolCalls.push({
          id: fc.id,
          name: fc.name || '',
          args: fc.args || {},
        });
      }
    }

    const promptTokens = response.usageMetadata?.promptTokenCount;
    const completionTokens = response.usageMetadata?.candidatesTokenCount;
    const totalTokens = response.usageMetadata?.totalTokenCount;

    return {
      text: response.text || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: PRIMARY_FLASH_MODEL,
      usage: promptTokens !== undefined ? { promptTokens, completionTokens, totalTokens } : undefined,
    };
  }
}
