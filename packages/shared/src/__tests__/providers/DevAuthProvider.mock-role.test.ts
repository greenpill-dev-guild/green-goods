/**
 * The `?mockAuth=` seam is the only way the Playwright admin suite authenticates,
 * and saved QA links still carry the role's former name. A rename sweep once
 * rewrote the alias table's own key from `operator` to `steward`, turning the
 * alias into a no-op and unauthenticating every mock-auth spec — the app fell
 * back to the real AuthProvider and rendered "Connect to continue".
 *
 * These pin the alias itself, so the same edit fails here instead of in CI.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEV_MOCK_AUTH_ADDRESSES,
  DEV_MOCK_AUTH_STORAGE_KEY,
  hasMockAuthOverride,
} from "../../providers/DevAuthProvider";

/** The shared setup stubs window.location as a plain object, so the search is set directly. */
function setSearch(search: string) {
  (window.location as unknown as { search: string }).search = search ? `?${search}` : "";
}

function setHostname(hostname: string) {
  (window.location as unknown as { hostname: string }).hostname = hostname;
}

describe("dev mock-auth role resolution", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setSearch("");
    setHostname("localhost");
  });

  afterEach(() => {
    window.sessionStorage.clear();
    setSearch("");
    setHostname("localhost");
  });

  it("accepts the current role name from the URL", () => {
    setSearch("mockAuth=steward");
    expect(hasMockAuthOverride()).toBe(true);
  });

  it("ignores the mock seam entirely on non-loopback hosts (LAN exposure guard)", () => {
    // Vite binds host:true, so a LAN device could otherwise get production-backed
    // views via ?mockAuth= with no credentials. Only loopback may use the seam.
    setHostname("192.168.1.20");
    setSearch("mockAuth=deployer");
    expect(hasMockAuthOverride()).toBe(false);
    window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "steward");
    expect(hasMockAuthOverride()).toBe(false);
  });

  it("accepts the seam on every loopback hostname form", () => {
    setSearch("mockAuth=deployer");
    for (const host of ["localhost", "127.0.0.1", "[::1]", "app.localhost"]) {
      setHostname(host);
      expect(hasMockAuthOverride()).toBe(true);
    }
  });

  it("still accepts the former `operator` name from a saved QA link", () => {
    setSearch("mockAuth=operator");
    expect(hasMockAuthOverride()).toBe(true);
  });

  it("still accepts a persisted `operator` value from an earlier session", () => {
    window.sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "operator");
    expect(hasMockAuthOverride()).toBe(true);
  });

  it("rejects a role it has never known, so the real provider stays in charge", () => {
    setSearch("mockAuth=gardener");
    expect(hasMockAuthOverride()).toBe(false);
  });

  it("keys its address table on the current role names", () => {
    expect(Object.keys(DEV_MOCK_AUTH_ADDRESSES).sort()).toEqual(["deployer", "steward", "user"]);
  });
});
