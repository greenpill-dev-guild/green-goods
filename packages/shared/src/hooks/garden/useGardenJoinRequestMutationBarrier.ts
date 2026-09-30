import { useCallback, useRef } from "react";

type RequestMutationBarrier = {
  scopeKey: string;
  promise: Promise<void>;
};

export function useGardenJoinRequestMutationBarrier() {
  const barrierRef = useRef<RequestMutationBarrier | null>(null);

  const beginRequestMutation = useCallback((scopeKey: string) => {
    const previousBarrier =
      barrierRef.current?.scopeKey === scopeKey ? barrierRef.current.promise : null;
    let release!: () => void;
    const ownBarrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const combinedBarrier = previousBarrier
      ? Promise.all([previousBarrier, ownBarrier]).then(() => undefined)
      : ownBarrier;
    barrierRef.current = { scopeKey, promise: combinedBarrier };
    return () => {
      release();
      void combinedBarrier.then(() => {
        if (barrierRef.current?.promise === combinedBarrier) barrierRef.current = null;
      });
    };
  }, []);

  const waitForRequestMutation = useCallback(async (scopeKey: string) => {
    const pending = barrierRef.current?.scopeKey === scopeKey ? barrierRef.current.promise : null;
    if (pending) await pending;
  }, []);

  return { beginRequestMutation, waitForRequestMutation };
}
