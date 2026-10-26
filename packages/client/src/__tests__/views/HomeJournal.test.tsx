/**
 * Home journal tests: the Highlights carousel, Recent Activity and Take Part in the active
 * garden (DL-127, decisions 23, 27 and 32). The Shared journal reads are mocked; what each
 * section draws from a read, and where each card, row and link goes, runs for real.
 *
 * @vitest-environment happy-dom
 */

import type { CommitmentReadModel } from "@green-goods/shared/commitment-pooling";
import type {
  GardenOpenCycles,
  GardenOpenPromises,
  GardenRecentActivity,
  JournalCycle,
  TakePartEntry,
} from "@green-goods/shared/hooks/garden/useGardenJournal";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address, Garden, Work } from "@green-goods/shared/types/domain";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0x5000000000000000000000000000000000000001";
const NEIGHBOUR = "0xb0b0000000000000000000000000000000000002" as Address;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  recent: vi.fn(),
  cycles: vi.fn(),
  promises: vi.fn(),
  cycleNames: vi.fn(),
  shareLink: vi.fn(),
  // The edges of the About section's access predicate (`useGardenAccess`): who is signed in,
  // the garden's vaults, the account's deposits, and the chain's answer on the evaluator role.
  account: null as string | null,
  vaults: [] as unknown[],
  deposits: [] as Array<{ shares: bigint }>,
  evaluatorOnChain: false,
}));

vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => mocks.navigate,
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenJournal", () => ({
  useGardenRecentActivity: (gardenId: string) => mocks.recent(gardenId),
  useGardenOpenCycles: (gardenId: string, options?: { shown?: boolean }) =>
    mocks.cycles(gardenId, options),
  useGardenOpenPromises: (gardenId: string) => mocks.promises(gardenId),
}));

// The details sheet names its cycle itself, from the cycle's metadata.
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentCycleNames: () => mocks.cycleNames(),
}));

// Needs Your Attention (step 19) and Continue (step 8), each with its own tests, stand in as
// markers here.
vi.mock("@green-goods/shared/hooks/garden/useStewardDuties", () => ({
  useStewardDuties: () => ({ duties: [], isLoading: false, isError: false, refetch: () => {} }),
}));
vi.mock("../../views/Home/Journal/NeedsYourAttention", () => ({
  NeedsYourAttention: () => <section data-component="HomeNeedsYourAttention" />,
}));
vi.mock("../../views/Home/Journal/Continue", () => ({
  Continue: () => <section data-component="Continue" />,
}));

// The section sheets over Home wrap the garden page's own section component, which has its own
// tests; a marker stands in for it, naming the section it was handed and whether the reader
// manages join requests. The Endowment and governance sheets are the garden page's too.
vi.mock("../../views/Home/Garden/GardenSection", () => ({
  GardenSection: ({ tab, canManageRequests }: { tab: string; canManageRequests: boolean }) => (
    <div data-testid="garden-section" data-tab={tab} data-requests={String(canManageRequests)} />
  ),
}));
vi.mock("@/components/Sheets", () => ({
  EndowmentSheet: ({ isOpen, gardenAddress }: { isOpen: boolean; gardenAddress: string }) =>
    isOpen ? <div data-testid="endowment-sheet">{gardenAddress}</div> : null,
  ConvictionSheet: () => null,
}));
vi.mock("@green-goods/shared/utils/app/clipboard", () => ({
  shareLink: (...args: unknown[]) => mocks.shareLink(...args),
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mocks.account }),
}));
vi.mock("@green-goods/shared/hooks/vault/useGardenVaults", () => ({
  useGardenVaults: () => ({ vaults: mocks.vaults }),
}));
vi.mock("@green-goods/shared/hooks/vault/useVaultDeposits", () => ({
  useVaultDeposits: () => ({ deposits: mocks.deposits }),
}));
vi.mock("@green-goods/shared/hooks/roles/useHasRole", () => ({
  useHasRole: () => ({ hasRole: mocks.evaluatorOnChain }),
}));
vi.mock("@green-goods/shared/hooks/conviction/useConvictionStrategies", () => ({
  useConvictionStrategies: () => ({ strategies: [] }),
}));
// The Work sheet reads the garden's work as the Work tab does; the marker above draws it.
vi.mock("@green-goods/shared/hooks/work/useWorks", () => ({
  useWorks: () => ({
    works: [],
    isFetching: false,
    isLoading: false,
    isError: false,
    isPaused: false,
    availability: "empty",
    refetch: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

const { HighlightsCarousel } = await import("../../views/Home/Journal/HighlightsCarousel");
const { RecentActivity } = await import("../../views/Home/Journal/RecentActivity");
const { TakePart } = await import("../../views/Home/Journal/TakePart");
const { HomeJournal } = await import("../../views/Home/Journal");
const { TakePartSheet } = await import("../../views/Home/Journal/TakePartSheet");
const { HomeShownContext } = await import("../../views/Home/Journal/homeShown");

const render = (ui: ReactElement) => renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
/** The journal as Home holds it: shown, or out of sight under a page Home opened. */
const asHomeHolds = (ui: ReactElement, shown: boolean) => (
  <MemoryRouter>
    <HomeShownContext value={shown}>{ui}</HomeShownContext>
  </MemoryRouter>
);

function work(id: string, status: Work["status"], title: string, media: string[] = []): Work {
  return {
    id,
    title,
    actionUID: 1,
    gardenerAddress: NEIGHBOUR,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "bafy-work",
    media,
    createdAt: 1_790_000_000,
    status,
  };
}

const PENDING = work("0xwork3", "pending", "Compost turn", ["https://example.test/compost.jpg"]);
const APPROVED = work("0xwork2", "approved", "Seed library sort");
const REJECTED = work("0xwork1", "rejected", "Fence repair");

function recent(overrides: Partial<GardenRecentActivity> = {}): GardenRecentActivity {
  return {
    state: { status: "ready", items: [PENDING, APPROVED, REJECTED], savedAt: null },
    featured: PENDING,
    actionTitleOf: () => undefined,
    refetch: vi.fn(),
    ...overrides,
  };
}

function journalCycle(
  id: string,
  cycleType: "SEASON" | "CAMPAIGN",
  name: string,
  daysLeft: number | null
): JournalCycle {
  return {
    name,
    daysLeft,
    cycle: {
      id,
      chainId: 42161,
      cycleId: BigInt(id.length),
      seedSeen: true,
      poolId: 7n,
      poolEntityId: "42161-7",
      garden: GARDEN as Address,
      gardenId: GARDEN,
      cycleType,
      state: "OPEN",
      startTime: null,
      endTime: null,
      metadataCID: null,
      gardenersBps: 0,
      treasuryBps: 0,
      operatorBps: 0,
      evaluatorBps: 0,
      communityBps: 0,
      funderBps: 0,
      equalParticipationBps: 0,
      verifiedContributionBps: 0,
      liveCommitmentCount: 5n,
      commitmentsAccepted: 4n,
      commitmentsReadyForConfirmation: 0n,
      commitmentsFulfilled: 3n,
      commitmentsCancelled: 0n,
      commitmentsExpired: 0n,
      commitmentsDisputed: 0n,
      commitmentsDue: 7n,
      openCommitmentCount: 2n,
      createdAt: null,
      updatedAt: 1_790_000_000,
    },
  };
}

const SEASON = journalCycle("c-season", "SEASON", "Autumn Planting 2026", 36);
const CAMPAIGN = journalCycle("c-camp", "CAMPAIGN", "Seed Swap Weekend", null);

function cycles(overrides: Partial<GardenOpenCycles> = {}): GardenOpenCycles {
  return {
    state: { status: "ready", items: [SEASON, CAMPAIGN], savedAt: null },
    ...overrides,
  };
}

function promise(id: number, overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: `42161-${id}`,
    chainId: 42161,
    commitmentId: BigInt(id),
    creationSeen: true,
    onchainState: "OFFERED",
    derivedState: "OFFERED",
    state: "OFFERED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 2n,
    unitLabel: "hours",
    poolId: 7n,
    creator: NEIGHBOUR,
    leadProvider: NEIGHBOUR,
    counterparty: null,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    metadataCID: `cid-${id}`,
    ...overrides,
  };
}

const single = (commitment: CommitmentReadModel): TakePartEntry => ({
  kind: "single",
  row: { commitment, seat: "bystander", needsYou: false },
  copy: commitment,
});

const OFFER = single(promise(21));
const ASK = single(
  promise(20, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" })
);
const TITLES: Record<string, string> = {
  "cid-21": "Teach the composting basics workshop",
  "cid-20": "Two hours sorting the seed library",
  "cid-19": "Water the new beds",
  "cid-18": "Mulch the orchard rows",
};

/** An ask open to take up, with its own title by metadata CID. */
const openAsk = (id: number, overrides: Partial<CommitmentReadModel> = {}) =>
  single(
    promise(id, {
      direction: "REQUEST",
      onchainState: "REQUESTED",
      derivedState: "REQUESTED",
      ...overrides,
    })
  );

function promises(overrides: Partial<GardenOpenPromises> = {}): GardenOpenPromises {
  return {
    state: { status: "ready", items: [OFFER, ASK], savedAt: null },
    all: { status: "ready", items: [OFFER, ASK], savedAt: null },
    ask: ASK,
    titleOf: (cid) => (cid ? (TITLES[cid] ?? null) : null),
    refetch: vi.fn(),
    ...overrides,
  };
}

/** What held focus as the open promises' sheet opened: the opener it hands focus back to. */
function recordPromisesOpener() {
  const recorded: { opener: Element | null } = { opener: null };
  const stop = useUIStore.subscribe((state, previous) => {
    if (state.takePartSheet && !previous.takePartSheet) {
      recorded.opener = document.activeElement;
    }
  });
  return { recorded, stop };
}

const GARDEN_RECORD = { id: GARDEN, name: "Riverside Commons Garden" };

/** The rows a sheet lists, by their titles. */
const sheetRows = (sheet: HTMLElement) =>
  within(sheet)
    .getAllByRole("button")
    .filter((button) => button.getAttribute("data-component") === "CommitmentRow")
    .map((row) => Object.values(TITLES).find((title) => row.textContent?.includes(title)));

describe("Home journal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({
      isCommitmentsSheetOpen: false,
      commitmentsSheetOpening: undefined,
      takePartSheet: null,
      gardenSheet: null,
      isEndowmentSheetOpen: false,
    });
    mocks.account = null;
    mocks.vaults = [];
    mocks.deposits = [];
    mocks.evaluatorOnChain = false;
    mocks.shareLink.mockResolvedValue(undefined);
    mocks.recent.mockReturnValue(recent());
    mocks.cycles.mockReturnValue(cycles());
    mocks.promises.mockReturnValue(promises());
    mocks.cycleNames.mockReturnValue({ byCycleId: new Map(), isLoading: false });
  });

  describe("Recent Activity", () => {
    it("lists the garden's three newest works with their own status, the same for every role", () => {
      render(<RecentActivity gardenId={GARDEN} />);

      expect(screen.getByRole("heading", { level: 2, name: "Recent Activity" })).toBeVisible();
      const rows = screen.getAllByRole("button", {
        name: /Compost turn|Seed library|Fence repair/,
      });
      expect(rows.map((row) => within(row).getByRole("status").textContent)).toEqual([
        "Pending",
        "Approved",
        "Rejected",
      ]);
      // A steward approves inside the work's page; the row carries no Review control.
      expect(screen.queryByRole("button", { name: /review/i })).toBeNull();
      expect(mocks.recent).toHaveBeenCalledWith(GARDEN);
    });

    it("opens a pending work's page, coming back to Home, and See All opens the Work sheet over Home", async () => {
      const user = userEvent.setup();
      render(<RecentActivity gardenId={GARDEN} />);

      await user.click(screen.getByRole("button", { name: /Compost turn/ }));
      expect(mocks.navigate).toHaveBeenCalledWith(
        `/home/${GARDEN}/work/${PENDING.id}`,
        expect.objectContaining({ state: { from: "home", returnTo: "/home" } })
      );

      // The garden's Work opens as a sheet over Home (DL-128), so Home keeps its place.
      await user.click(screen.getByRole("button", { name: "See All" }));
      expect(useUIStore.getState().gardenSheet).toBe("work");
      expect(mocks.navigate).toHaveBeenCalledTimes(1);
    });

    it("takes focus as See All is pressed, before the Work sheet opens, so the sheet hands it back", () => {
      render(<RecentActivity gardenId={GARDEN} />);
      const seeAll = screen.getByRole("button", { name: "See All" });
      let focusedAtOpen: Element | null = null;
      const stop = useUIStore.subscribe((state, previous) => {
        if (state.gardenSheet && !previous.gardenSheet) focusedAtOpen = document.activeElement;
      });

      // A tap presses and clicks a button, and in Safari it focuses nothing.
      fireEvent.pointerDown(seeAll);
      fireEvent.click(seeAll);
      stop();

      expect(focusedAtOpen).toBe(seeAll);
    });

    it("keeps its place while loading, and tells a failure, a wait and an empty garden apart", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mocks.recent.mockReturnValue(recent({ state: { status: "loading" } }));
      const { rerender } = render(<RecentActivity gardenId={GARDEN} />);
      expect(screen.getByRole("status")).toHaveTextContent("Gathering recent activity…");
      expect(screen.getByRole("heading", { name: "Recent Activity" })).toBeVisible();

      mocks.recent.mockReturnValue(recent({ state: { status: "error" }, refetch }));
      rerender(
        <MemoryRouter>
          <RecentActivity gardenId={GARDEN} />
        </MemoryRouter>
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the work");
      await user.click(screen.getByRole("button", { name: "Try Again" }));
      expect(refetch).toHaveBeenCalled();

      mocks.recent.mockReturnValue(recent({ state: { status: "offline" } }));
      rerender(
        <MemoryRouter>
          <RecentActivity gardenId={GARDEN} />
        </MemoryRouter>
      );
      expect(screen.getByText("Not saved on this phone yet")).toBeVisible();
      expect(screen.queryByRole("alert")).toBeNull();

      mocks.recent.mockReturnValue(recent({ state: { status: "empty" } }));
      rerender(
        <MemoryRouter>
          <RecentActivity gardenId={GARDEN} />
        </MemoryRouter>
      );
      expect(screen.getByText("No work yet")).toBeVisible();
    });

    it("says when an offline copy was saved", () => {
      mocks.recent.mockReturnValue(
        recent({ state: { status: "ready", items: [APPROVED], savedAt: Date.UTC(2026, 0, 2, 9) } })
      );
      render(<RecentActivity gardenId={GARDEN} />);

      expect(screen.getByText(/^Offline · Saved /)).toBeVisible();
      expect(screen.getAllByRole("button", { name: /Seed library/ })).toHaveLength(1);
    });
  });

  describe("Take Part", () => {
    it("lists the open promises as commitment rows that open each promise's page", async () => {
      const user = userEvent.setup();
      render(<TakePart gardenId={GARDEN} />);

      expect(screen.getByRole("heading", { level: 2, name: "Take Part" })).toBeVisible();
      const ask = screen.getByRole("button", { name: /Two hours sorting the seed library/ });
      expect(ask).toHaveAttribute("data-component", "CommitmentRow");
      expect(within(ask).getByRole("img", { name: "Request" })).toBeInTheDocument();
      expect(ask).toHaveTextContent("Asked for");

      await user.click(ask);
      expect(mocks.navigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/20`);
    });

    it("opens every promise the reader could take up from See All, not the reader's own", async () => {
      const user = userEvent.setup();
      // Take Part previews the first entries; the sheet lists the whole read.
      mocks.promises.mockReturnValue(
        promises({ all: { status: "ready", items: [OFFER, ASK, openAsk(19)], savedAt: null } })
      );
      render(
        <>
          <TakePart gardenId={GARDEN} />
          <TakePartSheet garden={GARDEN_RECORD} />
        </>
      );

      await user.click(screen.getByRole("button", { name: "See All" }));
      const sheet = await screen.findByRole("dialog");
      expect(within(sheet).getByText("In Riverside Commons Garden")).toBeVisible();
      expect(sheetRows(sheet)).toEqual([
        "Teach the composting basics workshop",
        "Two hours sorting the seed library",
        "Water the new beds",
      ]);
      expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);

      // A row opens its promise's page and puts the sheet away.
      await user.click(within(sheet).getByRole("button", { name: /Water the new beds/ }));
      expect(mocks.navigate).toHaveBeenCalledWith(`/home/${GARDEN}/commitments/19`);
      expect(useUIStore.getState().takePartSheet).toBeNull();
    });

    it("closes the open promises when the journal turns to another garden or goes away", () => {
      const membership = { roles: ["gardener" as const], pendingJoin: false };
      const journal = (id: string) => (
        <MemoryRouter>
          <HomeJournal garden={{ ...GARDEN_RECORD, id } as Garden} membership={membership} />
        </MemoryRouter>
      );
      const { rerender, unmount } = renderWithProviders(journal(GARDEN));

      act(() => useUIStore.getState().openTakePartSheet());
      rerender(journal("0x5000000000000000000000000000000000000002"));
      expect(useUIStore.getState().takePartSheet).toBeNull();

      act(() => useUIStore.getState().openTakePartSheet());
      unmount();
      expect(useUIStore.getState().takePartSheet).toBeNull();
    });

    it("opens the sheet at a season's promises from Show Its Promises, which its rail widens", async () => {
      const user = userEvent.setup();
      const inSeason = openAsk(18, { cycleId: SEASON.cycle.cycleId });
      mocks.promises.mockReturnValue(
        promises({ all: { status: "ready", items: [OFFER, inSeason], savedAt: null } })
      );
      // The rail names each cycle from its metadata, as the Promises sheet's does.
      mocks.cycleNames.mockReturnValue({
        byCycleId: new Map([
          [SEASON.cycle.cycleId.toString(), { status: "resolved", name: "Autumn Planting 2026" }],
          [CAMPAIGN.cycle.cycleId.toString(), { status: "resolved", name: "Seed Swap Weekend" }],
        ]),
        isLoading: false,
      });
      useUIStore.setState({ takePartSheet: { cycleId: SEASON.cycle.cycleId.toString() } });
      render(<TakePartSheet garden={GARDEN_RECORD} />);

      const sheet = await screen.findByRole("dialog");
      expect(sheetRows(sheet)).toEqual(["Mulch the orchard rows"]);
      const season = within(sheet).getByRole("button", { name: /Autumn Planting 2026/ });
      expect(season).toHaveAttribute("aria-pressed", "true");

      // Nothing in the campaign is open to take up, and the sheet says so for the campaign.
      await user.click(within(sheet).getByRole("button", { name: /Seed Swap Weekend/ }));
      expect(within(sheet).getByText("Nothing open in this campaign")).toBeVisible();

      // Tapping the chosen cycle again lists them all.
      await user.click(within(sheet).getByRole("button", { name: /Seed Swap Weekend/ }));
      expect(sheetRows(sheet)).toEqual([
        "Teach the composting basics workshop",
        "Mulch the orchard rows",
      ]);
    });

    // A cycle that closed on a refetch between the details and the sheet is no longer on the
    // rail; Show Its Promises must not widen to the garden's whole list (Codex on #1331).
    // A cycle can close on a refetch between its details and the sheet, or after it is chosen
    // on the rail; Show Its Promises must not widen to the garden's list then (Codex on #1331),
    // and the list must keep a way back to all of them (Codex on #1339) and its campaign's name
    // (CodeRabbit on #1339).
    it("keeps a cycle the rail no longer lists as the filter, named, with See All to widen it", async () => {
      const user = userEvent.setup();
      const inClosed = openAsk(19, { cycleId: 99n });
      mocks.promises.mockReturnValue(
        promises({ all: { status: "ready", items: [OFFER, inClosed], savedAt: null } })
      );
      mocks.cycleNames.mockReturnValue({
        byCycleId: new Map([
          [CAMPAIGN.cycle.cycleId.toString(), { status: "resolved", name: "Seed Swap Weekend" }],
        ]),
        isLoading: false,
      });
      useUIStore.setState({ takePartSheet: { cycleId: "99", cycleType: "CAMPAIGN" } });
      const { rerender } = render(<TakePartSheet garden={GARDEN_RECORD} />);
      const again = () =>
        rerender(
          <MemoryRouter>
            <TakePartSheet garden={GARDEN_RECORD} />
          </MemoryRouter>
        );

      // The cycle's own rows, with no card chosen on the rail: See All is the way back.
      const sheet = await screen.findByRole("dialog");
      expect(sheetRows(sheet)).toEqual(["Water the new beds"]);
      expect(within(sheet).queryByRole("button", { pressed: true })).toBeNull();
      await user.click(within(sheet).getByRole("button", { name: "See All" }));
      expect(sheetRows(sheet)).toEqual([
        "Teach the composting basics workshop",
        "Water the new beds",
      ]);

      // A campaign chosen on the rail, with nothing open in it, then dropped by a refetch: the
      // row still names a campaign, and See All stands in for the card that is gone.
      await user.click(within(sheet).getByRole("button", { name: /Seed Swap Weekend/ }));
      expect(within(sheet).getByText("Tap it again to see them all")).toBeVisible();
      mocks.cycles.mockReturnValue(
        cycles({ state: { status: "ready", items: [SEASON], savedAt: null } })
      );
      again();
      expect(within(sheet).getByText("Nothing open in this campaign")).toBeVisible();
      expect(within(sheet).queryByText("Tap it again to see them all")).toBeNull();
      await user.click(within(sheet).getByRole("button", { name: "See All" }));
      expect(sheetRows(sheet)).toEqual([
        "Teach the composting basics workshop",
        "Water the new beds",
      ]);
    });

    it("tells a chain without promises, a failure, a wait and nothing open apart", async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();
      mocks.promises.mockReturnValue(promises({ state: { status: "unavailable" } }));
      const { rerender } = render(<TakePart gardenId={GARDEN} />);
      expect(screen.getByText("Promises aren't available yet")).toBeVisible();

      mocks.promises.mockReturnValue(promises({ state: { status: "error" }, refetch }));
      rerender(
        <MemoryRouter>
          <TakePart gardenId={GARDEN} />
        </MemoryRouter>
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the list");
      await user.click(screen.getByRole("button", { name: "Try Again" }));
      expect(refetch).toHaveBeenCalled();

      mocks.promises.mockReturnValue(promises({ state: { status: "offline" } }));
      rerender(
        <MemoryRouter>
          <TakePart gardenId={GARDEN} />
        </MemoryRouter>
      );
      expect(screen.getByText("Not saved on this phone yet")).toBeVisible();

      mocks.promises.mockReturnValue(promises({ state: { status: "empty" } }));
      rerender(
        <MemoryRouter>
          <TakePart gardenId={GARDEN} />
        </MemoryRouter>
      );
      expect(screen.getByText("No open promises right now")).toBeVisible();
    });

    it("stands each open cycle as one line when Home has no carousel, opening its details", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<TakePart gardenId={GARDEN} />);
      expect(screen.queryByRole("button", { name: /Autumn Planting 2026/ })).toBeNull();
      unmount();

      render(<TakePart gardenId={GARDEN} withCycleLines />);
      expect(screen.getByRole("button", { name: /Seed Swap Weekend/ })).toBeInTheDocument();
      const line = screen.getByRole("button", { name: /Autumn Planting 2026/ });
      await user.click(line);
      const sheet = await screen.findByRole("dialog");
      const promises = recordPromisesOpener();
      await user.click(within(sheet).getByRole("button", { name: "Show Its Promises" }));
      await waitFor(() =>
        expect(useUIStore.getState().takePartSheet).toEqual({
          cycleId: SEASON.cycle.cycleId.toString(),
          cycleType: "SEASON",
        })
      );
      expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
      promises.stop();
      // The details close first and hand focus back to the line, so the open promises' sheet
      // returns focus there rather than to the details' own button, which unmounts.
      expect(promises.recorded.opener).toBe(line);
    });
  });

  describe("Highlights", () => {
    it("leads with the open season and campaigns, then the newest update, then an open ask", () => {
      render(<HighlightsCarousel gardenId={GARDEN} />);

      expect(screen.getByRole("heading", { level: 2, name: "Highlights" })).toBeVisible();
      const cards = within(screen.getByRole("list")).getAllByRole("button");
      expect(cards.map((card) => card.getAttribute("data-highlight"))).toEqual([
        "cycle",
        "cycle",
        "work",
        "ask",
      ]);
      expect(cards[0]).toHaveTextContent("Autumn Planting 2026");
      expect(cards[0]).toHaveTextContent("3 of 7 kept · 36 days left");
      // A cycle with no end date says what it has kept, and no count of days.
      expect(cards[1]).toHaveTextContent("Seed Swap Weekend");
      expect(cards[1]).not.toHaveTextContent("left");
      expect(within(cards[2]!).getByRole("status")).toHaveTextContent("Pending");
      expect(cards[3]).toHaveTextContent("Two hours sorting the seed library");
    });

    it("opens the work's page, the ask's page, and a cycle's details with its own promises", async () => {
      const user = userEvent.setup();
      render(<HighlightsCarousel gardenId={GARDEN} />);

      await user.click(screen.getByRole("button", { name: /Compost turn/ }));
      expect(mocks.navigate).toHaveBeenCalledWith(
        `/home/${GARDEN}/work/${PENDING.id}`,
        expect.objectContaining({ state: { from: "home", returnTo: "/home" } })
      );
      await user.click(screen.getByRole("button", { name: /Two hours sorting the seed library/ }));
      expect(mocks.navigate).toHaveBeenLastCalledWith(`/home/${GARDEN}/commitments/20`);

      const card = screen.getByRole("button", { name: /Autumn Planting 2026/ });
      await user.click(card);
      const sheet = await screen.findByRole("dialog");
      const promises = recordPromisesOpener();
      await user.click(within(sheet).getByRole("button", { name: "Show Its Promises" }));
      // The garden's open promises open at the season, not the reader's own, and once the
      // details have closed, so the sheet returns focus to the card.
      await waitFor(() =>
        expect(useUIStore.getState().takePartSheet).toEqual({
          cycleId: SEASON.cycle.cycleId.toString(),
          cycleType: "SEASON",
        })
      );
      expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
      promises.stop();
      expect(promises.recorded.opener).toBe(card);
    });

    it("keys each card by what it shows, so a season and an ask with one indexer id stay apart", () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      // A cycle's and a promise's indexer ids are both `${chainId}-${id}`: this season's matches
      // the ask's, `42161-20`.
      const season = journalCycle("42161-20", "SEASON", "Autumn Planting 2026", 36);
      mocks.cycles.mockReturnValue(
        cycles({ state: { status: "ready", items: [season], savedAt: null } })
      );

      render(<HighlightsCarousel gardenId={GARDEN} />);

      expect(within(screen.getByRole("list")).getAllByRole("button")).toHaveLength(3);
      expect(errors.mock.calls.flat().join(" ")).not.toContain("same key");
      errors.mockRestore();
    });

    it("shows and opens a grouped ask at the copy still open to take up", async () => {
      const user = userEvent.setup();
      const asked = { direction: "REQUEST", metadataCID: "cid-20" } as const;
      const kept = promise(23, { ...asked, onchainState: "FULFILLED", derivedState: "FULFILLED" });
      const open = promise(22, { ...asked, onchainState: "REQUESTED", derivedState: "REQUESTED" });
      const counts = { published: 2, available: 1, inProgress: 0, kept: 1, ended: 0, other: 0 };
      // The newer copy was kept, so the group's first child is not the one open to take up.
      const grouped: TakePartEntry = {
        kind: "group",
        group: {
          kind: "group",
          key: "set-1",
          displayGroupId: "set-1",
          children: [kept, open],
          counts,
        },
        copy: open,
      };
      mocks.promises.mockReturnValue(promises({ ask: grouped }));

      render(<HighlightsCarousel gardenId={GARDEN} />);
      const card = screen.getByRole("button", { name: /Two hours sorting the seed library/ });
      expect(card).toHaveTextContent("Asked for");
      await user.click(card);

      expect(mocks.navigate).toHaveBeenLastCalledWith(
        `/home/${GARDEN}/commitments/group/set-1?copy=22`
      );
    });

    it("is absent when it has no card", () => {
      mocks.cycles.mockReturnValue(cycles({ state: { status: "empty" } }));
      mocks.recent.mockReturnValue(recent({ featured: null }));
      mocks.promises.mockReturnValue(promises({ ask: null }));

      const { container } = render(<HighlightsCarousel gardenId={GARDEN} />);

      expect(container).toBeEmptyDOMElement();
    });

    it("waits until every read settles, then adds no card for one that failed", () => {
      // A card slid in ahead of the one in view would scroll the row, so they arrive together.
      mocks.cycles.mockReturnValue(cycles({ state: { status: "loading" } }));
      const { container, rerender } = render(<HighlightsCarousel gardenId={GARDEN} />);
      expect(container).toBeEmptyDOMElement();

      mocks.cycles.mockReturnValue(cycles({ state: { status: "error" } }));
      mocks.recent.mockReturnValue(recent());
      mocks.promises.mockReturnValue(promises());
      rerender(
        <MemoryRouter>
          <HighlightsCarousel gardenId={GARDEN} />
        </MemoryRouter>
      );
      const cards = within(screen.getByRole("list")).getAllByRole("button");
      expect(cards.map((card) => card.getAttribute("data-highlight"))).toEqual(["work", "ask"]);
    });
  });

  it("mounts the journal's sections in DL-127's order, closing with About This Garden", () => {
    const garden = { id: GARDEN, name: "Riverside Commons Garden" } as Garden;
    const { container } = render(
      <HomeJournal garden={garden} membership={{ roles: ["gardener"], pendingJoin: false }} />
    );

    const order = [...container.querySelectorAll("[data-component]")]
      .map((node) => node.getAttribute("data-component"))
      .filter((name) =>
        [
          "HomeNeedsYourAttention",
          "HighlightsCarousel",
          "RecentActivity",
          "Continue",
          "TakePart",
          "AboutGarden",
          "GardenPage",
        ].includes(name ?? "")
      );
    expect(order).toEqual([
      "HomeNeedsYourAttention",
      "HighlightsCarousel",
      "RecentActivity",
      "Continue",
      "TakePart",
      "AboutGarden",
    ]);
    // The interim garden page that stood in About's slot (steps 8 and 19) is gone.
    expect(screen.queryByTestId("home-garden-page")).toBeNull();
    for (const read of [mocks.recent, mocks.promises]) {
      expect(read).toHaveBeenCalledWith(GARDEN);
    }
    expect(mocks.cycles).toHaveBeenCalledWith(GARDEN, { shown: true });
  });

  describe("About This Garden", () => {
    const ME = "0xa11ce00000000000000000000000000000000001";
    const garden = (overrides: Partial<Garden> = {}) =>
      ({
        id: GARDEN,
        name: "Riverside Commons Garden",
        bannerImage: "https://example.test/riverside.jpg",
        description: "Food for the block.",
        gardeners: [NEIGHBOUR],
        stewards: [],
        owners: [],
        evaluators: [],
        ...overrides,
      }) as Garden;
    const renderAbout = (record: Garden, roles: Array<"gardener" | "steward" | "owner"> = []) =>
      render(<HomeJournal garden={record} membership={{ roles, pendingJoin: false }} />);
    const aboutRows = () =>
      within(screen.getByRole("heading", { name: "About This Garden" }).closest("section")!)
        .getAllByRole("button")
        .map((row) => row.querySelector(".gg-item-row-title")?.textContent);

    it("gives a gardener Insights, Gardeners and Share, and never Endowment", () => {
      mocks.account = NEIGHBOUR;
      mocks.vaults = [{}];
      renderAbout(garden(), ["gardener"]);

      expect(aboutRows()).toEqual(["Insights", "Gardeners", "Share Garden"]);
      expect(screen.getByText("1 member")).toBeInTheDocument();
    });

    it("opens Insights as a tall sheet named for the garden, with its banner, and hands focus back to the row", async () => {
      const user = userEvent.setup();
      mocks.account = NEIGHBOUR;
      renderAbout(garden(), ["gardener"]);

      const row = screen.getByRole("button", { name: /Insights/ });
      await user.click(row);
      const sheet = await screen.findByRole("dialog", { name: "Insights" });
      expect(sheet).toHaveAttribute("data-sheet-size", "tall");
      expect(sheet).toHaveAccessibleDescription("In Riverside Commons Garden");
      // The banner is decorative: the title names the garden's section, the chip the garden.
      expect(within(sheet).getByTestId("garden-sheet-banner").querySelector("img")).toHaveAttribute(
        "src",
        "https://example.test/riverside.jpg"
      );
      expect(within(sheet).getByTestId("garden-section")).toHaveAttribute("data-tab", "insights");

      await user.click(within(sheet).getByRole("button", { name: "Close" }));
      expect(useUIStore.getState().gardenSheet).toBeNull();
      expect(document.activeElement).toBe(row);
    });

    it("opens Insights without a banner for a garden that has none", async () => {
      const user = userEvent.setup();
      mocks.account = NEIGHBOUR;
      renderAbout(garden({ bannerImage: "" }), ["gardener"]);

      await user.click(screen.getByRole("button", { name: /Insights/ }));
      const sheet = await screen.findByRole("dialog", { name: "Insights" });
      expect(within(sheet).queryByTestId("garden-sheet-banner")).toBeNull();
      expect(within(sheet).getByTestId("garden-section")).toBeInTheDocument();
    });

    it("hands a steward the Gardeners sheet with the requests queue, and a gardener without it", async () => {
      const user = userEvent.setup();
      mocks.account = ME;
      const { unmount } = renderAbout(garden({ stewards: [ME] }), ["steward"]);

      await user.click(screen.getByRole("button", { name: /Gardeners/ }));
      let sheet = await screen.findByRole("dialog", { name: "Gardeners" });
      expect(within(sheet).getByTestId("garden-section")).toHaveAttribute("data-requests", "true");
      // Check Requests is the queue's own control; no count stands beside the row (every read
      // of the queue needs a signed proof, so no count exists).
      expect(screen.queryByText(/request/i)).toBeNull();
      unmount();
      useUIStore.getState().closeGardenSheet();

      mocks.account = NEIGHBOUR;
      renderAbout(garden(), ["gardener"]);
      await user.click(screen.getByRole("button", { name: /Gardeners/ }));
      sheet = await screen.findByRole("dialog", { name: "Gardeners" });
      expect(within(sheet).getByTestId("garden-section")).toHaveAttribute("data-requests", "false");
    });

    it("opens the garden's Work as a sheet from the store, so See All and a duty row land there", async () => {
      mocks.account = NEIGHBOUR;
      renderAbout(garden(), ["gardener"]);

      useUIStore.getState().openGardenSheet("work");
      const sheet = await screen.findByRole("dialog", { name: "Work" });
      expect(sheet).toHaveAccessibleDescription("In Riverside Commons Garden");
      expect(within(sheet).getByTestId("garden-section")).toHaveAttribute("data-tab", "work");
    });

    it("shows Endowment to a steward of a garden with a vault, and opens the Endowment sheet", async () => {
      const user = userEvent.setup();
      mocks.account = ME;
      mocks.vaults = [{}];
      renderAbout(garden({ stewards: [ME] }), ["steward"]);

      expect(aboutRows()).toEqual(["Insights", "Gardeners", "Share Garden", "Endowment"]);
      await user.click(screen.getByRole("button", { name: /Endowment/ }));
      expect(await screen.findByTestId("endowment-sheet")).toHaveTextContent(GARDEN);
      // Its own state, not the app-wide flag the garden's page reads: a sheet left open on Home
      // can never open itself on a garden's page the member goes back to.
      expect(useUIStore.getState().isEndowmentSheetOpen).toBe(false);
    });

    it("shows Endowment to a depositor who holds no role, naming their deposit", () => {
      mocks.account = ME;
      mocks.vaults = [{}];
      mocks.deposits = [{ shares: 3n }];
      renderAbout(garden());

      const endowment = screen.getByRole("button", { name: /Endowment/ });
      expect(endowment).toHaveTextContent("Your deposit");
      expect(screen.queryByText("Needs Your Attention")).toBeNull();
    });

    it("keeps Endowment out while the garden has no vault, and Governance out while its flag is off", () => {
      mocks.account = ME;
      renderAbout(garden({ stewards: [ME] }), ["steward"]);

      expect(aboutRows()).toEqual(["Insights", "Gardeners", "Share Garden"]);
    });

    it("shares the garden's own link from the Share row", async () => {
      const user = userEvent.setup();
      mocks.account = NEIGHBOUR;
      renderAbout(garden(), ["gardener"]);

      await user.click(screen.getByRole("button", { name: /Share Garden/ }));
      await waitFor(() =>
        expect(mocks.shareLink).toHaveBeenCalledWith({
          title: "Riverside Commons Garden",
          url: `${window.location.origin}/home/${GARDEN}`,
        })
      );
    });

    // Its sheets portal past Home's hidden wrapper, so leaving Home closes them with Home's own
    // drawers instead of leaving them over the page Home opened (Codex P2 on #1333).
    it("closes Endowment when Home opens a page, and it stays closed on return", async () => {
      const user = userEvent.setup();
      mocks.account = ME;
      mocks.vaults = [{}];
      const journal = (
        <HomeJournal
          garden={garden({ stewards: [ME] })}
          membership={{ roles: ["steward"], pendingJoin: false }}
        />
      );
      const { rerender } = renderWithProviders(asHomeHolds(journal, true));
      await user.click(screen.getByRole("button", { name: /Endowment/ }));
      expect(await screen.findByTestId("endowment-sheet")).toBeInTheDocument();

      rerender(asHomeHolds(journal, false));
      expect(screen.queryByTestId("endowment-sheet")).not.toBeInTheDocument();
      rerender(asHomeHolds(journal, true));
      expect(screen.queryByTestId("endowment-sheet")).not.toBeInTheDocument();
    });
  });

  // The cycle details portal past Home's hidden wrapper too (Codex P2 on #1333), and the cycles'
  // clock is read again as Home shows, so days left never stand stale under a page.
  it.each([
    ["the carousel's", <HighlightsCarousel key="carousel" gardenId={GARDEN} />],
    ["Take Part's", <TakePart key="take-part" gardenId={GARDEN} withCycleLines />],
  ])("closes %s cycle details when Home opens a page, and tells its cycles whether Home shows", async (_host, host) => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(asHomeHolds(host, true));
    expect(mocks.cycles).toHaveBeenLastCalledWith(GARDEN, { shown: true });
    await user.click(screen.getByRole("button", { name: /Autumn Planting 2026/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    rerender(asHomeHolds(host, false));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.cycles).toHaveBeenLastCalledWith(GARDEN, { shown: false });
  });
});
