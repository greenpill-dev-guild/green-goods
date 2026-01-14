/**
 * Authentication State Machine
 *
 * XState 5 machine for managing passkey and wallet authentication flows.
 * Integrates with Pimlico passkey server for credential storage.
 *
 * Design Principles:
 * 1. ALL state transitions defined in the machine (no React-side filtering)
 * 2. External events (wallet connect/disconnect) are always received
 * 3. Passkey and wallet auth are MUTUALLY EXCLUSIVE
 * 4. Explicit transitions for switching auth methods
 *
 * States:
 * - initializing: Checking for existing session
 * - unauthenticated: No active session, ready for login
 * - registering: Creating new passkey (new user flow)
 * - authenticating: Logging in with existing passkey (returning user flow)
 * - wallet_connecting: Opening wallet modal, waiting for connection
 * - authenticated.passkey: Active passkey session
 * - authenticated.wallet: Active wallet session
 * - error: Recoverable error state
 *
 * External Events (from wagmi/wallet):
 * - EXTERNAL_WALLET_CONNECTED: Wallet connected (browser extension, etc.)
 * - EXTERNAL_WALLET_DISCONNECTED: Wallet disconnected
 *
 * User Actions:
 * - LOGIN_PASSKEY_NEW: Create new passkey account
 * - LOGIN_PASSKEY_EXISTING: Login with existing passkey
 * - LOGIN_WALLET: Open wallet modal to connect
 * - SWITCH_TO_WALLET: Switch from passkey to connected wallet
 * - SWITCH_TO_PASSKEY: Switch from wallet to passkey (triggers login flow)
 * - SIGN_OUT: Clear all auth state
 */

import { type SmartAccountClient } from "permissionless";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { assign, fromPromise, setup } from "xstate";

import { type PasskeyServerClient } from "../config/passkeyServer";

// ============================================================================
// CONTEXT
// ============================================================================

export interface AuthContext {
  // Pimlico server client (initialized at start)
  passkeyClient: PasskeyServerClient | null;

  // Passkey session state
  credential: P256Credential | null;
  userName: string | null;
  smartAccountClient: SmartAccountClient | null;
  smartAccountAddress: Hex | null;

  // Wallet session state (when authenticated via wallet)
  walletAddress: Hex | null;

  // External wallet state (always tracked, even when not primary auth)
  // This allows us to know a wallet is available for switching
  externalWalletConnected: boolean;
  externalWalletAddress: Hex | null;

  // Meta
  chainId: number;
  error: Error | null;
  retryCount: number;
}

// ============================================================================
// EVENTS
// ============================================================================

export type AuthEvent =
  // ─────────────────────────────────────────────────────────────────────────
  // User-initiated actions
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "LOGIN_PASSKEY_NEW"; userName: string }
  | { type: "LOGIN_PASSKEY_EXISTING"; userName: string }
  | { type: "LOGIN_WALLET" }
  | { type: "SWITCH_TO_WALLET" } // Switch from passkey to wallet (requires external wallet)
  | { type: "SWITCH_TO_PASSKEY"; userName: string } // Switch from wallet to passkey
  | { type: "SIGN_OUT" }
  | { type: "RETRY" }
  | { type: "DISMISS_ERROR" }
  // ─────────────────────────────────────────────────────────────────────────
  // External events (from wagmi - always sent, machine decides what to do)
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "EXTERNAL_WALLET_CONNECTED"; address: Hex }
  | { type: "EXTERNAL_WALLET_DISCONNECTED" }
  | { type: "MODAL_CLOSED" } // Wallet modal was closed without connecting
  // ─────────────────────────────────────────────────────────────────────────
  // ENS
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "CLAIM_ENS"; name: string }
  // ─────────────────────────────────────────────────────────────────────────
  // Internal (from services/actors)
  // ─────────────────────────────────────────────────────────────────────────
  | { type: "done.invoke.restoreSession"; output: RestoreSessionResult | null }
  | { type: "error.platform.restoreSession"; error: unknown }
  | { type: "done.invoke.registerPasskey"; output: PasskeySessionResult }
  | { type: "error.platform.registerPasskey"; error: unknown }
  | { type: "done.invoke.authenticatePasskey"; output: PasskeySessionResult }
  | { type: "error.platform.authenticatePasskey"; error: unknown }
  | { type: "done.invoke.claimENS"; output: void }
  | { type: "error.platform.claimENS"; error: unknown };

// Service result types
export interface PasskeySessionResult {
  credential: P256Credential;
  smartAccountClient: SmartAccountClient;
  smartAccountAddress: Hex;
  userName: string;
}

export interface RestoreSessionResult extends PasskeySessionResult {}

// ============================================================================
// ACTOR INPUT TYPES
// ============================================================================

/** Input for session restore operation */
export interface RestoreSessionInput {
  passkeyClient: PasskeyServerClient | null;
  chainId: number;
}

/** Input for passkey operations (register/authenticate) */
export interface PasskeyOperationInput {
  passkeyClient: PasskeyServerClient | null;
  userName: string | null;
  chainId: number;
}

/** Input for ENS claiming */
export interface ClaimENSInput {
  smartAccountClient: SmartAccountClient | null;
  name: string;
}

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface AuthInput {
  chainId: number;
  passkeyClient: PasskeyServerClient | null;
}

// ============================================================================
// MACHINE SETUP
// ============================================================================

const authSetup = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
    input: {} as AuthInput,
  },
  actions: {
    // ─────────────────────────────────────────────────────────────────────────
    // Clear actions
    // ─────────────────────────────────────────────────────────────────────────

    /** Clear all auth state (full sign out) */
    clearAllAuthState: assign({
      credential: null,
      userName: null,
      smartAccountClient: null,
      smartAccountAddress: null,
      walletAddress: null,
      error: null,
      retryCount: 0,
      // Note: Keep externalWallet* - that's tracked independently
    }),

    /** Clear only passkey session (keep external wallet tracking) */
    clearPasskeySession: assign({
      credential: null,
      smartAccountClient: null,
      smartAccountAddress: null,
    }),

    /** Clear only wallet auth (keep external wallet tracking) */
    clearWalletAuth: assign({
      walletAddress: null,
    }),

    /** Clear error state */
    clearError: assign({
      error: null,
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Store actions
    // ─────────────────────────────────────────────────────────────────────────

    /** Store passkey session from successful auth */
    storePasskeySession: assign(({ event }) => {
      const { output } = event as { output: PasskeySessionResult };
      return {
        credential: output.credential,
        smartAccountClient: output.smartAccountClient,
        smartAccountAddress: output.smartAccountAddress,
        userName: output.userName,
        error: null,
        retryCount: 0,
      };
    }),

    /** Store wallet address as primary auth */
    storeWalletAuth: assign({
      walletAddress: ({ context }) => context.externalWalletAddress,
      error: null,
    }),

    /** Store userName for registration/login */
    storeUserName: assign({
      userName: ({ event }) => {
        const e = event as { userName: string };
        return e.userName;
      },
    }),

    /** Store error from failed operation */
    storeError: assign({
      error: ({ event }) => {
        const e = event as { error: unknown };
        if (e.error instanceof Error) return e.error;
        if (typeof e.error === "string") return new Error(e.error);
        return new Error("Authentication failed");
      },
    }),

    /** Increment retry count */
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // External wallet tracking (independent of auth state)
    // ─────────────────────────────────────────────────────────────────────────

    /** Track external wallet connection (doesn't change auth state) */
    trackExternalWalletConnected: assign({
      externalWalletConnected: true,
      externalWalletAddress: ({ event }) => {
        const e = event as { type: "EXTERNAL_WALLET_CONNECTED"; address: Hex };
        return e.address;
      },
    }),

    /** Track external wallet disconnection */
    trackExternalWalletDisconnected: assign({
      externalWalletConnected: false,
      externalWalletAddress: null,
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Logging actions (for debugging)
    // ─────────────────────────────────────────────────────────────────────────

    /** Log when external wallet connects during passkey session */
    logWalletConnectedDuringPasskey: ({ context, event }) => {
      const e = event as { type: "EXTERNAL_WALLET_CONNECTED"; address: Hex };
      console.debug(
        "[AuthMachine] External wallet connected while in passkey mode.",
        "\n  Wallet:",
        e.address,
        "\n  Smart Account:",
        context.smartAccountAddress,
        "\n  Use SWITCH_TO_WALLET event to switch auth method."
      );
    },

    /** Log when external wallet disconnects during wallet auth */
    logWalletDisconnectedDuringWalletAuth: ({ context }) => {
      console.debug(
        "[AuthMachine] External wallet disconnected while in wallet auth mode.",
        "\n  Previous wallet:",
        context.walletAddress,
        "\n  Transitioning to unauthenticated."
      );
    },
  },
  guards: {
    /** Can retry authentication (max 3 attempts) */
    canRetry: ({ context }) => context.retryCount < 3,

    /** External wallet is connected (can switch to wallet auth) */
    hasExternalWallet: ({ context }) => context.externalWalletConnected === true,

    /** Session was successfully restored */
    sessionRestored: ({ event }) => {
      const e = event as { output: RestoreSessionResult | null };
      return e.output !== null;
    },
  },
  actors: {
    // Placeholder actors with proper typing - actual implementations provided in authActor.ts
    restoreSession: fromPromise<RestoreSessionResult | null, RestoreSessionInput>(
      async () => {
        throw new Error("restoreSession actor not provided");
      }
    ),
    registerPasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(async () => {
      throw new Error("registerPasskey actor not provided");
    }),
    authenticatePasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(async () => {
      throw new Error("authenticatePasskey actor not provided");
    }),
    claimENS: fromPromise<void, ClaimENSInput>(async () => {
      throw new Error("claimENS actor not provided");
    }),
  },
});

// ============================================================================
// MACHINE DEFINITION
// ============================================================================

export const authMachine = authSetup.createMachine({
  id: "auth",
  initial: "initializing",

  context: ({ input }) => ({
    passkeyClient: input?.passkeyClient ?? null,
    credential: null,
    userName: null,
    smartAccountClient: null,
    smartAccountAddress: null,
    walletAddress: null,
    externalWalletConnected: false,
    externalWalletAddress: null,
    chainId: input?.chainId ?? 84532, // Default to Base Sepolia
    error: null,
    retryCount: 0,
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL EVENT HANDLERS
  // These events are handled from ANY state - the machine decides what to do
  // ═══════════════════════════════════════════════════════════════════════════
  on: {
    // External wallet events - ALWAYS track, but only change auth state when appropriate
    EXTERNAL_WALLET_CONNECTED: {
      // Always track the external wallet state
      actions: "trackExternalWalletConnected",
    },
    EXTERNAL_WALLET_DISCONNECTED: {
      // Always track disconnection
      actions: "trackExternalWalletDisconnected",
    },
  },

  states: {
    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZING
    // Check for existing session (passkey via stored username)
    // ═══════════════════════════════════════════════════════════════════════════
    initializing: {
      invoke: {
        src: "restoreSession",
        input: ({ context }): RestoreSessionInput => ({
          passkeyClient: context.passkeyClient,
          chainId: context.chainId,
        }),
        onDone: [
          {
            // Session restored successfully → authenticated.passkey
            guard: "sessionRestored",
            target: "authenticated.passkey",
            actions: "storePasskeySession",
          },
          {
            // No stored session → unauthenticated
            target: "unauthenticated",
          },
        ],
        onError: {
          // Restore failed → unauthenticated (don't show error for restore failures)
          target: "unauthenticated",
          actions: "clearError",
        },
      },

      // EXTERNAL_WALLET_CONNECTED handled by global handler
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // UNAUTHENTICATED
    // Ready for user to choose login method
    // ═══════════════════════════════════════════════════════════════════════════
    unauthenticated: {
      entry: "clearAllAuthState",

      on: {
        // User actions
        LOGIN_PASSKEY_NEW: {
          target: "registering",
          actions: "storeUserName",
        },
        LOGIN_PASSKEY_EXISTING: {
          target: "authenticating",
          actions: "storeUserName",
        },
        LOGIN_WALLET: [
          {
            // If external wallet already connected, go straight to authenticated
            guard: "hasExternalWallet",
            target: "authenticated.wallet",
            actions: "storeWalletAuth",
          },
          {
            // Otherwise, open modal and wait
            target: "wallet_connecting",
          },
        ],

        // External events
        EXTERNAL_WALLET_CONNECTED: {
          // Track but don't auto-login (user must explicitly choose wallet)
          actions: "trackExternalWalletConnected",
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // REGISTERING (New User - Passkey)
    // Creating new passkey credential
    // ═══════════════════════════════════════════════════════════════════════════
    registering: {
      entry: "clearError",

      invoke: {
        src: "registerPasskey",
        input: ({ context }): PasskeyOperationInput => ({
          passkeyClient: context.passkeyClient,
          userName: context.userName,
          chainId: context.chainId,
        }),
        onDone: {
          target: "authenticated.passkey",
          actions: "storePasskeySession",
        },
        onError: {
          target: "error",
          actions: ["storeError", "incrementRetry"],
        },
      },

      on: {
        // Allow cancellation
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAllAuthState",
        },
        // EXTERNAL_WALLET_CONNECTED handled by global handler
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTHENTICATING (Existing User - Passkey)
    // Logging in with existing passkey
    // ═══════════════════════════════════════════════════════════════════════════
    authenticating: {
      entry: "clearError",

      invoke: {
        src: "authenticatePasskey",
        input: ({ context }): PasskeyOperationInput => ({
          passkeyClient: context.passkeyClient,
          userName: context.userName,
          chainId: context.chainId,
        }),
        onDone: {
          target: "authenticated.passkey",
          actions: "storePasskeySession",
        },
        onError: {
          target: "error",
          actions: ["storeError", "incrementRetry"],
        },
      },

      on: {
        // Allow cancellation
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAllAuthState",
        },
        // EXTERNAL_WALLET_CONNECTED handled by global handler
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // WALLET_CONNECTING
    // Wallet modal is open, waiting for user to connect
    // ═══════════════════════════════════════════════════════════════════════════
    wallet_connecting: {
      on: {
        // External wallet connected → authenticate with wallet
        EXTERNAL_WALLET_CONNECTED: {
          target: "authenticated.wallet",
          actions: ["trackExternalWalletConnected", "storeWalletAuth"],
        },
        // Modal closed without connecting
        MODAL_CLOSED: {
          target: "unauthenticated",
        },
        // User cancelled
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAllAuthState",
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTHENTICATED
    // User is authenticated (passkey OR wallet - mutually exclusive)
    // ═══════════════════════════════════════════════════════════════════════════
    authenticated: {
      initial: "passkey",

      states: {
        // ─────────────────────────────────────────────────────────────────────────
        // PASSKEY AUTHENTICATED
        // User authenticated via passkey smart account
        // ─────────────────────────────────────────────────────────────────────────
        passkey: {
          on: {
            // User wants to claim ENS
            CLAIM_ENS: {
              target: "claiming_ens",
            },

            // User explicitly wants to switch to wallet
            SWITCH_TO_WALLET: [
              {
                // Only if external wallet is connected
                guard: "hasExternalWallet",
                target: "wallet",
                actions: ["clearPasskeySession", "storeWalletAuth"],
              },
              {
                // No wallet connected - could show error or open modal
                // For now, do nothing (UI should disable button if no wallet)
                actions: () =>
                  console.warn("[AuthMachine] SWITCH_TO_WALLET: No external wallet connected"),
              },
            ],

            // Sign out
            SIGN_OUT: {
              target: "#auth.unauthenticated",
              actions: "clearAllAuthState",
            },

            // External wallet connects while in passkey mode
            // We track it but DON'T auto-switch (user must explicitly switch)
            EXTERNAL_WALLET_CONNECTED: {
              actions: ["trackExternalWalletConnected", "logWalletConnectedDuringPasskey"],
            },

            // External wallet disconnects - just track it
            EXTERNAL_WALLET_DISCONNECTED: {
              actions: "trackExternalWalletDisconnected",
            },
          },
        },

        // ─────────────────────────────────────────────────────────────────────────
        // WALLET AUTHENTICATED
        // User authenticated via connected wallet (EOA)
        // ─────────────────────────────────────────────────────────────────────────
        wallet: {
          on: {
            // External wallet disconnected while using wallet auth → sign out
            EXTERNAL_WALLET_DISCONNECTED: {
              target: "#auth.unauthenticated",
              actions: [
                "logWalletDisconnectedDuringWalletAuth",
                "trackExternalWalletDisconnected",
                "clearWalletAuth",
              ],
            },

            // Sign out
            SIGN_OUT: {
              target: "#auth.unauthenticated",
              actions: "clearAllAuthState",
            },

            // User wants to switch to passkey (new account)
            LOGIN_PASSKEY_NEW: {
              target: "#auth.registering",
              actions: ["clearWalletAuth", "storeUserName"],
            },

            // User wants to switch to passkey (existing account)
            LOGIN_PASSKEY_EXISTING: {
              target: "#auth.authenticating",
              actions: ["clearWalletAuth", "storeUserName"],
            },

            // Alias for switching to passkey
            SWITCH_TO_PASSKEY: {
              target: "#auth.authenticating",
              actions: ["clearWalletAuth", "storeUserName"],
            },

            // Track wallet reconnection (same or different wallet)
            EXTERNAL_WALLET_CONNECTED: {
              actions: ["trackExternalWalletConnected", "storeWalletAuth"],
            },
          },
        },

        // ─────────────────────────────────────────────────────────────────────────
        // CLAIMING ENS
        // Sub-state of authenticated.passkey for ENS claiming
        // ─────────────────────────────────────────────────────────────────────────
        claiming_ens: {
          invoke: {
            src: "claimENS",
            input: ({ context, event }): ClaimENSInput => {
              // This state is only entered via CLAIM_ENS event
              const claimEvent = event as { type: "CLAIM_ENS"; name: string };
              return {
                smartAccountClient: context.smartAccountClient,
                name: claimEvent.name,
              };
            },
            onDone: {
              target: "passkey",
            },
            onError: {
              target: "passkey",
              actions: "storeError",
            },
          },

          // EXTERNAL_WALLET_CONNECTED handled by global handler
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERROR
    // Recoverable error state (failed auth attempt)
    // ═══════════════════════════════════════════════════════════════════════════
    error: {
      on: {
        // Retry authentication
        RETRY: [
          {
            guard: "canRetry",
            target: "authenticating",
          },
          {
            // Max retries reached, go back to unauthenticated
            target: "unauthenticated",
          },
        ],

        // Try different auth methods
        LOGIN_PASSKEY_NEW: {
          target: "registering",
          actions: ["clearError", "storeUserName"],
        },
        LOGIN_PASSKEY_EXISTING: {
          target: "authenticating",
          actions: ["clearError", "storeUserName"],
        },
        LOGIN_WALLET: [
          {
            guard: "hasExternalWallet",
            target: "authenticated.wallet",
            actions: ["clearError", "storeWalletAuth"],
          },
          {
            target: "wallet_connecting",
            actions: "clearError",
          },
        ],

        // Dismiss error and go back to unauthenticated
        DISMISS_ERROR: {
          target: "unauthenticated",
          actions: "clearError",
        },

        // Sign out
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAllAuthState",
        },

        // External wallet events handled by global handler
      },
    },
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export type AuthMachine = typeof authMachine;
export type AuthState = ReturnType<typeof authMachine.getInitialSnapshot>;
