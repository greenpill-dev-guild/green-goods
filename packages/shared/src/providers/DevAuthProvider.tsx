/**
 * Dev-only mock auth provider.
 *
 * Provides the same AuthStateContext / AuthActionsContext / AuthContext shape
 * as the real AuthProvider, but with hardcoded values controlled via URL param.
 *
 * Usage: add `?mockAuth=steward` to any admin URL in dev mode.
 * Values: deployer | steward | user | disconnected
 * `?mockAuth=operator` still resolves to steward so older QA links keep working.
 *
 * Tree-shaken from production builds via the AuthGate DEV guard.
 */
import { type ReactNode, useMemo } from "react";
import {
  AuthActionsContext,
  AuthContext,
  AuthStateContext,
  type AuthActionsValue,
  type AuthContextType,
  type AuthStateValue,
} from "./Auth";
import {
  DEV_MOCK_AUTH_ADDRESSES,
  DEV_MOCK_AUTH_STORAGE_KEY,
  type DevMockAuthRole,
  hasMockAuthOverride,
  normalizeMockRole,
  readPersistedMockRole,
} from "../modules/auth/mock-auth-seam";

export type { DevMockAuthRole };
export { DEV_MOCK_AUTH_ADDRESSES, DEV_MOCK_AUTH_STORAGE_KEY, hasMockAuthOverride };

function persistMockRole(role: DevMockAuthRole) {
  window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, role);
}

function getMockRole(forcedRole?: DevMockAuthRole): DevMockAuthRole {
  if (forcedRole) {
    return forcedRole;
  }

  const params = new URLSearchParams(window.location.search);
  const roleFromUrl = normalizeMockRole(params.get("mockAuth"));
  if (roleFromUrl) {
    persistMockRole(roleFromUrl);
    return roleFromUrl;
  }

  return readPersistedMockRole() ?? "steward";
}

export function DevAuthProvider({
  children,
  mockRole,
}: {
  children: ReactNode;
  mockRole?: DevMockAuthRole;
}) {
  const role = getMockRole(mockRole);
  const isAuth = role !== "disconnected";
  const address = isAuth ? DEV_MOCK_AUTH_ADDRESSES[role] : null;

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
      resolveSmartAccountClient: null,
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
        persistMockRole("disconnected");
        const url = new URL(window.location.href);
        url.searchParams.set("mockAuth", "disconnected");
        window.location.href = url.toString();
      },
      switchToWallet: noopSync,
      switchToPasskey: noopSync,
      retry: noopSync,
      dismissError: noopSync,
      clearPasskey: noopSync,
      disconnectWallet: async () => {
        persistMockRole("disconnected");
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
