/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminGardenWorkspaceSelection } from "../../../hooks/garden/useAdminGardenWorkspaceSelection";
import { ADMIN_GARDEN_PREFERENCES_STORAGE_KEY, useAdminStore } from "../../../stores/useAdminStore";
import type { Garden } from "../../../types/domain";
import { createMockGarden } from "../../test-utils";

const mockEligibleState = vi.hoisted(() => ({
  current: {
    eligibleGardens: [] as Garden[],
    resolvedDefaultGarden: null as Garden | null,
    persistedGardenId: null as string | null,
    scopeKey: "11155111:0x1111111111111111111111111111111111111111",
    canCreateGarden: false,
    isLoaded: true,
    isError: false,
    hasStaleBaseList: false,
  },
}));

vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => mockEligibleState.current,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function GardenSwitchingHarness() {
  const { selectedGarden, gardenOptions, handleSelectGarden } = useAdminGardenWorkspaceSelection({
    autoSelectFirstGarden: true,
  });
  const activeGardenId = selectedGarden?.id.toLowerCase() ?? "";
  const renderedContent =
    activeGardenId === "0xaaa0000000000000000000000000000000000aaa"
      ? "Alpha settings and work queue"
      : activeGardenId === "0xbbb0000000000000000000000000000000000bbb"
        ? "Beta members and treasury"
        : "No garden selected";

  return (
    <section>
      <h1 data-testid="garden-heading">{selectedGarden?.name ?? "No garden"}</h1>
      <p>{renderedContent}</p>
      {gardenOptions.map((garden) => (
        <button
          key={garden.id}
          type="button"
          onClick={() =>
            handleSelectGarden({
              id: garden.name === "Beta Garden" ? garden.id.toUpperCase() : garden.id,
              name: garden.name,
            })
          }
        >
          Switch to {garden.name}
        </button>
      ))}
      <LocationProbe />
    </section>
  );
}

describe("admin garden switching rendered context", () => {
  beforeEach(() => {
    localStorage.removeItem(ADMIN_GARDEN_PREFERENCES_STORAGE_KEY);
    useAdminStore.setState({ selectedGarden: null, lastGardenIdsByScope: {} });
  });

  it("updates URL and rendered admin content after switching between two eligible gardens", async () => {
    const gardenA = createMockGarden({
      id: "0xaaa0000000000000000000000000000000000aaa",
      tokenAddress: "0x9990000000000000000000000000000000000999",
      name: "Alpha Garden",
      location: "Quito",
    });
    const gardenB = createMockGarden({
      id: "0xbbb0000000000000000000000000000000000bbb",
      tokenAddress: "0x9990000000000000000000000000000000000999",
      name: "Beta Garden",
      location: "Bogota",
    });
    mockEligibleState.current = {
      ...mockEligibleState.current,
      eligibleGardens: [gardenA, gardenB],
      resolvedDefaultGarden: gardenA,
    };

    render(
      <MemoryRouter initialEntries={["/hub"]}>
        <GardenSwitchingHarness />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("garden-heading")).toHaveTextContent("Alpha Garden");
    });
    expect(screen.getByText("Alpha settings and work queue")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Beta Garden" }));

    await waitFor(() => {
      expect(screen.getByTestId("garden-heading")).toHaveTextContent("Beta Garden");
    });
    expect(screen.queryByText("Alpha settings and work queue")).not.toBeInTheDocument();
    expect(screen.getByText("Beta members and treasury")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "gardenAddress=0xbbb0000000000000000000000000000000000bbb"
    );
  });
});
