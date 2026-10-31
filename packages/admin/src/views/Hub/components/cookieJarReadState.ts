import type { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";

/** What a surface can say about a garden's jars right now. */
export type CookieJarReadState =
  | "ready"
  | "checking"
  | "offline"
  | "failed"
  | "no-jar"
  | "unavailable";

type CookieJarRead = Pick<
  ReturnType<typeof useGardenCookieJars>,
  | "jars"
  | "moduleConfigured"
  | "isPaused"
  | "error"
  | "hasDetailReadFailure"
  | "hasNoJar"
  | "hasUnreadDecimals"
>;

export function resolveCookieJarReadState({
  jars,
  moduleConfigured,
  isPaused,
  error,
  hasDetailReadFailure,
  hasNoJar,
  hasUnreadDecimals,
}: CookieJarRead): CookieJarReadState {
  if (!moduleConfigured) return "unavailable";
  // A jar's amounts need its currency's decimals: until those are read they use a fallback,
  // so a jar waits like any other unfinished read.
  const awaitingAmounts = jars.length > 0 && hasUnreadDecimals;
  if (jars.length > 0 && !awaitingAmounts) return "ready";
  // A read paused offline or failed proves nothing, even beside an empty list the cache still
  // holds, so it speaks first; only a finished read that came back empty shows the garden has
  // no jar. TanStack Query reports a paused or not-yet-fetching read as not loading.
  if (isPaused) return "offline";
  if (!awaitingAmounts && (error || hasDetailReadFailure)) return "failed";
  return hasNoJar ? "no-jar" : "checking";
}
