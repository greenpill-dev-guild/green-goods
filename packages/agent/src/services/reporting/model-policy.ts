/**
 * What a model may be sent about a conversation, in one place (RESR-79). Every provider-bound
 * snapshot is built from these bounds and passes its free text through `sanitizeModelText`, so
 * changing the decision is a change to this file and its tests.
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

/**
 * What the sanitizer takes out, most specific first. It matches shapes, so it has limits it does
 * not hide: a name or a street written in words passes, and a row of numbers separated only by
 * spaces can be taken for a phone number. It removes what it can detect; it is not a promise that
 * a model never sees personal data.
 */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bhttps?:\/\/\S+/giu, "[link]"],
  [/\bwww\.\S+/giu, "[link]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu, "[email]"],
  // Account addresses, transaction hashes and signatures.
  [/\b0x[0-9a-f]{8,}\b/giu, "[address]"],
  [/\b[\w-]+\.eth\b/giu, "[account]"],
  [/(?<![\w@])@[a-z]\w{3,}/giu, "[handle]"],
  // Continuation tokens, keys and other long opaque strings.
  [/\b[\w-]{32,}\b/gu, "[token]"],
  // Nine or more digits, however they are grouped: "+234 800 000 0001", "(11) 91234-5678".
  [/(?<![\w.,])\+?\(?\d(?:[\s().-]{0,3}\d){8,}(?!\w)/gu, "[phone]"],
];

/** Text as a model may read it: identifiers removed, then cut to `maxChars`. */
export function sanitizeModelText(text: string, maxChars: number): string {
  let clean = text;
  for (const [pattern, replacement] of REDACTIONS) clean = clean.replace(pattern, replacement);
  clean = clean.trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1).trimEnd()}…` : clean;
}
