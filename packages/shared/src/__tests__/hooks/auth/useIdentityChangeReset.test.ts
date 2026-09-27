/**
 * @vitest-environment jsdom
 */

import { render as renderElement, renderHook } from "@testing-library/react";
import { createElement } from "react";
import type { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../config/react-query";
import { useIdentityChangeReset } from "../../../hooks/auth/useIdentityChangeReset";
import { DEFAULT_GARDEN_FILTERS } from "../../../hooks/garden/useFilteredGardens";
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
const GARDEN = "0x1111111111111111111111111111111111111111";
const aliceRoleKey = ["greengoods", "roles", "hasRole", GARDEN, ALICE, "steward"];
const gardensKey = ["greengoods", "gardens", 42161];

/** What one account leaves on a shared phone: Home's filters, a garden's place, a steward read. */
function leaveTraces() {
  useUIStore.getState().setGardenFilters(() => ({ scope: "mine", sort: "name" }));
  useUIStore.getState().openCommitmentsSheet();
  useGardenStateStore.getState().setGardenState(GARDEN, { activeTab: "pool", sheetOpen: true });
  useSheetOrchestratorStore.getState().openSheet("right", "profile");
  useSheetOrchestratorStore.getState().saveViewState("/profile");
  queryClient.setQueryData(aliceRoleKey, true);
  queryClient.setQueryData(gardensKey, []);
}

function render(address: Hex | null) {
  return renderHook(({ viewer }) => useIdentityChangeReset(viewer), {
    initialProps: { viewer: address },
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
    const { rerender } = render(ALICE);
    leaveTraces();

    // Signed out, nothing is decided yet: the next account may be the same one.
    rerender({ viewer: null });
    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });

    rerender({ viewer: BOB });
    expect(useUIStore.getState().gardenFilters).toEqual(DEFAULT_GARDEN_FILTERS);
    expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
    expect(useGardenStateStore.getState().gardenStates).toEqual({});
    expect(useSheetOrchestratorStore.getState().viewStates).toEqual({});
    expect(useSheetOrchestratorStore.getState().activeSheet).toBeNull();
    // Reads keyed by the previous account go; shared reads stay warm.
    expect(queryClient.getQueryData(aliceRoleKey)).toBeUndefined();
    expect(queryClient.getQueryData(gardensKey)).toEqual([]);
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

  it("is mounted by the auth gate, so a mock-role reload as another address starts clean", () => {
    renderHook(() => useIdentityChangeReset(DEV_MOCK_AUTH_ADDRESSES.deployer));
    leaveTraces();

    sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "steward");
    renderElement(createElement(AuthGate, { children: null }));
    expect(useUIStore.getState().gardenFilters).toEqual(DEFAULT_GARDEN_FILTERS);
    expect(useGardenStateStore.getState().gardenStates).toEqual({});
  });
});
