/**
 * Authentication State Machine
 *
 * XState 5 machine for managing passkey and wallet authentication flows.
 * Integrates with Pimlico passkey server for credential storage.
 *
 * States:
 * - initializing: Checking for existing session
 * - unauthenticated: No active session
 * - registering: Creating new passkey (new user flow)
 * - authenticating: Logging in with existing passkey (returning user flow)
 * - wallet_connecting: Opening wallet modal
 * - authenticated.passkey: Active passkey session
 * - authenticated.wallet: Active wallet session
 */

import { type SmartAccountClient } from "permissionless";
import { type Hex } from "viem";
import { type P256Credential } from "viem/account-abstraction";
import { assign, setup } from "xstate";

import { type PasskeyServerClient } from "../config/passkeyServer";

// ============================================================================
// CONTEXT
// ============================================================================

export interface AuthContext {
  // Pimlico server client (initialized at start)
  passkeyClient: PasskeyServerClient | null;

  // Credential from Pimlico server (not localStorage)
  credential: P256Credential | null;
  userName: string | null;

  // Session state
  smartAccountClient: SmartAccountClient | null;
  smartAccountAddress: Hex | null;

  // Wallet (alternative auth)
  walletAddress: Hex | null;

  // Meta
  chainId: number;
  error: Error | null;
  retryCount: number;
}

// ============================================================================
// EVENTS
// ============================================================================

export type AuthEvent =
  // User actions
  | { type: "LOGIN_PASSKEY_NEW"; userName: string }
  | { type: "LOGIN_PASSKEY_EXISTING"; userName: string }
  | { type: "LOGIN_WALLET" }
  | { type: "SIGN_OUT" }
  | { type: "RETRY" }
  // External events
  | { type: "WALLET_CONNECTED"; address: Hex }
  | { type: "WALLET_DISCONNECTED" }
  | { type: "MODAL_CLOSED" }
  // ENS
  | { type: "CLAIM_ENS"; name: string }
  // Internal (from services)
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
// MACHINE SETUP
// ============================================================================

const authSetup = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
    input: {} as AuthInput,
  },
  actions: {
    // Clear all auth state
    clearAuthState: assign({
      credential: null,
      userName: null,
      smartAccountClient: null,
      smartAccountAddress: null,
      walletAddress: null,
      error: null,
      retryCount: 0,
    }),

    // Clear only error
    clearError: assign({
      error: null,
    }),

    // Store passkey session
    storePasskeySession: assign({
      credential: ({ event }) => {
        const e = event as { output: PasskeySessionResult };
        return e.output.credential;
      },
      smartAccountClient: ({ event }) => {
        const e = event as { output: PasskeySessionResult };
        return e.output.smartAccountClient;
      },
      smartAccountAddress: ({ event }) => {
        const e = event as { output: PasskeySessionResult };
        return e.output.smartAccountAddress;
      },
      userName: ({ event }) => {
        const e = event as { output: PasskeySessionResult };
        return e.output.userName;
      },
      error: null,
      retryCount: 0,
    }),

    // Store wallet address
    storeWalletAddress: assign({
      walletAddress: ({ event }) => {
        const e = event as { type: "WALLET_CONNECTED"; address: Hex };
        return e.address;
      },
      error: null,
    }),

    // Store error
    storeError: assign({
      error: ({ event }) => {
        const e = event as { error: unknown };
        if (e.error instanceof Error) return e.error;
        if (typeof e.error === "string") return new Error(e.error);
        return new Error("Authentication failed");
      },
    }),

    // Increment retry count
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),

    // Store userName for registration/login
    storeUserName: assign({
      userName: ({ event }) => {
        const e = event as { userName: string };
        return e.userName;
      },
    }),

    // Clear wallet
    clearWallet: assign({
      walletAddress: null,
    }),

    // Clear passkey session (keep credential for re-login)
    clearPasskeySession: assign({
      smartAccountClient: null,
      smartAccountAddress: null,
    }),
  },
  guards: {
    // Can retry (max 3 attempts)
    canRetry: ({ context }) => context.retryCount < 3,

    // Has stored username for session restore
    hasStoredUsername: ({ context }) => {
      const stored = localStorage.getItem("greengoods_username");
      return Boolean(stored || context.userName);
    },

    // Has wallet connected
    hasWalletConnected: ({ context }) => Boolean(context.walletAddress),
  },
  actors: {
    // Services are provided via machine options in authActor.ts
    restoreSession: () => {
      throw new Error("restoreSession actor not provided");
    },
    registerPasskey: () => {
      throw new Error("registerPasskey actor not provided");
    },
    authenticatePasskey: () => {
      throw new Error("authenticatePasskey actor not provided");
    },
    claimENS: () => {
      throw new Error("claimENS actor not provided");
    },
  } as any,
});

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface AuthInput {
  chainId: number;
  passkeyClient: PasskeyServerClient | null;
}

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
    chainId: input?.chainId ?? 84532, // Default to Base Sepolia
    error: null,
    retryCount: 0,
  }),
  states: {
    // ========================================
    // INITIALIZING
    // ========================================
    initializing: {
      invoke: {
        src: "restoreSession",
        input: ({ context }: { context: AuthContext }) => ({
          passkeyClient: context.passkeyClient,
          chainId: context.chainId,
        }),
        onDone: [
          {
            // Session restored successfully
            guard: ({ event }: { event: { output: RestoreSessionResult | null } }) =>
              event.output !== null,
            target: "authenticated.passkey",
            actions: "storePasskeySession",
          },
          {
            // No stored session
            target: "unauthenticated",
          },
        ],
        onError: {
          target: "unauthenticated",
          actions: "clearError", // Don't show error for restore failures
        },
      } as any,
    },

    // ========================================
    // UNAUTHENTICATED
    // ========================================
    unauthenticated: {
      entry: "clearAuthState",
      on: {
        LOGIN_PASSKEY_NEW: {
          target: "registering",
          actions: "storeUserName",
        },
        LOGIN_PASSKEY_EXISTING: {
          target: "authenticating",
          actions: "storeUserName",
        },
        LOGIN_WALLET: {
          target: "wallet_connecting",
        },
        WALLET_CONNECTED: {
          target: "authenticated.wallet",
          actions: "storeWalletAddress",
        },
      },
    },

    // ========================================
    // REGISTERING (New User)
    // ========================================
    registering: {
      entry: "clearError",
      invoke: {
        src: "registerPasskey",
        input: ({ context }: { context: AuthContext }) => ({
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
      } as any,
      on: {
        // Allow cancellation
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAuthState",
        },
      },
    },

    // ========================================
    // AUTHENTICATING (Existing User)
    // ========================================
    authenticating: {
      entry: "clearError",
      invoke: {
        src: "authenticatePasskey",
        input: ({ context }: { context: AuthContext }) => ({
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
      } as any,
      on: {
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAuthState",
        },
      },
    },

    // ========================================
    // WALLET CONNECTING
    // ========================================
    wallet_connecting: {
      on: {
        WALLET_CONNECTED: {
          target: "authenticated.wallet",
          actions: "storeWalletAddress",
        },
        MODAL_CLOSED: {
          target: "unauthenticated",
        },
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAuthState",
        },
      },
    },

    // ========================================
    // AUTHENTICATED
    // ========================================
    authenticated: {
      initial: "passkey",
      states: {
        // Passkey authenticated
        passkey: {
          on: {
            CLAIM_ENS: {
              target: "claiming_ens",
            },
            SIGN_OUT: {
              target: "#auth.unauthenticated",
              actions: "clearAuthState",
            },
          },
        },

        // Wallet authenticated
        wallet: {
          on: {
            WALLET_DISCONNECTED: {
              target: "#auth.unauthenticated",
              actions: "clearWallet",
            },
            SIGN_OUT: {
              target: "#auth.unauthenticated",
              actions: "clearAuthState",
            },
            // Allow switching to passkey
            LOGIN_PASSKEY_NEW: {
              target: "#auth.registering",
              actions: ["clearWallet", "storeUserName"],
            },
            LOGIN_PASSKEY_EXISTING: {
              target: "#auth.authenticating",
              actions: ["clearWallet", "storeUserName"],
            },
          },
        },

        // ENS claiming (sub-state of authenticated.passkey)
        claiming_ens: {
          invoke: {
            src: "claimENS",
            input: ({
              context,
              event,
            }: {
              context: AuthContext;
              event: { type: "CLAIM_ENS"; name: string };
            }) => ({
              smartAccountClient: context.smartAccountClient,
              name: event.name,
            }),
            onDone: {
              target: "passkey",
            },
            onError: {
              target: "passkey",
              actions: "storeError",
            },
          } as any,
        },
      },
    },

    // ========================================
    // ERROR
    // ========================================
    error: {
      on: {
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
        LOGIN_PASSKEY_NEW: {
          target: "registering",
          actions: ["clearError", "storeUserName"],
        },
        LOGIN_PASSKEY_EXISTING: {
          target: "authenticating",
          actions: ["clearError", "storeUserName"],
        },
        LOGIN_WALLET: {
          target: "wallet_connecting",
          actions: "clearError",
        },
        SIGN_OUT: {
          target: "unauthenticated",
          actions: "clearAuthState",
        },
      },
    },
  },
});

// Export types for external use
export type AuthMachine = typeof authMachine;
export type AuthState = ReturnType<typeof authMachine.getInitialSnapshot>;
