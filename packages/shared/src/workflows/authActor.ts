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
import { createPasskeyServerClient, isPasskeyServerAvailable } from "../config/passkeyServer";
import { authMachine } from "./authMachine";
import { authServices } from "./authServices";

// ============================================================================
// CREATE ACTOR WITH SERVICES
// ============================================================================

/**
 * Create the auth actor with proper services injected
 */
function createAuthActor() {
  // Initialize passkey server client if available
  let passkeyClient = null;
  if (isPasskeyServerAvailable()) {
    try {
      passkeyClient = createPasskeyServerClient(DEFAULT_CHAIN_ID);
    } catch (error) {
      console.warn("[AuthActor] Failed to create passkey server client:", error);
    }
  }

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
        chainId: DEFAULT_CHAIN_ID,
        passkeyClient,
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
 * Common selectors for use with `useSelector`
 */
export const authSelectors = {
  // State checks
  isInitializing: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().matches("initializing"),

  isAuthenticated: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().matches("authenticated"),

  isPasskeyAuth: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().matches({ authenticated: "passkey" }),

  isWalletAuth: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().matches({ authenticated: "wallet" }),

  isAuthenticating: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().matches("registering") || state().matches("authenticating"),

  isError: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) => state().matches("error"),

  // Context values
  smartAccountAddress: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().context.smartAccountAddress,

  walletAddress: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().context.walletAddress,

  userName: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) => state().context.userName,

  error: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) => state().context.error,

  // Computed
  activeAddress: (state: ReturnType<typeof getAuthActor>["getSnapshot"]) =>
    state().context.smartAccountAddress || state().context.walletAddress,
};

// ============================================================================
// TYPES
// ============================================================================

export type AuthActor = ReturnType<typeof createAuthActor>;
export type AuthSnapshot = ReturnType<AuthActor["getSnapshot"]>;
