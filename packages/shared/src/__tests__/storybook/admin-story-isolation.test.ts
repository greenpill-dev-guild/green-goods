/**
 * Storybook admin state isolation tests
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../config";
import { DEV_MOCK_AUTH_STORAGE_KEY } from "../../providers/DevAuthProvider";
import { ADMIN_GARDEN_PREFERENCES_STORAGE_KEY, useAdminStore } from "../../stores/useAdminStore";
import { GARDEN_STATE_STORAGE_KEY, useGardenStateStore } from "../../stores/useGardenStateStore";
import {
  SHEET_STATE_STORAGE_KEY,
  useSheetOrchestratorStore,
} from "../../stores/useSheetOrchestratorStore";
import { resetAdminStoryState } from "../../../.storybook/adminStoryIsolation";

describe("resetAdminStoryState", () => {
  it("clears admin singleton state and persisted story auth/session state", () => {
    useAdminStore.setState({
      selectedChainId: 999,
      selectedGarden: {
        id: "garden-1",
        chainId: 999,
        tokenAddress: "garden-1",
        tokenID: 1n,
        name: "Leaked Garden",
        description: "",
        location: "",
        bannerImage: "",
        createdAt: 0,
        gardeners: [],
        operators: [],
      },
      lastGardenIdsByScope: { "999:0xabc": "garden-1" },
      pendingTransactions: { "0xhash": { type: "test", status: "pending" } },
      lastAttestationId: "attestation-1",
    });
    useSheetOrchestratorStore.setState({
      activeSheet: "left",
      activeContentId: "action-detail:1",
      viewStates: {
        "/actions": {
          sheetOpen: "left",
          sheetContentId: "action-detail:1",
          formState: { title: "Leaked" },
          scrollPosition: 42,
        },
      },
    });
    useGardenStateStore.getState().setGardenWorkspaceState("__all__", "actions", {
      selectedItem: "action-1",
      sheetOpen: true,
      scrollPosition: 40,
    });
    localStorage.setItem(ADMIN_GARDEN_PREFERENCES_STORAGE_KEY, "{}");
    sessionStorage.setItem(SHEET_STATE_STORAGE_KEY, "{}");
    sessionStorage.setItem(GARDEN_STATE_STORAGE_KEY, "{}");
    sessionStorage.setItem(DEV_MOCK_AUTH_STORAGE_KEY, "operator");

    resetAdminStoryState();

    expect(useAdminStore.getState().selectedChainId).toBe(DEFAULT_CHAIN_ID);
    expect(useAdminStore.getState().selectedGarden).toBeNull();
    expect(useAdminStore.getState().lastGardenIdsByScope).toEqual({});
    expect(useAdminStore.getState().pendingTransactions).toEqual({});
    expect(useAdminStore.getState().lastAttestationId).toBeNull();
    expect(useSheetOrchestratorStore.getState().activeSheet).toBeNull();
    expect(useSheetOrchestratorStore.getState().activeContentId).toBeNull();
    expect(useSheetOrchestratorStore.getState().viewStates).toEqual({});
    expect(useGardenStateStore.getState().gardenStates).toEqual({});
    expect(localStorage.getItem(ADMIN_GARDEN_PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(SHEET_STATE_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(GARDEN_STATE_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(DEV_MOCK_AUTH_STORAGE_KEY)).toBeNull();
  });
});
