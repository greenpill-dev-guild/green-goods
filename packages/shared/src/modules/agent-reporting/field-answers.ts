import type { WorkInput } from "../../types/domain";

/**
 * Deterministic interpretation of chat answers against an Action's own `inputs` declaration.
 *
 * This is the floor that works with every model disabled. It never coerces: a non-numeric answer
 * to a number field is rejected, a stated unit that differs from the field's unit produces a
 * question rather than a conversion, and a repeater is refused honestly instead of guessed at.
 */
export type DetailCheck =
  | { ok: true; value: string | number | string[] }
  | { ok: false; reason: "invalid_value" | "unsupported_input" };

export type AnswerFailure =
  | "empty"
  | "not_a_number"
  | "ambiguous_number"
  | "negative"
  | "unit_mismatch"
  | "unit_required"
  | "unknown_option"
  | "too_long"
  | "unsupported_input";

export type AnswerResult =
  | { ok: true; value: string | number | string[]; original: string; statedUnit?: string }
  | { ok: false; reason: AnswerFailure; statedUnit?: string };

export const MAX_DETAIL_TEXT_LENGTH = 2_000;

function choicesFor(input: WorkInput): string[] {
  return input.type === "band" ? (input.bands ?? input.options) : input.options;
}

function labelFor(input: WorkInput, key: string): string {
  const labels = input.type === "band" ? input.bandLabels : input.optionLabels;
  return labels?.[key] ?? key;
}

export function validateDetailValue(input: WorkInput, value: unknown): DetailCheck {
  switch (input.type) {
    case "repeater":
      return { ok: false, reason: "unsupported_input" };
    case "number":
      return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? { ok: true, value }
        : { ok: false, reason: "invalid_value" };
    case "select":
    case "band":
      return typeof value === "string" && choicesFor(input).includes(value)
        ? { ok: true, value }
        : { ok: false, reason: "invalid_value" };
    case "multi-select": {
      if (!Array.isArray(value) || value.length === 0)
        return { ok: false, reason: "invalid_value" };
      const unique = [...new Set(value)];
      return unique.every((item) => typeof item === "string" && input.options.includes(item))
        ? { ok: true, value: unique as string[] }
        : { ok: false, reason: "invalid_value" };
    }
    default: {
      if (typeof value !== "string") return { ok: false, reason: "invalid_value" };
      const text = value.trim();
      return text.length > 0 && text.length <= MAX_DETAIL_TEXT_LENGTH
        ? { ok: true, value: text }
        : { ok: false, reason: "invalid_value" };
    }
  }
}

// Only the number is matched; what follows it is read on its own. One pattern for both lets two
// of its parts claim the same digits or spaces, which takes quadratic time on a long chat message.
const NUMBER_START = /^(-?)(\d+)(?:([.,])(\d+))?/u;
const LINE_BREAK = /[\n\r\p{Zl}\p{Zp}]/u;

function singular(word: string): string {
  const lower = word.trim().toLowerCase();
  return lower.length > 3 && lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

/** Parses "12", "2.5", "2,5" and "12 kg". "1.200" is ambiguous across locales, so it is asked. */
export function parseNumberAnswer(
  answer: string,
  expectedUnit?: string
): (AnswerResult & { ok: true; value: number }) | Extract<AnswerResult, { ok: false }> {
  const text = answer.trim();
  if (!text) return { ok: false, reason: "empty" };
  const match = NUMBER_START.exec(text);
  // The unit is the rest of the number's line, or the one line after it: more lines are not a unit.
  const statedUnit = match ? text.slice(match[0].length).trimStart() : "";
  if (!match || LINE_BREAK.test(statedUnit)) return { ok: false, reason: "not_a_number" };
  const [, sign, whole, separator, fraction] = match;
  if (separator && fraction?.length === 3) return { ok: false, reason: "ambiguous_number" };
  const value = Number(`${whole}${fraction ? `.${fraction}` : ""}`);
  if (sign) return { ok: false, reason: "negative" };
  if (statedUnit && expectedUnit && singular(statedUnit) !== singular(expectedUnit)) {
    return { ok: false, reason: "unit_mismatch", statedUnit };
  }
  return { ok: true, value, original: text, ...(statedUnit ? { statedUnit } : {}) };
}

function matchChoice(input: WorkInput, token: string, presented: readonly string[]): string | null {
  const needle = token.trim().toLowerCase();
  if (!needle) return null;
  if (/^\d+$/.test(needle)) {
    const index = Number(needle) - 1;
    return presented[index] ?? null;
  }
  return (
    choicesFor(input).find(
      (key) => key.toLowerCase() === needle || labelFor(input, key).toLowerCase() === needle
    ) ?? null
  );
}

/**
 * Interprets one answer to one field. `presented` lists the option keys in the order the
 * question numbered them, so "2" means the second option actually shown on that page.
 */
export function parseFieldAnswer(
  input: WorkInput,
  answer: string,
  presented: readonly string[] = choicesFor(input)
): AnswerResult {
  const text = answer.trim();
  if (input.type === "repeater") return { ok: false, reason: "unsupported_input" };
  if (!text) return { ok: false, reason: "empty" };
  switch (input.type) {
    case "number":
      return parseNumberAnswer(text, input.unit);
    case "select":
    case "band": {
      const choice = matchChoice(input, text, presented);
      return choice
        ? { ok: true, value: choice, original: text }
        : { ok: false, reason: "unknown_option" };
    }
    case "multi-select": {
      // Split on the separator alone and trim afterwards: a separator that also swallowed the
      // spaces around it took quadratic time on a long run of spaces.
      const tokens = text
        .split(/,|;|\band\b|\by\b|\be\b/iu)
        .map((token) => token.trim())
        .filter(Boolean);
      const choices = tokens.map((token) => matchChoice(input, token, presented));
      if (choices.length === 0 || choices.some((choice) => choice === null)) {
        return { ok: false, reason: "unknown_option" };
      }
      return { ok: true, value: [...new Set(choices as string[])], original: text };
    }
    default:
      return text.length <= MAX_DETAIL_TEXT_LENGTH
        ? { ok: true, value: text, original: text }
        : { ok: false, reason: "too_long" };
  }
}

const HOUR_WORDS = /^(h|hr|hrs|hour|hours|hora|horas)$/iu;
const MINUTE_WORDS = /^(m|min|mins|minute|minutes|minuto|minutos)$/iu;

/**
 * Normalizes a stated duration to whole minutes, keeping the stated unit for provenance.
 * A bare number has no unit, so it asks instead of assuming hours or minutes.
 */
export function parseDurationAnswer(
  answer: string
):
  | { ok: true; minutes: number; original: string; unit: "hours" | "minutes" }
  | Extract<AnswerResult, { ok: false }> {
  const text = answer.trim().toLowerCase();
  if (!text) return { ok: false, reason: "empty" };
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  if (clock) {
    return {
      ok: true,
      minutes: Number(clock[1]) * 60 + Number(clock[2]),
      original: answer.trim(),
      unit: "hours",
    };
  }
  const compound =
    /^(\d+)\s*(?:h|hr|hrs|hours?|horas?)\s*(\d+)\s*(?:m|min|mins|minutes?|minutos?)?$/iu.exec(text);
  if (compound) {
    return {
      ok: true,
      minutes: Number(compound[1]) * 60 + Number(compound[2]),
      original: answer.trim(),
      unit: "hours",
    };
  }
  const parsed = parseNumberAnswer(text);
  if (!parsed.ok) return parsed;
  const unit = parsed.statedUnit ?? "";
  if (!unit) return { ok: false, reason: "unit_required" };
  if (HOUR_WORDS.test(unit)) {
    return {
      ok: true,
      minutes: Math.round(parsed.value * 60),
      original: answer.trim(),
      unit: "hours",
    };
  }
  if (MINUTE_WORDS.test(unit)) {
    return {
      ok: true,
      minutes: Math.round(parsed.value),
      original: answer.trim(),
      unit: "minutes",
    };
  }
  return { ok: false, reason: "unit_mismatch", statedUnit: unit };
}

/** Pages a choice list for providers whose list messages hold a limited number of rows. */
export function pageChoices(
  input: WorkInput,
  page: number,
  pageSize: number
): { keys: string[]; labels: string[]; hasMore: boolean } {
  const all = choicesFor(input);
  const start = Math.max(0, page) * pageSize;
  const keys = all.slice(start, start + pageSize);
  return {
    keys,
    labels: keys.map((key) => labelFor(input, key)),
    hasMore: start + pageSize < all.length,
  };
}
