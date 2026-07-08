/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelectGarden = vi.fn();
const mockClearGarden = vi.fn();
const mockContextState = {
  activeGarden: null as { id: string; name: string; location?: string } | null,
  eligibleGardens: [] as Array<{ id: string; name: string; location?: string }>,
  isLoaded: true,
};

vi.mock("../../../hooks/garden/useAdminGardenContext", () => ({
  useAdminGardenContext: () => ({
    activeGarden: mockContextState.activeGarden,
    activeGardenId: mockContextState.activeGarden?.id ?? null,
    requestedGardenId: mockContextState.activeGarden?.id ?? null,
    eligibleGardens: mockContextState.eligibleGardens,
    isLoaded: mockContextState.isLoaded,
    isError: false,
    hasExplicitGarden: Boolean(mockContextState.activeGarden),
    status: mockContextState.activeGarden ? "ready" : "not-found",
    selectGarden: mockSelectGarden,
    clearGarden: mockClearGarden,
  }),
}));

import { useAdminGardenWorkspaceSelection } from "../../../hooks/garden/useAdminGardenWorkspaceSelection";

describe("hooks/garden/useAdminGardenWorkspaceSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextState.activeGarden = null;
    mockContextState.eligibleGardens = [];
    mockContextState.isLoaded = true;
  });

  it("maps eligible gardens into workspace options", () => {
    mockContextState.eligibleGardens = [
      { id: "garden-a", name: "Alpha", location: "Lisbon" },
      { id: "garden-b", name: "Beta" },
    ];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    expect(result.current.gardenOptions).toEqual([
      { id: "garden-a", name: "Alpha", location: "Lisbon" },
      { id: "garden-b", name: "Beta", location: undefined },
    ]);
  });

  it("selects the full eligible garden through route-backed garden context", () => {
    const garden = { id: "garden-a", name: "Alpha", location: "Lisbon" };
    mockContextState.eligibleGardens = [garden];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    act(() => {
      result.current.handleSelectGarden({ id: "garden-a" });
    });

    expect(mockSelectGarden).toHaveBeenCalledWith(garden);
  });

  it("ignores a selected option id that is not eligible", () => {
    mockContextState.eligibleGardens = [{ id: "garden-a", name: "Alpha" }];

    const { result } = renderHook(() => useAdminGardenWorkspaceSelection());

    act(() => {
      result.current.handleSelectGarden({ id: "garden-missing" });
    });

    expect(mockSelectGarden).not.toHaveBeenCalled();
    expect(mockClearGarden).not.toHaveBeenCalled();
  });

  it("reports the active route-derived garden through the auto-select callback", async () => {
    const activeGarden = { id: "garden-b", name: "Beta" };
    const onAutoSelectGarden = vi.fn();
    mockContextState.eligibleGardens = [activeGarden];
    mockContextState.activeGarden = activeGarden;

    renderHook(() =>
      useAdminGardenWorkspaceSelection({
        autoSelectFirstGarden: true,
        onAutoSelectGarden,
      })
    );

    await waitFor(() => {
      expect(onAutoSelectGarden).toHaveBeenCalledWith(activeGarden);
    });
    expect(mockSelectGarden).not.toHaveBeenCalled();
  });

  it("does not report auto-selection before eligible gardens are loaded", () => {
    const onAutoSelectGarden = vi.fn();
    mockContextState.eligibleGardens = [{ id: "garden-a", name: "Alpha" }];
    mockContextState.activeGarden = { id: "garden-a", name: "Alpha" };
    mockContextState.isLoaded = false;

    renderHook(() =>
      useAdminGardenWorkspaceSelection({ autoSelectFirstGarden: true, onAutoSelectGarden })
    );

    expect(onAutoSelectGarden).not.toHaveBeenCalled();
  });
});
