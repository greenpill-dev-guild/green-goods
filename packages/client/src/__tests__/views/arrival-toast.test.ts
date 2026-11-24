// @vitest-environment happy-dom
/**
 * The per-session record of a passed arrival that AppShell writes and Home reads: the arrival
 * toast belongs to a session that opens on Home, once per tab and account.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { hasArrivalPassed, markArrivalPassed } from "../../views/Home/arrivalToast";

describe("arrival session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("records a passed arrival for that account only, whatever the address casing", () => {
    // AppShell marks with the checksummed address; Home checks with the lowercased one.
    markArrivalPassed("0xAbCdEf0123456789aBcDeF0123456789AbCdEf01");

    expect(hasArrivalPassed("0xabcdef0123456789abcdef0123456789abcdef01")).toBe(true);
    expect(hasArrivalPassed("0x1111111111111111111111111111111111111111")).toBe(false);
  });

  it("keeps the arrival for this page load when session storage is blocked", () => {
    // AppShell marks on every screen but Home, so a storage error must not escape.
    const blocked = () => {
      throw new DOMException("Storage is disabled", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    const address = "0x2222222222222222222222222222222222222222";

    expect(hasArrivalPassed(address)).toBe(false);
    expect(() => markArrivalPassed(address)).not.toThrow();
    expect(hasArrivalPassed(address)).toBe(true);
  });
});
