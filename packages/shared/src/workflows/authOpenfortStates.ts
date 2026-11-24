/**
 * Email (Openfort) states, kept beside the startup states so the main auth machine
 * stays readable. Spread into the machine: `authOpenfortSignInStates` at the top level, and
 * `authOpenfortSessionStates` inside `authenticated`. Restore lives in `authStartupState`.
 */
import type { AuthEvent, OpenfortOperationInput } from "./authMachine.types";

type LoginOpenfort = Extract<AuthEvent, { type: "LOGIN_OPENFORT" }>;

export const authOpenfortSignInStates = {
  // Verifying the code, then setting up or recovering the person's wallet.
  authenticating_openfort: {
    entry: "clearError",
    invoke: {
      src: "authenticateOpenfort",
      input: ({
        context,
        event,
      }: {
        context: { chainId: number };
        event: AuthEvent;
      }): OpenfortOperationInput => {
        const login = event as LoginOpenfort;
        return { email: login.email, code: login.code, chainId: context.chainId };
      },
      onDone: { target: "authenticated.openfort", actions: "storeOpenfortSession" },
      onError: { target: "error", actions: "storeError" },
    },
    on: {
      // Cancelling ends the attempt; a code verified meanwhile commits nothing.
      SIGN_OUT: { target: "unauthenticated", actions: "clearAllAuthState" },
    },
  },
} as const;

export const authOpenfortSessionStates = {
  // The Openfort wallet owns the session's Kernel smart account.
  openfort: {
    on: {
      SIGN_OUT: { target: "#auth.unauthenticated", actions: "clearAllAuthState" },
      EXTERNAL_WALLET_CONNECTED: { actions: "trackExternalWalletConnected" },
      EXTERNAL_WALLET_DISCONNECTED: { actions: "trackExternalWalletDisconnected" },
    },
  },
} as const;
