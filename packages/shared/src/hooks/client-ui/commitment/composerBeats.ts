import {
  type CommitmentComposerValues,
  commitmentComposerSchema,
} from "../../commitment-pooling/useCommitmentComposerForm";

export const COMPOSER_BEATS = ["what", "howMuch", "details", "review"] as const;
export type ComposerBeat = (typeof COMPOSER_BEATS)[number];
export type ComposerBlockedReason = "title" | "unit" | "count" | "action" | "rowCount" | null;

/** Which answers each beat owns; later answers never block an earlier screen. */
export const BEAT_FIELDS = {
  what: ["title", "kind", "cycleId"],
  howMuch: ["unitLabel", "targetUnits", "dueInDays", "requirements", "claimMode"],
  details: ["note", "links", "openTeam", "protocolFallbackEnabled"],
  review: [],
} as const satisfies Record<ComposerBeat, readonly (keyof CommitmentComposerValues)[]>;

export interface ComposerBeatValidity {
  canAdvance: boolean;
  reason: ComposerBlockedReason;
}

function selectReason(beat: ComposerBeat, values: CommitmentComposerValues): ComposerBlockedReason {
  if (beat === "what" && values.title.trim().length === 0) return "title";
  if (beat !== "howMuch") return null;
  if (values.unitLabel.trim().length === 0) return "unit";
  if (!Number.isFinite(values.targetUnits) || values.targetUnits <= 0) return "count";
  if (values.kind !== "GARDEN_WORK") return null;
  if (values.requirements.length === 0) return "action";
  if (
    values.requirements.some((row) => !Number.isInteger(row.requiredCount) || row.requiredCount < 1)
  ) {
    return "rowCount";
  }
  return null;
}

/** Pure schema-backed validity and human-readable blocking reason for one beat. */
export function selectBeatValidity(
  beat: ComposerBeat,
  values: CommitmentComposerValues
): ComposerBeatValidity {
  const fields: readonly (keyof CommitmentComposerValues)[] = BEAT_FIELDS[beat];
  if (fields.length === 0) return { canAdvance: true, reason: null };
  const result = commitmentComposerSchema.safeParse(values);
  const canAdvance =
    result.success ||
    !result.error.issues.some((issue) =>
      fields.includes(issue.path[0] as keyof CommitmentComposerValues)
    );
  return { canAdvance, reason: canAdvance ? null : selectReason(beat, values) };
}
