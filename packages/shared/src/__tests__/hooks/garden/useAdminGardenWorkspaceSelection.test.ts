/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEligibleState = {
  eligibleGardens: [] as Array<{ id: string; name: string; location?: string }>,
  isLoaded: true,
};
const mockSetSelectedGarden = vi.fn();
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

import { useAdminGardenWorkspaceSelection } from "../../../hooks/garden/useAdminGardenWorkspaceSelection";

describe("hooks/garden/useAdminGardenWorkspaceSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligibleState.eligibleGardens = [];
    mockEligibleState.isLoaded = true;
    mockStoreState.selectedGarden = null;
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

  it("selects the full eligible garden from a workspace option id", () => {
    const garden = { id: "garden-a", name: "Alpha", location: "Lisbon" };
    mockEligibleState.eligibleGardens = [garden];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    act(() => {
      result.current.handleSelectGarden({ id: "garden-a" });
    });

    expect(mockSetSelectedGarden).toHaveBeenCalledWith(garden);
  });

  it("clears selection when the selected option id is not eligible", () => {
    mockEligibleState.eligibleGardens = [{ id: "garden-a", name: "Alpha" }];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    act(() => {
      result.current.handleSelectGarden({ id: "garden-missing" });
    });

    expect(mockSetSelectedGarden).toHaveBeenCalledWith(null);
  });

  it("auto-selects the first loaded garden when requested", async () => {
    const firstGarden = { id: "garden-a", name: "Alpha" };
    const onAutoSelectGarden = vi.fn();
    mockEligibleState.eligibleGardens = [firstGarden, { id: "garden-b", name: "Beta" }];

    renderHook(() =>
      useAdminGardenWorkspaceSelection({
        autoSelectFirstGarden: true,
        onAutoSelectGarden,
      })
    );

    await waitFor(() => {
      expect(mockSetSelectedGarden).toHaveBeenCalledWith(firstGarden);
    });
    expect(onAutoSelectGarden).toHaveBeenCalledWith(firstGarden);
  });

  it("does not auto-select before eligible gardens are loaded", () => {
    mockEligibleState.eligibleGardens = [{ id: "garden-a", name: "Alpha" }];
    mockEligibleState.isLoaded = false;

    renderHook(() => useAdminGardenWorkspaceSelection({ autoSelectFirstGarden: true }));

    expect(mockSetSelectedGarden).not.toHaveBeenCalled();
  });
});
