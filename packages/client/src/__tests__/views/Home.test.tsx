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
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACCOUNT = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER_ACCOUNT = "0xabcdef1234567890abcdef1234567890abcdef12";

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
  account: "",
  listed: [] as unknown[],
  awaiting: new Set<string>(),
  arrival: { kind: "none" } as ArrivalState,
  rootGarden: "",
  /** Every render of the bell's launcher: which account and garden it read, and whether open. */
  launcherRenders: [] as Array<{ account: string; gardenId: string; open: boolean }>,
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
  usePrimaryAddress: () => state.account,
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
vi.mock("../../views/Home/Notifications/Icon", () => ({
  NotificationsIcon: ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) =>
    createElement("button", { type: "button", onClick, disabled }, "Notifications"),
}));
vi.mock("../../views/Home/Notifications/Launcher", () => ({
  NotificationsLauncher: ({
    gardenId,
    open,
    onOpen,
  }: {
    gardenId: string;
    open: boolean;
    onOpen: () => void;
  }) => {
    state.launcherRenders.push({ account: state.account, gardenId, open });
    return createElement(
      "div",
      { "data-testid": "notifications-launcher" },
      createElement("button", { type: "button", onClick: onOpen }, "Notifications"),
      open ? createElement("div", { "data-testid": "notifications-sheet" }) : null
    );
  },
}));
vi.mock("../../views/Home/CommitmentsSheet", () => ({ CommitmentsSheet: () => null }));
// The Promises launcher loads once Home is idle, reading the inbox through the query cache; a
// test that renders after its chunk resolved would draw the real one without a query client.
vi.mock("../../views/Home/CommitmentsSheet/Launcher", () => ({
  CommitmentsSheetLauncher: () => createElement("button", { type: "button" }, "Promises"),
}));
// The wallet sheet shows only what Home hands it: whether it's open and the tab it starts on.
vi.mock("../../views/Home/WalletSheet", () => ({
  WalletSheet: ({ isOpen, startTab }: { isOpen: boolean; startTab?: string }) =>
    createElement("output", {
      "data-testid": "wallet-sheet",
      "data-open": String(isOpen),
      "data-start": startTab ?? "",
    }),
}));
// The journal is the seam the journal steps fill; Home only mounts it. Its row opens a page under
// Home, as a Recent Activity or Take Part row does.
vi.mock("../../views/Home/Journal", async () => {
  const { useNavigate } = await import("react-router-dom");
  const { useContext } = await import("react");
  const { HomeShownContext } = await import("../../views/Home/Journal/homeShown");
  return {
    HomeJournal: ({ garden }: { garden: Garden }) => {
      const navigate = useNavigate();
      // Whether Home tells its sections that it shows: they close their own sheets when not.
      const shown = useContext(HomeShownContext);
      return createElement(
        "section",
        { "data-testid": "home-journal", "data-shown": String(shown) },
        garden.name,
        createElement(
          "button",
          { type: "button", onClick: () => navigate(`/home/${garden.id}`) },
          "Open Its Page"
        )
      );
    },
  };
});

import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import Home from "../../views/Home";
import { hasArrivalPassed, markArrivalPassed } from "../../views/Home/arrivalToast";

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
let locationSearch = "";
let locationState: unknown;
function LocationProbe() {
  const current = useLocation();
  location = current.pathname;
  locationSearch = current.search;
  locationState = current.state;
  return null;
}
/** A page under Home; its Back opens Home again, as a work page's `returnTo` does. */
function VisitedGarden() {
  const navigate = useNavigate();
  return createElement(
    "div",
    null,
    createElement("p", null, `Visiting ${useParams().id}`),
    createElement("button", { type: "button", onClick: () => navigate("/home") }, "Back")
  );
}

function homeTree(entry = "/home") {
  return createElement(
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
  );
}

/** Renders Home; `rerender` draws it again in place, as a change to a read it holds would. */
function renderHome(entry = "/home") {
  const view = render(homeTree(entry));
  return { ...view, rerender: (tree = homeTree(entry)) => view.rerender(tree) };
}

/** Lets a closing sheet finish its exit. */
const finishSheetMotion = () => act(() => vi.runAllTimers());
/** Lets the launchers Home defers to an idle moment load. */
const passIdle = () => act(() => vi.advanceTimersByTime(1_000));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  sessionStorage.clear();
  state.account = ACCOUNT;
  state.launcherRenders = [];
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
  it("starts with the active garden's chip in the title's place, then Wallet, Promises, Your Work and the bell", () => {
    renderHome();

    const chip = screen.getByRole("button", { name: /TAS HUB/ });
    expect(chip).toHaveAttribute("data-component", "GardenChip");
    const header = chip.closest("[data-component='HomeHeader']") as HTMLElement;
    expect(
      within(header)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["TAS HUB", "Wallet", "Promises", "Your Work", "Notifications"]);
    // Filters moved to Explore's top bar.
    expect(screen.queryByRole("button", { name: "Filters" })).not.toBeInTheDocument();
  });

  it("names Home in the chip's place when the member has no garden, and the bell has nothing to list", () => {
    setActive("none");
    renderHome();

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(document.querySelector("[data-component='GardenChip']")).toBeNull();
    // The other launchers keep their places: the bell stays, with no garden's events to show.
    expect(screen.getByRole("button", { name: "Notifications" })).toBeDisabled();
  });

  it("mounts the bell's read with a remembered garden while the account's gardens still load", async () => {
    setActive("loading", [], TAS.id);
    renderHome();
    passIdle();

    expect(await screen.findByTestId("notifications-launcher")).toBeInTheDocument();
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

  // A remembered garden does not hide a failed read behind "Loading garden..." (QA finding 2).
  it.each([
    ["with nothing remembered", null],
    ["with a remembered garden", TAS.id],
  ])("says a failed read lost nothing and tries again, %s", (_case, remembered) => {
    setActive("error", [], remembered);
    renderHome();

    expect(screen.queryByText("Loading garden...")).not.toBeInTheDocument();

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

  it("opens once as Choose a Garden, and dismissing it leaves a quiet prompt without a write", async () => {
    const view = renderHome();

    // The switcher's code loads with its first opening.
    const chooser = await screen.findByRole("dialog", { name: "Choose a Garden" });
    fireEvent.click(within(chooser).getByTestId("app-sheet-close"));
    finishSheetMotion();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose a Garden" })).toBeInTheDocument();
    // Nothing was pressed to open it, so focus lands where the member can open it again, not on
    // the page (QA finding 11).
    expect(screen.getByRole("button", { name: "See Your Gardens" })).toHaveFocus();
    expect(selectGarden).not.toHaveBeenCalled();

    // Coming back to Home this session does not ask again.
    view.unmount();
    renderHome();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("writes only the garden the member picks", async () => {
    renderHome();

    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Choose a Garden" })).getByRole("button", {
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

  // The switcher's code loads with its first opening.
  const openSwitcher = () => {
    fireEvent.click(screen.getByRole("button", { name: /TAS HUB/ }));
    return screen.findByRole("dialog", { name: "Your Gardens" });
  };

  it("lists the member's gardens with their place and role, the active one marked, and Explore last", async () => {
    renderHome();
    const switcher = await openSwitcher();

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

  it("opens with one garden too", async () => {
    setActive("ready", [[TAS, ["gardener"]]], TAS.id);
    renderHome();

    expect(await openSwitcher()).toBeInTheDocument();
  });

  it("switches on a pick and stays on Home", async () => {
    renderHome();
    fireEvent.click(
      within(await openSwitcher()).getByRole("button", { name: /Aiyeloja Family Garden/ })
    );

    expect(selectGarden).toHaveBeenCalledExactlyOnceWith(AIYELOJA.id);
    expect(location).toBe("/home");
  });

  it("visits a garden awaiting review without switching to it", async () => {
    renderHome();
    fireEvent.click(within(await openSwitcher()).getByRole("button", { name: /Vida Verde/ }));

    expect(location).toBe(`/home/${VIDA.id}`);
    // Home names itself as where the visit came from, so the garden's Back steps back here.
    expect(locationState).toEqual({ returnTo: "/home" });
    expect(selectGarden).not.toHaveBeenCalled();
  });

  it("opens Explore from its last row", async () => {
    renderHome();
    fireEvent.click(within(await openSwitcher()).getByRole("button", { name: /Explore Gardens/ }));

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

  // The journal's own sheets open from their own state, never from the Endowment flag a garden
  // page reads (HomeJournal.test), so it can stay mounted, out of sight, and keep its place.
  it("keeps the journal mounted, out of sight, while a page under Home shows", () => {
    renderHome(`/home/${AIYELOJA.id}`);

    expect(screen.getByText(`Visiting ${AIYELOJA.id}`)).toBeInTheDocument();
    expect(screen.getByTestId("home-journal")).not.toBeVisible();
  });

  // The open promises are held in the store, which outlives Home's visit to the page.
  it("closes the journal's open promises while a page under Home shows, so they stay closed on return", () => {
    act(() => useUIStore.getState().openTakePartSheet());
    renderHome(`/home/${AIYELOJA.id}`);

    expect(useUIStore.getState().takePartSheet).toBeNull();
  });

  // QA finding 3: Back from a page Home opened came back at the top with focus on the page.
  it("comes back from a page it opened where it was, with focus on the row that opened it", async () => {
    const offsets = new WeakMap<Element, number>();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    Object.defineProperty(Element.prototype, "scrollTop", {
      configurable: true,
      get() {
        return offsets.get(this) ?? 0;
      },
      set(value: number) {
        offsets.set(this, value);
      },
    });
    const scroller = document.body.appendChild(document.createElement("div"));
    scroller.id = "app-scroll";
    try {
      render(homeTree(), { container: scroller });
      scroller.scrollTop = 567;
      fireEvent.scroll(scroller);

      fireEvent.click(screen.getByRole("button", { name: "Open Its Page" }));
      expect(screen.getByText(`Visiting ${TAS.id}`)).toBeInTheDocument();
      // The shell scrolls every new route to the top, and the member scrolls the page.
      scroller.scrollTop = 0;
      fireEvent.scroll(scroller);
      scroller.scrollTop = 300;
      fireEvent.scroll(scroller);

      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      // Home shows again before the shell resets the scroller, so that reset's scroll event
      // arrives while Home shows; it must not replace the place (Codex P1 on #1333).
      scroller.scrollTop = 0;
      fireEvent.scroll(scroller);
      await waitFor(() => expect(scroller.scrollTop).toBe(567));
      expect(screen.getByRole("button", { name: "Open Its Page" })).toHaveFocus();
    } finally {
      scroller.remove();
      if (original) Object.defineProperty(Element.prototype, "scrollTop", original);
      else Reflect.deleteProperty(Element.prototype, "scrollTop");
    }
  });

  // A failed upload's toast floats over any sheet, and its Review opens Your Work over Home: the
  // sheet under it closes, as when Home opens a page (Codex on #1339).
  it("closes its other sheets as Your Work opens over Home, and tells the journal it is covered", async () => {
    renderHome();
    passIdle();
    const launcher = await screen.findByTestId("notifications-launcher");
    fireEvent.click(within(launcher).getByRole("button", { name: "Notifications" }));
    act(() => {
      useUIStore.getState().openWalletSheet();
      useUIStore.getState().openTakePartSheet();
    });
    expect(screen.getByTestId("notifications-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("home-journal")).toHaveAttribute("data-shown", "true");

    act(() => useUIStore.getState().openWorkDashboard("pending", "all"));

    expect(screen.queryByTestId("notifications-sheet")).not.toBeInTheDocument();
    expect(useUIStore.getState()).toMatchObject({ isWalletSheetOpen: false, takePartSheet: null });
    expect(screen.getByTestId("home-journal")).toHaveAttribute("data-shown", "false");

    act(() => useUIStore.getState().closeWorkDashboard());
    expect(screen.getByTestId("home-journal")).toHaveAttribute("data-shown", "true");
  });

  // The header stays mounted under a child screen, so a sheet it opened would stay drawn over
  // that screen; Home closes the bell's sheet with its other drawers.
  it("closes the bell's sheet when Home opens a child screen", async () => {
    renderHome();
    passIdle();
    const launcher = await screen.findByTestId("notifications-launcher");

    fireEvent.click(within(launcher).getByRole("button", { name: "Notifications" }));
    expect(screen.getByTestId("notifications-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /TAS HUB/ }));
    fireEvent.click(screen.getByRole("button", { name: /Explore Gardens/ }));
    finishSheetMotion();

    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.queryByTestId("notifications-sheet")).not.toBeInTheDocument();
  });

  // Its sheet marks the events it shows as seen, so a sheet that opened for another account or
  // garden would clear that scope's badge without anyone opening its bell.
  it.each([
    [
      "garden",
      () =>
        setActive(
          "ready",
          [
            [TAS, ["steward"]],
            [AIYELOJA, ["gardener"]],
          ],
          AIYELOJA.id
        ),
      () =>
        setActive(
          "ready",
          [
            [TAS, ["steward"]],
            [AIYELOJA, ["gardener"]],
          ],
          TAS.id
        ),
    ],
    [
      "account",
      () => {
        state.account = OTHER_ACCOUNT;
      },
      () => {
        state.account = ACCOUNT;
      },
    ],
  ])("never opens the bell's sheet for a changed %s, nor again when it changes back", async (_scope, change, changeBack) => {
    setActive(
      "ready",
      [
        [TAS, ["steward"]],
        [AIYELOJA, ["gardener"]],
      ],
      TAS.id
    );
    const view = renderHome();
    passIdle();
    const launcher = await screen.findByTestId("notifications-launcher");
    fireEvent.click(within(launcher).getByRole("button", { name: "Notifications" }));
    expect(screen.getByTestId("notifications-sheet")).toBeInTheDocument();

    state.launcherRenders = [];
    change();
    view.rerender(homeTree());
    finishSheetMotion();

    expect(state.launcherRenders.length).toBeGreaterThan(0);
    expect(state.launcherRenders.filter(({ open }) => open)).toEqual([]);
    expect(screen.queryByTestId("notifications-sheet")).not.toBeInTheDocument();

    changeBack();
    view.rerender(homeTree());

    expect(screen.queryByTestId("notifications-sheet")).not.toBeInTheDocument();
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

  it("names where the uploads wait as the toast shows, after a garden switch during its delay", () => {
    const mine: Array<[Garden, Role[]]> = [
      [TAS, ["steward"]],
      [VIDA, ["gardener"]],
    ];
    setActive("ready", mine, TAS.id);
    const home = renderHome();

    // The member switches to Vida Verde first, so the uploads wait in another garden now.
    setActive("ready", mine, VIDA.id);
    state.arrival = {
      kind: "queue",
      orientation: { target: "switcher", gardenId: TAS.id, gardenName: TAS.name },
    };
    home.rerender();
    passArrivalDelay();

    expect(toastService.info).toHaveBeenCalledOnce();
    expect(shownToast()).toMatchObject({
      message: "Some of your work in TAS HUB hasn't uploaded yet.",
      action: { label: "See Your Gardens" },
    });
  });

  it("waits while the queue is unread, and lets an arrival with nothing waiting pass", () => {
    state.arrival = { kind: "pending" };
    const home = renderHome();
    passArrivalDelay();
    expect(hasArrivalPassed(ACCOUNT)).toBe(false);

    state.arrival = { kind: "none" };
    home.rerender();
    expect(hasArrivalPassed(ACCOUNT)).toBe(true);

    // Work queued later in the session raises no arrival toast.
    state.arrival = { kind: "queue", orientation: { target: "yourWork" } };
    home.rerender();
    passArrivalDelay();
    expect(toastService.info).not.toHaveBeenCalled();
  });

  it("announces unplaced uploads once without sending the member to an unverified garden", () => {
    state.arrival = { kind: "queue", orientation: null };
    const home = renderHome();
    passArrivalDelay();

    expect(shownToast()).toMatchObject({
      title: "Work is waiting to sync",
      message: "Some of your work hasn't uploaded yet.",
    });
    expect(shownToast()?.action).toBeUndefined();
    expect(hasArrivalPassed(ACCOUNT)).toBe(true);
    home.rerender();
    passArrivalDelay();
    expect(toastService.info).toHaveBeenCalledOnce();
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

describe("a link to the wallet's Vouchers tab", () => {
  it("opens the wallet on Vouchers and drops the link's ask from the address", async () => {
    renderHome("/home?wallet=vouchers");
    const sheet = await screen.findByTestId("wallet-sheet");
    expect(sheet).toHaveAttribute("data-open", "true");
    expect(sheet).toHaveAttribute("data-start", "vouchers");
    expect(useUIStore.getState().isWalletSheetOpen).toBe(true);
    expect(location).toBe("/home");
    expect(locationSearch).toBe("");
  });

  it("opens the wallet where it was left otherwise, once the linked one closes", async () => {
    renderHome("/home?wallet=vouchers");
    await screen.findByTestId("wallet-sheet");
    act(() => useUIStore.getState().closeWalletSheet());
    act(() => useUIStore.getState().openWalletSheet());
    expect(await screen.findByTestId("wallet-sheet")).toHaveAttribute("data-start", "");
  });
});
