import { useNavigateToTop } from "@green-goods/shared/hooks/app/useNavigateToTop";
import {
  useCommitment,
  useCommitmentMetadataFor,
  useCommitmentPool,
  useCommitmentWorkAttributionsForWork,
} from "@green-goods/shared/commitment-pooling";
import { formatCommitmentUnits } from "@green-goods/shared/i18n";
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
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigateToTop = useNavigateToTop();
  const { attributions } = useCommitmentWorkAttributionsForWork({ chainId, workUID });
  const attribution = attributions.find((entry) => entry.linked) ?? null;
  const { detail } = useCommitment(
    { chainId, commitmentId: attribution?.commitmentId ?? 0n },
    { enabled: Boolean(attribution) }
  );
  const metadata = useCommitmentMetadataFor(detail?.commitment);
  // The commitment lives under the garden that owns its pool, which on the
  // protocol pool is not the garden this work was submitted to. Opening it
  // under the work's garden would have the detail screen derive names, roles
  // and preflights from the wrong route.
  const { pool } = useCommitmentPool(
    { chainId, poolId: detail?.commitment.poolId ?? 0n },
    { enabled: Boolean(detail?.commitment.poolId) }
  );
  if (!attribution) return null;

  const commitment = detail?.commitment;
  const commitmentGarden = pool?.garden ?? gardenId;
  const name =
    metadata?.title ??
    (commitment?.unitLabel
      ? formatCommitmentUnits(intl, commitment.targetUnits, commitment.unitLabel)
      : formatMessage({ id: "app.commitments.row.untitled" }));

  return (
    <button
      type="button"
      onClick={() =>
        navigateToTop(
          `/home/${commitmentGarden}/commitments/${attribution.commitmentId.toString()}`
        )
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
