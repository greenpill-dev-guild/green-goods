/**
 * @vitest-environment happy-dom
 */

import { act, render as renderElement, renderHook, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import type { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../config/react-query";
import { useIdentityChangeReset } from "../../../hooks/auth/useIdentityChangeReset";
import {
  addRecentRecipient,
  useRecentRecipients,
} from "../../../hooks/blockchain/useRecentRecipients";
import { DEFAULT_GARDEN_FILTERS } from "../../../hooks/garden/useFilteredGardens";
import { PENDING_WORK_APPROVAL_STORAGE_KEY } from "../../../hooks/work/useWorkApprovalLifecycle";
import { AuthGate } from "../../../providers/AuthGate";
import {
  DEV_MOCK_AUTH_ADDRESSES,
  DEV_MOCK_AUTH_STORAGE_KEY,
} from "../../../providers/DevAuthProvider";
import { useGardenStateStore } from "../../../stores/useGardenStateStore";
import { useSheetOrchestratorStore } from "../../../stores/useSheetOrchestratorStore";
import { useUIStore } from "../../../stores/useUIStore";

// Mock auth needs no wallet connection; the primary address comes from the mock role.
vi.mock("wagmi", () => ({ useAccount: () => ({ address: undefined }), useConfig: () => ({}) }));

const ALICE = "0xA11cE00000000000000000000000000000000001" as Hex;
const BOB = "0xB0b0000000000000000000000000000000000002" as Hex;
const CAROL = "0xCa7010000000000000000000000000000000000c" as Hex;
const GARDEN = "0x1111111111111111111111111111111111111111";
const aliceRoleKey = ["greengoods", "roles", "hasRole", GARDEN, ALICE, "steward"];
const gardensKey = ["greengoods", "gardens", 42161];

/** What one account leaves on a shared phone: filters, a garden's place, a read, a recipient. */
function leaveTraces() {
  useUIStore.getState().setGardenFilters(() => ({ scope: "mine", sort: "name" }));
  useUIStore.getState().openCommitmentsSheet();
  useGardenStateStore.getState().setGardenState(GARDEN, { activeTab: "pool", sheetOpen: true });
  useSheetOrchestratorStore.getState().openSheet("right", "profile");
  useSheetOrchestratorStore.getState().saveViewState("/profile");
  queryClient.setQueryData(aliceRoleKey, true);
  queryClient.setQueryData(gardensKey, []);
  addRecentRecipient(CAROL, "for the seed swap");
  // A work approval whose receipt the last account was still waiting on.
  localStorage.setItem(PENDING_WORK_APPROVAL_STORAGE_KEY, JSON.stringify({ version: 1 }));
}

function render(address: Hex | null, ready = true) {
  return renderHook(({ viewer, isReady }) => useIdentityChangeReset(viewer, isReady), {
    initialProps: { viewer: address, isReady: ready },
  });
}

/** A screen with its own state: an open sheet a member was typing into. */
function OpenSheet() {
  const [reason, setReason] = useState("");
  return createElement("input", {
    "aria-label": "Reason",
    value: reason,
    onChange: (event: { target: { value: string } }) => setReason(event.target.value),
  });
}

describe("useIdentityChangeReset", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    useUIStore.getState().resetGardenFilters();
    useUIStore.getState().closeCommitmentsSheet();
    useGardenStateStore.getState().clearAll();
    useSheetOrchestratorStore.getState().clearAll();
  });

  it("clears what one account left when another signs in, a sign-out between or not", () => {
    const { result, rerender } = render(ALICE);
    leaveTraces();
    const recents = renderHook(() => useRecentRecipients());
    expect(recents.result.current).toHaveLength(1);

    // Signed out, nothing is decided yet: the next account may be the same one.
    rerender({ viewer: null, isReady: true });
    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });
    const before = result.current;

    rerender({ viewer: BOB, isReady: true });
    expect(useUIStore.getState().gardenFilters).toEqual(DEFAULT_GARDEN_FILTERS);
    expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
    expect(useGardenStateStore.getState().gardenStates).toEqual({});
    expect(useSheetOrchestratorStore.getState().viewStates).toEqual({});
    expect(useSheetOrchestratorStore.getState().activeSheet).toBeNull();
    // Reads keyed by the previous account go; shared reads stay warm.
    expect(queryClient.getQueryData(aliceRoleKey)).toBeUndefined();
    expect(queryClient.getQueryData(gardensKey)).toEqual([]);
    // The last account's recipients are not offered to the next one, and its
    // approval recovery does not resume under the next one's name.
    expect(recents.result.current).toEqual([]);
    expect(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)).toBeNull();
    // A new session generation, so the screens under the gate start over.
    expect(result.current).toBe(before + 1);
  });

  it("still starts the next account clean when storage cannot be read or written", () => {
    const { rerender } = render(ALICE);
    leaveTraces();
    const refuse = () => {
      throw new DOMException("Storage is blocked", "SecurityError");
    };
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);
    try {
      rerender({ viewer: BOB, isReady: true });
      expect(useUIStore.getState().gardenFilters).toEqual(DEFAULT_GARDEN_FILTERS);
      expect(useGardenStateStore.getState().gardenStates).toEqual({});
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("decides nothing while the session is still being restored", () => {
    const { rerender } = render(ALICE);
    leaveTraces();

    // A restore that may yet fail names B before B has signed in.
    rerender({ viewer: BOB, isReady: false });
    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });

    // The restore failed; A signs in again and keeps everything.
    rerender({ viewer: ALICE, isReady: true });
    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });
    expect(queryClient.getQueryData(aliceRoleKey)).toBe(true);
  });

  it("keeps everything when the same account comes back, after a reload in any casing", () => {
    // The first account on a device adopts what is there rather than wiping it.
    leaveTraces();
    const first = render(ALICE);
    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });
    first.unmount();

    render(ALICE.toLowerCase() as Hex);
    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });
    expect(useGardenStateStore.getState().getGardenState(GARDEN).activeTab).toBe("pool");
    expect(queryClient.getQueryData(aliceRoleKey)).toBe(true);
  });

  it("is mounted by the auth gate, which starts the screens over for another account", () => {
    renderHook(() => useIdentityChangeReset(DEV_MOCK_AUTH_ADDRESSES.deployer, true));
    leaveTraces();

    // Mock auth reads its role on each render, as a wallet reports a switched account.
    sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "deployer");
    const gate = renderElement(createElement(AuthGate, null, createElement(OpenSheet)));
    act(() => {
      const input = screen.getByLabelText("Reason") as HTMLInputElement;
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "left by the last account");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(screen.getByLabelText("Reason")).toHaveValue("left by the last account");

    sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "steward");
    gate.rerender(createElement(AuthGate, null, createElement(OpenSheet)));
    expect(useUIStore.getState().gardenFilters).toEqual(DEFAULT_GARDEN_FILTERS);
    expect(useGardenStateStore.getState().gardenStates).toEqual({});
    expect(screen.getByLabelText("Reason")).toHaveValue("");
  });
});
