/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - one subscription owns when the saved passkey is re-read
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useHasStoredCredential } from "../../../hooks/auth/useHasStoredCredential";

const CREDENTIAL_KEY = "greengoods_credential";

/** The auth actor as the hook sees it: something that says the session changed. */
function session() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return { unsubscribe: () => listeners.delete(listener) };
    },
    changed: () => listeners.forEach((listener) => listener()),
    listening: () => listeners.size,
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

/**
 * These run uncompiled, so they cannot see the failure the hook exists for: the React Compiler
 * keeping a storage read made while rendering. That one is proven in a real browser against the
 * dev client. What they hold is the wiring it depends on.
 * @direct-test-subject ../../../hooks/auth/useHasStoredCredential.ts
 */
describe("the passkey this device remembers", () => {
  it("is read again whenever the session changes, in either direction", () => {
    const auth = session();
    const { result, unmount } = renderHook(() => useHasStoredCredential(auth));
    expect(result.current).toBe(false);

    // Creating an account saves its passkey, then the session becomes signed in.
    localStorage.setItem(CREDENTIAL_KEY, "{}");
    act(() => auth.changed());
    expect(result.current).toBe(true);

    // Signing out keeps the passkey; clearing it is what forgets the account.
    act(() => auth.changed());
    expect(result.current).toBe(true);
    localStorage.removeItem(CREDENTIAL_KEY);
    act(() => auth.changed());
    expect(result.current).toBe(false);

    unmount();
    expect(auth.listening()).toBe(0);
  });

  it("answers from storage as it stands when there is no session to listen to", () => {
    localStorage.setItem(CREDENTIAL_KEY, "{}");
    expect(renderHook(() => useHasStoredCredential(null)).result.current).toBe(true);
  });
});
