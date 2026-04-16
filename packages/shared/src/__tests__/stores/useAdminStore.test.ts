/**
 * useAdminStore Tests
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_GARDEN_PREFERENCES_STORAGE_KEY,
  getAdminGardenScopeKey,
  useAdminStore,
} from "../../stores/useAdminStore";

describe("stores/useAdminStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAdminStore.setState({
      selectedGarden: null,
      lastGardenIdsByScope: {},
      pendingTransactions: {},
      lastAttestationId: null,
    });
  });

  it("stores and reads the last selected garden by wallet and chain scope", () => {
    const scopeKey = getAdminGardenScopeKey("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD", 11155111);

    expect(scopeKey).toBe("11155111:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");

    useAdminStore.getState().setPersistedGardenId(scopeKey!, "garden-123");

    expect(useAdminStore.getState().getPersistedGardenId(scopeKey!)).toBe("garden-123");
  });

  it("writes persisted garden preferences to localStorage", () => {
    const scopeKey = getAdminGardenScopeKey(
      "0x1111111111111111111111111111111111111111",
      11155111
    )!;

    useAdminStore.getState().setPersistedGardenId(scopeKey, "garden-persisted");

    const raw = localStorage.getItem(ADMIN_GARDEN_PREFERENCES_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.state.lastGardenIdsByScope[scopeKey]).toBe("garden-persisted");
  });

  it("clears a persisted garden preference for a scope", () => {
    const scopeKey = getAdminGardenScopeKey(
      "0x2222222222222222222222222222222222222222",
      11155111
    )!;

    useAdminStore.getState().setPersistedGardenId(scopeKey, "garden-to-clear");
    useAdminStore.getState().clearPersistedGardenId(scopeKey);

    expect(useAdminStore.getState().getPersistedGardenId(scopeKey)).toBeNull();
  });
});
