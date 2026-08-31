/**
 * @vitest-environment jsdom
 */

import type {
  PoolConsoleActs,
  PoolConsoleController,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  commitmentFixture,
  cycleFixture,
  poolFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import { selectPoolConsoleModel } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";

import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const CLAIMANT = "0x2222222222222222222222222222222222222222" as const;

type GardenWorkspaceModule =
  typeof import("@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController");

const mocks = vi.hoisted(() => ({
  controller: null as PoolConsoleController | null,
  gardenController: null as ReturnType<typeof gardenController> | null,
  navigate: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController", () => ({
  useGardenWorkspaceController: (() =>
    mocks.gardenController!) as unknown as GardenWorkspaceModule["useGardenWorkspaceController"],
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController", () => ({
  usePoolConsoleController: () => mocks.controller!,
}));

vi.mock("@green-goods/shared/hooks/ui/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/views/Garden/components/GardenWorkspaceContent", () => ({
  GardenWorkspaceContent: () => <div data-testid="garden-content" />,
}));
vi.mock("@/views/Garden/components/GardenSheetDescriptor", () => ({
  GardenSheetDescriptor: () => null,
}));
// The season/campaign flows and the settings dialog are their own surfaces;
// here they only need to be openable.
vi.mock("@/views/Garden/Pool/SetupFlow", () => ({
  PoolSetupFlow: ({ open, intent }: { open: boolean; intent: string }) =>
    open ? <div data-testid="pool-setup-flow">{intent}</div> : null,
}));

const { GardenPoolTab } = await import("@/views/Garden/Pool");
const { default: GardenView } = await import("@/views/Garden");

const NOW = 1_756_000_000n;

function pool(overrides: Partial<CommitmentPoolRecord> = {}): CommitmentPoolRecord {
  return poolFixture({
    id: "42161-7",
    chainId: 42161,
    poolId: 7n,
    registrationSeen: true,
    garden: GARDEN,
    gardenId: GARDEN,
    poolType: "GARDEN",
    state: "OPEN",
    charterCID: "bafy-charter",
    pauseReasonCID: null,
    pauseReasonBlockNumber: null,
    openSeasonCycleId: 12n,
    openSeasonCycleEntityId: "42161-12",
    openCampaignIds: [],
    openCampaignEntityIds: [],
    providerOpenCommitmentCap: 24n,
    liveCommitmentCount: 2n,
    nonTerminalCycleCount: 1n,
    commitmentsOffered: 1n,
    commitmentsRequested: 0n,
    commitmentsAccepted: 1n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 3n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 1n,
    commitmentsDisputed: 0n,
    workLinkedCount: 0n,
    workApprovedCount: 0n,
    openCommitmentCount: 2n,
    distinctProviderCount: 2n,
    commitmentsDue: 0n,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_100,
    ...overrides,
  });
}

function cycle(overrides: Partial<CommitmentCycleRecord> = {}): CommitmentCycleRecord {
  return cycleFixture({
    id: "42161-12",
    chainId: 42161,
    cycleId: 12n,
    seedSeen: true,
    poolId: 7n,
    poolEntityId: "42161-7",
    garden: null,
    gardenId: null,
    cycleType: "SEASON",
    state: "OPEN",
    startTime: NOW - 100n,
    endTime: NOW + 1000n,
    metadataCID: "bafy-season",
    gardenersBps: 6000,
    treasuryBps: 1500,
    operatorBps: 1000,
    evaluatorBps: 500,
    communityBps: 500,
    funderBps: 500,
    equalParticipationBps: 2000,
    verifiedContributionBps: 8000,
    liveCommitmentCount: 2n,
    commitmentsAccepted: 1n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 1n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 0n,
    openCommitmentCount: 2n,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_100,
    ...overrides,
  });
}

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    id: "42161-1",
    chainId: 42161,
    commitmentId: 1n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: 12n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 6n,
    unitLabel: "hours",
    direction: "OFFER",
    creator: CLAIMANT,
    leadProvider: CLAIMANT,
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    dueDate: NOW + 500n,
    metadataCID: "bafy-1",
    ...overrides,
  });
}

type ControllerOverrides = Omit<Partial<PoolConsoleController>, "pool" | "poolId"> & {
  pool?: CommitmentPoolRecord | null;
  poolId?: bigint;
};

function controller(overrides: ControllerOverrides = {}): PoolConsoleController {
  const acts: PoolConsoleActs = {
    pause: vi.fn().mockResolvedValue("0x1"),
    resume: vi.fn().mockResolvedValue("0x1"),
    closePool: vi.fn().mockResolvedValue("0x1"),
    compostPool: vi.fn().mockResolvedValue("0x1"),
    reopenPool: vi.fn().mockResolvedValue("0x1"),
    cancelCycle: vi.fn().mockResolvedValue("0x1"),
    closeCycle: vi.fn().mockResolvedValue("0x1"),
    compostCycle: vi.fn().mockResolvedValue("0x1"),
    expire: vi.fn().mockResolvedValue("0x1"),
    acceptClaim: vi.fn().mockResolvedValue("0x1"),
    declineClaim: vi.fn().mockResolvedValue("0x1"),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  };
  const poolRecord = overrides.pool === undefined ? pool() : overrides.pool;
  const cycles = overrides.cycles ?? [cycle()];
  const commitments = overrides.commitments ?? [commitment()];
  const claims = overrides.claims ?? [];
  return poolConsoleControllerFixture({
    chainId: 42161,
    garden: GARDEN,
    viewer: "0x1111111111111111111111111111111111111111",
    pool: poolRecord,
    poolId: poolRecord?.poolId,
    cycles,
    cycleNames: new Map([["12", { status: "resolved", name: "Season of First Rains" }]]),
    commitments,
    titles: new Map([["bafy-1", { version: 1, title: "Prune the north beds" }]]),
    claims,
    charter: {
      charter: { version: 1, purpose: "Neighbourly help in Rocinha" },
      isLoading: false,
      isUnavailable: false,
    },
    acts,
    refetch: vi.fn(),
    ...overrides,
    model:
      overrides.model ??
      selectPoolConsoleModel({
        pool: poolRecord,
        cycles,
        commitments,
        pendingClaimCount: claims.length,
        now: NOW,
      }),
  });
}

function renderTab({ canManage = true }: { canManage?: boolean } = {}) {
  // A data router, because the console's dialogs guard their close paths with
  // useDirtyClose (useBlocker), exactly as the app mounts them.
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <GardenPoolTab
            garden={{ id: GARDEN, name: "Rocinha" }}
            chainId={42161}
            canManage={canManage}
          />
        ),
      },
    ],
    { initialEntries: ["/"] }
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

function gardenController(canManage: boolean) {
  return {
    containerRef: { current: null },
    selectedGarden: { id: GARDEN, name: "Rocinha" },
    garden: { id: GARDEN, name: "Rocinha", gardeners: [], chainId: 42161 },
    hypercertsLoading: false,
    hypercerts: [],
    view: "health",
    derived: { overviewAlerts: [], impactBadge: { count: undefined } },
    handleTabChange: vi.fn(),
    desktopActions: [],
    canManage,
    hypercertId: undefined,
    hypercertSheetCloseTo: "/garden/impact",
    poolSeedOpen: false,
    poolCommitmentId: undefined,
    poolSheetCloseTo: "/garden/pool",
  };
}

describe("GardenPoolTab (W7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.controller = controller();
  });

  it("shows skeletons while the pool loads and a retry when the read fails", () => {
    mocks.controller = controller({ isLoading: true, pool: null, poolId: undefined });
    const { unmount } = renderTab();
    expect(screen.getByRole("status")).toBeInTheDocument();
    unmount();

    const refetch = vi.fn();
    mocks.controller = controller({ isError: true, refetch });
    renderTab();
    expect(screen.getByText(/couldn.t load this pool/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("says when the garden has no pool registered, without offering setup", () => {
    mocks.controller = controller({ pool: null, poolId: undefined, cycles: [], commitments: [] });
    renderTab();
    expect(screen.getByText(/no commitment pool/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set up commitments/i })).not.toBeInTheDocument();
  });

  it("renders the setup checklist for a pool that has never opened and opens the setup flow", () => {
    mocks.controller = controller({
      pool: pool({
        state: "NOT_READY",
        charterCID: null,
        providerOpenCommitmentCap: 0n,
        openSeasonCycleId: null,
        liveCommitmentCount: 0n,
        nonTerminalCycleCount: 0n,
      }),
      cycles: [],
      commitments: [],
      charter: { charter: null, isLoading: false, isUnavailable: false },
    });
    renderTab();
    expect(screen.getByText(/not taking commitments yet/i)).toBeInTheDocument();
    expect(screen.getByText(/agreement not written yet/i)).toBeInTheDocument();
    expect(screen.getByText(/commitment limit not set/i)).toBeInTheDocument();
    // Before the pool is ready the first-run flow owns the charter and the cap.
    expect(screen.queryByRole("button", { name: /edit pool/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /set up commitments/i }));
    expect(screen.getByTestId("pool-setup-flow")).toHaveTextContent("first-run");
  });

  it("keeps the pool settings reachable while the pool is ready but not open yet", async () => {
    // Ready is reached by reopening an archived pool, or by closing the
    // first-run flow half-way. The contract accepts setPoolCharter and
    // setProviderOpenCommitmentCap there, and Start season asks for neither,
    // so this is the steward's only way to correct them before opening.
    mocks.controller = controller({
      pool: pool({ state: "READY", openSeasonCycleId: null, nonTerminalCycleCount: 0n }),
      cycles: [],
      commitments: [],
    });
    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /edit pool/i }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByLabelText(/how many commitments one person can hold at once/i)
    ).toBeInTheDocument();
  });

  it("offers a season on a set-up pool with none running", () => {
    mocks.controller = controller({
      pool: pool({ state: "READY", openSeasonCycleId: null, nonTerminalCycleCount: 0n }),
      cycles: [],
      commitments: [],
    });
    renderTab();
    expect(screen.getByText(/no season running/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start season/i }));
    expect(screen.getByTestId("pool-setup-flow")).toHaveTextContent("season");
    // A campaign needs an open pool.
    expect(screen.getByRole("button", { name: /start campaign/i })).toBeDisabled();
  });

  it("names the running season, its campaigns, and the pool's rules", () => {
    mocks.controller = controller({
      cycles: [
        cycle(),
        cycle({
          id: "42161-13",
          cycleId: 13n,
          cycleType: "CAMPAIGN",
          state: "OPEN",
          metadataCID: "bafy-13",
        }),
      ],
      cycleNames: new Map([
        ["12", { status: "resolved", name: "Season of First Rains" }],
        ["13", { status: "resolved", name: "Market rides" }],
      ]),
    });
    renderTab();
    expect(screen.getByText("Season of First Rains")).toBeInTheDocument();
    expect(screen.getByText("Market rides")).toBeInTheDocument();
    expect(screen.getByText("Neighbourly help in Rocinha")).toBeInTheDocument();
    expect(screen.getByText(/24 per person at once/i)).toBeInTheDocument();
    expect(screen.getByText(/taking commitments/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start campaign/i }));
    expect(screen.getByTestId("pool-setup-flow")).toHaveTextContent("campaign");
  });

  it("counts the commitments a cycle carried once, not the kept ones twice", () => {
    // commitmentsAccepted is the lifetime milestone and already includes every
    // commitment that went on to be kept; adding fulfilled on top read three
    // accepted, two kept as five.
    mocks.controller = controller({
      cycles: [cycle({ commitmentsAccepted: 3n, commitmentsFulfilled: 2n })],
    });
    renderTab();
    expect(screen.getByText(/3 commitments/)).toHaveTextContent(/2 kept/);
    expect(screen.queryByText(/5 commitments/)).not.toBeInTheDocument();
  });

  it("groups commitments under Open · Confirmed · Past and opens a row in the inspector", () => {
    mocks.controller = controller({
      commitments: [
        commitment(),
        commitment({
          id: "42161-3",
          commitmentId: 3n,
          onchainState: "FULFILLED",
          derivedState: "FULFILLED",
          state: "FULFILLED",
          metadataCID: "bafy-3",
        }),
        commitment({
          id: "42161-4",
          commitmentId: 4n,
          onchainState: "EXPIRED",
          derivedState: "EXPIRED",
          state: "EXPIRED",
          metadataCID: "bafy-4",
        }),
      ],
      titles: new Map([
        ["bafy-1", { version: 1, title: "Prune the north beds" }],
        ["bafy-3", { version: 1, title: "Repair the greenhouse" }],
        ["bafy-4", { version: 1, title: "Market rides" }],
      ]),
    });
    renderTab();
    const list = screen.getByTestId("pool-commitments");
    expect(within(list).getByText("Prune the north beds")).toBeInTheDocument();
    expect(within(list).queryByText("Repair the greenhouse")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^confirmed/i }));
    expect(within(list).getByText("Repair the greenhouse")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^past/i }));
    expect(within(list).getByText("Market rides")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^open/i }));
    fireEvent.click(within(list).getByText("Prune the north beds"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/garden\/pool\/1\?gardenId=/)
    );
  });

  it("offers Expire now on a live past-due row, confirms the blast radius first, and nothing else until the index says Expired", async () => {
    mocks.controller = controller({
      commitments: [commitment({ dueDate: NOW - 10n })],
    });
    renderTab();
    const row = screen.getByTestId("pool-commitment-1");
    expect(within(row).getByText(/past due/i)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: /expire now/i }));
    // A governing act never fires from a bare row act: the confirm names the
    // blast radius before anything reaches the chain.
    const dialog = await screen.findByRole("alertdialog");
    expect(mocks.controller!.acts.expire).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^expire now$/i }));
    await waitFor(() => expect(mocks.controller!.acts.expire).toHaveBeenCalledWith(1n));
    // Still listed as live: past due alone never renders Expired.
    expect(within(row).queryByText(/^expired$/i)).not.toBeInTheDocument();
  });

  it("pauses with a reason, and resumes without one", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /^pause/i }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /pause pool/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/^reason/i), {
      target: { value: "Seasonal flooding, back after the rains" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mocks.controller!.acts.pause).toHaveBeenCalledWith(
        "Seasonal flooding, back after the rains"
      )
    );
  });

  it("while paused, shows the reason, hides the acts the contract refuses, and offers Resume", async () => {
    mocks.controller = controller({
      pool: pool({ state: "PAUSED", pauseReasonCID: "bafy-reason" }),
      pauseReason: {
        reason: { version: 1, reason: "Seasonal flooding, back after the rains" },
        isLoading: false,
        isUnavailable: false,
      },
      claims: [
        {
          claim: {
            id: `42161-2-${CLAIMANT}`,
            chainId: 42161,
            commitmentId: 2n,
            claimant: CLAIMANT,
            requestSeen: true,
            requestedBy: CLAIMANT,
            claimType: "INDIVIDUAL",
            gardenContext: null,
            state: "PENDING",
            reasonCID: null,
            resolutionCode: null,
            requestedAt: 1_700_000_000,
            resolvedAt: null,
            updatedAt: 1_700_000_100,
          },
          commitment: commitment({
            id: "42161-2",
            commitmentId: 2n,
            onchainState: "REQUESTED",
            state: "REQUESTED",
            metadataCID: "bafy-2",
          }),
        },
      ],
    });
    renderTab();
    expect(screen.getByText(/seasonal flooding, back after the rains/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^accept$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^pause/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /resume pool/i }));
    await waitFor(() => expect(mocks.controller!.acts.resume).toHaveBeenCalled());
  });

  it("accepts a claim directly and declines one with a reason, keyed to the stored claimant", async () => {
    mocks.controller = controller({
      claims: [
        {
          claim: {
            id: `42161-2-${CLAIMANT}`,
            chainId: 42161,
            commitmentId: 2n,
            claimant: CLAIMANT,
            requestSeen: true,
            requestedBy: CLAIMANT,
            claimType: "INDIVIDUAL",
            gardenContext: null,
            state: "PENDING",
            reasonCID: null,
            resolutionCode: null,
            requestedAt: 1_700_000_000,
            resolvedAt: null,
            updatedAt: 1_700_000_100,
          },
          commitment: commitment({
            id: "42161-2",
            commitmentId: 2n,
            onchainState: "REQUESTED",
            state: "REQUESTED",
            metadataCID: "bafy-2",
          }),
        },
      ],
      titles: new Map([["bafy-2", { version: 1, title: "Ride to the market on Saturday" }]]),
    });
    renderTab();
    const claims = screen.getByTestId("pool-claims");
    expect(within(claims).getByText("Ride to the market on Saturday")).toBeInTheDocument();
    fireEvent.click(within(claims).getByRole("button", { name: /^accept$/i }));
    await waitFor(() =>
      expect(mocks.controller!.acts.acceptClaim).toHaveBeenCalledWith(2n, CLAIMANT)
    );

    fireEvent.click(within(claims).getByRole("button", { name: /^decline/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^reason/i), {
      target: { value: "Crew is full" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /decline request/i }));
    await waitFor(() =>
      expect(mocks.controller!.acts.declineClaim).toHaveBeenCalledWith(2n, CLAIMANT, "Crew is full")
    );
  });

  it("keeps Close pool out of reach while anything is live, and names the live count", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: /close pool/i })).not.toBeInTheDocument();
    expect(screen.getByText(/2 live commitments/i)).toBeInTheDocument();
  });

  it("offers Close pool only once every cycle and commitment has finished", async () => {
    mocks.controller = controller({
      pool: pool({ liveCommitmentCount: 0n, nonTerminalCycleCount: 0n, openSeasonCycleId: null }),
      cycles: [cycle({ state: "COMPOSTED" })],
      commitments: [],
    });
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /close pool/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /close pool/i }));
    await waitFor(() => expect(mocks.controller!.acts.closePool).toHaveBeenCalled());
  });

  it("disables every online act and says why when the device is offline", () => {
    mocks.controller = controller({ isOnline: false });
    renderTab();
    expect(screen.getByRole("button", { name: /^pause/i })).toBeDisabled();
    expect(screen.getAllByText(/needs a connection/i).length).toBeGreaterThan(0);
  });
});

describe("Garden workspace Pool tab visibility", () => {
  it("shows the Pool tab to a steward and not to a plain member", () => {
    mocks.gardenController = gardenController(true);
    const steward = renderWithProviders(<GardenView />);
    expect(screen.getByRole("tab", { name: /pool/i })).toBeInTheDocument();
    steward.unmount();

    mocks.gardenController = gardenController(false);
    renderWithProviders(<GardenView />);
    expect(screen.queryByRole("tab", { name: /pool/i })).not.toBeInTheDocument();
  });

  it("keeps management controls from a reader who reaches the route directly while retaining funding facts", () => {
    // The rail hides the tab, but a deep link is the other way in: every write
    // control here would otherwise invite a call the contract refuses.
    renderTab({ canManage: false });

    expect(screen.getByText(/pool console is for this garden.s stewards/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pool funding/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close pool/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set up commitments/i })).not.toBeInTheDocument();
  });
});
