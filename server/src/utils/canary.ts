import crypto from 'crypto';
import { logger } from './logger.js';
import { auditService } from '../services/audit.service.js';

export interface PromptInjectionScanResult {
  flagged: boolean;
  matchedPatterns: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'critical';
}

export interface CanaryScanResult {
  detected: boolean;
  detectedTokens: string[];
}

/**
 * Common high-risk prompt injection heuristics and system prompt override signatures.
 */
const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string; risk: 'low' | 'medium' | 'critical' }> = [
  {
    pattern:
      /(?:ignore|disregard|forget|bypass)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|directives)/i,
    name: 'instruction_override',
    risk: 'critical',
  },
  {
    pattern:
      /(?:reveal|output|print|display|dump|leak)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|hidden\s+instructions|secret\s+key|api\s+key)/i,
    name: 'system_prompt_exfiltration',
    risk: 'critical',
  },
  {
    pattern:
      /(?:you\s+are\s+now\s+in\s+DAN\s+mode|developer\s+mode\s+enabled|jailbreak\s+active|unfiltered\s+mode|unrestricted\s+ai)/i,
    name: 'jailbreak_persona_adoption',
    risk: 'critical',
  },
  {
    pattern: /---+\s*END\s+(?:OF\s+)?SYSTEM\s+(?:PROMPT|INSTRUCTIONS?)\s*---+/i,
    name: 'delimiter_tampering',
    risk: 'critical',
  },
  {
    pattern: /(?:<\|im_start\|>|<\|im_end\|>|\[INST\]\s*<<SYS>>)/i,
    name: 'special_token_injection',
    risk: 'critical',
  },
  {
    pattern: /!\[(?:.*?)]\((?:https?:\/\/[^\s)]+\?(?:token|cookie|secret|leak|data)=[^\s)]+)\)/i,
    name: 'markdown_image_exfiltration',
    risk: 'critical',
  },
  {
    pattern: /(?:act\s+as\s+an\s+unrestricted|pretend\s+you\s+have\s+no\s+safety\s+guidelines)/i,
    name: 'safety_bypass_attempt',
    risk: 'medium',
  },
  {
    pattern: /(?:execute\s+arbitrary\s+shell|sudo\s+rm\s+-rf|DROP\s+TABLE\s+users)/i,
    name: 'malicious_command_simulation',
    risk: 'medium',
  },
];

/**
 * Generate a unique, cryptographically secure synthetic canary token.
 */
export function generateCanaryToken(prefix: string = 'STREAMLINE_CANARY'): string {
  const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  return `${prefix}_${uniqueSuffix}`;
}

/**
 * Scan content for known prompt injection signatures.
 */
export function scanForPromptInjection(content: string): PromptInjectionScanResult {
  if (!content || typeof content !== 'string') {
    return { flagged: false, matchedPatterns: [], riskLevel: 'none' };
  }

  const matchedPatterns: string[] = [];
  let maxRiskLevel: 'none' | 'low' | 'medium' | 'critical' = 'none';

  for (const item of PROMPT_INJECTION_PATTERNS) {
    if (item.pattern.test(content)) {
      matchedPatterns.push(item.name);
      if (item.risk === 'critical') {
        maxRiskLevel = 'critical';
      } else if (item.risk === 'medium' && maxRiskLevel !== 'critical') {
        maxRiskLevel = 'medium';
      } else if (item.risk === 'low' && maxRiskLevel === 'none') {
        maxRiskLevel = 'low';
      }
    }
  }

  return {
    flagged: matchedPatterns.length > 0,
    matchedPatterns,
    riskLevel: maxRiskLevel,
  };
}

/**
 * Scan content to detect if planted synthetic canary tokens are present.
 */
export function scanForCanaryTokens(content: string, canaryTokens: string[]): CanaryScanResult {
  if (!content || !Array.isArray(canaryTokens) || canaryTokens.length === 0) {
    return { detected: false, detectedTokens: [] };
  }

  const detectedTokens = canaryTokens.filter((token) => token && content.includes(token));

  return {
    detected: detectedTokens.length > 0,
    detectedTokens,
  };
}

/**
 * Evaluates input content, logs security alerts, and publishes audit log events if injection or canary is flagged.
 */
export async function guardAndAlertIngestion(
  userId: string,
  content: string,
  sourceContext: { source: string; emailId?: string; sessionId?: string; metadata?: Record<string, unknown> },
): Promise<PromptInjectionScanResult> {
  const result = scanForPromptInjection(content);

  if (result.flagged) {
    logger.warn(
      {
        userId,
        riskLevel: result.riskLevel,
        matchedPatterns: result.matchedPatterns,
        source: sourceContext.source,
        sessionId: sourceContext.sessionId,
      },
      '🚨 Security Alert: Prompt injection or system prompt override attempt detected in ingestion payload',
    );

    await auditService.logAction(userId, 'agent.security.prompt_injection_flagged', {
      riskLevel: result.riskLevel,
      matchedPatterns: result.matchedPatterns,
      source: sourceContext.source,
      emailId: sourceContext.emailId,
      sessionId: sourceContext.sessionId,
      contextSnippet: content.substring(0, 150),
    });
  }

  return result;
}
