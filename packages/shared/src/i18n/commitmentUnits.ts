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

/**
 * Format a commitment quantity without losing bigint precision. The catalog
 * owns the language-specific nouns; the raw unit remains the fallback for
 * garden-authored units outside the known composer choices.
 */
export function formatCommitmentUnits(
  intl: Pick<IntlShape, "formatMessage">,
  count: bigint | number | string,
  unit: string
): string {
  const normalizedUnit = unit.trim();
  const unitKey: CommitmentUnitKey =
    UNIT_KEY_BY_LABEL[normalizedUnit.toLocaleLowerCase()] ?? "other";

  return intl.formatMessage(
    { id: "app.commitments.row.units" },
    {
      count: String(count),
      pluralCount: pluralCount(count),
      unit: normalizedUnit,
      unitKey,
    }
  );
}
