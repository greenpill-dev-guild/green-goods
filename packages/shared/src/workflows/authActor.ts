/**
 * Authentication Actor (Singleton)
 *
 * Creates and exports a singleton XState actor for authentication.
 * This actor is started once on module load and persists across the app.
 *
 * Usage:
 * ```ts
 * import { authActor } from '@green-goods/shared';
 *
 * // Send events
 * authActor.send({ type: 'LOGIN_PASSKEY_NEW', userName: 'alice' });
 *
 * // Subscribe to state changes
 * const subscription = authActor.subscribe((snapshot) => {
 *   console.log(snapshot.value, snapshot.context);
 * });
 *
 * // Get current snapshot
 * const snapshot = authActor.getSnapshot();
 * ```
 *
 * For React components, use `useSelector` from `@xstate/react`:
 * ```ts
 * import { useSelector } from '@xstate/react';
 * import { authActor } from '@green-goods/shared';
 *
 * function Component() {
 *   const isAuthenticated = useSelector(authActor, (s) => s.matches('authenticated'));
 *   const address = useSelector(authActor, (s) => s.context.smartAccountAddress);
 * }
 * ```
 */

import { createActor } from "xstate";

import { DEFAULT_CHAIN_ID } from "../config/blockchain";
import { authMachine } from "./authMachine";
import { authServices } from "./authServices";

// ============================================================================
// CREATE ACTOR WITH SERVICES
// ============================================================================

/**
 * Get chain ID at runtime (not module load time)
 * This ensures env vars are properly loaded before reading
 */
function getChainId(): number {
  const envChainId = (import.meta as any).env?.VITE_CHAIN_ID;
  const chainId = envChainId ? Number(envChainId) : DEFAULT_CHAIN_ID;
  console.debug("[AuthActor] Using chainId:", chainId, "from env:", envChainId);
  return chainId;
}

/**
 * Create the auth actor with proper services injected
 */
function createAuthActor() {
  // Get chain ID at runtime
  const chainId = getChainId();

  // Create actor with services and initial context
  const actor = createActor(
    authMachine.provide({
      actors: {
        restoreSession: authServices.restoreSession,
        registerPasskey: authServices.registerPasskey,
        authenticatePasskey: authServices.authenticatePasskey,
        claimENS: authServices.claimENS,
      },
    }),
    {
      input: {
        chainId,
      },
    }
  );

  return actor;
}

// ============================================================================
// SINGLETON ACTOR
// ============================================================================

/**
 * Singleton auth actor instance
 *
 * Started lazily on first access to avoid issues with SSR.
 * The actor persists for the lifetime of the application.
 */
let _authActor: ReturnType<typeof createAuthActor> | null = null;

export function getAuthActor() {
  if (!_authActor) {
    _authActor = createAuthActor();
    _authActor.start();
  }
  return _authActor;
}

/**
 * Export the actor directly for convenience
 *
 * Note: This starts the actor immediately when imported.
 * For SSR-safe code, use `getAuthActor()` instead.
 */
export const authActor = typeof window !== "undefined" ? getAuthActor() : null;

// ============================================================================
// HELPER SELECTORS
// ============================================================================

/**
 * Selectors for use with `useSelector` from @xstate/react
 *
 * Usage:
 * ```ts
 * const isAuthenticated = useSelector(authActor, authSelectors.isAuthenticated);
 * const address = useSelector(authActor, authSelectors.activeAddress);
 * ```
 */
export const authSelectors = {
  // State checks
  isInitializing: (snapshot: AuthSnapshot) => snapshot.matches("initializing"),
  isAuthenticated: (snapshot: AuthSnapshot) => snapshot.matches("authenticated"),
  isPasskeyAuth: (snapshot: AuthSnapshot) => snapshot.matches({ authenticated: "passkey" }),
  isWalletAuth: (snapshot: AuthSnapshot) => snapshot.matches({ authenticated: "wallet" }),
  isAuthenticating: (snapshot: AuthSnapshot) =>
    snapshot.matches("registering") || snapshot.matches("authenticating"),
  isError: (snapshot: AuthSnapshot) => snapshot.matches("error"),

  // Context values
  smartAccountAddress: (snapshot: AuthSnapshot) => snapshot.context.smartAccountAddress,
  walletAddress: (snapshot: AuthSnapshot) => snapshot.context.walletAddress,
  userName: (snapshot: AuthSnapshot) => snapshot.context.userName,
  error: (snapshot: AuthSnapshot) => snapshot.context.error,

  // Computed - respects auth mode (single source of truth)
  activeAddress: (snapshot: AuthSnapshot) => {
    if (snapshot.matches({ authenticated: "passkey" })) {
      return snapshot.context.smartAccountAddress;
    }
    if (snapshot.matches({ authenticated: "wallet" })) {
      return snapshot.context.walletAddress;
    }
    return null;
  },

  // Auth mode derived from state
  authMode: (snapshot: AuthSnapshot) => {
    if (
      snapshot.matches({ authenticated: "passkey" }) ||
      snapshot.matches({ authenticated: "claiming_ens" })
    ) {
      return "passkey" as const;
    }
    if (snapshot.matches({ authenticated: "wallet" })) {
      return "wallet" as const;
    }
    return null;
  },
};

// ============================================================================
// TYPES
// ============================================================================

export type AuthActor = ReturnType<typeof createAuthActor>;
export type AuthSnapshot = ReturnType<AuthActor["getSnapshot"]>;
