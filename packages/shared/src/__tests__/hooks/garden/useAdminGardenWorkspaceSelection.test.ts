/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEligibleState = {
  eligibleGardens: [] as Array<{ id: string; name: string; location?: string }>,
  resolvedDefaultGarden: null as { id: string; name: string; location?: string } | null,
  isLoaded: true,
};
const mockSetSelectedGarden = vi.fn();
const mockSetUrlGarden = vi.fn();
const mockSyncedGardenId = { current: null as string | null };
const mockStoreState = {
  selectedGarden: null as { id: string; name: string; location?: string } | null,
  setSelectedGarden: mockSetSelectedGarden,
};

vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => mockEligibleState,
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

vi.mock("../../../hooks/navigation/useGardenUrlSync", () => ({
  useGardenUrlSync: () => ({
    gardenId: mockSyncedGardenId.current,
    tab: null,
    item: null,
    setGarden: mockSetUrlGarden,
    setTab: vi.fn(),
    setFilter: vi.fn(),
    openItem: vi.fn(),
    closeItem: vi.fn(),
  }),
}));

import { useAdminGardenWorkspaceSelection } from "../../../hooks/garden/useAdminGardenWorkspaceSelection";

describe("hooks/garden/useAdminGardenWorkspaceSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligibleState.eligibleGardens = [];
    mockEligibleState.resolvedDefaultGarden = null;
    mockEligibleState.isLoaded = true;
    mockStoreState.selectedGarden = null;
    mockSyncedGardenId.current = null;
  });

  it("maps eligible gardens into workspace options", () => {
    mockEligibleState.eligibleGardens = [
      { id: "garden-a", name: "Alpha", location: "Lisbon" },
      { id: "garden-b", name: "Beta" },
    ];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    expect(result.current.gardenOptions).toEqual([
      { id: "garden-a", name: "Alpha", location: "Lisbon" },
      { id: "garden-b", name: "Beta", location: undefined },
    ]);
  });

  it("selects the full eligible garden through URL-backed garden sync", () => {
    const garden = { id: "garden-a", name: "Alpha", location: "Lisbon" };
    mockEligibleState.eligibleGardens = [garden];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    act(() => {
      result.current.handleSelectGarden({ id: "garden-a" });
    });

    expect(mockSetUrlGarden).toHaveBeenCalledWith(garden);
    expect(mockSetSelectedGarden).not.toHaveBeenCalledWith(garden);
  });

  it("clears selection when the selected option id is not eligible", () => {
    mockEligibleState.eligibleGardens = [{ id: "garden-a", name: "Alpha" }];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    act(() => {
      result.current.handleSelectGarden({ id: "garden-missing" });
    });

    expect(mockSetUrlGarden).toHaveBeenCalledWith(null);
  });

  it("auto-selects the resolved default garden through URL-backed garden sync", async () => {
    const firstGarden = { id: "garden-a", name: "Alpha" };
    const persistedGarden = { id: "garden-b", name: "Beta" };
    const onAutoSelectGarden = vi.fn();
    mockEligibleState.eligibleGardens = [firstGarden, persistedGarden];
    mockEligibleState.resolvedDefaultGarden = persistedGarden;

    renderHook(() =>
      useAdminGardenWorkspaceSelection({
        autoSelectFirstGarden: true,
        onAutoSelectGarden,
      })
    );

    await waitFor(() => {
      expect(mockSetUrlGarden).toHaveBeenCalledWith(persistedGarden);
    });
    expect(onAutoSelectGarden).toHaveBeenCalledWith(persistedGarden);
  });

  it("does not auto-select before eligible gardens are loaded", () => {
    mockEligibleState.eligibleGardens = [{ id: "garden-a", name: "Alpha" }];
    mockEligibleState.isLoaded = false;

    renderHook(() => useAdminGardenWorkspaceSelection({ autoSelectFirstGarden: true }));

    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
  });
});
