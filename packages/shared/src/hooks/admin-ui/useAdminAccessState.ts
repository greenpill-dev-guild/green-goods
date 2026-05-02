import { useAuth } from "../auth/useAuth";
import {
  useEligibleAdminGardens,
  type EligibleAdminGardensResult,
} from "../garden/useEligibleAdminGardens";

type ReadyEligibleGardens = Pick<
  EligibleAdminGardensResult,
  "eligibleGardens" | "resolvedDefaultGarden" | "hasStaleBaseList"
>;

export type AdminAccessState =
  | { status: "checking" }
  | { status: "disconnected" }
  | { status: "embedded-wallet"; signOut: () => Promise<void> }
  | { status: "indexer-error" }
  | { status: "no-access"; canCreateGarden: boolean }
  | ({ status: "ready" } & ReadyEligibleGardens);

/**
 * Shared terminal-state classifier for the admin app.
 *
 * The ordering intentionally preserves the eligible-garden fallback contract:
 * if `useEligibleAdminGardens` recovered a role-confirmed garden from `useRole`,
 * the admin route is ready even when the base garden list also reports an
 * indexer error.
 */
export function useAdminAccessState(): AdminAccessState {
  const { isAuthenticated, eoaAddress, isReady, authMode, signOut } = useAuth();
  const {
    eligibleGardens,
    resolvedDefaultGarden,
    canCreateGarden,
    isLoaded: eligibleGardensLoaded,
    isError: eligibleGardensError,
    hasStaleBaseList,
  } = useEligibleAdminGardens();

  if (!isReady || (isAuthenticated && !eligibleGardensLoaded)) {
    return { status: "checking" };
  }

  if (authMode === "embedded") {
    return { status: "embedded-wallet", signOut };
  }

  if (!isAuthenticated || !eoaAddress) {
    return { status: "disconnected" };
  }

  if (eligibleGardens.length > 0) {
    return {
      status: "ready",
      eligibleGardens,
      resolvedDefaultGarden,
      hasStaleBaseList,
    };
  }

  if (eligibleGardensError) {
    return { status: "indexer-error" };
  }

  return { status: "no-access", canCreateGarden };
}
