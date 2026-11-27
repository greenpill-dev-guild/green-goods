/**
 * The development mock-auth seam (`?mockAuth=<role>`, or the role a tab already carries): which
 * role a session borrows, and whether the seam is active. It holds no React, so both the auth gate
 * and the wallet config (`config/appkit`) read the same answer.
 */
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

export function normalizeMockRole(value: string | null): DevMockAuthRole | null {
  if (value === null) return null;
  const resolved = LEGACY_MOCK_ROLE_ALIASES[value] ?? value;
  if (resolved === "disconnected" || resolved in DEV_MOCK_AUTH_ADDRESSES) {
    return resolved as DevMockAuthRole;
  }
  return null;
}

export function readPersistedMockRole(): DevMockAuthRole | null {
  return normalizeMockRole(window.sessionStorage.getItem(DEV_MOCK_AUTH_STORAGE_KEY));
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
