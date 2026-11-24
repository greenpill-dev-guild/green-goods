import {
  type CommitmentReadModel,
  useCommitmentMetadataFor,
} from "@green-goods/shared/commitment-pooling";
import { Alert } from "@green-goods/shared/components/Alert";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { useIntl } from "react-intl";

import { presentState } from "@/components/Features/Commitments";
import { CommitmentDetailShell } from "./CommitmentDetailShell";

/** The notification has a summary, not the full detail or authority to offer an act. */
export function SavedCommitment({
  commitment,
  onBack,
}: {
  commitment: CommitmentReadModel;
  onBack: () => void;
}) {
  const intl = useIntl();
  const metadata = useCommitmentMetadataFor(commitment);
  const units = commitment.unitLabel
    ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
    : null;
  const state = presentState(commitment.derivedState);
  return (
    <CommitmentDetailShell
      onBack={onBack}
      title={metadata?.title ?? units ?? intl.formatMessage({ id: "app.commitments.row.untitled" })}
    >
      <Alert variant="warning">{intl.formatMessage({ id: "app.commitment.offline.saved" })}</Alert>
      <StatusBadge variant={state.tone} showIcon={false}>
        {intl.formatMessage({ id: state.labelId })}
      </StatusBadge>
      {metadata?.note ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-sub-600">
          {metadata.note}
        </p>
      ) : null}
    </CommitmentDetailShell>
  );
}
