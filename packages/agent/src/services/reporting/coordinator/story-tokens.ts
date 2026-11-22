import { parseNumberAnswer } from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import * as W from "./story-words";

/**
 * The pieces the reader that needs no model reads a message in: its words and numbers in order,
 * with the clause breaks between them, and the durations and choice names they spell.
 */
export interface Token {
  word: string;
  raw: string;
  start: number;
  end: number;
  kind: "word" | "number" | "glued" | "date" | "mark" | "break";
  capital: boolean;
}

const TOKEN =
  /(\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?|\d{1,2}:\d{2})|(\d+(?:[.,]\d+)?)(?![\p{L}\d%º°ª])|(\d+(?:[.,]\d+)?[\p{L}%º°ª][\p{L}\d%º°ª]*)|([\p{L}\p{M}'’]+)|([:=&%+<>~≈±])|([!?;\n¿¡]+|(?<!\d)[.,]|[.,](?!\d))/gu;

export function tokenize(text: string): Token[] {
  const kinds = ["date", "number", "glued", "word", "mark", "break"] as const;
  return [...text.matchAll(TOKEN)].map((match) => {
    const group = match.slice(1).findIndex((part) => part !== undefined);
    const raw = match[0];
    return {
      word: W.wordKey(raw),
      raw,
      start: match.index,
      end: match.index + raw.length,
      kind: kinds[group] ?? "mark",
      capital: /^\p{Lu}/u.test(raw),
    };
  });
}

const GENERIC = new Set(["count", "total", "number", "amount", "value", "type", "tag", "band"]);
export const numeric = (token: Token | undefined) =>
  token?.kind === "number" || token?.kind === "glued";
const GLUED_HOURS = /^(\d+)h(\d{1,2})$/u;
const GLUED_UNIT = /^(\d+(?:[.,]\d+)?)([\p{L}]+)$/u;

/** The words of each field's title and key that no other field of the activity shares. */
export function ownWords(inputs: readonly WorkInput[]): Map<string, Set<string>> {
  const named = inputs.map((input) => {
    const text = `${input.title} ${input.key.replace(/([a-z])([A-Z])/gu, "$1 $2")}`;
    const found = tokenize(text).filter((token) => token.kind === "word");
    return [input.key, new Set(found.map((token) => token.word).filter(useful))] as const;
  });
  return new Map(
    named.map(([key, own]) => [
      key,
      new Set(
        [...own].filter(
          (word) => !named.some(([other, theirs]) => other !== key && theirs.has(word))
        )
      ),
    ])
  );
}
const useful = (word: string) => word.length >= 4 && !GENERIC.has(word);

/** Every choice an activity's fields offer, by the words of its key and its label. */
export function choiceNames(choices: readonly WorkInput[]): ChoiceName[] {
  return choices.flatMap((input) => {
    const keys = input.type === "band" ? (input.bands ?? input.options) : input.options;
    const labels = input.type === "band" ? input.bandLabels : input.optionLabels;
    return keys.flatMap((key) =>
      [...new Set([key, labels?.[key] ?? key])]
        // A name with a number in it ("1 month", "0-25%") is never read from a story.
        .filter((name) => !/\d/u.test(name))
        .map((name) => ({
          input,
          key,
          words: tokenize(name)
            .filter((token) => token.kind === "word")
            .map((token) => token.word),
        }))
        .filter((name) => name.words.length > 0)
    );
  });
}

/** The choice named at a token, longest name first; null when none, or when two fields share it. */
export function choiceIn(
  names: readonly ChoiceName[],
  tokens: readonly Token[],
  at: number,
  among?: readonly WorkInput[]
): ChoiceName | null {
  const fits = names.filter(
    (name) =>
      (!among || among.includes(name.input)) &&
      name.words.every((word, offset) => tokens[at + offset]?.word === word)
  );
  const longest = Math.max(0, ...fits.map((name) => name.words.length));
  const best = fits.filter((name) => name.words.length === longest);
  return longest > 0 && new Set(best.map((name) => name.input)).size === 1
    ? (best[0] as ChoiceName)
    : null;
}

export interface ChoiceName {
  input: WorkInput;
  key: string;
  words: string[];
}

export interface Duration {
  minutes: number;
  unit: "hours" | "minutes";
  /** The amount as said, when it was said in one unit; null for "1 hour 30 minutes". */
  simple: number | null;
  /** The token after the duration. */
  end: number;
}

/** A number written onto its unit, as "5kW" or "45min", split into the two. */
export function gluedUnit(token: Token): RegExpExecArray | null {
  return token.kind === "glued" ? GLUED_UNIT.exec(token.raw) : null;
}

/** A duration at a token: "3 hours", "1h30", "an hour and a half", "2 horas e meia". */
export function durationIn(tokens: readonly Token[], at: number): Duration | null {
  const token = tokens[at];
  if (!token) return null;
  const glued = token.kind === "glued" ? GLUED_HOURS.exec(token.raw.toLowerCase()) : null;
  if (glued)
    return {
      minutes: Number(glued[1]) * 60 + Number(glued[2]),
      unit: "hours" as const,
      simple: null,
      end: at + 1,
    };
  const split = gluedUnit(token);
  const amount = (raw: string) => {
    const parsed = parseNumberAnswer(raw);
    return parsed.ok ? parsed.value : null;
  };
  let value: number | null = null;
  let unitAt = at + 1;
  let unitWord = tokens[unitAt]?.word;
  if (split)
    [value, unitAt, unitWord] = [amount(split[1] as string), at, W.wordKey(split[2] as string)];
  else if (token.kind === "number") value = amount(token.raw);
  else if (W.ONE.has(token.word) && W.HOURS.has(tokens[at + 1]?.word ?? "")) value = 1;
  else if (W.HALF.has(token.word)) {
    const hour = W.ONE.has(tokens[at + 1]?.word ?? "") ? at + 2 : at + 1;
    return W.HOURS.has(tokens[hour]?.word ?? "")
      ? { minutes: 30, unit: "minutes" as const, simple: null, end: hour + 1 }
      : null;
  }
  if (value === null || !unitWord) return null;
  if (W.MINUTES.has(unitWord))
    return {
      minutes: Math.round(value),
      unit: "minutes" as const,
      simple: value,
      end: unitAt + 1,
    };
  if (!W.HOURS.has(unitWord)) return null;
  let end = unitAt + 1;
  let minutes = Math.round(value * 60);
  let simple: number | null = value;
  const joined = W.JOINERS.has(tokens[end]?.word ?? "") ? end + 1 : end;
  const more = tokens[joined]?.kind === "number" ? amount(tokens[joined]?.raw ?? "") : null;
  if (more !== null && W.MINUTES.has(tokens[joined + 1]?.word ?? "")) {
    [minutes, simple, end] = [minutes + Math.round(more), null, joined + 2];
  } else if (joined > end) {
    const half = W.ONE.has(tokens[joined]?.word ?? "") ? joined + 1 : joined;
    if (W.HALF.has(tokens[half]?.word ?? ""))
      [minutes, simple, end] = [minutes + 30, null, half + 1];
  }
  return { minutes, unit: "hours" as const, simple, end };
}
