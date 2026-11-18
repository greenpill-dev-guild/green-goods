/**
 * GardensList Component Tests
 *
 * Tests the profile's "My gardens" list: loading, empty, and error states, the
 * gardens an account belongs to, the active garden's mark, and opening one.
 * Joining lives on the garden, and only Home's chip switches the active garden.
 */

import en from "@green-goods/shared/i18n/en.json";
import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
const departure = vi.hoisted(() => ({
  options: [] as any[],
  leave: vi.fn(),
  recover: vi.fn(),
  check: vi.fn(),
}));
vi.mock("@green-goods/shared/hooks/garden/useLeaveGarden", () => ({
  useGardenDepartureOptions: () => ({
    options: departure.options,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useLeaveGarden: () => ({
    leaveGarden: departure.leave,
    reconcileDeparture: departure.recover,
    isLeaving: false,
    availability: "available",
    checkAvailability: departure.check,
    hasPendingDeparture: false,
  }),
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x1234567890abcdef1234567890abcdef12345678" }),
}));
vi.mock("@green-goods/shared/hooks/roles/useHasRole", () => ({
  useHasRole: () => ({ hasRole: false, refetch: vi.fn() }),
}));
vi.mock("@green-goods/shared/hooks/roles/useGardenMembership", () => ({
  useGardenMembership: () => ({ isMember: true, refetch: vi.fn() }),
}));
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { success: vi.fn(), error: vi.fn() },
}));
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
vi.mock("@green-goods/shared/hooks/garden/useGardenMemberHistory", () => ({
  useGardenMemberHistory: vi.fn(() => ({
    members: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
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

// Mock client components
vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "card" }, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { GardensList } from "../../views/Profile/GardensList";

const wrap = (el: React.ReactElement) =>
  createElement(
    MemoryRouter,
    null,
    createElement(IntlProvider, { locale: "en", messages: en }, el)
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
    departure.options = [];
    vi.mocked(useGardenMemberHistory).mockReturnValue({
      members: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useGardenMemberHistory>);
    departure.leave.mockResolvedValue({ hash: "0xabc", departed: true });
    departure.recover.mockResolvedValue({ hash: "0xabc", departed: false });
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

    const rows = mockMyGardens.gardens.map(({ garden }) =>
      screen.getByRole("button", { name: garden.name })
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("My Garden"),
      expect.stringContaining("Reviewed Garden"),
    ]);
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    // Joining lives on the garden itself, so this list offers no join.
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
  });

  it("opens the normal leave sheet for an older membership found only in Profile", async () => {
    departure.options = [
      {
        ...asMine({ id: "0xolder", name: "Older Garden" }),
        roles: ["gardener"],
        hasPendingDeparture: false,
      },
    ];
    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    const myGardens = screen.getByText("My gardens").closest("section")!;
    await userEvent
      .setup()
      .click(within(myGardens).getByRole("button", { name: "Leave Garden: Older Garden" }));
    expect(screen.getByRole("dialog", { name: "Leave Older Garden?" })).toBeInTheDocument();
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
    const rows = mockMyGardens.gardens.map(({ garden }) =>
      screen.getByRole("button", { name: garden.name })
    );
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

    expect(screen.getAllByText("Leave Garden")).toHaveLength(2);
    expect(screen.queryByText("On Home")).not.toBeInTheDocument();
  });

  it("opens the garden when its row is pressed", async () => {
    const user = userEvent.setup();
    mockMyGardens.gardens = [asMine({ id: "0xgarden1", name: "My Garden" })];

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    await user.click(screen.getByRole("button", { name: "My Garden" }));

    expect(mockNavigate).toHaveBeenCalledWith("/home/0xgarden1");
  });

  it("matches each garden's own membership dates from one account history read", () => {
    const first = "0x1111111111111111111111111111111111111111";
    const second = "0x2222222222222222222222222222222222222222";
    mockMyGardens.gardens = [
      asMine({ id: first, name: "River garden" }),
      {
        garden: { id: second, name: "Hill garden" },
        membership: { roles: ["steward", "gardener"], pendingJoin: false },
      },
    ];
    vi.mocked(useGardenMemberHistory).mockReturnValue({
      members: [
        {
          garden: second,
          account: MOCK_ADDRESS,
          joinedAt: Date.UTC(2026, 4, 3, 12),
          memberSince: Date.UTC(2026, 8, 4, 12),
          roleSince: { gardener: Date.UTC(2026, 8, 4, 12), steward: Date.UTC(2026, 9, 5, 12) },
        },
        {
          garden: first.toUpperCase().replace("0X", "0x"),
          account: MOCK_ADDRESS,
          joinedAt: Date.UTC(2026, 5, 12, 12),
          memberSince: Date.UTC(2026, 5, 12, 12),
          roleSince: { gardener: Date.UTC(2026, 5, 12, 12) },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useGardenMemberHistory>);

    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS })));

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Jun 12, 2026");
    expect(rows[0]).not.toHaveTextContent("May 3, 2026");
    expect(rows[1]).toHaveTextContent("May 3, 2026");
    expect(rows[1]).toHaveTextContent("Sep 4, 2026");
    expect(rows[1]).toHaveTextContent("Oct 5, 2026");
    expect(useGardenMemberHistory).toHaveBeenCalledWith({ account: MOCK_ADDRESS });
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

  it.each([
    0, 1, 2,
  ])("hands an active departure to Home after the sheet closes (%s gardens remain)", async (remaining) => {
    const user = userEvent.setup();
    const leaving = asMine({ id: "0xgarden1", name: "My Garden" });
    const others = Array.from({ length: remaining }, (_, i) =>
      asMine({ id: `0xother${i}`, name: `Other ${i}` })
    );
    mockMyGardens.gardens = [leaving, ...others];
    mockActiveGarden.gardenId = leaving.garden.id;
    let finish!: (result: { hash: string; departed: boolean }) => void;
    departure.leave.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const view = render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    await user.click(screen.getByRole("button", { name: "Leave Garden: My Garden" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Leave Garden" })
    );
    // Receipt reconciliation removes the row before the command resolves. The flow must survive.
    mockMyGardens.gardens = others;
    mockActiveGarden.gardenId = others.length === 1 ? others[0].garden.id : null;
    view.rerender(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    const dialogAtNavigation: Array<HTMLElement | null> = [];
    mockNavigate.mockImplementationOnce(() => {
      dialogAtNavigation.push(screen.queryByRole("dialog"));
    });
    await act(async () => finish({ hash: "0xabc", departed: true }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true, viewTransition: true })
    );
    expect(dialogAtNavigation).toEqual([null]);
  });

  it.each([
    true,
    false,
  ])("keeps Profile when leaving another garden or recovering a rejoin (departed=%s)", async (departed) => {
    const user = userEvent.setup();
    mockMyGardens.gardens = [asMine({ id: "0xgarden1", name: "My Garden" })];
    mockActiveGarden.gardenId = departed ? "0xanother" : "0xgarden1";
    departure.leave.mockResolvedValue({ hash: "0xabc", departed });
    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    await user.click(screen.getByRole("button", { name: "Leave Garden: My Garden" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Leave Garden" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps a previous departure accessible after the member card disappears", () => {
    departure.options = [
      {
        garden: { id: "0xleft", name: "Previous Garden" },
        membership: { roles: [], pendingJoin: false },
        roles: [],
        hasPendingDeparture: true,
      },
    ];
    render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    expect(screen.getByRole("heading", { name: "Previous Departures" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Check Previous Departure: Previous Garden/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Leave Garden: Previous Garden" })
    ).not.toBeInTheDocument();
  });
  it("closes a departure on account change and does not reopen it when that account returns", async () => {
    const user = userEvent.setup();
    mockMyGardens.gardens = [asMine({ id: "0xgarden1", name: "My Garden" })];
    const view = render(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    await user.click(screen.getByRole("button", { name: "Leave Garden: My Garden" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    view.rerender(wrap(createElement(GardensList, { primaryAddress: undefined })));
    view.rerender(wrap(createElement(GardensList, { primaryAddress: MOCK_ADDRESS as any })));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(departure.leave).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
