import type { IntlShape } from "react-intl";

type CommitmentUnitKey = "hours" | "meals" | "sessions" | "repairs" | "rides" | "other";

// Every first-class composer unit (ComposeHowMuch UNIT_CHOICES) needs a family
// here — a missing entry falls through to the raw label and prints "1 hours".
const UNIT_KEY_BY_LABEL: Record<string, Exclude<CommitmentUnitKey, "other">> = {
  hour: "hours",
  hours: "hours",
  hora: "hours",
  horas: "hours",
  meal: "meals",
  meals: "meals",
  comida: "meals",
  comidas: "meals",
  refeição: "meals",
  refeições: "meals",
  session: "sessions",
  sessions: "sessions",
  sesión: "sessions",
  sesiones: "sessions",
  sessão: "sessions",
  sessões: "sessions",
  repair: "repairs",
  repairs: "repairs",
  reparación: "repairs",
  reparaciones: "repairs",
  conserto: "repairs",
  consertos: "repairs",
  ride: "rides",
  rides: "rides",
  viaje: "rides",
  viajes: "rides",
  carona: "rides",
  caronas: "rides",
};

function pluralCount(count: bigint | number | string): number {
  try {
    return BigInt(count) === 1n ? 1 : 2;
  } catch {
    return Number(count) === 1 ? 1 : 2;
  }
}

type SingularRule = readonly [plural: RegExp, singular: string | null];

/** Spanish and Portuguese plural endings no English word shares, undone for any reader. */
const SINGULAR_ANY_LANGUAGE: readonly SingularRule[] = [
  [/iones$/, "ión"],
  [/ões$/, "ão"],
];

/** Spanish and Portuguese "-os" and "-as" plurals ("certificados", "aulas"). */
const SINGULAR_SPANISH_PORTUGUESE: readonly SingularRule[] = [[/(.{2}[ao])s$/i, "$1"]];

/**
 * English plurals. A rule with no singular leaves the word as written, as does
 * a final "s" after a letter a singular unit can end on: "canvas", "chaos",
 * "lens", "news", "bus", "basis".
 */
const SINGULAR_ENGLISH: readonly SingularRule[] = [
  [/(ss|sh|ch|x)es$/i, "$1"],
  // Endings whose singular the word can't settle: "activities" or "movies", "buses" or
  // "courses", "leaves" or "gloves", "potatoes" or "shoes", "quizzes" or "prizes";
  // "physics" is no plural.
  [/(ies|ses|ves|oes|zes|ics)$/i, null],
  [/(.{2}[^aiosuwn])s$/i, "$1"],
];

/**
 * A garden's own unit, read for a count of one. Units are written as plurals
 * (the composer's chips are too), so the raw word would say "1 certificates".
 * Only a single word whose ending proves it a plural changes; the reader's
 * language stands in for the garden's, which isn't recorded.
 */
function singularOf(unit: string, locale: string): string {
  if (/\s/.test(unit)) return unit;
  const language = locale.toLowerCase().split("-")[0];
  for (const [plural, singular] of [
    ...SINGULAR_ANY_LANGUAGE,
    ...(language === "en" ? SINGULAR_ENGLISH : []),
    ...(language === "es" || language === "pt" ? SINGULAR_SPANISH_PORTUGUESE : []),
  ]) {
    if (plural.test(unit)) return singular === null ? unit : unit.replace(plural, singular);
  }
  return unit;
}

/**
 * Format a commitment quantity without losing bigint precision. The catalog
 * owns the language-specific nouns; the raw unit remains the fallback for
 * garden-authored units outside the known composer choices, in its singular
 * for a count of one when that is certain.
 */
export function formatCommitmentUnits(
  intl: Pick<IntlShape, "formatMessage" | "locale">,
  count: bigint | number | string,
  unit: string
): string {
  const normalizedUnit = unit.trim();
  const knownKey: CommitmentUnitKey | undefined =
    UNIT_KEY_BY_LABEL[normalizedUnit.toLocaleLowerCase()];
  const one = pluralCount(count) === 1;

  return intl.formatMessage(
    { id: "app.commitments.row.units" },
    {
      count: String(count),
      pluralCount: pluralCount(count),
      unit: one && !knownKey ? singularOf(normalizedUnit, intl.locale) : normalizedUnit,
      unitKey: knownKey ?? "other",
    }
  );
}
