/**
 * GardensList Component Tests
 *
 * Tests the profile's "My gardens" list: loading, empty, and error states, the
 * gardens an account belongs to, and opening one. Joining lives on the garden.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state
const mockGardensState = {
  data: [] as any[],
  isError: false,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
};
const mockNavigate = vi.fn();
// Mock @green-goods/shared
vi.mock("@green-goods/shared/hooks/garden/useJoinGarden", () => ({
  isGardenMember: (address: string, gardeners: string[], _stewards: string[], _id: string) =>
    gardeners.includes(address),
  usePendingJoinsVersion: () => 0,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mockGardensState,
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
    mockGardensState.data = [];
    mockGardensState.isError = false;
    mockGardensState.isLoading = false;
    mockGardensState.isFetching = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when no primaryAddress", () => {
    const { container } = render(wrap(createElement(GardensList, { primaryAddress: undefined })));

    expect(container.innerHTML).toBe("");
  });

  it("shows loading state", () => {
    mockGardensState.isLoading = true;

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText(/loading gardens/i)).toBeInTheDocument();
  });

  it("shows empty state when no gardens available", () => {
    mockGardensState.data = [];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText(/no gardens yet/i)).toBeInTheDocument();
    expect(screen.getByText(/join a garden to start documenting/i)).toBeInTheDocument();
  });

  it("shows a retry state when gardens cannot load without a cache", async () => {
    const user = userEvent.setup();
    mockGardensState.isError = true;

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText("Gardens are unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByText(/no gardens yet/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockGardensState.refetch).toHaveBeenCalledOnce();
  });

  it("navigates to home when Open Gardens is clicked from empty state", async () => {
    mockGardensState.data = [];
    const user = userEvent.setup();

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    await user.click(screen.getByRole("button", { name: "Open Gardens" }));
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  it("lists only the gardens the account belongs to, open or not", () => {
    mockGardensState.data = [
      {
        id: "0xgarden1",
        name: "My Garden",
        location: "Berlin",
        openJoining: false,
        gardeners: [MOCK_ADDRESS],
        stewards: [],
      },
      {
        id: "0xgarden2",
        name: "Open Garden",
        location: "Lagos",
        openJoining: true,
        gardeners: [],
        stewards: [],
      },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));

    expect(screen.getByText("My Garden")).toBeInTheDocument();
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    // Joining lives on the garden itself, so an open garden is not offered here.
    expect(screen.queryByText("Open Garden")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
  });

  it("opens the garden when its row is pressed", async () => {
    const user = userEvent.setup();
    mockGardensState.data = [
      { id: "0xgarden1", name: "My Garden", gardeners: [MOCK_ADDRESS], stewards: [] },
    ];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    await user.click(screen.getByRole("button", { name: /my garden/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home/0xgarden1");
  });

  it("constrains long garden names and locations inside the row", () => {
    const longName = "RegenerativeBioregionStewardshipGardenCollective2026";
    const longLocation = "RuaDasCooperativasNeighborhoodWithLongUnbrokenPlaceNameLisbonPortugal";
    mockGardensState.data = [
      {
        id: "0xgarden-long",
        name: longName,
        location: longLocation,
        gardeners: [MOCK_ADDRESS],
        stewards: [],
      },
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
