import {
  useCommitment,
  useCommitmentMetadataFor,
  useCommitmentWorkAttributionsForWork,
  useNavigateToTop,
} from "@green-goods/shared";
import { RiHandHeartLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { FormCard } from "@/components/Cards";

export interface WorkFulfillsProps {
  chainId: number;
  /** The work's attestation id, or null while it is not yet on chain. */
  workUID: string | null;
  gardenId: string;
}

/**
 * The commitment this work fulfils, from the indexer's own attribution.
 *
 * The relationship is read here and never edited: the row only opens its
 * other end. A work not yet on chain has no attribution to read, and a work
 * that fulfils nothing draws nothing.
 */
export function WorkFulfills({ chainId, workUID, gardenId }: WorkFulfillsProps) {
  const { formatMessage } = useIntl();
  const navigateToTop = useNavigateToTop();
  const { attributions } = useCommitmentWorkAttributionsForWork({ chainId, workUID });
  const attribution = attributions.find((entry) => entry.linked) ?? null;
  const { detail } = useCommitment(
    { chainId, commitmentId: attribution?.commitmentId ?? 0n },
    { enabled: Boolean(attribution) }
  );
  const metadata = useCommitmentMetadataFor(detail?.commitment);
  if (!attribution) return null;

  const commitment = detail?.commitment;
  const name =
    metadata?.title ??
    (commitment?.unitLabel
      ? formatMessage(
          { id: "app.commitments.row.units" },
          { count: commitment.targetUnits.toString(), unit: commitment.unitLabel }
        )
      : formatMessage({ id: "app.commitments.row.untitled" }));

  return (
    <button
      type="button"
      onClick={() =>
        navigateToTop(`/home/${gardenId}/commitments/${attribution.commitmentId.toString()}`)
      }
      data-component="WorkFulfillsRow"
      className="w-full text-left tap-feedback"
    >
      <FormCard
        label={formatMessage({ id: "app.work.fulfills.label" })}
        value={formatMessage(
          { id: "app.work.fulfills.value" },
          { name, row: attribution.requirementIndex + 1 }
        )}
        Icon={RiHandHeartLine}
        className="border-primary-alpha-24"
      />
    </button>
  );
}
