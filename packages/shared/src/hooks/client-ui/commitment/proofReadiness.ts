export const PROOF_BEATS = ["media", "details", "review"] as const;

export type ProofBeat = (typeof PROOF_BEATS)[number];
export type ProofBlockedReason =
  | "processing"
  | "recording"
  | "nothing"
  | "credit"
  | "invalid-link"
  | null;

export interface ProofReadinessInput {
  beat: ProofBeat;
  isProcessing: boolean;
  isRecording: boolean;
  hasAnything: boolean;
  creditedCount: number;
  links: readonly string[];
}

export interface ProofReadiness {
  canAdvance: boolean;
  reason: ProofBlockedReason;
}

const WEB_LINK = /^https?:\/\/\S+$/i;

/** Pure beat gate shared by the proof controller and its table-driven tests. */
export function selectProofReadiness(input: ProofReadinessInput): ProofReadiness {
  let reason: ProofBlockedReason = null;

  if (input.beat === "media") {
    if (input.isProcessing) reason = "processing";
    else if (input.isRecording) reason = "recording";
  } else if (input.beat === "details") {
    if (!input.hasAnything) reason = "nothing";
    else if (input.creditedCount === 0) reason = "credit";
    else if (input.links.some((url) => !WEB_LINK.test(url))) reason = "invalid-link";
  }

  return { canAdvance: reason === null, reason };
}
