/** Refresh live steward reads while their review surface is open. */
const REVIEW_REFRESH_MS = 20_000;

export function reviewRefreshOptions(active: boolean) {
  return {
    // TanStack Query pauses intervals in the background and disposes them when
    // the observer unmounts. Focus/reconnect catches up immediately afterward.
    refetchInterval: active ? REVIEW_REFRESH_MS : (false as const),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: active ? ("always" as const) : undefined,
    refetchOnReconnect: active ? ("always" as const) : undefined,
  };
}
