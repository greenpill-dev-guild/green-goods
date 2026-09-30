/** Startup states kept separate so the main auth machine stays readable. */
export const authGlobalWalletEvents = {
  EXTERNAL_WALLET_CONNECTED: { actions: "trackExternalWalletConnected" },
  EXTERNAL_WALLET_DISCONNECTED: { actions: "trackExternalWalletDisconnected" },
} as const;

export const authStartupStates = {
  initializing: {
    invoke: {
      src: "restoreSession",
      input: ({ context }: { context: { chainId: number } }) => ({ chainId: context.chainId }),
      onDone: [
        {
          guard: "sessionRestored",
          target: "authenticated.passkey",
          actions: "storePasskeySession",
        },
        { guard: "hasRestoringWallet", target: "restoring.wallet" },
        { guard: "hasRestoringEmbedded", target: "restoring.embedded" },
        { target: "unauthenticated" },
      ],
      onError: [
        {
          guard: "hasRestoringWallet",
          target: "restoring.wallet",
          actions: "clearError",
        },
        {
          guard: "hasRestoringEmbedded",
          target: "restoring.embedded",
          actions: "clearError",
        },
        { target: "unauthenticated", actions: "clearError" },
      ],
    },
  },
  restoring: {
    initial: "wallet",
    states: {
      wallet: {
        always: {
          guard: "hasTrackedWalletConnector",
          target: "#auth.authenticated.wallet",
          actions: "storeWalletAuth",
        },
        on: {
          EXTERNAL_WALLET_CONNECTED: { actions: "trackExternalWalletConnected" },
          EXTERNAL_WALLET_DISCONNECTED: { actions: "trackExternalWalletDisconnected" },
          RESTORE_TIMEOUT: {
            target: "#auth.unauthenticated",
            actions: "clearWalletAuth",
          },
          SIGN_OUT: {
            target: "#auth.unauthenticated",
            actions: "clearAllAuthState",
          },
        },
      },
      embedded: {
        always: {
          guard: "hasTrackedEmbeddedConnector",
          target: "#auth.authenticated.embedded",
          actions: "storeEmbeddedAuthFromExternal",
        },
        on: {
          EXTERNAL_WALLET_CONNECTED: { actions: "trackExternalWalletConnected" },
          EXTERNAL_WALLET_DISCONNECTED: { actions: "trackExternalWalletDisconnected" },
          RESTORE_TIMEOUT: {
            target: "#auth.unauthenticated",
            actions: "clearEmbeddedAuth",
          },
          SIGN_OUT: {
            target: "#auth.unauthenticated",
            actions: "clearAllAuthState",
          },
        },
      },
    },
  },
} as const;
