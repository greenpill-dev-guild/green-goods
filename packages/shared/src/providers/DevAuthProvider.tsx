/**
 * Dev-only mock auth provider.
 *
 * Provides the same AuthStateContext / AuthActionsContext / AuthContext shape
 * as the real AuthProvider, but with hardcoded values controlled via URL param.
 *
 * Usage: add `?mockAuth=operator` to any admin URL in dev mode.
 * Values: deployer | operator | user | disconnected
 *
 * Tree-shaken from production builds via the AuthGate DEV guard.
 */
import { type ReactNode, useMemo } from "react";
import { AuthActionsContext, AuthContext, AuthStateContext } from "./Auth";
import type { AuthActionsValue, AuthContextType, AuthStateValue } from "./Auth";

type MockRole = "deployer" | "operator" | "user" | "disconnected";

const MOCK_ADDRESSES: Record<Exclude<MockRole, "disconnected">, `0x${string}`> = {
  deployer: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  operator: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  user: "0x1234567890123456789012345678901234567890",
};

export function getMockRole(): MockRole {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("mockAuth");
  if (role === "disconnected") return "disconnected";
  if (role && role in MOCK_ADDRESSES) return role as MockRole;
  return "operator";
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const role = getMockRole();
  const isAuth = role !== "disconnected";
  const address = isAuth ? MOCK_ADDRESSES[role] : null;

  const state = useMemo<AuthStateValue>(
    () => ({
      authMode: isAuth ? "wallet" : null,
      isReady: true,
      isAuthenticated: isAuth,
      isAuthenticating: false,
      error: null,
      credential: null,
      smartAccountAddress: null,
      smartAccountClient: null,
      walletAddress: address,
      eoaAddress: address ?? undefined,
      embeddedAddress: null,
      userName: isAuth ? `Dev ${role}` : null,
      hasStoredCredential: false,
      externalWalletConnected: isAuth,
      externalWalletAddress: address,
    }),
    [role, isAuth, address]
  );

  const noop = useMemo(() => async () => {}, []);
  const noopSync = useMemo(() => () => {}, []);

  const actions = useMemo<AuthActionsValue>(
    () => ({
      createAccount: noop,
      loginWithPasskey: noop,
      loginWithWallet: noopSync,
      loginWithEmbedded: noopSync,
      signOut: async () => {
        const url = new URL(window.location.href);
        url.searchParams.set("mockAuth", "disconnected");
        window.location.href = url.toString();
      },
      switchToWallet: noopSync,
      switchToPasskey: noopSync,
      retry: noopSync,
      dismissError: noopSync,
      signInWithPasskey: noop,
      createPasskey: noop,
      clearPasskey: noopSync,
      connectWallet: noopSync,
      disconnectWallet: async () => {
        const url = new URL(window.location.href);
        url.searchParams.set("mockAuth", "disconnected");
        window.location.href = url.toString();
      },
    }),
    [noop, noopSync]
  );

  const combined = useMemo<AuthContextType>(() => ({ ...state, ...actions }), [state, actions]);

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        <AuthContext.Provider value={combined}>{children}</AuthContext.Provider>
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}
