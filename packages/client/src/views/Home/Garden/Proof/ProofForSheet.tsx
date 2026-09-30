import {
  type CommitmentDetail,
  type CommitmentMetadataV1,
  type CommitmentSeat,
  useCommitmentCycleLabel,
} from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";

import { AppSheet } from "@/components/Sheets/AppSheet";
import { CommitmentEvidence } from "../Commitment/CommitmentEvidence";
import { CommitmentIdentity } from "../Commitment/CommitmentIdentity";
import { CommitmentProgress } from "../Commitment/CommitmentProgress";
import { selectStatusBand } from "../Commitment/statusBand";

export interface ProofForSheetProps {
  open: boolean;
  onClose: () => void;
  chainId: number;
  title: string;
  detail: CommitmentDetail;
  metadata: CommitmentMetadataV1 | null;
  seat: CommitmentSeat | null;
  viewer: Address | null;
  stewards: readonly Address[];
}

/**
 * The promise, mid-proof: someone back later taps the pinned card and reads
 * its latest state (where it stands, what was promised, the proof so far)
 * without leaving the step. Closing it returns to the same step, nothing lost.
 * The sections are the promise page's own.
 */
export function ProofForSheet({
  open,
  onClose,
  chainId,
  title,
  detail,
  metadata,
  seat,
  viewer,
  stewards,
}: ProofForSheetProps) {
  const intl = useIntl();
  const { commitment, contributors, requirements } = detail;
  const cycle = useCommitmentCycleLabel({ chainId, cycleId: commitment.cycleId });
  const units = commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;

  return (
    <AppSheet
      isOpen={open}
      onClose={onClose}
      size="tall"
      header={{
        title,
        description: cycle
          ? intl.formatMessage({ id: "app.proof.sheet.description" }, { place: cycle.name })
          : intl.formatMessage({ id: "app.proof.sheet.latest" }),
      }}
      bodyLabel={intl.formatMessage({ id: "app.proof.sheet.body" })}
    >
      <div className="space-y-4">
        <CommitmentIdentity
          commitment={commitment}
          contributors={contributors}
          seat={seat}
          band={selectStatusBand({ commitment, seat, actKind: "addProof" })}
          metadata={metadata}
          units={units}
          joinable={false}
          viewer={viewer}
          stewards={stewards}
        />
        <CommitmentProgress chainId={chainId} commitment={commitment} requirements={requirements}>
          <CommitmentEvidence
            attributions={detail.evidenceAttributions}
            recordedCount={commitment.evidenceCount}
          />
        </CommitmentProgress>
      </div>
    </AppSheet>
  );
}
