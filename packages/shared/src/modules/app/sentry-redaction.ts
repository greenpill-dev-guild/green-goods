const REDACTED = "[REDACTED]";
const REDACTED_EMAIL = "[REDACTED_EMAIL]";
const REDACTED_TOKEN = "[REDACTED_TOKEN]";
const REDACTED_WALLET = "[REDACTED_WALLET]";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const WALLET_PATTERN = /0x[a-fA-F0-9]{40}/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/g;
const MAX_STRING_LENGTH = 4_000;
const MAX_ARRAY_LENGTH = 50;
const MAX_DEPTH = 8;

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|token|secret|password|private|session|jwt|api[_-]?key|platform[_-]?id|sender|wallet|address|email|distinct|replay|user[_-]?id|chat[_-]?id|thread[_-]?id)/i;

export type RedactedSentryValue =
  | null
  | boolean
  | number
  | string
  | RedactedSentryValue[]
  | { [key: string]: RedactedSentryValue };

export function redactSentryString(value: string): string {
  return value
    .replace(JWT_PATTERN, REDACTED_TOKEN)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(WALLET_PATTERN, REDACTED_WALLET)
    .replace(URL_PATTERN, redactUrl)
    .slice(0, MAX_STRING_LENGTH);
}

export function sanitizeSentryValue(value: unknown): RedactedSentryValue {
  return sanitizeValue(value, 0, new WeakSet<object>());
}

export function sanitizeSentryContext(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeSentryValue(value) as Record<string, unknown>;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${redactSentryString(url.pathname)}`;
  } catch {
    return REDACTED;
  }
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): RedactedSentryValue {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") return redactSentryString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return String(value);

  if (depth >= MAX_DEPTH) return "[REDACTED_DEPTH]";

  if (value instanceof Error) {
    return {
      name: redactSentryString(value.name),
      message: redactSentryString(value.message),
      stack: value.stack ? redactSentryString(value.stack) : null,
    };
  }

  if (value instanceof URL) return redactUrl(value.toString());
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((entry) => sanitizeValue(entry, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[REDACTED_CIRCULAR]";
    seen.add(value);

    const output: Record<string, RedactedSentryValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const safeKey = redactSentryString(key);
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[safeKey] = REDACTED;
        continue;
      }
      output[safeKey] = sanitizeValue(entry, depth + 1, seen);
    }
    return output;
  }

  return REDACTED;
}
