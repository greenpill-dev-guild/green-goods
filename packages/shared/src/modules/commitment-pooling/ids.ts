import type { Address } from "../../types/domain";

const address = (value: Address | string) => value.toLowerCase();
const hex = (value: string) => value.toLowerCase();

export const getCommitmentPoolId = (chainId: number, poolId: bigint) => `${chainId}-${poolId}`;
export const getCommitmentCycleId = (chainId: number, cycleId: bigint) => `${chainId}-${cycleId}`;
export const getCommitmentId = (chainId: number, commitmentId: bigint) =>
  `${chainId}-${commitmentId}`;
export const getCommitmentSeriesId = (chainId: number, seriesId: bigint) =>
  `${chainId}-${seriesId}`;
export const getCommitmentSeriesCycleSummaryId = (
  chainId: number,
  seriesId: bigint,
  cycleId: bigint
) => `${chainId}-${seriesId}-${cycleId}`;
export const getCommitmentContributorId = (
  chainId: number,
  commitmentId: bigint,
  contributor: Address | string
) => `${chainId}-${commitmentId}-${address(contributor)}`;
export const getCommitmentClaimRequestId = (
  chainId: number,
  commitmentId: bigint,
  claimant: Address | string
) => `${chainId}-${commitmentId}-${address(claimant)}`;
export const getCommitmentUnitSummaryId = (
  chainId: number,
  scope: "POOL" | "CYCLE",
  scopeId: bigint,
  unitLabelHash: string
) => `${chainId}-${scope}-${scopeId}-${hex(unitLabelHash)}`;
export const getNeedCommitmentIndexId = (chainId: number, needUID: string) =>
  `${chainId}-${hex(needUID)}`;
export const getCommitmentExchangeId = (
  chainId: number,
  poolId: bigint,
  commitmentIdA: bigint,
  commitmentIdB: bigint
) => `${chainId}-EXCHANGE-${poolId}-${commitmentIdA}-${commitmentIdB}`;
export const getPoolMemberHistoryId = (
  chainId: number,
  poolId: bigint,
  account: Address | string
) => `${chainId}-${poolId}-${address(account)}`;
export const getCommitmentEventId = (chainId: number, txHash: string, logIndex: number) =>
  `${chainId}-${hex(txHash)}-${logIndex}`;
