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
 * not hide, and where a shape could be either it removes it:
 *
 * - A name or a street written in words passes. So does a phone number of eight digits or fewer
 *   with nothing to mark it as one, and one written as two numbers joined by a hyphen, the second
 *   the larger ("2345-67890"), which is how a range is written.
 * - Nine digits or more in one row are taken for a phone number whatever they are: a row of counts
 *   ("10 20 30 40 50"), a quantity in the hundreds of millions ("612.345.678") or a list of
 *   opening hours. So are eight digits that open with 0, as a Brazilian postcode ("01310-100")
 *   does, and the digits of a precise coordinate. A model then reads "[phone]" where the gardener
 *   wrote numbers.
 * - A full stop with no space after it reads as a link when a slash follows later in the word
 *   ("rega.poda/colheita") or the next word is a common ending ("garden.Site visit").
 * - A link of two names with no scheme, an upper-case ending outside the common ones, a path and
 *   no query ("T.ME/NAME") passes, since "Sr.Silva/Sra.Souza" is written the same way.
 *
 * It removes what it can detect; it is not a promise that a model never sees personal data.
 */
const ENDINGS = "com|org|net|app|xyz|dev|info|link|page|site|io";
const HOST = "(?<![\\p{L}\\p{N}])(?:[\\p{L}\\p{N}-]+\\.)+";
const AFTER_HOST = "(?::\\d+)?(?:\\/\\S*|\\?\\S*=\\S*|#\\S+)";
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}\p{N}])https?:\/\/\S+/giu, "[link]"],
  [/(?<![\p{L}\p{N}])www\.\S+/giu, "[link]"],
  // A link that carries a name and a password: "user:secret@example.org/x".
  [/(?<![\p{L}\p{N}])[^\s@/:]+:[^\s@/]+@\S+/gu, "[link]"],
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu, "[email]"],
  // A link written without its scheme: a host followed by a path, a query with a value or a
  // fragment, as in "t.me/joinchat/abc" and "photos.example.org?key=1". The host's ending is in
  // lower case, or is one of the common endings in any case ("GREENGOODS.APP/PAIR?CODE=1").
  // "Plantamos 20 mudas.Certo?" and "Sr.Silva/Sra.Souza" are sentences with a missing space.
  [new RegExp(`${HOST}[a-z]{2,}${AFTER_HOST}`, "gu"), "[link]"],
  [new RegExp(`${HOST}(?:${ENDINGS})${AFTER_HOST}`, "giu"), "[link]"],
  // A host of three or more names, in any case, with a path: "PHOTOS.EXAMPLE.MX/private".
  // Two names joined by a full stop ("Sr.Silva/Sra.Souza", "R.Augusta/SP") are prose.
  [/(?<![\p{L}\p{N}])(?:[\p{L}\p{N}-]+\.){2,}\p{L}{2,}(?::\d+)?\/\S*/gu, "[link]"],
  // Any host, in any case, with a query that carries a value: "Photos.Example.Mx/x?token=1".
  [new RegExp(`${HOST}\\p{L}{2,}(?::\\d+)?(?:\\/[^\\s?]*)?\\?\\S*=\\S*`, "gu"), "[link]"],
  // A bare host under an ending that is rarely an everyday word.
  [
    new RegExp(
      `${HOST}(?:${ENDINGS})(?:\\.[a-z]{2})?(?::\\d+)?(?![\\p{L}\\p{N}]|\\.\\p{L})`,
      "giu"
    ),
    "[link]",
  ],
  // Account addresses, transaction hashes and signatures, whole or shortened ("0x7099…79C8").
  [/\b0x[0-9a-f]{2,}(?:…|\.{2,3})[0-9a-f]{2,}\b/giu, "[address]"],
  [/\b0x[0-9a-f]{8,}\b/giu, "[address]"],
  [/(?<![\p{L}\p{N}])[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.eth(?![\p{L}\p{N}_])/giu, "[account]"],
  // "@joao.silva_horta" is one handle; "@ada_gardens.Ela plantou" is a handle and a sentence.
  [/(?<![\w@])@[A-Za-z]\w{2,}(?:\.(?=[a-z0-9_])\w+)*/gu, "[handle]"],
  // Continuation tokens, keys and other long opaque strings: letters and digits mixed, unbroken.
  [/\b(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{32,}\b/giu, "[token]"],
];

/** A space between groups of digits: ordinary, tab, no-break, figure, thin or narrow no-break. */
const GAP = "[ \\t\\u00a0\\u2007\\u2009\\u202f]";
/** A hyphen or a dash between groups of digits. */
const DASH = "[-\\u2010-\\u2015]";

/**
 * Eight or more digits in a row, joined by up to two spaces, a hyphen or dash, a bracket, or
 * (between digits) a slash or a dot: a candidate phone number. A full stop followed by a space ends the
 * run, so the count that opens the next sentence is not part of it. The characters are written as
 * escapes so that no editor can turn a no-break space into an ordinary one.
 */
const DIGIT_RUN = new RegExp(
  `(?<!\\d)\\+?\\(?\\d(?:(?:${GAP}{0,2}${DASH}${GAP}{0,2}|${GAP}{0,2}\\(|\\)${GAP}{0,2}(?:${DASH}${GAP}{0,2})?|${GAP}{1,2}|\\/|\\.(?=\\d))?\\d){7,}(?!\\d)`,
  "gu"
);
/** Three numbers with the same separator, which may be a date. */
const DATE_SHAPED = /(?<![\d.,/-])(\d{1,4})([-./])(\d{1,2})\2(\d{1,4})(?![\d/-]|\.\d)/gu;
/** Two dates joined by a dash or a slash, a period of work: "21/11/2026-25/11/2026". */
const DATE_RANGE =
  /(?<![\d.,/-])(\d{1,4})([-./])(\d{1,2})\2(\d{1,4})[-/\u2010-\u2015](\d{1,4})([-./])(\d{1,2})\6(\d{1,4})(?![\d/-]|\.\d)/gu;
/** Two months of a year joined by a dash: "11/2026-12/2026". */
const MONTH_RANGE =
  /(?<![\d.,/-])(\d{1,2})\/((?:19|20)\d{2})[-\u2010-\u2015](\d{1,2})\/((?:19|20)\d{2})(?![\d/-]|\.\d)/gu;
/**
 * A small decimal standing between spaces ("0.25", "8.30"): a measure, not part of a number to
 * call. Anything longer, or joined to its neighbours by a dot, a hyphen or a bracket, is not one:
 * "612.345.678" and "900.123" are how phone numbers are written in Spanish and Portuguese.
 */
const DECIMAL = /(?<![\d.()\u2010-\u2015-])\d{1,3}\.\d{1,2}(?![\d.()\u2010-\u2015-])/gu;
/** Two numbers joined by a hyphen, as a range is written. */
const RANGE = /^(\d+) ?[-\u2010-\u2015] ?(\d+)$/u;

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

/** The dates, date ranges and small decimals in a text: digits kept whatever stands beside them. */
function keptSpans(text: string): Span[] {
  const spans: Span[] = [];
  const keep = (match: RegExpMatchArray) => {
    const span = { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length };
    if (!spans.some((kept) => kept.start < span.end && span.start < kept.end)) spans.push(span);
  };
  const month = (value: string | undefined) => Number(value) >= 1 && Number(value) <= 12;
  for (const match of text.matchAll(DATE_RANGE)) {
    const [, a, , b, c, d, , e, f] = match as unknown as string[];
    if (
      isDate(a as string, b as string, c as string) &&
      isDate(d as string, e as string, f as string)
    )
      keep(match);
  }
  for (const match of text.matchAll(MONTH_RANGE))
    if (month(match[1]) && month(match[3])) keep(match);
  for (const match of text.matchAll(DATE_SHAPED)) {
    if (isDate(match[1] as string, match[3] as string, match[4] as string)) keep(match);
  }
  for (const match of text.matchAll(DECIMAL)) keep(match);
  return spans;
}

/**
 * The parts of one run of digits that are phone numbers. Any nine digits unbroken are one, with
 * whatever is written onto their front ("+234(0)8031234567"). What is left is one when it holds
 * nine digits or more, or eight after a +, a bracket or a leading 0 of an area code. Two things
 * that long are not: a row of years, and a range of nine digits with nothing to mark it.
 */
function phoneSpans(run: string, offset: number): Span[] {
  const long = /\S*?\d{9,}/u.exec(run);
  if (long) {
    const end = long.index + long[0].length;
    return [
      ...phoneSpans(run.slice(0, long.index), offset),
      { start: offset + long.index, end: offset + end },
      ...phoneSpans(run.slice(end), offset + end),
    ];
  }
  // The number itself: from its first digit, + or bracket to its last digit.
  const body = /[+(]?\d(?:.*\d)?/u.exec(run);
  if (!body) return [];
  const groups = body[0].match(/\d+/gu) ?? [];
  const digits = groups.join("").length;
  const marked = /^(?:\+|\(|0\d)/u.test(body[0]);
  if (digits < (marked ? 8 : 9)) return [];
  if (groups.every(isYear)) return [];
  const range = marked ? null : RANGE.exec(body[0]);
  if (range && digits === 9 && Number(range[1]) < Number(range[2])) return [];
  return [{ start: offset + body.index, end: offset + body.index + body[0].length }];
}

/** Text with its phone numbers taken out. Dates and small decimals are kept where they stand. */
function withoutPhones(text: string): string {
  const kept = keptSpans(text);
  const phones: Span[] = [];
  for (const run of text.matchAll(DIGIT_RUN)) {
    // What a date or a decimal leaves of the run on either side is judged on its own.
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

/** A character an identifier may be written in: Latin letters with their accents, digits, marks. */
const IDENTIFIER_PART = /[\p{Script=Latin}\p{N}\p{M}._%+@:/?#=&()-]/u;

/**
 * Text with no spaces, without the identifier it may end in half of ("josé" of an email address).
 * Letters of other scripts end the run, so Thai written without spaces is kept. Read from the end.
 */
function withoutTrailingIdentifier(text: string): string {
  let start = text.length;
  while (start > 0 && IDENTIFIER_PART.test(text[start - 1] as string)) start -= 1;
  return text.slice(0, start);
}

const NUMBER_PART = /[\d\s().\u2010-\u2015+/-]/u;

/**
 * Text without the number it ends on, when the cut may have split one: a phone number written in
 * groups ("+234 800 000 0001") loses more than its last word, so all of it goes. Read from the
 * end, so a long run of digits costs one pass.
 */
function withoutTrailingNumber(text: string): string {
  let start = text.length;
  while (start > 0 && NUMBER_PART.test(text[start - 1] as string)) start -= 1;
  return /\d/u.test(text.slice(start)) ? text.slice(0, start) : text;
}

/** Text as a model may read it: identifiers removed, then cut to `maxChars`. */
export function sanitizeModelText(text: string, maxChars: number): string {
  // Nothing past twice the bound can survive the cut, so it is not worth matching against. A word
  // the first cut leaves in half is dropped, so half an identifier is never left at the end. Text
  // with no space to cut at loses only what an identifier may be written in, so Thai is kept.
  const limit = maxChars * 2;
  const long = text.length > limit;
  const head = long ? text.slice(0, limit).replace(/[\ud800-\udbff]$/u, "") : text;
  const cut = /\s\S+$/u.test(head) ? head.replace(/\S+$/u, "") : withoutTrailingIdentifier(head);
  let clean = long ? withoutTrailingNumber(cut) : head;
  for (const [pattern, replacement] of REDACTIONS) clean = clean.replace(pattern, replacement);
  clean = withoutPhones(clean).trim();
  if (clean.length < maxChars) return long ? `${clean}…` : clean;
  if (clean.length === maxChars && !long) return clean;
  // The cut never leaves half of a mark standing for something removed, or half of a character
  // written as a pair, as an emoji is.
  return `${clean
    .slice(0, maxChars - 1)
    .replace(/[\ud800-\udbff]$/u, "")
    .replace(/\[[a-z]*$/u, "")
    .trimEnd()}…`;
}
