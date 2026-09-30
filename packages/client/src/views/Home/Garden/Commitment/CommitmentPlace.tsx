import {
  type CommitmentReadModel,
  useCommitmentCycle,
  useCommitmentCycleNames,
} from "@green-goods/shared/commitment-pooling";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import type { Address } from "@green-goods/shared/types/domain";
import { RiFlagLine, RiSunLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface CommitmentPlaceProps {
  chainId: number;
  commitment: CommitmentReadModel;
  /** The garden whose pool holds the promise. */
  garden: Address | null | undefined;
}

/**
 * Where a promise lives, for the line under its title: its season or campaign,
 * with that cycle's glyph, and its garden. Each part shows once it resolves;
 * a promise outside any season names only its garden.
 */
export function CommitmentPlace({ chainId, commitment, garden }: CommitmentPlaceProps) {
  const { formatMessage } = useIntl();
  const cycleId = commitment.cycleId ?? 0n;
  const { cycle } = useCommitmentCycle({ chainId, cycleId }, { enabled: cycleId !== 0n });
  const { byCycleId } = useCommitmentCycleNames(cycle ? [cycle] : []);
  const { data: gardens = [] } = useGardens(chainId);
  const gardenName = garden
    ? gardens.find((entry) => entry.id.toLowerCase() === garden.toLowerCase())?.name
    : undefined;
  const isCampaign = cycle?.cycleType === "CAMPAIGN";
  const cycleName = cycle
    ? (byCycleId.get(cycle.cycleId.toString())?.name ??
      formatMessage({ id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season" }))
    : null;

  if (!cycleName && !gardenName) return null;
  return (
    <p className="-mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-text-sub-600">
      {cycleName ? (
        <>
          {isCampaign ? (
            <RiFlagLine className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <RiSunLine className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{cycleName}</span>
        </>
      ) : null}
      {cycleName && gardenName ? <span aria-hidden="true">·</span> : null}
      {gardenName ? <span>{gardenName}</span> : null}
    </p>
  );
}
