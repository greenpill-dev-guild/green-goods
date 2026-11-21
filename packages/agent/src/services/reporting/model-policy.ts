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
export const REDACTION_MARK = /\[(?:link|email|address|account|handle|token|phone)\]/u;

/**
 * What the sanitizer takes out, most specific first. It matches shapes, so it has limits it does
 * not hide: a name or a street written in words passes, so does a phone number of fewer than nine
 * digits with nothing to mark it as one, and a long plain number can be taken for a phone number.
 * It removes what it can detect; it is not a promise that a model never sees personal data.
 */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bhttps?:\/\/\S+/giu, "[link]"],
  [/\bwww\.\S+/giu, "[link]"],
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu, "[email]"],
  // A domain followed by a path, written without its scheme: "t.me/joinchat/abc".
  [/\b(?:[\p{L}\p{N}-]+\.)+\p{L}{2,}\/\S*/gu, "[link]"],
  // Account addresses, transaction hashes and signatures.
  [/\b0x[0-9a-f]{8,}\b/giu, "[address]"],
  [/\b[\w-]+(?:\.[\w-]+)*\.eth\b/giu, "[account]"],
  [/(?<![\w@])@[a-z]\w{2,}/giu, "[handle]"],
  // Continuation tokens, keys and other long opaque strings: letters and digits mixed, unbroken.
  [/\b(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{32,}\b/giu, "[token]"],
];

/** Digits grouped by spaces, dots, hyphens or brackets on one line: a candidate phone number. */
const DIGIT_RUN = /(?<![\w.,])\+?\(?\d(?:[ ().-]{0,3}\d){7,}(?!\w)/gu;
const DATE = /\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4}/u;

/**
 * Whether a run of digits is written the way a phone number is, and not the way a date, a list of
 * counts or a large quantity is: it opens with +, 00, 0 or a bracket; or it is nine or more digits
 * unbroken; or its groups end in four digits, as "800 000 0001" and "91234-5678" do.
 */
function looksLikePhone(run: string): boolean {
  if (DATE.test(run)) return false;
  const groups = run.match(/\d+/gu) ?? [];
  const digits = groups.join("").length;
  if (digits > 15) return false;
  if (/^(?:\+|\(|0)/u.test(run)) return digits >= 8;
  if (digits < 9) return false;
  return groups.length === 1 || (groups.length <= 4 && groups.at(-1)?.length === 4);
}

/** Text as a model may read it: identifiers removed, then cut to `maxChars`. */
export function sanitizeModelText(text: string, maxChars: number): string {
  // Nothing past a few times the bound can survive the cut, so it is not worth matching against.
  let clean = text.slice(0, maxChars * 4);
  for (const [pattern, replacement] of REDACTIONS) clean = clean.replace(pattern, replacement);
  clean = clean.replace(DIGIT_RUN, (run) => (looksLikePhone(run) ? "[phone]" : run)).trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1).trimEnd()}…` : clean;
}
