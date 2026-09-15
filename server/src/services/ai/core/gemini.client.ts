import { GoogleGenAI } from '@google/genai';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { toError } from '../../../utils/errors.js';
import { withRetryAndTimeout } from '../../../utils/resilience.js';
import { AllModelsExhaustedError } from '../../../errors/index.js';

let geminiClientInstance: GoogleGenAI | null = null;

export const PRIMARY_FLASH_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_FLASH_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'];
export const PRIMARY_PRO_MODEL = 'gemini-3.1-pro-preview';
export const FALLBACK_PRO_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];

export function getGeminiClient(): GoogleGenAI | null {
  if (geminiClientInstance) {
    return geminiClientInstance;
  }

  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('⚠️ GEMINI_API_KEY is not configured. AI features will run in mock / fallback mode.');
    return null;
  }

  try {
    geminiClientInstance = new GoogleGenAI({ apiKey });
    logger.info('✨ Google Gen AI (Gemini) client initialized successfully');
    return geminiClientInstance;
  } catch (err: unknown) {
    logger.error({ err: toError(err).message }, '❌ Failed to initialize Google Gen AI client');
    return null;
  }
}

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  models: string[],
  request: any
): Promise<any> {
  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const response = await withRetryAndTimeout(
        async (signal) => {
          return await ai.models.generateContent({
            ...request,
            model,
            config: {
              ...(request.config || {}),
              abortSignal: signal,
            },
          });
        },
        {
          timeoutMs: 15000,
          maxRetries: 1,
          operationName: `gemini_${model}`,
        }
      );
      return response;
    } catch (err: unknown) {
      lastError = toError(err);
      logger.warn({ model, err: lastError.message }, 'Gemini model invocation failed, trying next candidate');
    }
  }

  throw new AllModelsExhaustedError(models, lastError ?? undefined);
}
