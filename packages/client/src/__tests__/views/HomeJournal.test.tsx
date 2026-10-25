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
import { renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0x5000000000000000000000000000000000000001";
const NEIGHBOUR = "0xb0b0000000000000000000000000000000000002" as Address;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  recent: vi.fn(),
  cycles: vi.fn(),
  promises: vi.fn(),
  cycleNames: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => mocks.navigate,
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenJournal", () => ({
  useGardenRecentActivity: (gardenId: string) => mocks.recent(gardenId),
  useGardenOpenCycles: (gardenId: string) => mocks.cycles(gardenId),
  useGardenOpenPromises: (gardenId: string) => mocks.promises(gardenId),
}));

// The details sheet names its cycle itself, from the cycle's metadata.
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentCycleNames: () => mocks.cycleNames(),
}));

// The garden's own page closes the journal until About lands; it stands in as a marker here.
vi.mock("../../views/Home/Garden/GardenPage", () => ({
  GardenPage: () => <div data-component="GardenPage" />,
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

const render = (ui: ReactElement) => renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);

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
});

const OFFER = single(promise(21));
const ASK = single(
  promise(20, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" })
);
const TITLES: Record<string, string> = {
  "cid-21": "Teach the composting basics workshop",
  "cid-20": "Two hours sorting the seed library",
};

function promises(overrides: Partial<GardenOpenPromises> = {}): GardenOpenPromises {
  return {
    state: { status: "ready", items: [OFFER, ASK], savedAt: null },
    ask: ASK,
    titleOf: (cid) => (cid ? (TITLES[cid] ?? null) : null),
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("Home journal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ isCommitmentsSheetOpen: false, commitmentsSheetOpening: undefined });
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

    it("opens a pending work's page, coming back to Home, and See All opens the garden's work", async () => {
      const user = userEvent.setup();
      render(<RecentActivity gardenId={GARDEN} />);

      await user.click(screen.getByRole("button", { name: /Compost turn/ }));
      expect(mocks.navigate).toHaveBeenCalledWith(
        `/home/${GARDEN}/work/${PENDING.id}`,
        expect.objectContaining({ state: { from: "home", returnTo: "/home" } })
      );

      await user.click(screen.getByRole("button", { name: "See All" }));
      expect(mocks.navigate).toHaveBeenLastCalledWith(`/home/${GARDEN}`);
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

    it("opens the Promises sheet from See All, the one promise workflow", async () => {
      const user = userEvent.setup();
      render(<TakePart gardenId={GARDEN} />);

      await user.click(screen.getByRole("button", { name: "See All" }));
      expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(true);
      expect(mocks.navigate).not.toHaveBeenCalled();
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
      await user.click(screen.getByRole("button", { name: /Autumn Planting 2026/ }));
      const sheet = await screen.findByRole("dialog");
      await user.click(within(sheet).getByRole("button", { name: "Show Its Promises" }));
      expect(useUIStore.getState()).toMatchObject({
        isCommitmentsSheetOpen: true,
        commitmentsSheetOpening: { cycleId: SEASON.cycle.cycleId.toString() },
      });
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

      await user.click(screen.getByRole("button", { name: /Autumn Planting 2026/ }));
      const sheet = await screen.findByRole("dialog");
      await user.click(within(sheet).getByRole("button", { name: "Show Its Promises" }));
      // The Promises sheet opens filtered to the season (step 11), not whole.
      expect(useUIStore.getState()).toMatchObject({
        isCommitmentsSheetOpen: true,
        commitmentsSheetOpening: { cycleId: SEASON.cycle.cycleId.toString() },
      });
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

  it("mounts Highlights, Recent Activity and Take Part in DL-127's order, then the garden's page", async () => {
    const garden = { id: GARDEN, name: "Riverside Commons Garden" } as Garden;
    const { container } = render(
      <HomeJournal garden={garden} membership={{ roles: ["gardener"], pendingJoin: false }} />
    );

    // Until step 10's About entry, the garden's own page keeps its tabs and actions within reach.
    await waitFor(() =>
      expect(container.querySelector("[data-component='GardenPage']")).not.toBeNull()
    );
    const order = [...container.querySelectorAll("[data-component]")]
      .map((node) => node.getAttribute("data-component"))
      .filter((name) =>
        ["HighlightsCarousel", "RecentActivity", "TakePart", "GardenPage"].includes(name ?? "")
      );
    expect(order).toEqual(["HighlightsCarousel", "RecentActivity", "TakePart", "GardenPage"]);
    for (const read of [mocks.cycles, mocks.recent, mocks.promises]) {
      expect(read).toHaveBeenCalledWith(GARDEN);
    }
  });
});
