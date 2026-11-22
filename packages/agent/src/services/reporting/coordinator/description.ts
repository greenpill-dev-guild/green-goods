/**
 * Keeps a report's description in step with a corrected value. A gardener who says "it was 14,
 * not 12" has corrected the count; a description that still says 12 would publish both. Where the
 * old value can be found in the description without doubt, it is replaced; where it cannot, the
 * description is left alone and the caller says that it still states the old value. Nothing here
 * rewrites wording: only the value changes, and the gardener confirms the result in the summary.
 */
const NUMBER_WORDS: ReadonlyArray<readonly [number, readonly string[]]> = [
  [0, ["zero", "cero"]],
  [1, ["one", "uno", "una", "um", "uma"]],
  [2, ["two", "dos", "dois", "duas"]],
  [3, ["three", "tres"]],
  [4, ["four", "cuatro", "quatro"]],
  [5, ["five", "cinco"]],
  [6, ["six", "seis"]],
  [7, ["seven", "siete", "sete"]],
  [8, ["eight", "ocho", "oito"]],
  [9, ["nine", "nueve", "nove"]],
  [10, ["ten", "diez", "dez"]],
  [11, ["eleven", "once", "onze"]],
  [12, ["twelve", "doce", "doze"]],
  [13, ["thirteen", "trece", "treze"]],
  [14, ["fourteen", "catorce", "quatorze", "catorze"]],
  [15, ["fifteen", "quince", "quinze"]],
  [16, ["sixteen", "dieciseis", "dezesseis"]],
  [17, ["seventeen", "diecisiete", "dezessete"]],
  [18, ["eighteen", "dieciocho", "dezoito"]],
  [19, ["nineteen", "diecinueve", "dezenove"]],
  [20, ["twenty", "veinte", "vinte"]],
  [30, ["thirty", "treinta", "trinta"]],
  [40, ["forty", "cuarenta", "quarenta"]],
  [50, ["fifty", "cincuenta", "cinquenta"]],
  [100, ["hundred", "cien", "cem"]],
];

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

interface Found {
  start: number;
  end: number;
}

/** Where a number stands in a text, written in digits or as one of the plain number words. */
function numberMentions(text: string, value: number): Found[] {
  const found: Found[] = [];
  // Digits that are a number of their own: not part of a longer number, a decimal or a date.
  for (const match of text.matchAll(/(?<![\d.,/:-])\d+(?:[.,]\d+)?(?![\d/:-]|[.,]\d)/gu)) {
    if (Number(match[0].replace(",", ".")) === value)
      found.push({ start: match.index, end: match.index + match[0].length });
  }
  const words = NUMBER_WORDS.find(([number]) => number === value)?.[1] ?? [];
  const plain = fold(text);
  // Folding keeps every character's place, so a match in the folded text is one in the text.
  if (plain.length !== text.length) return found;
  for (const word of words) {
    for (const match of plain.matchAll(
      new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "gu")
    ))
      found.push({ start: match.index, end: match.index + word.length });
  }
  return found.sort((one, other) => one.start - other.start);
}

function mentions(text: string, phrase: string): Found[] {
  const needle = fold(phrase).trim();
  const plain = fold(text);
  if (!needle || plain.length !== text.length) return [];
  const found: Found[] = [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![\\p{L}\\p{N}])`,
    "gu"
  );
  for (const match of plain.matchAll(pattern))
    found.push({ start: match.index, end: match.index + needle.length });
  return found;
}

const put = (text: string, at: Found, words: string) =>
  `${text.slice(0, at.start)}${words}${text.slice(at.end)}`;

/** The one place among `found` that is meant: the only one, or the only one inside `span`. */
function meant(text: string, found: readonly Found[], span: string | undefined): Found | null {
  if (found.length === 1) return found[0] as Found;
  const [within, ...others] = span ? mentions(text, span) : [];
  if (!within || others.length > 0) return null;
  const inside = found.filter((at) => at.start >= within.start && at.end <= within.end);
  return inside.length === 1 ? (inside[0] as Found) : null;
}

export type DescriptionChange =
  | { kind: "number"; before: number; after: number; beforeWords?: string }
  | { kind: "words"; before: string; after: string };

/**
 * What a corrected value does to the description. `revised` is the description with the old value
 * replaced, when exactly one place states it (or exactly one inside the words the value was read
 * from). `stale` is true when the description still states the old value and could not be changed.
 */
export function reviseDescription(
  description: string,
  change: DescriptionChange
): { revised: string | null; stale: boolean } {
  const found =
    change.kind === "number"
      ? numberMentions(description, change.before)
      : mentions(description, change.before);
  if (found.length === 0) return { revised: null, stale: false };
  const at = meant(description, found, change.kind === "number" ? change.beforeWords : undefined);
  if (!at) return { revised: null, stale: true };
  return { revised: put(description, at, String(change.after)), stale: false };
}
