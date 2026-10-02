import { useEffect, useMemo, useState } from "react";
import { selectNextDueBoundary } from "../../modules/commitment-pooling/steward-selectors";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import { useTimeout } from "../utils/useTimeout";

const MAX_TIMEOUT_MS = 2_147_483_647;

/** Keep expiry eligibility current in an open review, including after sleep. */
export function useExpiryClock(input: {
  commitments: readonly Pick<CommitmentReadModel, "onchainState" | "cycleId" | "dueDate">[];
  cycleEndTimes: ReadonlyMap<string, bigint | null>;
}): bigint {
  const { commitments, cycleEndTimes } = input;
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const { set: setTimer, clear: clearTimer } = useTimeout();
  const nextDue = useMemo(
    () => selectNextDueBoundary({ commitments, cycleEndTimes, now }),
    [commitments, cycleEndTimes, now]
  );

  useEffect(() => {
    if (nextDue === null) return;
    // Expiry is strictly after the due second. Cap the wait at the browser's
    // 32-bit timer limit, then check the clock again for distant deadlines.
    const remaining = (nextDue + 1n) * 1000n - BigInt(Date.now());
    const delay =
      remaining <= 0n ? 0 : Number(remaining > BigInt(MAX_TIMEOUT_MS) ? MAX_TIMEOUT_MS : remaining);
    setTimer(() => setNow(BigInt(Math.floor(Date.now() / 1000))), delay);
    return clearTimer;
  }, [nextDue, now, setTimer, clearTimer]);

  useEffect(() => {
    const updateClock = () => setNow(BigInt(Math.floor(Date.now() / 1000)));
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
  }, []);

  return now;
}
