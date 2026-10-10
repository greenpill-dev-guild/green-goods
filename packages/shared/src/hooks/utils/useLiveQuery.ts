import type { Observable } from "dexie";
import { useEffect, useRef, useState } from "react";

export interface LiveQueryState<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isSuccess: boolean;
}

const IDLE: LiveQueryState<never> = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isSuccess: false,
};

/**
 * Subscribe to a Dexie live query for as long as the component is mounted.
 * `key` identifies what is being watched, an account for instance; the
 * subscription restarts when it changes and stops while it is null. The
 * latest `source` is used whenever a subscription starts.
 */
export function useLiveQuery<T>(
  key: string | null,
  source: () => Observable<T>
): LiveQueryState<T> {
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [state, setState] = useState<LiveQueryState<T>>(() =>
    key === null ? IDLE : { ...IDLE, isLoading: true }
  );

  useEffect(() => {
    if (key === null) {
      setState(IDLE);
      return;
    }
    setState((previous) =>
      previous.isLoading && previous.data === undefined ? previous : { ...IDLE, isLoading: true }
    );
    const subscription = sourceRef.current().subscribe({
      next: (data) => setState({ data, error: undefined, isLoading: false, isSuccess: true }),
      error: (error: unknown) =>
        setState((previous) => ({ ...previous, error, isLoading: false, isSuccess: false })),
    });
    return () => subscription.unsubscribe();
  }, [key]);

  return state;
}
