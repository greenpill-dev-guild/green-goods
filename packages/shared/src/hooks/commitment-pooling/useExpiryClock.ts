import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect, useMemo, useState } from "react";
import { WagmiContext } from "wagmi";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { selectNextDueBoundary } from "../../modules/commitment-pooling/steward-selectors";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import { useTimeout } from "../utils/useTimeout";

const MAX_TIMEOUT_MS = 2_147_483_647;

/** How long one read of the chain's time stands: a device drifts from it slowly. */
const CHAIN_CLOCK_STALE_MS = 30 * 60_000;

/** The chain's time now, in Unix seconds: this device's clock, moved by how far it runs off. */
const chainSecondsNow = (offsetMs: number) => BigInt(Math.floor((Date.now() + offsetMs) / 1000));

/**
 * How far the chain's clock runs ahead of this device's, in milliseconds: the latest block's
 * timestamp against the device's time as it arrived, read once per chain through the app's wagmi
 * client. Zero where there is no wallet runtime (a public page, a test), until the read answers,
 * and while the latest read has failed, so the device's clock stands in. A block's timestamp
 * trails the chain's head by up to a block, which keeps the clock that little behind, never
 * ahead. The calibration is read again whenever the app comes back (`useExpiryClock`) and never
 * persisted, since a device clock corrected meanwhile would carry an old offset with it. For the
 * same reason a failed read drops an earlier answer, which TanStack would otherwise keep.
 */
function useChainClockOffsetMs(chainId: number): number {
  const config = useContext(WagmiContext);
  const { data, isError } = useQuery({
    queryKey: commitmentPoolingKeys.chainClock(chainId),
    queryFn: async () => {
      if (!config) throw new Error("No wagmi client to read the chain's time");
      const { readChainClockOffsetMs } = await import("../../utils/blockchain/chain-clock");
      return readChainClockOffsetMs(config, chainId);
    },
    enabled: config !== undefined,
    staleTime: CHAIN_CLOCK_STALE_MS,
    retry: 1,
  });
  return isError ? 0 : (data ?? 0);
}

/**
 * The chain's clock, in Unix seconds, kept current while a surface is open and after sleep: it
 * is the device's clock set to the chain's latest block (`useChainClockOffsetMs`), so a device
 * that runs fast or slow neither hides a promise early nor offers one past due, and it ticks
 * when one of the commitments falls due, and on focus or return. Expiry reads it, and take-up
 * through `useDueClock`.
 */
export function useExpiryClock(input: {
  chainId: number;
  commitments: readonly Pick<CommitmentReadModel, "onchainState" | "cycleId" | "dueDate">[];
  cycleEndTimes: ReadonlyMap<string, bigint | null>;
}): bigint {
  const { chainId, commitments, cycleEndTimes } = input;
  const queryClient = useQueryClient();
  const offsetMs = useChainClockOffsetMs(chainId);
  const [now, setNow] = useState(() => chainSecondsNow(offsetMs));
  // The chain's time arrives after the first render, and is read again now and then: the clock
  // moves to it in the render that brings it.
  const [readWith, setReadWith] = useState(offsetMs);
  if (readWith !== offsetMs) {
    setReadWith(offsetMs);
    setNow(chainSecondsNow(offsetMs));
  }
  const { set: setTimer, clear: clearTimer } = useTimeout();
  const nextDue = useMemo(
    () => selectNextDueBoundary({ commitments, cycleEndTimes, now }),
    [commitments, cycleEndTimes, now]
  );

  useEffect(() => {
    if (nextDue === null) return;
    // Expiry is strictly after the due second. Cap the wait at the browser's
    // 32-bit timer limit, then check the clock again for distant deadlines.
    const remaining = (nextDue + 1n) * 1000n - BigInt(Date.now() + offsetMs);
    const delay =
      remaining <= 0n ? 0 : Number(remaining > BigInt(MAX_TIMEOUT_MS) ? MAX_TIMEOUT_MS : remaining);
    setTimer(() => setNow(chainSecondsNow(offsetMs)), delay);
    return clearTimer;
  }, [nextDue, now, offsetMs, setTimer, clearTimer]);

  useEffect(() => {
    const updateClock = () => {
      setNow(chainSecondsNow(offsetMs));
      // The device's clock may have been corrected while the app was away: read the chain's
      // time again, and the clock moves to it as the read answers.
      void queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.chainClock(chainId) });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") updateClock();
    };
    window.addEventListener("focus", updateClock);
    window.addEventListener("online", updateClock);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", updateClock);
      window.removeEventListener("online", updateClock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [chainId, offsetMs, queryClient]);

  return now;
}
