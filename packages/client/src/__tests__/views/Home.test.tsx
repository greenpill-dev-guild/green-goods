/**
 * Home in the member's active garden (DL-123 to DL-125): the header's chip, the five states of
 * `useActiveGarden`, the one-time chooser and the switcher. The active garden is the edge: its
 * store and resolver have their own tests, so here a pick calls `selectGarden` and nothing else
 * does.
 */

import type { ArrivalState } from "@green-goods/shared/hooks/app/useArrivalState";
import messages from "@green-goods/shared/i18n/en.json";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Garden } from "@green-goods/shared/types/domain";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACCOUNT = "0x1234567890abcdef1234567890abcdef12345678";

const garden = (suffix: string, name: string, overrides: Partial<Garden> = {}) =>
  ({
    id: `0x60000000000000000000000000000000000000${suffix}`,
    name,
    location: `${name} place`,
    bannerImage: "",
    openJoining: false,
    gardeners: [],
    stewards: [],
    owners: [],
    evaluators: [],
    ...overrides,
  }) as unknown as Garden;

const TAS = garden("01", "TAS HUB");
const AIYELOJA = garden("02", "Aiyeloja Family Garden");
const VIDA = garden("03", "Vida Verde");
const COMMUNITY = garden("04", "Green Goods Community Garden", { openJoining: true });

const state = vi.hoisted(() => ({
  active: {} as Record<string, unknown>,
  listed: [] as unknown[],
  awaiting: new Set<string>(),
  arrival: { kind: "none" } as ArrivalState,
  rootGarden: "",
}));

vi.mock("@green-goods/shared/hooks/garden/useActiveGarden", () => ({
  useActiveGarden: () => state.active,
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: state.listed, isPending: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@green-goods/shared/hooks/garden/useGardenJoinRequests", () => ({
  useAwaitingJoinRequests: () => state.awaiting,
}));
vi.mock("@green-goods/shared/hooks/garden/useJoinGarden", () => ({
  useJoinGarden: () => ({ joinGarden: vi.fn(), isJoining: false }),
}));
vi.mock("@green-goods/shared/config/blockchain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared/config/blockchain")>();
  return {
    ...actual,
    getDefaultChain: () => ({
      ...actual.getDefaultChain(),
      rootGarden: { address: state.rootGarden, tokenId: 1 },
    }),
  };
});
vi.mock("@green-goods/shared/hooks/app/useArrivalState", () => ({
  useArrivalState: () => state.arrival,
}));
vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => ({ isAuthenticated: true }),
}));
vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => ACCOUNT,
}));
vi.mock("@green-goods/shared/hooks/app/useBrowserNavigation", () => ({
  useBrowserNavigation: vi.fn(),
}));
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// The launchers and their sheets have their own tests.
vi.mock("../../views/Home/WalletSheet/Icon", () => ({
  WalletSheetIcon: () => createElement("button", { type: "button" }, "Wallet"),
}));
vi.mock("../../views/Home/CommitmentsSheet/Icon", () => ({
  CommitmentsSheetIcon: () => createElement("button", { type: "button" }, "Promises"),
}));
vi.mock("../../views/Home/WorkDashboard/Icon", () => ({
  WorkDashboardIcon: () =>
    createElement("button", { type: "button", "data-testid": "work-dashboard-icon" }, "Your Work"),
}));
vi.mock("../../views/Home/CommitmentsSheet", () => ({ CommitmentsSheet: () => null }));
vi.mock("../../views/Home/WalletSheet", () => ({ WalletSheet: () => null }));
// The journal is the seam the journal steps fill; Home only mounts it.
vi.mock("../../views/Home/Journal", () => ({
  HomeJournal: ({ garden }: { garden: Garden }) =>
    createElement("section", { "data-testid": "home-journal" }, garden.name),
}));

import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import Home from "../../views/Home";
import { markArrivalPassed } from "../../views/Home/arrivalToast";

type Status = "loading" | "error" | "none" | "choose" | "ready";
type Role = "owner" | "steward" | "evaluator" | "gardener";

const selectGarden = vi.fn();
const refetch = vi.fn();

function setActive(
  status: Status,
  mine: Array<[Garden, Role[]]> = [],
  activeId: string | null = null
) {
  state.active = {
    status,
    gardenId: activeId,
    garden: status === "ready" ? (mine.find(([g]) => g.id === activeId)?.[0] ?? null) : null,
    myGardens: {
      gardens: mine.map(([g, roles]) => ({ garden: g, membership: { roles, pendingJoin: false } })),
      isLoaded: status !== "loading" && status !== "error",
      isError: status === "error",
      isStale: false,
      refetch,
    },
    selectGarden,
  };
}

let location = "";
function LocationProbe() {
  location = useLocation().pathname;
  return null;
}
function VisitedGarden() {
  return createElement("p", null, `Visiting ${useParams().id}`);
}

function renderHome(entry = "/home") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(LocationProbe),
        createElement(
          Routes,
          null,
          createElement(
            Route,
            { path: "/home", element: createElement(Home) },
            createElement(Route, { path: "explore", element: createElement("p", null, "Explore") }),
            createElement(Route, { path: ":id", element: createElement(VisitedGarden) })
          )
        )
      )
    )
  );
}

/** Lets a closing sheet finish its exit. */
const finishSheetMotion = () => act(() => vi.runAllTimers());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  sessionStorage.clear();
  state.listed = [TAS, AIYELOJA, VIDA, COMMUNITY];
  state.awaiting = new Set();
  state.arrival = { kind: "none" };
  state.rootGarden = COMMUNITY.id;
  useUIStore.getState().resetForAccountChange();
  setActive("ready", [[TAS, ["steward"]]], TAS.id);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Home's header", () => {
  it("starts with the active garden's chip in the title's place, then Wallet, Promises and Your Work", () => {
    renderHome();

    const chip = screen.getByRole("button", { name: /TAS HUB/ });
    expect(chip).toHaveAttribute("data-component", "GardenChip");
    const header = chip.closest("[data-component='HomeHeader']") as HTMLElement;
    expect(
      within(header)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["TAS HUB", "Wallet", "Promises", "Your Work"]);
    // Filters moved to Explore's top bar.
    expect(screen.queryByRole("button", { name: "Filters" })).not.toBeInTheDocument();
  });

  it("names Home in the chip's place when the member has no garden", () => {
    setActive("none");
    renderHome();

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(document.querySelector("[data-component='GardenChip']")).toBeNull();
  });
});

describe("Home's states", () => {
  it("opens the active garden's journal when ready", () => {
    renderHome();

    expect(screen.getByTestId("home-journal")).toHaveTextContent("TAS HUB");
  });

  it("goes straight into a remembered garden while the account's gardens load", () => {
    setActive("loading", [], TAS.id);
    renderHome();

    expect(screen.getByRole("status")).toHaveTextContent("Loading garden...");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Find Your Garden")).not.toBeInTheDocument();
  });

  it("says a failed read lost nothing and tries again", () => {
    setActive("error");
    renderHome();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your gardens");
    expect(alert).toHaveTextContent("Nothing was lost");
    fireEvent.click(within(alert).getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("finds a garden: Explore, the requests awaiting review and the Community Garden's open door", () => {
    setActive("none");
    state.awaiting = new Set([VIDA.id.toLowerCase()]);
    renderHome();

    expect(screen.getByRole("heading", { name: "Find Your Garden" })).toBeInTheDocument();
    const requests = screen.getByRole("region", { name: "Your Requests" });
    expect(within(requests).getByRole("button", { name: /Vida Verde/ })).toHaveTextContent(
      "Awaiting review"
    );
    const door = screen.getByRole("region", { name: "Join the Community Garden" });
    expect(door).toHaveTextContent("Green Goods Community Garden");
    expect(within(door).getByRole("button", { name: "Join Garden" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Explore Gardens" }));
    expect(location).toBe("/home/explore");
  });

  it("keeps the requests and the door out when there are none to show", () => {
    setActive("none");
    state.rootGarden = "";
    renderHome();

    expect(screen.queryByRole("region", { name: "Your Requests" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Join the Community Garden" })
    ).not.toBeInTheDocument();
  });
});

describe("the one-time chooser", () => {
  beforeEach(() => {
    setActive("choose", [
      [TAS, ["steward"]],
      [AIYELOJA, ["gardener"]],
    ]);
  });

  it("opens once as Choose a Garden, and dismissing it leaves a quiet prompt without a write", () => {
    const view = renderHome();

    const chooser = screen.getByRole("dialog", { name: "Choose a Garden" });
    fireEvent.click(within(chooser).getByTestId("app-sheet-close"));
    finishSheetMotion();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose a Garden" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See Your Gardens" })).toBeInTheDocument();
    expect(selectGarden).not.toHaveBeenCalled();

    // Coming back to Home this session does not ask again.
    view.unmount();
    renderHome();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("writes only the garden the member picks", () => {
    renderHome();

    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Choose a Garden" })).getByRole("button", {
        name: /Aiyeloja Family Garden/,
      })
    );

    expect(selectGarden).toHaveBeenCalledExactlyOnceWith(AIYELOJA.id);
    expect(location).toBe("/home");
  });
});

describe("the switcher", () => {
  beforeEach(() => {
    setActive(
      "ready",
      [
        [TAS, ["owner", "steward"]],
        [AIYELOJA, ["gardener"]],
      ],
      TAS.id
    );
    state.awaiting = new Set([VIDA.id.toLowerCase()]);
  });

  const openSwitcher = () => {
    fireEvent.click(screen.getByRole("button", { name: /TAS HUB/ }));
    return screen.getByRole("dialog", { name: "Your Gardens" });
  };

  it("lists the member's gardens with their place and role, the active one marked, and Explore last", () => {
    renderHome();
    const switcher = openSwitcher();

    const rows = within(switcher).getAllByRole("button", { name: /./ }).slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "TAS HUBTAS HUB placeOwner",
      "Aiyeloja Family GardenAiyeloja Family Garden placeGardener",
      "Vida VerdeVida Verde placeAwaiting review",
      "Explore GardensFind a garden to join",
    ]);
    expect(rows[0]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).not.toHaveAttribute("aria-current");
  });

  it("opens with one garden too", () => {
    setActive("ready", [[TAS, ["gardener"]]], TAS.id);
    renderHome();

    expect(openSwitcher()).toBeInTheDocument();
  });

  it("switches on a pick and stays on Home", () => {
    renderHome();
    fireEvent.click(within(openSwitcher()).getByRole("button", { name: /Aiyeloja Family Garden/ }));

    expect(selectGarden).toHaveBeenCalledExactlyOnceWith(AIYELOJA.id);
    expect(location).toBe("/home");
  });

  it("visits a garden awaiting review without switching to it", () => {
    renderHome();
    fireEvent.click(within(openSwitcher()).getByRole("button", { name: /Vida Verde/ }));

    expect(location).toBe(`/home/${VIDA.id}`);
    expect(selectGarden).not.toHaveBeenCalled();
  });

  it("opens Explore from its last row", () => {
    renderHome();
    fireEvent.click(within(openSwitcher()).getByRole("button", { name: /Explore Gardens/ }));

    expect(location).toBe("/home/explore");
    expect(selectGarden).not.toHaveBeenCalled();
  });
});

describe("Home under its child routes", () => {
  it("keeps the dashboard host mounted beneath Explore", () => {
    renderHome();
    const host = screen.getByTestId("work-dashboard-icon");

    fireEvent.click(screen.getByRole("button", { name: /TAS HUB/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explore Gardens/ }));
    finishSheetMotion();

    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByTestId("work-dashboard-icon")).toBe(host);
    expect(host).not.toBeVisible();
  });

  // A garden page under Home renders its own sheets, and the Endowment sheet opens from one
  // app-wide flag: a journal left mounted would open a second sheet for the active garden.
  it("leaves the journal while a garden page shows", () => {
    renderHome(`/home/${AIYELOJA.id}`);

    expect(screen.getByText(`Visiting ${AIYELOJA.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId("home-journal")).not.toBeInTheDocument();
  });

  it.each(["/home", "/home/"])("shows Home at the compatible entry %s", (entry) => {
    renderHome(entry);

    expect(screen.getByTestId("home-journal")).toBeVisible();
  });
});

describe("arrival toast", () => {
  // Home waits 700 ms after an arrival resolves before it shows the toast.
  const passArrivalDelay = () => act(() => vi.advanceTimersByTime(700));
  const shownToast = () => vi.mocked(toastService.info).mock.calls.at(-1)?.[0];

  beforeEach(() => {
    state.arrival = { kind: "queue", orientation: { target: "yourWork" } };
  });

  it("tells a session that opens on Home about its uploads, and Review opens Your Work on Pending", () => {
    renderHome();
    passArrivalDelay();

    expect(toastService.info).toHaveBeenCalledOnce();
    expect(shownToast()).toMatchObject({
      title: "Work is waiting to sync",
      message: "Some of your work hasn't uploaded yet.",
      action: { label: "Review" },
    });
    act(() => shownToast()?.action?.onClick());
    expect(useUIStore.getState()).toMatchObject({
      isWorkDashboardOpen: true,
      workDashboardInitialTab: "pending",
    });
  });

  it("names the other garden its uploads wait in, and opens the switcher there without switching", async () => {
    setActive(
      "ready",
      [
        [TAS, ["steward"]],
        [VIDA, ["gardener"]],
      ],
      TAS.id
    );
    state.arrival = {
      kind: "queue",
      orientation: { target: "switcher", gardenId: VIDA.id, gardenName: VIDA.name },
    };

    renderHome();
    passArrivalDelay();

    expect(shownToast()).toMatchObject({
      title: "Work is waiting to sync",
      message: "Some of your work in Vida Verde hasn't uploaded yet.",
      action: { label: "See Your Gardens" },
    });
    act(() => shownToast()?.action?.onClick());
    expect(await screen.findByRole("dialog", { name: "Your Gardens" })).toBeInTheDocument();
    expect(selectGarden).not.toHaveBeenCalled();
    expect(useUIStore.getState().gardenSwitcherRequested).toBe(false);
  });

  it("stays quiet on Home once the session has arrived on another screen", () => {
    markArrivalPassed(ACCOUNT);

    renderHome();
    passArrivalDelay();

    expect(toastService.info).not.toHaveBeenCalled();
  });

  it("drops a pending arrival toast when Home opens a child screen before it shows", () => {
    setActive("none");
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Explore Gardens" }));
    passArrivalDelay();

    expect(toastService.info).not.toHaveBeenCalled();
  });
});

describe("the switcher a toast asked for", () => {
  it("opens once Home shows, and not over a garden page Home holds open", async () => {
    setActive(
      "ready",
      [
        [TAS, ["steward"]],
        [VIDA, ["gardener"]],
      ],
      TAS.id
    );
    act(() => useUIStore.getState().requestGardenSwitcher());

    const visit = renderHome(`/home/${VIDA.id}`);
    expect(screen.queryByRole("dialog", { name: "Your Gardens" })).not.toBeInTheDocument();
    expect(useUIStore.getState().gardenSwitcherRequested).toBe(true);
    visit.unmount();

    renderHome();
    expect(await screen.findByRole("dialog", { name: "Your Gardens" })).toBeInTheDocument();
    expect(useUIStore.getState().gardenSwitcherRequested).toBe(false);
    expect(selectGarden).not.toHaveBeenCalled();
  });
});
