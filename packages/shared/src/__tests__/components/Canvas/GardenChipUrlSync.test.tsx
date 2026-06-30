/**
 * @vitest-environment jsdom
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminStore, type Garden } from "../../../stores/useAdminStore";
import { GardenChip } from "../../../components/Canvas/GardenChip";
import { useGardenUrlSync } from "../../../hooks/navigation/useGardenUrlSync";
import { compareAddresses } from "../../../utils/blockchain/address";
import { createTestQueryClient } from "../../test-utils";

const TEST_GARDENS: Garden[] = [
  {
    id: "0x1111111111111111111111111111111111111111",
    chainId: 11155111,
    tokenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    tokenID: 1n,
    name: "Garden One",
    description: "",
    location: "Quito",
    bannerImage: "",
    createdAt: 1,
    gardeners: [],
    operators: [],
  },
  {
    id: "0x2222222222222222222222222222222222222222",
    chainId: 11155111,
    tokenAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    tokenID: 2n,
    name: "Garden Two",
    description: "",
    location: "Lisbon",
    bannerImage: "",
    createdAt: 2,
    gardeners: [],
    operators: [],
  },
];

const eligibleState = {
  current: {
    eligibleGardens: TEST_GARDENS,
    resolvedDefaultGarden: TEST_GARDENS[0],
    persistedGardenId: null,
    scopeKey: "11155111:0x9999999999999999999999999999999999999999",
    canCreateGarden: true,
    isLoaded: true,
    isError: false,
    hasStaleBaseList: false,
  },
};
const locationSearch = { current: "" };

vi.mock("../../../hooks/garden/useEligibleAdminGardens", () => ({
  useEligibleAdminGardens: () => eligibleState.current,
}));

function LocationProbe() {
  const location = useLocation();
  locationSearch.current = location.search;
  return <output data-testid="garden-url">{location.search}</output>;
}

function GardenChipUrlSyncHarness() {
  const shellSync = useGardenUrlSync();
  // The admin shell and nested workspaces can mount URL sync readers at the same
  // time. This second instance reproduces the stale-URL restore race from PR #543.
  useGardenUrlSync();

  const selectedGarden =
    TEST_GARDENS.find((garden) => compareAddresses(garden.id, shellSync.gardenId)) ?? null;

  return (
    <GardenChip
      gardens={TEST_GARDENS.map((garden) => ({ id: garden.id, name: garden.name }))}
      selectedGarden={selectedGarden}
      onSelectGarden={(garden) => {
        const fullGarden = garden
          ? (TEST_GARDENS.find((entry) => compareAddresses(entry.id, garden.id)) ?? null)
          : null;
        shellSync.setGarden(fullGarden);
      }}
    />
  );
}

function renderHarness(initialEntry: string) {
  const queryClient = createTestQueryClient();
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <IntlProvider
          locale="en"
          messages={{
            "cockpit.gardenChip.allGardens": "All Gardens",
            "cockpit.gardenChip.createGarden": "Create Garden",
          }}
        >
          <LocationProbe />
          <GardenChipUrlSyncHarness />
        </IntlProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("GardenChip + useGardenUrlSync integration", () => {
  beforeEach(() => {
    localStorage.clear();
    locationSearch.current = "";
    act(() => {
      useAdminStore.setState({
        selectedGarden: TEST_GARDENS[0],
        lastGardenIdsByScope: {},
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an interactive chip for two eligible gardens and switches URL plus selected garden", async () => {
    const user = userEvent.setup();
    renderHarness(`/hub/work?gardenId=${TEST_GARDENS[0].id}`);

    const trigger = screen.getByRole("button", { name: /garden one/i });
    expect(trigger).toHaveAttribute("data-slot", "trigger");

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Garden Two" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /garden two/i })).toBeInTheDocument();
      expect(screen.getByTestId("garden-url")).toHaveTextContent(`gardenId=${TEST_GARDENS[1].id}`);
    });
  });
});
