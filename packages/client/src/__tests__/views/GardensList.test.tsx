/**
 * GardensList Component Tests
 *
 * Tests the profile's "My gardens" list: loading, empty, and error states, the
 * gardens an account belongs to, the active garden's mark, and opening one.
 * Joining lives on the garden, and only Home's chip switches the active garden.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state: the membership owner's answer for the signed-in account.
const mockMyGardens = {
  gardens: [] as Array<{ garden: any; membership: { roles: string[]; pendingJoin: boolean } }>,
  isLoaded: true,
  isError: false,
  isStale: false,
  refetch: vi.fn(),
};
const mockNavigate = vi.fn();
const asMine = (garden: any) => ({
  garden,
  membership: { roles: ["gardener"], pendingJoin: false },
});
// The garden Home opens in, as the resolver reports it.
const mockActiveGarden = { gardenId: null as string | null, selectGarden: vi.fn() };
// Mock @green-goods/shared
vi.mock("@green-goods/shared/hooks/garden/useMyGardens", () => ({
  useMyGardens: () => mockMyGardens,
}));
vi.mock("@green-goods/shared/hooks/garden/useActiveGarden", () => ({
  useActiveGarden: () => mockActiveGarden,
}));

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

// Mock react-router-dom navigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiArrowRightSLine: (props: any) => createElement("span", props),
  RiErrorWarningLine: (props: any) => createElement("span", props),
  RiHomeLine: (props: any) => createElement("span", props),
  RiMapPinLine: (props: any) => createElement("span", props),
  RiLoader4Line: (props: any) => createElement("span", props),
  RiPlantLine: (props: any) => createElement("span", props),
  RiRefreshLine: (props: any) => createElement("span", props),
}));

// Mock client components
vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "card" }, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

import { GardensList } from "../../views/Profile/GardensList";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";

const wrap = (el: React.ReactElement) =>
  createElement(
    MemoryRouter,
    null,
    createElement(IntlProvider, { locale: "en", messages: {} }, el)
  );

const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

describe("GardensList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.getState().resetGardenFilters();
    mockMyGardens.gardens = [];
    mockMyGardens.isLoaded = true;
    mockMyGardens.isError = false;
    mockMyGardens.isStale = false;
    mockActiveGarden.gardenId = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when no primaryAddress", () => {
    const { container } = render(wrap(createElement(GardensList, { primaryAddress: undefined })));

    expect(container.innerHTML).toBe("");
  });

  it("shows loading state while the account's gardens are unknown", () => {
    mockMyGardens.isLoaded = false;

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText(/loading gardens/i)).toBeInTheDocument();
    expect(screen.queryByText(/no gardens yet/i)).not.toBeInTheDocument();
  });

  it("shows empty state when no gardens available", () => {
    mockMyGardens.gardens = [];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText(/no gardens yet/i)).toBeInTheDocument();
    expect(screen.getByText(/join a garden to start documenting/i)).toBeInTheDocument();
  });

  it("shows a retry state when gardens cannot load without a cache", async () => {
    const user = userEvent.setup();
    mockMyGardens.isLoaded = false;
    mockMyGardens.isError = true;

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText("Gardens are unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByText(/no gardens yet/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockMyGardens.refetch).toHaveBeenCalledOnce();
  });

  it("keeps the last good list when a refresh fails", () => {
    mockMyGardens.isError = true;
    mockMyGardens.isStale = true;
    mockMyGardens.gardens = [asMine({ id: "0xgarden1", name: "My Garden" })];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText("My Garden")).toBeInTheDocument();
    expect(screen.queryByText("Gardens are unavailable right now.")).not.toBeInTheDocument();
  });

  it("applies the open scope and clears restrictive filters before opening home", async () => {
    mockMyGardens.gardens = [];
    useUIStore.getState().setGardenFilters(() => ({ scope: "mine", sort: "recent", domains: [0] }));
    mockNavigate.mockImplementationOnce(() => {
      expect(useUIStore.getState().gardenFilters).toEqual({ scope: "open", sort: "recent" });
    });
    const user = userEvent.setup();

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    await user.click(screen.getByRole("button", { name: "Open Gardens" }));
    expect(mockNavigate).toHaveBeenCalledWith("/home/explore");
  });

  it("lists the gardens the membership owner returns, in its order, with no join offer", () => {
    mockMyGardens.gardens = [
      asMine({ id: "0xgarden1", name: "My Garden", location: "Berlin" }),
      {
        garden: { id: "0xgarden2", name: "Reviewed Garden", location: "Lagos" },
        membership: { roles: ["evaluator"], pendingJoin: false },
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    const rows = screen.getAllByRole("button", { name: /garden/i });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("My Garden"),
      expect.stringContaining("Reviewed Garden"),
    ]);
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    // Joining lives on the garden itself, so this list offers no join.
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
  });

  it("marks the active garden On Home and offers no control to switch it", async () => {
    const user = userEvent.setup();
    mockMyGardens.gardens = [
      asMine({ id: "0xgarden1", name: "My Garden" }),
      asMine({ id: "0xGarden2", name: "Rooftop Garden" }),
    ];
    mockActiveGarden.gardenId = "0xgarden2";

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    // Only Home's chip switches: the list holds its rows and nothing else.
    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("On Home");
    expect(rows[0]).not.toHaveTextContent("On Home");

    await user.click(rows[1]);
    expect(mockNavigate).toHaveBeenCalledWith("/home/0xGarden2");
    expect(mockActiveGarden.selectGarden).not.toHaveBeenCalled();
  });

  it("marks no garden while the member has not chosen one", () => {
    mockMyGardens.gardens = [
      asMine({ id: "0xgarden1", name: "My Garden" }),
      asMine({ id: "0xgarden2", name: "Rooftop Garden" }),
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("On Home")).not.toBeInTheDocument();
  });

  it("opens the garden when its row is pressed", async () => {
    const user = userEvent.setup();
    mockMyGardens.gardens = [asMine({ id: "0xgarden1", name: "My Garden" })];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    await user.click(screen.getByRole("button", { name: /my garden/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home/0xgarden1");
  });

  it("constrains long garden names and locations inside the row", () => {
    const longName = "RegenerativeBioregionStewardshipGardenCollective2026";
    const longLocation = "RuaDasCooperativasNeighborhoodWithLongUnbrokenPlaceNameLisbonPortugal";
    mockMyGardens.gardens = [
      asMine({ id: "0xgarden-long", name: longName, location: longLocation }),
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    const gardenName = screen.getByText(longName);
    expect(gardenName).toHaveClass("line-clamp-2", "min-w-0", "max-w-full");
    expect(gardenName.className).toContain("[overflow-wrap:anywhere]");
    expect(gardenName.parentElement).toHaveClass("min-w-0", "flex-1");
    const location = screen.getByText(longLocation);
    expect(location).toHaveClass("min-w-0", "truncate");
    expect(location.parentElement).toHaveClass("min-w-0", "max-w-full");
  });
});
