import {
  COMMITMENT_NOTE_MAX_LENGTH,
  COMMITMENT_TITLE_MAX_LENGTH,
  COMMITMENT_UNIT_LABEL_MAX_LENGTH,
} from "../../../modules/commitment-pooling/metadata";
import {
  type CommitmentComposerValues,
  commitmentComposerSchema,
} from "../../commitment-pooling/useCommitmentComposerForm";

export const COMPOSER_BEATS = ["what", "howMuch", "details", "review"] as const;
export type ComposerBeat = (typeof COMPOSER_BEATS)[number];
/**
 * What stops a beat, in words the composer can say. The `TooLong` reasons are
 * for text copied in from an older commitment ("compose again"), written before
 * the limits: typing stops at the limit, so only copied text can run past it.
 */
export type ComposerBlockedReason =
  | "title"
  | "titleTooLong"
  | "unit"
  | "unitTooLong"
  | "count"
  | "action"
  | "rowCount"
  | "noteTooLong"
  | null;

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
  // Measured as the schema measures them: trimmed.
  if (beat === "what") {
    const title = values.title.trim().length;
    if (title === 0) return "title";
    return title > COMMITMENT_TITLE_MAX_LENGTH ? "titleTooLong" : null;
  }
  if (beat === "details") {
    return (values.note ?? "").trim().length > COMMITMENT_NOTE_MAX_LENGTH ? "noteTooLong" : null;
  }
  if (beat !== "howMuch") return null;
  const unit = values.unitLabel.trim().length;
  if (unit === 0) return "unit";
  if (unit > COMMITMENT_UNIT_LABEL_MAX_LENGTH) return "unitTooLong";
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
