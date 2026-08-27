import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { getPoolFundingSnapshot } from "../../modules/commitment-pooling/data-pool-funding";
import type { Address } from "../../types/domain";

const FUNDING_REFRESH_INTERVAL_MS = 30_000;

export function usePoolFunding(input: { chainId: number; garden: Address }) {
  const lastBalance = useRef<{
    chainId: number;
    garden: Address;
    safe: Address;
    balance: NonNullable<Awaited<ReturnType<typeof getPoolFundingSnapshot>>["balance"]>;
  } | null>(null);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.poolFunding(input.chainId, input.garden),
    queryFn: () => getPoolFundingSnapshot(input.chainId, input.garden),
    staleTime: STALE_TIME_MEDIUM,
    refetchInterval: FUNDING_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
  const rawSnapshot = query.data ?? null;
  if (rawSnapshot?.safe && rawSnapshot.balance) {
    lastBalance.current = {
      chainId: input.chainId,
      garden: input.garden,
      safe: rawSnapshot.safe,
      balance: rawSnapshot.balance,
    };
  }
  const hasStaleBalance = Boolean(
    rawSnapshot?.safe &&
      !rawSnapshot.balance &&
      rawSnapshot.fundingUnavailableReasons.includes("balance_unreadable") &&
      lastBalance.current?.chainId === input.chainId &&
      lastBalance.current.garden.toLowerCase() === input.garden.toLowerCase() &&
      lastBalance.current?.safe.toLowerCase() === rawSnapshot.safe.toLowerCase()
  );
  const snapshot =
    rawSnapshot && hasStaleBalance && lastBalance.current
      ? { ...rawSnapshot, balance: lastBalance.current.balance }
      : rawSnapshot;

  return {
    ...query,
    snapshot,
    hasStaleBalance,
    lastReadAt: snapshot?.balance?.readAt ?? null,
    ledgerReadAt: snapshot?.ledgerReadAt ?? null,
  };
}
