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
  | "hasDecimalsReadFailure"
  | "hasNoJar"
  | "hasUnreadDecimals"
>;

export function resolveCookieJarReadState({
  jars,
  moduleConfigured,
  isPaused,
  error,
  hasDetailReadFailure,
  hasDecimalsReadFailure,
  hasNoJar,
  hasUnreadDecimals,
}: CookieJarRead): CookieJarReadState {
  if (!moduleConfigured) return "unavailable";
  // A jar's amounts need its currency's decimals. Until those are read, and after a failed read,
  // they use an 18-decimal fallback that misreads a six-decimal token, so a jar is not ready.
  if (jars.length > 0 && !hasUnreadDecimals && !hasDecimalsReadFailure) return "ready";
  // A read paused offline or failed proves nothing, even beside an empty list the cache still
  // holds, so it speaks first; only a finished read that came back empty shows the garden has
  // no jar. TanStack Query reports a paused or not-yet-fetching read as not loading.
  if (isPaused) return "offline";
  if (hasDecimalsReadFailure || (jars.length === 0 && (error || hasDetailReadFailure))) {
    return "failed";
  }
  return hasNoJar ? "no-jar" : "checking";
}
