/**
 * What a model may be sent about a conversation, in one place (RESR-79). Every dialogue snapshot
 * is built from these bounds and passes its free text through `sanitizeModelText`, so changing the
 * decision is a change to this file and its tests. Files a gardener attaches are read on a path of
 * their own, which this policy does not cover.
 *
 * The policy is text only: no raw media and no voice reach the dialogue snapshot. Gardens and
 * activities travel as opaque local identifiers, never as addresses.
 */
export const MODEL_INPUT_POLICY = {
  version: 1,
  /** The most earlier turns a snapshot carries, counting the person's and the assistant's. */
  maxTurns: 4,
  maxTurnChars: 500,
  maxMessageChars: 2_000,
  /** A draft's own free text: its description and its text details. */
  maxFieldChars: 1_000,
  /** Catalogue words: a garden's name, an activity's title, a field's title, hint or option. */
  maxLabelChars: 160,
  maxGardens: 40,
  maxActivities: 60,
  /** The whole snapshot as JSON. Past it, earlier turns go first and then the activity list. */
  maxSnapshotChars: 48_000,
} as const;

/** What stands in a text for something the sanitizer took out. */
export const REDACTION_MARK = /\[(?:link|email|address|account|handle|token|phone)\]/iu;

/**
 * What the sanitizer takes out, most specific first. It matches shapes, so it has limits it does
 * not hide. A name or a street written in words passes. So does a phone number of eight digits or
 * fewer with nothing to mark it as one. In the other direction, a row of counts separated only by
 * spaces ("1200 1500 1800") and a plain number of nine digits or more are taken for phone numbers,
 * and a full stop with no space before "com" reads as a link. It removes what it can detect; it is
 * not a promise that a model never sees personal data.
 */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}\p{N}])https?:\/\/\S+/giu, "[link]"],
  [/(?<![\p{L}\p{N}])www\.\S+/giu, "[link]"],
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu, "[email]"],
  // A link written without its scheme: a host under a lower-case ending, followed by a path, a
  // query with a value or a fragment, as in "t.me/joinchat/abc" and "photos.example.org?key=1".
  // "Plantamos 20 mudas.Certo?" is a sentence with a missing space, and stays one.
  [/(?<![\p{L}\p{N}])(?:[\p{L}\p{N}-]+\.)+[a-z]{2,}(?:\/\S*|\?\S*=\S*|#\S+)/gu, "[link]"],
  // A bare host under an ending that is rarely an everyday word.
  [
    /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}-]+\.)+(?:com|org|net|app|xyz|dev|info|link|page|site|io)(?:\.[a-z]{2})?(?![\p{L}\p{N}]|\.\p{L})/gu,
    "[link]",
  ],
  // Account addresses, transaction hashes and signatures.
  [/\b0x[0-9a-f]{8,}\b/giu, "[address]"],
  [/(?<![\p{L}\p{N}])[\w-]+(?:\.[\w-]+)*\.eth\b/giu, "[account]"],
  [/(?<![\w@])@[a-z]\w{2,}/giu, "[handle]"],
  // Continuation tokens, keys and other long opaque strings: letters and digits mixed, unbroken.
  [/\b(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{32,}\b/giu, "[token]"],
];

/**
 * Eight or more digits in a row, joined by at most one space, hyphen, bracket or (between digits)
 * dot: a candidate phone number. A full stop followed by a space ends the run, so the count that
 * opens the next sentence is not part of it.
 */
const DIGIT_RUN = /(?<!\d)\+?\(?\d(?:(?: ?[-‐-―] ?| ?\(|\) ?|[  ]|\.(?=\d))?\d){7,}(?!\d)/gu;
/** Three numbers with the same separator, which may be a date. */
const DATE_SHAPED = /(?<![\d.,/-])(\d{1,4})([-./])(\d{1,2})\2(\d{1,4})(?![\d/-]|\.\d)/gu;
/** A grouped quantity ("1.000.000") or a decimal ("12,5", "8.30"): a measure, not a number to call. */
const QUANTITY =
  /(?<![\d.,])(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,3})?|\d{1,6}[.,]\d{1,3})(?!\d|[.,]\d)/gu;

const isYear = (digits: string) => /^(?:19|20)\d{2}$/u.test(digits);

/** Whether three numbers are a calendar date: year first, or day and month in either order. */
function isDate(first: string, second: string, third: string): boolean {
  const [a, b, c] = [first, second, third].map(Number) as [number, number, number];
  if (isYear(first)) return b >= 1 && b <= 12 && c >= 1 && c <= 31;
  const dayAndMonth = a >= 1 && b >= 1 && a <= 31 && b <= 31 && Math.min(a, b) <= 12;
  return first.length <= 2 && dayAndMonth && (third.length === 2 || isYear(third));
}

interface Span {
  start: number;
  end: number;
}

/** The dates and quantities in a text: digits that are kept whatever stands beside them. */
function keptSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const match of text.matchAll(DATE_SHAPED)) {
    if (isDate(match[1] as string, match[3] as string, match[4] as string))
      spans.push({ start: match.index, end: match.index + match[0].length });
  }
  for (const match of text.matchAll(QUANTITY)) {
    const span = { start: match.index, end: match.index + match[0].length };
    if (!spans.some((kept) => kept.start < span.end && span.start < kept.end)) spans.push(span);
  }
  return spans;
}

/**
 * The parts of one run of digits that are phone numbers. Any nine digits unbroken are one. What
 * is left is one when it holds nine digits or more, or eight after a +, a bracket or a leading 0
 * of an area code, unless it is a row of years or of one- and two-digit counts with no such mark.
 */
function phoneSpans(run: string, offset: number): Span[] {
  const long = /\+?\(?\d{9,}/u.exec(run);
  if (long) {
    const end = long.index + long[0].length;
    return [
      ...phoneSpans(run.slice(0, long.index), offset),
      { start: offset + long.index, end: offset + end },
      ...phoneSpans(run.slice(end), offset + end),
    ];
  }
  const groups = run.match(/\d+/gu) ?? [];
  const digits = groups.join("").length;
  const marked = /^\s*(?:\+|\(|0\d)/u.test(run);
  if (digits < (marked ? 8 : 9)) return [];
  if (groups.every(isYear)) return [];
  if (!marked && groups.every((group) => group.length <= 2)) return [];
  const lead = run.length - run.trimStart().length;
  return [{ start: offset + lead, end: offset + run.trimEnd().length }];
}

/** Text with its phone numbers taken out. Dates and quantities are kept where they stand. */
function withoutPhones(text: string): string {
  const kept = keptSpans(text);
  const phones: Span[] = [];
  for (const run of text.matchAll(DIGIT_RUN)) {
    // What a date or a quantity leaves of the run on either side is judged on its own.
    let from = run.index;
    const end = run.index + run[0].length;
    const inside = kept
      .filter((span) => span.start < end && run.index < span.end)
      .sort((one, other) => one.start - other.start);
    for (const span of [...inside, { start: end, end }]) {
      if (span.start > from) phones.push(...phoneSpans(text.slice(from, span.start), from));
      from = Math.max(from, span.end);
    }
  }
  let clean = text;
  for (const span of phones.sort((one, other) => other.start - one.start))
    clean = `${clean.slice(0, span.start)}[phone]${clean.slice(span.end)}`;
  return clean;
}

/** Text as a model may read it: identifiers removed, then cut to `maxChars`. */
export function sanitizeModelText(text: string, maxChars: number): string {
  // Nothing past twice the bound can survive the cut, so it is not worth matching against. A word
  // the first cut leaves in half is dropped, so half an identifier is never left at the end.
  const limit = maxChars * 2;
  const long = text.length > limit;
  let clean = long ? text.slice(0, limit).replace(/\S+$/u, "") : text;
  for (const [pattern, replacement] of REDACTIONS) clean = clean.replace(pattern, replacement);
  clean = withoutPhones(clean).trim();
  if (clean.length < maxChars) return long ? `${clean}…` : clean;
  if (clean.length === maxChars && !long) return clean;
  // The cut never leaves half of a mark standing for something removed.
  return `${clean
    .slice(0, maxChars - 1)
    .replace(/\[[a-z]*$/u, "")
    .trimEnd()}…`;
}
