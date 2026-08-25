import {
  type EvidenceAttributionRow,
  useCommitmentEvidence,
} from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";

import { EvidencePreview } from "./EvidencePreview";

export interface CommitmentEvidenceProps {
  attributions: readonly EvidenceAttributionRow[];
  /** The chain's own count, so a gap in readable rows is said out loud. */
  recordedCount: number;
}

/**
 * The submitted proof, on the detail itself, for every seat.
 *
 * The provider's own record keeps the artifact of their work instead of a
 * bare count, and a careful confirmer can look before ever opening the sheet
 * whose button is worded as the decision. Absent proof renders nothing —
 * the progress card already says no proof was added.
 */
export function CommitmentEvidence({ attributions, recordedCount }: CommitmentEvidenceProps) {
  const { formatMessage } = useIntl();
  const { evidence, isLoading } = useCommitmentEvidence(attributions);

  if (recordedCount === 0 && attributions.length === 0) return null;

  return (
    <section
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-component="CommitmentEvidence"
    >
      <h3 className="text-sm font-medium text-text-strong-950">
        {formatMessage({ id: "app.commitment.evidence.title" })}
      </h3>
      <div className="mt-3">
        <EvidencePreview evidence={evidence} isLoading={isLoading} recordedCount={recordedCount} />
      </div>
    </section>
  );
}
