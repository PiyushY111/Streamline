/**
 * Automated PII & Secret Redaction Engine
 *
 * Scans strings and arbitrary object structures for high-entropy secrets,
 * API keys (Google Gemini, OpenAI, Anthropic), Bearer tokens, DB connection strings,
 * and PII before persistence in trace audit tables or client transmission.
 */

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Google API Keys
  { pattern: /AIza[0-9A-Za-z-_]{35}/g, replacement: '[REDACTED_GOOGLE_API_KEY]' },
  // OpenAI API Keys
  { pattern: /sk-[a-zA-Z0-9]{20,48}/g, replacement: '[REDACTED_OPENAI_API_KEY]' },
  // Anthropic API Keys
  { pattern: /sk-ant-[a-zA-Z0-9-_]{40,}/g, replacement: '[REDACTED_ANTHROPIC_API_KEY]' },
  // Bearer Authorization Header tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, replacement: 'Bearer [REDACTED_BEARER_TOKEN]' },
  // Database Connection URIs with passwords
  { pattern: /(postgres|postgresql|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@[^\s/]+/gi, replacement: '$1://[REDACTED_USER_PASSWORD]@[REDACTED_HOST]' },
  // Private SSH / RSA Keys
  { pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  // Generic password assignments in JSON/strings
  { pattern: /("password"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED_PASSWORD]$2' },
  { pattern: /("client_secret"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED_CLIENT_SECRET]$2' },
];

/**
 * Scrub a single string of known secret patterns
 */
export function scrubString(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let scrubbed = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  return scrubbed;
}

/**
 * Deeply scrub any arbitrary JavaScript object, array, or primitive
 */
export function redactSecrets<T = unknown>(target: T, depth = 0): T {
  if (depth > 12) return target; // Prevent cyclic recursion stack overflow
  if (target === null || target === undefined) return target;

  if (typeof target === 'string') {
    return scrubString(target) as unknown as T;
  }

  if (Array.isArray(target)) {
    return target.map((item) => redactSecrets(item, depth + 1)) as unknown as T;
  }

  if (typeof target === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key')
      ) {
        copy[key] = '[REDACTED_CREDENTIAL]';
      } else {
        copy[key] = redactSecrets(value, depth + 1);
      }
    }
    return copy as T;
  }

  return target;
}
