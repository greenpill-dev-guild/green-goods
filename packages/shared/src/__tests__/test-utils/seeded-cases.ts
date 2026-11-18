/**
 * Seeded cases for property-style tests: one rule checked against many generated inputs, where a
 * table of examples covers only the inputs someone thought of. The seed, not wall time, owns
 * every variation, so a failing case fails the same way on the next run. Set `GG_PROPERTY_SEED`
 * to check the same rules against other inputs.
 */

interface CaseSource {
  /** A whole number from `min` to `max`, both included. */
  int(min: number, max: number): number;
  pick<T>(options: readonly T[]): T;
  /** Up to `maxLength` entries of `alphabet` joined, each entry kept whole. */
  text(alphabet: readonly string[], maxLength: number): string;
}

export const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** Well-formed text that trips encoders: accents, astral characters, separators and escapes. */
export const AWKWARD_TEXT = [
  "a",
  "Z",
  "7",
  " ",
  "é",
  "ß",
  "中",
  "🌱",
  "👩‍🌾",
  "\n",
  "\r",
  "\t",
  "\\",
  '"',
  "'",
  "/",
  "+",
  "=",
  "-",
  "_",
  ":",
  "\u0000",
  " ",
  "​",
  " ",
] as const;

const DEFAULT_SEED = "17";
const DEFAULT_CASES = 100;

function readSeed(): number {
  const seedText = process.env.GG_PROPERTY_SEED ?? DEFAULT_SEED;
  if (!/^[1-9]\d*$/.test(seedText) || Number(seedText) > 0xffffffff) {
    throw new Error("GG_PROPERTY_SEED must be an integer from 1 to 4294967295");
  }
  return Number(seedText);
}

/** Runs `check` against `cases` generated inputs and names the seed and case on a failure. */
export function forSeededCases(check: (source: CaseSource) => void, cases = DEFAULT_CASES): void {
  const seed = readSeed();
  let state = seed;
  // xorshift32: small, and identical on every runtime.
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const int = (min: number, max: number) => min + (next() % (max - min + 1));
  const source: CaseSource = {
    int,
    pick: (options) => options[int(0, options.length - 1)],
    text: (alphabet, maxLength) =>
      Array.from({ length: int(0, maxLength) }, () => alphabet[int(0, alphabet.length - 1)]).join(
        ""
      ),
  };

  for (let index = 1; index <= cases; index += 1) {
    try {
      check(source);
    } catch (error) {
      // Keep the assertion's own diff; only say which generated case produced it.
      if (error instanceof Error) {
        error.message = `Seeded case ${index} of ${cases} (GG_PROPERTY_SEED=${seed}): ${error.message}`;
      }
      throw error;
    }
  }
}
