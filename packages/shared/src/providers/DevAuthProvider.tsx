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

export type DevMockAuthRole = "deployer" | "steward" | "user" | "disconnected";

/** Role names this param used to accept, kept resolvable for saved QA links. */
const LEGACY_MOCK_ROLE_ALIASES: Record<string, DevMockAuthRole> = { operator: "steward" };
export const DEV_MOCK_AUTH_STORAGE_KEY = "greengoods_dev_mock_auth";

export const DEV_MOCK_AUTH_ADDRESSES: Record<
  Exclude<DevMockAuthRole, "disconnected">,
  `0x${string}`
> = {
  deployer: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  steward: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  user: "0x1234567890123456789012345678901234567890",
};

function normalizeMockRole(value: string | null): DevMockAuthRole | null {
  if (value === null) return null;
  const resolved = LEGACY_MOCK_ROLE_ALIASES[value] ?? value;
  if (resolved === "disconnected" || resolved in DEV_MOCK_AUTH_ADDRESSES) {
    return resolved as DevMockAuthRole;
  }
  return null;
}

function readPersistedMockRole(): DevMockAuthRole | null {
  return normalizeMockRole(window.sessionStorage.getItem(DEV_MOCK_AUTH_STORAGE_KEY));
}

function persistMockRole(role: DevMockAuthRole) {
  window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, role);
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

export function hasMockAuthOverride(): boolean {
  // The dev servers bind on all interfaces (vite `host: true`), so without
  // this guard any device on the LAN could request ?mockAuth= and receive
  // production-backed views with no credentials. Mock auth is a loopback-only
  // seam: on any other hostname the real AuthProvider stays in charge.
  if (!isLoopbackHost(window.location.hostname)) return false;
  const params = new URLSearchParams(window.location.search);
  return normalizeMockRole(params.get("mockAuth")) !== null || readPersistedMockRole() !== null;
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
