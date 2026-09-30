import {
  type EvidenceAttributionRow,
  useCommitmentEvidence,
} from "@green-goods/shared/commitment-pooling";

import { EvidencePreview } from "./EvidencePreview";

export interface CommitmentEvidenceProps {
  attributions: readonly EvidenceAttributionRow[];
  /** The chain's own count, so a gap in readable rows is said out loud. */
  recordedCount: number;
}

/**
 * The submitted proof, on the detail itself, for every seat, under the progress
 * in the Progress and proof section.
 *
 * The provider's own record keeps the artifact of their work instead of a
 * bare count, and a careful confirmer can look before ever opening the sheet
 * whose button is worded as the decision. Absent proof renders nothing —
 * the progress line above already says no proof was added.
 */
export function CommitmentEvidence({ attributions, recordedCount }: CommitmentEvidenceProps) {
  const { evidence, isLoading } = useCommitmentEvidence(attributions);

  if (recordedCount === 0 && attributions.length === 0) return null;

  return (
    <div className="mt-3" data-component="CommitmentEvidence">
      <EvidencePreview evidence={evidence} isLoading={isLoading} recordedCount={recordedCount} />
    </div>
  );
}
