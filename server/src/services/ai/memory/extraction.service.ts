import { getAiProvider } from '../core/factory.js';
import { saveMemory, MemoryType } from './memory.service.js';
import { logger } from '../../../utils/logger.js';
import { toError } from '../../../utils/errors.js';

export interface ExtractedFactResult {
  hasFact: boolean;
  type?: MemoryType;
  content?: string;
}

const DANGEROUS_MEMORY_PATTERNS = [
  'ignore previous',
  'system prompt',
  'admin override',
  'dan mode',
  'exfiltrate',
  'always send',
  'forward all',
  'bypass security',
  'unrestricted',
  'secret instruction',
  'api key',
  'password',
];

export function isAdversarialMemoryCandidate(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return DANGEROUS_MEMORY_PATTERNS.some((pattern) => lower.includes(pattern));
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    hasFact: { type: 'boolean', description: 'Whether a durable fact was identified' },
    type: {
      type: 'string',
      enum: ['preference', 'decision', 'project_fact'],
      description: 'Category of durable fact',
    },
    content: {
      type: 'string',
      description: 'The durable fact statement in plain language',
    },
  },
  required: ['hasFact'],
};

export class MemoryExtractionService {
  /**
   * Evaluates an interaction or executed action and extracts at most one durable fact.
   * 100% provider-agnostic, decoupled from proprietary vendor SDKs.
   * Enforces strict write policy: rejects memory poisoning from untrusted external injections.
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

    // Anti-poisoning guard: reject extraction if input contains adversarial injection signatures
    if (isAdversarialMemoryCandidate(userMessage) || isAdversarialMemoryCandidate(agentResponse)) {
      logger.warn({ userId, sourceRef }, 'Memory extraction skipped: adversarial injection pattern detected');
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
        schema: EXTRACTION_SCHEMA,
      });

      if (parsed?.hasFact && parsed.type && parsed.content) {
        // Double-check extracted fact content against poisoning patterns
        if (isAdversarialMemoryCandidate(parsed.content)) {
          logger.warn({ userId, content: parsed.content }, 'Refused to persist extracted memory: failed anti-poisoning validation');
          return;
        }

        logger.info({ userId, type: parsed.type, fact: parsed.content }, 'Extracted durable memory fact');
        await saveMemory(userId, parsed.type, parsed.content, sourceRef, { checkContradiction: true });
      }
    } catch (err: unknown) {
      const error = toError(err);
      logger.warn({ err: error.message, userId }, 'Background memory extraction failed, non-fatal');
    }
  }
}

export const memoryExtractionService = new MemoryExtractionService();
export const extractMemoryFromInteraction = memoryExtractionService.extractMemoryFromInteraction.bind(memoryExtractionService);
