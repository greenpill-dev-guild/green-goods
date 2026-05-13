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
import {
  AuthActionsContext,
  AuthContext,
  AuthStateContext,
  type AuthActionsValue,
  type AuthContextType,
  type AuthStateValue,
} from "./Auth";

export type DevMockAuthRole = "deployer" | "operator" | "user" | "disconnected";
export const DEV_MOCK_AUTH_STORAGE_KEY = "greengoods_dev_mock_auth";

export const DEV_MOCK_AUTH_ADDRESSES: Record<
  Exclude<DevMockAuthRole, "disconnected">,
  `0x${string}`
> = {
  deployer: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  operator: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  user: "0x1234567890123456789012345678901234567890",
};

function isMockRole(value: string | null): value is DevMockAuthRole {
  return value === "disconnected" || (value !== null && value in DEV_MOCK_AUTH_ADDRESSES);
}

function readPersistedMockRole(): DevMockAuthRole | null {
  const stored = window.sessionStorage.getItem(DEV_MOCK_AUTH_STORAGE_KEY);
  return isMockRole(stored) ? stored : null;
}

function persistMockRole(role: DevMockAuthRole) {
  window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, role);
}

export function hasMockAuthOverride(): boolean {
  const params = new URLSearchParams(window.location.search);
  const roleFromUrl = params.get("mockAuth");
  return isMockRole(roleFromUrl) || readPersistedMockRole() !== null;
}

function getMockRole(forcedRole?: DevMockAuthRole): DevMockAuthRole {
  if (forcedRole) {
    return forcedRole;
  }

  const params = new URLSearchParams(window.location.search);
  const roleFromUrl = params.get("mockAuth");
  if (isMockRole(roleFromUrl)) {
    persistMockRole(roleFromUrl);
    return roleFromUrl;
  }

  return readPersistedMockRole() ?? "operator";
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
