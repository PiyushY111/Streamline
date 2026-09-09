import { Type } from '@google/genai';
import { getAiProvider } from './ai.factory.js';
import { saveMemory, MemoryType } from './memory.service.js';
import { PRIMARY_FLASH_MODEL, FALLBACK_FLASH_MODELS } from './gemini.client.js';
import { logger } from '../../utils/logger.js';

export interface ExtractedFactResult {
  hasFact: boolean;
  type?: MemoryType;
  content?: string;
}

export class MemoryExtractionService {
  /**
   * Evaluates an interaction or executed action and extracts at most one durable fact.
   * Decoupled, non-blocking fire-and-forget design.
   */
  async extractMemoryFromInteraction(
    userId: string,
    userMessage: string,
    agentResponse: string,
    sourceRef: string
  ): Promise<void> {
    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      return;
    }

    const prompt = `Given this exchange or executed action between a user and their productivity assistant,
extract at most ONE durable, long-term fact worth remembering across future sessions:
- A user preference (e.g. scheduling constraints, work habits, notification preferences) -> "preference"
- A key architectural or business decision made -> "decision"
- A persistent fact about an active project, codebase, or infrastructure -> "project_fact"

If nothing durable or reusable long-term was established, return { "hasFact": false }.
Do NOT invent facts not present in the exchange.
Do NOT remember ephemeral chatter, greetings, temporary questions, or one-off task statuses.

Interaction:
User / Action Context:
${userMessage}

Assistant / Result Context:
${agentResponse}`;

    try {
      const parsed = await provider.generateStructuredJson<ExtractedFactResult>({
        prompt,
        models: [PRIMARY_FLASH_MODEL, ...FALLBACK_FLASH_MODELS],
        schema: {
          type: Type.OBJECT,
          properties: {
            hasFact: { type: Type.BOOLEAN },
            type: {
              type: Type.STRING,
              enum: ['preference', 'decision', 'project_fact'],
            },
            content: { type: Type.STRING },
          },
          required: ['hasFact'],
        },
      });

      if (parsed?.hasFact && parsed.type && parsed.content) {
        logger.info({ userId, type: parsed.type, fact: parsed.content }, 'Extracted durable memory fact');
        await saveMemory(userId, parsed.type, parsed.content, sourceRef, { checkContradiction: true });
      }
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'Background memory extraction failed, non-fatal');
    }
  }
}

export const memoryExtractionService = new MemoryExtractionService();
export const extractMemoryFromInteraction = memoryExtractionService.extractMemoryFromInteraction.bind(memoryExtractionService);
