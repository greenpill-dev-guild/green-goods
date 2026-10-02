/**
 * useCommitmentCycleLabel Hook
 *
 * A promise's season or campaign, in words: the name its stewards gave it once
 * the metadata is read, "Season" or "Campaign" until then. The promise page's
 * place line and the proof flow's promise sheet both say it this way.
 *
 * @module hooks/commitment-pooling/useCommitmentCycleLabel
 */

import { useIntl } from "react-intl";

import { useCommitmentCycleNames } from "./useCommitmentCycleNames";
import { useCommitmentCycle } from "./useCommitmentPooling";

export interface CommitmentCycleLabel {
  name: string;
  isCampaign: boolean;
}

/** Null for a promise outside any cycle, or while its cycle is still being read. */
export function useCommitmentCycleLabel({
  chainId,
  cycleId,
}: {
  chainId: number;
  cycleId: bigint | null | undefined;
}): CommitmentCycleLabel | null {
  const { formatMessage } = useIntl();
  const id = cycleId ?? 0n;
  const { cycle } = useCommitmentCycle({ chainId, cycleId: id }, { enabled: id !== 0n });
  const { byCycleId } = useCommitmentCycleNames(cycle ? [cycle] : []);
  if (!cycle) return null;
  const isCampaign = cycle.cycleType === "CAMPAIGN";
  return {
    isCampaign,
    name:
      byCycleId.get(cycle.cycleId.toString())?.name ??
      formatMessage({ id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season" }),
  };
}
