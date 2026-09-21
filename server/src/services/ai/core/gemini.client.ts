import { GoogleGenAI } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { toError, AllModelsExhaustedError } from '../../../utils/errors.js';
import { withRetryAndTimeout } from '../../../utils/resilience.js';
import { classifyAiFailureReason, type AiFailureReason } from './failure-classifier.js';

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
  } catch (rawErr: unknown) {
    const err = toError(rawErr);
    logger.error({ err: err.message }, '❌ Failed to initialize Google Gen AI client');
    return null;
  }
}

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  models: string[],
  request: Omit<GenerateContentParameters, 'model'>,
): Promise<GenerateContentResponse> {
  let lastError: Error | null = null;
  let lastReason: AiFailureReason = 'unknown';
  const attemptedModels: string[] = [];
  const attemptReasons: Array<{ model: string; reason: AiFailureReason }> = [];

  for (const model of models) {
    attemptedModels.push(model);
    try {
      const response = await withRetryAndTimeout(
        async (_signal) => {
          return await ai.models.generateContent({
            ...request,
            model,
          });
        },
        {
          timeoutMs: 15000,
          maxRetries: 1,
          backoffBaseMs: 400,
          operationName: `gemini_generate_${model}`,
        },
      );
      return response;
    } catch (rawErr: unknown) {
      const err = toError(rawErr);
      const reason = classifyAiFailureReason(rawErr);
      lastError = err;
      lastReason = reason;
      attemptReasons.push({ model, reason });
      logger.warn(
        { model, reason, err: err.message },
        `Gemini model invocation failed (${reason}), trying next candidate in cascade`,
      );
    }
  }

  // All cascade tiers failed: degrade to typed domain error with clear user-facing explanation
  logger.error(
    { attemptedModels, attemptReasons, lastReason, lastError: lastError?.message },
    `All Gemini cascade fallback candidate tiers failed (last reason: ${lastReason})`,
  );
  throw new AllModelsExhaustedError(attemptedModels, lastError?.message, lastReason, attemptReasons);
}
