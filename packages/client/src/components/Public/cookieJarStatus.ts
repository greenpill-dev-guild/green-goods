export type CookieJarStatus =
  | { kind: "for-you-claimable"; bucket: "for-you" }
  | { kind: "for-you-cooldown"; bucket: "for-you"; nextClaimAt: number }
  | { kind: "for-you-claimed"; bucket: "for-you" }
  | { kind: "needs-funding"; bucket: "active" }
  | { kind: "claims-paused"; bucket: "active" }
  | { kind: "active-open"; bucket: "active" }
  | { kind: "active-not-eligible"; bucket: "active" }
  | { kind: "loading"; bucket: "unresolved" }
  | { kind: "error"; bucket: "unresolved" };

interface JarLikeForStatus {
  isPaused: boolean;
  balance: bigint;
  isEligible: boolean;
  canClaimNow: boolean;
  nextClaimAt: number | null;
  oneTimeWithdrawal: boolean;
  totalWithdrawn: bigint;
}

export function classifyCookieJarStatus(
  jar: JarLikeForStatus | null | undefined,
  options: { hasError: boolean; isConnected: boolean; isLoading: boolean }
): CookieJarStatus {
  if (options.hasError) return { kind: "error", bucket: "unresolved" };
  if (!jar) {
    return {
      kind: options.isLoading ? "loading" : "error",
      bucket: "unresolved",
    };
  }

  if (jar.isPaused) return { kind: "claims-paused", bucket: "active" };
  if (jar.balance === 0n) return { kind: "needs-funding", bucket: "active" };

  if (options.isConnected && jar.isEligible) {
    if (jar.canClaimNow) return { kind: "for-you-claimable", bucket: "for-you" };
    if (jar.oneTimeWithdrawal && jar.totalWithdrawn > 0n) {
      return { kind: "for-you-claimed", bucket: "for-you" };
    }
    if (jar.nextClaimAt && jar.nextClaimAt * 1000 > Date.now()) {
      return { kind: "for-you-cooldown", bucket: "for-you", nextClaimAt: jar.nextClaimAt };
    }
  }

  if (options.isConnected && !jar.isEligible) {
    return { kind: "active-not-eligible", bucket: "active" };
  }
  return { kind: "active-open", bucket: "active" };
}
