import { useLayoutEffect, useRef, useState } from "react";

type Activity = "sending" | "checking" | "withdrawing";
// Presentation timing, not an API delay: fast responses still have readable feedback.
const MINIMUM_FEEDBACK_MS = 600;

/** Owns only the visible action lifecycle; persistence and authorization stay in the data hook. */
export function useGardenJoinRequestActivity(scopeKey: string) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const active = useRef<{ cancel: () => void } | null>(null);
  useLayoutEffect(() => {
    setActivity(null);
    return () => {
      active.current?.cancel();
      active.current = null;
    };
  }, [scopeKey]);
  async function run<T>(next: Activity, operation: () => Promise<T>) {
    if (active.current) return null;
    let cancel = () => {};
    const readableFeedback = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, MINIMUM_FEEDBACK_MS);
      cancel = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    const current = { cancel };
    active.current = current;
    setActivity(next);
    const [result] = await Promise.allSettled([
      Promise.resolve().then(operation),
      readableFeedback,
    ]);
    if (active.current !== current) return null;
    active.current = null;
    setActivity(null);
    if (result.status === "rejected") throw result.reason;
    return { value: result.value };
  }
  return { activity, run };
}
