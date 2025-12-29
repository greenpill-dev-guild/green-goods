/**
 * Analytics Identity Hook
 *
 * Syncs user identity with PostHog when authentication state changes.
 * - Identifies user by their primary address (wallet or smart account)
 * - Sets person properties (auth_mode, app, chain_id, etc.)
 * - Resets identity on logout
 *
 * Usage:
 * ```tsx
 * // In your app root (inside AuthProvider + AppProvider)
 * function App() {
 *   useAnalyticsIdentity({ app: 'client' });
 *   return <Routes />;
 * }
 * ```
 */

import { useEffect, useRef } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { identifyWithProperties, reset, track } from "../../modules/app/posthog";
import { useAuth } from "../auth/useAuth";
import { useUser } from "../auth/useUser";

export interface UseAnalyticsIdentityOptions {
  /** App identifier for segmentation */
  app: "client" | "admin";
  /** Whether user is in PWA mode */
  isPwa?: boolean;
  /** User's locale */
  locale?: string;
}

/**
 * Sync user identity with PostHog analytics.
 *
 * Call this hook once in your app root. It will:
 * - Identify the user when they log in
 * - Update person properties when auth state changes
 * - Reset identity when they log out
 */
export function useAnalyticsIdentity(options: UseAnalyticsIdentityOptions) {
  const { app, isPwa = false, locale } = options;
  const { isAuthenticated, authMode, isReady } = useAuth();
  const { primaryAddress } = useUser();

  // Track previous state to detect changes
  const prevStateRef = useRef<{
    isAuthenticated: boolean;
    primaryAddress: string | null;
    authMode: "wallet" | "passkey" | null;
  }>({
    isAuthenticated: false,
    primaryAddress: null,
    authMode: null,
  });

  useEffect(() => {
    // Wait for auth to be ready
    if (!isReady) return;

    const prev = prevStateRef.current;
    const current = {
      isAuthenticated,
      primaryAddress,
      authMode,
    };

    // Detect login (wasn't authenticated, now is)
    const justLoggedIn = !prev.isAuthenticated && current.isAuthenticated && current.primaryAddress;

    // Detect logout (was authenticated, now isn't)
    const justLoggedOut = prev.isAuthenticated && !current.isAuthenticated;

    // Detect address change while authenticated (e.g., switched auth method)
    const addressChanged =
      current.isAuthenticated &&
      prev.isAuthenticated &&
      prev.primaryAddress !== current.primaryAddress &&
      current.primaryAddress;

    if (justLoggedIn || addressChanged) {
      // Identify with the new address
      identifyWithProperties(current.primaryAddress!, {
        auth_mode: current.authMode,
        app,
        chain_id: DEFAULT_CHAIN_ID,
        is_pwa: isPwa,
        locale,
      });

      // Track the login event
      if (justLoggedIn) {
        track("auth_login_success", {
          auth_mode: current.authMode,
          app,
        });
      }
    }

    if (justLoggedOut) {
      // Track logout before resetting
      track("auth_logout", {
        auth_mode: prev.authMode,
        app,
      });

      // Reset PostHog identity
      reset();
    }

    // Update ref for next comparison
    prevStateRef.current = current;
  }, [isReady, isAuthenticated, primaryAddress, authMode, app, isPwa, locale]);
}

export default useAnalyticsIdentity;
