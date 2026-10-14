/**
 * useGoodDollarPrice Hook
 *
 * The one place the app reads today's G$ price in dollars (the rules live in
 * `modules/wallet/good-dollar-price`). While a screen uses it, it is read
 * again every minute; `readNow` reads it once more just before a write fixes a
 * G$ amount, so the amount a steward creates is never converted on a stale
 * rate. Swapping the source later means changing that module, not its callers.
 *
 * @module hooks/blockchain/useGoodDollarPrice
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { tokensKeys } from "../../config/query-keys/tokens";
import {
  type GoodDollarPrice,
  type GoodDollarPriceState,
  goodDollarPriceState,
  readGoodDollarPrice,
} from "../../modules/wallet/good-dollar-price";

const REFRESH_MS = 60_000;

export interface GoodDollarPriceReader {
  state: GoodDollarPriceState;
  /** A fresh read, for the moment a G$ amount is fixed. Rejects when there is no usable price. */
  readNow: () => Promise<GoodDollarPrice>;
}

export function useGoodDollarPrice(options: { enabled?: boolean } = {}): GoodDollarPriceReader {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: tokensKeys.goodDollarPrice(),
    queryFn: () => readGoodDollarPrice(),
    enabled,
    refetchInterval: enabled ? REFRESH_MS : false,
    staleTime: REFRESH_MS / 2,
    retry: 1,
  });
  const readNow = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: tokensKeys.goodDollarPrice(),
        queryFn: () => readGoodDollarPrice(),
        staleTime: 0,
      }),
    [queryClient]
  );
  return {
    // Read at render: the minute's refetch re-renders, so a read that ages past
    // its limit turns stale on the next one even when the refetch fails.
    state: enabled ? goodDollarPriceState(query, Date.now()) : { status: "loading" },
    readNow,
  };
}
