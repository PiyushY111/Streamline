import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { AiProvider } from './types.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider.js';
import { MockAiProvider } from './providers/mock.provider.js';

let activeProviderInstance: AiProvider | null = null;

export function getAiProvider(preferredProvider?: string): AiProvider {
  if (activeProviderInstance && !preferredProvider) {
    return activeProviderInstance;
  }

  const providerType = preferredProvider || env.AI_PROVIDER || 'gemini';

  switch (providerType.toLowerCase()) {
    case 'gemini': {
      const gemini = new GeminiProvider();
      if (gemini.isAvailable()) {
        activeProviderInstance = gemini;
        return gemini;
      }

      // If Gemini is requested but unavailable, auto-fallback to OpenAI if configured
      if (env.OPENAI_API_KEY) {
        logger.info('🔄 Gemini key missing but OPENAI_API_KEY detected. Auto-switching to OpenAI provider.');
        const openai = new OpenAiCompatibleProvider({ name: 'openai' });
        activeProviderInstance = openai;
        return openai;
      }

      // Default to Gemini instance (will trigger graceful mock fallbacks internally if no key)
      activeProviderInstance = gemini;
      return gemini;
    }

    case 'openai': {
      const openai = new OpenAiCompatibleProvider({
        name: 'openai',
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      });
      activeProviderInstance = openai;
      return openai;
    }

    case 'groq': {
      const groq = new OpenAiCompatibleProvider({
        name: 'groq',
        apiKey: env.GROQ_API_KEY,
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.3-70b-versatile',
      });
      activeProviderInstance = groq;
      return groq;
    }

    case 'mock':
    default: {
      const mock = new MockAiProvider();
      activeProviderInstance = mock;
      return mock;
    }
  }
}

/**
 * Override the active AI provider (useful for unit tests, evals, and multi-model benchmarking).
 */
export function setAiProvider(provider: AiProvider | null): void {
  activeProviderInstance = provider;
}
