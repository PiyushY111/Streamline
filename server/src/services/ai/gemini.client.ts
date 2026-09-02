import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

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
  } catch (err: any) {
    logger.error({ err: err.message }, '❌ Failed to initialize Google Gen AI client');
    return null;
  }
}

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  models: string[],
  request: any
): Promise<any> {
  let lastError: any = null;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        ...request,
        model,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      logger.warn({ model, err: err.message }, 'Gemini model invocation failed, trying next candidate');
    }
  }
  throw lastError;
}
