import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCrossTabSignOut } from "../../../hooks/auth/useCrossTabSignOut";
import { publishSignOut, SIGN_OUT_REVISION_KEY } from "../../../modules/auth/sessionSignOut";

beforeEach(() => localStorage.clear());

function storageEvent(key = SIGN_OUT_REVISION_KEY, storageArea = localStorage) {
  window.dispatchEvent(new StorageEvent("storage", { key, storageArea }));
}

it("delivers each other-tab logout once and does not echo it", () => {
  const endSession = vi.fn();
  const view = renderHook(() => useCrossTabSignOut(endSession));
  const revision = publishSignOut();
  act(() => storageEvent());
  act(() => storageEvent());
  expect(endSession).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(SIGN_OUT_REVISION_KEY)).toBe(revision);
  // The old passkey sentinel can remain true across repeated wallet logins.
  localStorage.setItem("greengoods_signed_out", "true");
  expect(publishSignOut()).not.toBe(revision);
  act(() => storageEvent());
  expect(endSession).toHaveBeenCalledTimes(2);
  view.unmount();
});

it("does not treat its own logout or unrelated/session storage as another logout", () => {
  const endSession = vi.fn();
  const view = renderHook(() => useCrossTabSignOut(endSession));
  act(() => view.result.current.notifySignOut());
  act(() => storageEvent());
  publishSignOut();
  act(() => storageEvent("theme"));
  act(() => storageEvent(SIGN_OUT_REVISION_KEY, sessionStorage));
  expect(endSession).not.toHaveBeenCalled();
  view.unmount();
});

it.each([
  "pageshow",
  "visibilitychange",
])("catches a missed logout on %s without interrupting ordinary restores", (event) => {
  publishSignOut();
  const endSession = vi.fn();
  const view = renderHook(() => useCrossTabSignOut(endSession));
  expect(endSession).not.toHaveBeenCalled();
  publishSignOut();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => (event === "pageshow" ? window : document).dispatchEvent(new Event(event)));
  expect(endSession).toHaveBeenCalledTimes(1);
  view.unmount();
});

it("acknowledges a pending logout before explicit login so delayed events cannot cancel the new session", () => {
  const endSession = vi.fn();
  const view = renderHook(() => useCrossTabSignOut(endSession));
  publishSignOut();
  act(() => view.result.current.syncSignOut());
  expect(endSession).toHaveBeenCalledTimes(1);
  act(() => storageEvent());
  expect(endSession).toHaveBeenCalledTimes(1);
  view.unmount();
});

it("removes storage and resume listeners on unmount", () => {
  const endSession = vi.fn();
  const view = renderHook(() => useCrossTabSignOut(endSession));
  view.unmount();
  publishSignOut();
  act(() => {
    storageEvent();
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(endSession).not.toHaveBeenCalled();
});
