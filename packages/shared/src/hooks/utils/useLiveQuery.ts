import type { Observable } from "dexie";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveQueryState<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isSuccess: boolean;
  /** The last subscription failed, and nothing has answered since. */
  isError: boolean;
  /** Subscribe again, as after a failed read; a later subscription gets a fresh attempt. */
  retry: () => void;
}

type LiveQueryAnswer<T> = Omit<LiveQueryState<T>, "retry">;

const IDLE: LiveQueryAnswer<never> = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isSuccess: false,
  isError: false,
};

/**
 * Subscribe to a Dexie live query for as long as the component is mounted.
 * `key` identifies what is being watched, an account for instance; the
 * subscription restarts when it changes, or on `retry`, and stops while it is
 * null. The latest `source` is used whenever a subscription starts.
 */
export function useLiveQuery<T>(
  key: string | null,
  source: () => Observable<T>
): LiveQueryState<T> {
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LiveQueryAnswer<T>>(() =>
    key === null ? IDLE : { ...IDLE, isLoading: true }
  );

  useEffect(() => {
    // `attempt` restarts the subscription; nothing else in it reads the counter.
    void attempt;
    if (key === null) {
      setState(IDLE);
      return;
    }
    setState((previous) =>
      previous.isLoading && previous.data === undefined ? previous : { ...IDLE, isLoading: true }
    );
    const subscription = sourceRef.current().subscribe({
      next: (data) =>
        setState({ data, error: undefined, isLoading: false, isSuccess: true, isError: false }),
      error: (error: unknown) =>
        setState((previous) => ({
          ...previous,
          error,
          isLoading: false,
          isSuccess: false,
          isError: true,
        })),
    });
    return () => subscription.unsubscribe();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { ...state, retry };
}
