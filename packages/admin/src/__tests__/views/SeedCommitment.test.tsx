/**
 * @vitest-environment jsdom
 */

import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  cycleFixture,
  poolFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { CommitmentJobVariables } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { selectPoolConsoleModel } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";

import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const CONFIRMER = "0x2222222222222222222222222222222222222222" as const;
const REWARD_TOKEN = "0x4444444444444444444444444444444444444444" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const NOW = 1_756_000_000n;
const TX_HASH = `0x${"ab".repeat(32)}`;

type ActionsModule = typeof import("@green-goods/shared/hooks/blockchain/useBaseLists");
type PoolingModule = typeof import("@green-goods/shared/commitment-pooling");
type Enqueue = (input: CommitmentJobVariables) => Promise<string>;

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn<Enqueue>(),
  protocolRegistered: true,
  settlementActive: false,
  console: null as PoolConsoleController | null,
  again: null as Record<string, unknown> | null,
  /** Open-commitment room the steward has left; null while it is not read. */
  room: null as number | null,
  /** Whether the external reward token answers decimals(); it reads as six-decimal USDC. */
  rewardTokenReadable: true,
}));

// The reward token is read on chain; here it answers as a six-decimal token,
// or not at all, so no test reaches for an RPC.
vi.mock("@green-goods/shared/hooks/blockchain/useErc20Metadata", () => ({
  useErc20Metadata: (_chainId: number, token: string | null | undefined) =>
    !token || !/^0x[0-9a-fA-F]{40}$/.test(token)
      ? { status: "idle" }
      : mocks.rewardTokenReadable
        ? { status: "ready", metadata: { decimals: 6, symbol: "USDC" } }
        : { status: "unreadable" },
}));

// The tray itself is the real one; only its read of the steward's open count is
// answered here, so no test reaches for the indexer.
vi.mock("@green-goods/shared/hooks/admin-ui/pool/useSeedTray", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/hooks/admin-ui/pool/useSeedTray")>();
  return { ...actual, useSeedTrayRoom: () => mocks.room };
});

vi.mock("@green-goods/shared/hooks/commitment-pooling/useComposeAgainValues", () => ({
  useComposeAgainValues: () => mocks.again,
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController", () => ({
  usePoolConsoleController: () => mocks.console!,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: (() => ({
    data: [{ id: "42161-44", title: "Prune trees" }],
  })) as unknown as ActionsModule["useActions"],
  // The wizard names the pool it seeds into from the gardens list.
  useGardens: (() => ({
    data: [{ id: GARDEN, name: "Rocinha" }],
  })) as unknown as ActionsModule["useGardens"],
}));

vi.mock("@green-goods/shared/hooks/ui/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock(
  "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs")
      >();
    return {
      ...actual,
      useCommitmentJobs: () => ({
        enqueue: mocks.enqueue,
        isPending: false,
        error: null,
        viewer: VIEWER,
      }),
    };
  }
);

vi.mock("@green-goods/shared/hooks/commitment-pooling/useProtocolPool", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@green-goods/shared/hooks/commitment-pooling/useProtocolPool")
    >();
  return {
    ...actual,
    useProtocolPool: (() => ({
      poolId: mocks.protocolRegistered ? 1n : null,
      rootGarden: "0xcccccccccccccccccccccccccccccccccccccccc",
      isRegistered: mocks.protocolRegistered,
      isLoading: false,
    })) as unknown as PoolingModule["useProtocolPool"],
  };
});

vi.mock(
  "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@green-goods/shared/hooks/commitment-pooling/useSettlementQueries")
      >();
    return {
      ...actual,
      useSettlementAccount: (() => ({
        detail: mocks.settlementActive
          ? { account: { active: true }, route: null }
          : { account: null, route: null },
        isLoading: false,
      })) as unknown as PoolingModule["useSettlementAccount"],
    };
  }
);

const { SeedCommitmentDialog } = await import("@/views/Garden/Pool/Seed");

function cycle(overrides: Partial<CommitmentCycleRecord> = {}): CommitmentCycleRecord {
  return cycleFixture({
    id: "42161-12",
    chainId: 42161,
    cycleId: 12n,
    seedSeen: true,
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
    liveCommitmentCount: 0n,
    commitmentsAccepted: 0n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 0n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    commitmentsDue: 0n,
    openCommitmentCount: 0n,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  });
}

function consoleFor(poolType: "GARDEN" | "PROTOCOL" = "GARDEN"): PoolConsoleController {
  const pool = poolFixture({
    id: "42161-7",
    chainId: 42161,
    poolId: 7n,
    registrationSeen: true,
    garden: GARDEN,
    gardenId: GARDEN,
    poolType,
    state: "OPEN",
    charterCID: "bafy-charter",
    pauseReasonCID: null,
    pauseReasonBlockNumber: null,
    openSeasonCycleId: 12n,
    openSeasonCycleEntityId: "42161-12",
    openCampaignIds: [13n],
    openCampaignEntityIds: ["42161-13"],
    providerOpenCommitmentCap: 24n,
    liveCommitmentCount: 0n,
    nonTerminalCycleCount: 2n,
    commitmentsOffered: 0n,
    commitmentsRequested: 0n,
    commitmentsAccepted: 0n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsFulfilled: 0n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    workLinkedCount: 0n,
    workApprovedCount: 0n,
    openCommitmentCount: 0n,
    distinctProviderCount: 0n,
    commitmentsDue: 0n,
    createdAt: 1,
    updatedAt: 2,
  });
  const cycles = [
    cycle(),
    cycle({ id: "42161-13", cycleId: 13n, cycleType: "CAMPAIGN", metadataCID: "bafy-13" }),
  ];
  return poolConsoleControllerFixture({
    chainId: 42161,
    garden: GARDEN,
    viewer: VIEWER,
    isOnline: true,
    pool,
    cycles,
    cycleNames: new Map([
      ["12", { status: "resolved", name: "Season of First Rains" }],
      ["13", { status: "resolved", name: "Market rides" }],
    ]),
    commitments: [],
    titles: new Map(),
    claims: [],
    charter: { charter: null, isLoading: false, isUnavailable: false },
    pauseReason: { reason: null, isLoading: false, isUnavailable: false },
    pendingCreates: [],
    queueUnavailable: false,
    refetch: vi.fn(),
    model: selectPoolConsoleModel({
      pool,
      cycles,
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    }),
  });
}

function renderSeed(props: { fromCommitmentId?: bigint } = {}) {
  const onClose = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/garden/pool/seed",
        element: (
          <SeedCommitmentDialog
            open
            chainId={42161}
            garden={GARDEN}
            onClose={onClose}
            fromCommitmentId={props.fromCommitmentId}
          />
        ),
      },
    ],
    { initialEntries: ["/garden/pool/seed"] }
  );
  renderWithProviders(<RouterProvider router={router} />);
  return { onClose };
}

/**
 * The dialog as PoolDialogs mounts it: always rendered, `open` toggling around
 * it, and a re-render on demand so a query can be made to answer late.
 */
function renderMounted() {
  function Harness() {
    const [open, setOpen] = useState(true);
    const [, setTick] = useState(0);
    return (
      <>
        <button type="button" data-testid="toggle-seed" onClick={() => setOpen((value) => !value)}>
          toggle seed
        </button>
        <button
          type="button"
          data-testid="settle-queries"
          onClick={() => setTick((value) => value + 1)}
        >
          settle queries
        </button>
        <SeedCommitmentDialog
          open={open}
          chainId={42161}
          garden={GARDEN}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }
  const router = createMemoryRouter([{ path: "/garden/pool/seed", element: <Harness /> }], {
    initialEntries: ["/garden/pool/seed"],
  });
  renderWithProviders(<RouterProvider router={router} />);
  // By test id, not by role: an open Radix dialog marks everything outside it
  // aria-hidden, so the harness controls are not in the accessibility tree.
  const press = (id: string) => fireEvent.click(screen.getByTestId(id));
  return {
    toggleOpen: () => press("toggle-seed"),
    settleQueries: () => press("settle-queries"),
  };
}

const dialog = () => screen.getByRole("dialog");
const next = () => fireEvent.click(within(dialog()).getByRole("button", { name: /^next$/i }));

function fillWhat(title = "Market rides") {
  fireEvent.change(within(dialog()).getByLabelText(/^title/i), { target: { value: title } });
}

function fillHowMuch() {
  fireEvent.change(within(dialog()).getByLabelText(/^unit/i), { target: { value: "rides" } });
  fireEvent.change(within(dialog()).getByLabelText(/^target/i), { target: { value: "16" } });
}

/** From the first step to the review, with the answers a commitment cannot do without. */
async function toReview(title?: string) {
  fillWhat(title);
  next();
  await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
  fillHowMuch();
  next();
  await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
  next();
  await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
}

const createdIds = () =>
  mocks.enqueue.mock.calls.map(([input]) =>
    input.act === "create" ? input.payload.clientCommitmentId : null
  );
const createdTitles = () =>
  mocks.enqueue.mock.calls.map(([input]) =>
    input.act === "create" ? (input.payload.metadata as { title: string }).title : null
  );

describe("SeedCommitmentDialog (W8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protocolRegistered = true;
    mocks.settlementActive = false;
    mocks.again = null;
    mocks.room = null;
    mocks.rewardTokenReadable = true;
    mocks.console = consoleFor();
    mocks.enqueue.mockResolvedValue("job-1");
  });

  it("groups the cycle choice as the one season, then the campaigns, then cycle-less, defaulting to the season", () => {
    renderSeed();
    // Every step names the pool the commitments land in before anything else.
    expect(within(dialog()).getByText("Rocinha’s pool")).toBeInTheDocument();
    const select = within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual([
      expect.stringMatching(/season · season of first rains/i),
      expect.stringMatching(/campaign · market rides/i),
      expect.stringMatching(/no cycle/i),
    ]);
    expect(select.value).toBe("12");
  });

  it("opens on the earlier commitment's answers, the steward's extras included, in this pool's season", async () => {
    mocks.again = {
      direction: "REQUEST",
      kind: "SERVICE",
      title: "Market rides",
      unitLabel: "rides",
      targetUnits: 16,
      confirmers: ["0x3333333333333333333333333333333333333333"],
      confirmationThreshold: 1,
    };
    renderSeed({ fromCommitmentId: 9n });

    await waitFor(() =>
      expect(within(dialog()).getByLabelText(/^title/i)).toHaveValue("Market rides")
    );
    // The season is this pool's own, never the earlier commitment's.
    expect((within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement).value).toBe("12");
  });

  it("queues a season commitment with the steward's extras in the payload", async () => {
    const { onClose } = renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
    fireEvent.change(within(dialog()).getByLabelText(/add an address/i), {
      target: { value: CONFIRMER },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: /^add$/i }));
    expect(within(dialog()).getByText(CONFIRMER)).toBeInTheDocument();
    // The pilot default: the Green Goods team may step in, and it is on.
    const fallback = within(dialog()).getByRole("checkbox", { name: /green goods team/i });
    expect(fallback).toBeChecked();
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    expect(screen.getByTestId("seed-review")).toHaveTextContent(/named group · 1 of 1/i);
    fireEvent.click(within(dialog()).getByRole("button", { name: /seed this commitment/i }));

    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    const input = mocks.enqueue.mock.calls[0]?.[0];
    expect(input?.act).toBe("create");
    if (!input || input.act !== "create") throw new Error("Expected a create commitment job");
    expect(input.act).toBe("create");
    expect(input.payload).toMatchObject({
      poolId: 7n,
      cycleId: 12n,
      direction: 0,
      commitmentType: 2,
      claimMode: 0,
      unitLabel: "rides",
      targetUnits: 16n,
      confirmers: [CONFIRMER],
      confirmationThreshold: 1,
      protocolFallbackEnabled: true,
      // Direct creation: CreationChecksLib.resolveCreator reverts
      // UnauthorizedCaller on any named onBehalfOf outside a StewardCaptured
      // commitment, and this console never seeds one.
      onBehalfOf: ZERO_ADDRESS,
      gardenAddress: GARDEN,
      consideration: { rail: 0, amount: 0n },
    });
    expect((input.payload.metadata as { title: string }).title).toBe("Market rides");
    // The wizard ends on what the pass made, and Done is what closes it.
    await waitFor(() => expect(screen.getByTestId("seed-done")).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    // Every row was sent, so its answers are spent: no step opens them again.
    expect(within(dialog()).queryAllByRole("button", { name: /^what$/i })).toHaveLength(0);
    fireEvent.click(within(dialog()).getByRole("button", { name: /^done$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("prefills steward review when the pool is the protocol's, and lets the steward gate an offer", async () => {
    // Context comes from the pool itself, never from where the wizard was opened.
    mocks.console = consoleFor("PROTOCOL");
    renderSeed();
    // The protocol pool is set apart from the first step, not only in its defaults.
    expect(
      within(dialog()).getByText("Writing to the Green Goods protocol pool")
    ).toBeInTheDocument();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
    expect(within(dialog()).getByRole("radio", { name: /steward-reviewed/i })).toBeChecked();
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    fireEvent.click(within(dialog()).getByRole("button", { name: /seed this commitment/i }));
    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    const input = mocks.enqueue.mock.calls[0]?.[0];
    if (!input || input.act !== "create") throw new Error("Expected a create commitment job");
    expect(input.payload.claimMode).toBe(1);
  });

  it("keeps the rails exclusive: the external rail names its fields, Celo stays disabled until the settlement account is active", async () => {
    renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
    const celo = within(dialog()).getByRole("radio", { name: /celo g\$ settlement/i });
    expect(celo).toBeDisabled();
    expect(within(dialog()).getByText(/settlement account to be active/i)).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /external payout record/i }));
    expect(within(dialog()).getByLabelText(/paid from/i)).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /^none/i }));
    expect(within(dialog()).queryByLabelText(/paid from/i)).not.toBeInTheDocument();
  });

  it("disables the Green Goods team fallback with a repair path when no protocol pool is registered, and stores it off", async () => {
    mocks.protocolRegistered = false;
    renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
    const fallback = within(dialog()).getByRole("checkbox", { name: /green goods team/i });
    expect(fallback).toBeDisabled();
    expect(fallback).not.toBeChecked();
    expect(within(dialog()).getByText(/repair path/i)).toBeInTheDocument();
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    fireEvent.click(within(dialog()).getByRole("button", { name: /seed this commitment/i }));
    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    const input = mocks.enqueue.mock.calls[0]?.[0];
    if (!input || input.act !== "create") throw new Error("Expected a create commitment job");
    expect(input.payload.protocolFallbackEnabled).toBe(false);
  });

  it("refuses the zero address as a named confirmer, which no threshold could ever reach", async () => {
    renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() =>
      expect(within(dialog()).getByLabelText(/add an address/i)).toBeInTheDocument()
    );
    const draft = within(dialog()).getByLabelText(/add an address/i);
    fireEvent.change(draft, { target: { value: ZERO_ADDRESS } });
    expect(within(dialog()).getByRole("button", { name: /^add$/i })).toBeDisabled();
    fireEvent.change(draft, { target: { value: CONFIRMER } });
    expect(within(dialog()).getByRole("button", { name: /^add$/i })).toBeEnabled();
  });

  it("says a broken reward in the steward's language, not in the schema's own words", async () => {
    renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() =>
      expect(
        within(dialog()).getByRole("radio", { name: /external payout record/i })
      ).toBeInTheDocument()
    );
    fireEvent.click(within(dialog()).getByRole("radio", { name: /external payout record/i }));
    fireEvent.change(within(dialog()).getByLabelText(/token \(address\)/i), {
      target: { value: REWARD_TOKEN },
    });
    fireEvent.change(await within(dialog()).findByLabelText(/^amount \(usdc\)/i), {
      target: { value: "0" },
    });
    // The schema says this as a message id; a raw one reaching the DOM is the
    // regression, and only a catalog lookup turns it back into a sentence.
    await waitFor(() =>
      expect(within(dialog()).getByText("Enter an amount above zero.")).toBeInTheDocument()
    );
    expect(dialog().textContent).not.toContain("cockpit.garden.pool.seed.error");
  });

  it("records a declared reward in the token's own units, never its base units", async () => {
    renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
    fireEvent.click(within(dialog()).getByRole("radio", { name: /external payout record/i }));
    fireEvent.change(within(dialog()).getByLabelText(/paid from/i), {
      target: { value: GARDEN },
    });
    fireEvent.change(within(dialog()).getByLabelText(/token \(address\)/i), {
      target: { value: REWARD_TOKEN },
    });
    fireEvent.change(await within(dialog()).findByLabelText(/^amount \(usdc\)/i), {
      target: { value: "2.5" },
    });
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    expect(within(dialog()).getByText(/2\.5 USDC/)).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: /seed this commitment/i }));
    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    const input = mocks.enqueue.mock.calls[0]?.[0];
    if (!input || input.act !== "create") throw new Error("Expected a create commitment job");
    expect(input.payload.consideration.amount).toBe(2_500_000n);
  });

  it("holds the amount, and says why, when the reward token's units cannot be read", async () => {
    mocks.rewardTokenReadable = false;
    renderSeed();
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() => expect(within(dialog()).getByText(/^confirmers$/i)).toBeInTheDocument());
    fireEvent.click(within(dialog()).getByRole("radio", { name: /external payout record/i }));
    fireEvent.change(within(dialog()).getByLabelText(/token \(address\)/i), {
      target: { value: REWARD_TOKEN },
    });
    // Guessing 18 decimals would record the amount wrong by orders of magnitude.
    expect(within(dialog()).getByLabelText(/^amount/i)).toBeDisabled();
    expect(within(dialog()).getByText(/units could not be read/i)).toBeInTheDocument();
  });

  it("starts a fresh draft each time the mounted dialog reopens", async () => {
    const { toggleOpen } = renderMounted();
    fillWhat("Abandoned draft");
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    toggleOpen();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    toggleOpen();
    // Back on the first step, with nothing carried over: resuming the abandoned
    // answers is how the same commitment reaches the queue twice.
    await waitFor(() => expect(within(dialog()).getByLabelText(/^title/i)).toBeInTheDocument());
    expect(within(dialog()).getByLabelText(/^title/i)).toHaveValue("");
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("follows the season and the protocol pool once their queries answer", async () => {
    mocks.protocolRegistered = false;
    mocks.console = { ...consoleFor(), model: { ...consoleFor().model, season: null } };
    const { settleQueries } = renderMounted();
    const cycleSelect = () => within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement;
    // Cold load: no season yet, and no protocol pool, so the one-time defaults
    // are cycle-less with the fallback off.
    expect(cycleSelect().value).toBe("0");

    mocks.protocolRegistered = true;
    mocks.console = consoleFor();
    settleQueries();

    // Untouched fields follow the answer; otherwise an untouched submission is
    // silently cycle-less with the fallback off.
    expect(cycleSelect().value).toBe("12");
    fillWhat();
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
    fillHowMuch();
    next();
    await waitFor(() =>
      expect(within(dialog()).getByRole("checkbox", { name: /green goods team/i })).toBeChecked()
    );
  });

  it("adds another like this, then creates them all, each under an id of its own", async () => {
    const { onClose } = renderSeed();
    await toReview("Market rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /add another like this/i }));

    // Back on the first step with the same answers, so only what differs is typed.
    await waitFor(() =>
      expect(within(dialog()).getByLabelText(/^title/i)).toHaveValue("Market rides")
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
    await toReview("Clinic rides");

    expect(within(screen.getByTestId("seed-tray")).getByText("Market rides")).toBeInTheDocument();
    // How many times the wallet will ask sits beside the button that asks.
    expect(screen.getByTestId("seed-prompt-count")).toHaveTextContent(/ask you twice/i);
    fireEvent.click(within(dialog()).getByRole("button", { name: /create all \(2\)/i }));

    await waitFor(() => expect(screen.getByTestId("seed-done")).toBeInTheDocument());
    expect(within(screen.getByTestId("seed-pass")).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(within(dialog()).getByRole("button", { name: /^done$/i }));
    expect(onClose).toHaveBeenCalled();
    expect(createdTitles()).toEqual(["Market rides", "Clinic rides"]);
    expect(new Set(createdIds()).size).toBe(2);
  });

  it("keeps the one that was not sent, says what is left, and sends it again as itself", async () => {
    mocks.enqueue
      .mockResolvedValueOnce("job-1")
      .mockRejectedValueOnce(new Error("execution reverted"))
      .mockResolvedValueOnce("job-2");
    const { onClose } = renderSeed();
    await toReview("Market rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /add another like this/i }));
    await waitFor(() => expect(within(dialog()).getByLabelText(/^title/i)).toBeInTheDocument());
    await toReview("Clinic rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /create all \(2\)/i }));

    // The pass ends on how each row went, and a row left unsent keeps the way back open.
    await waitFor(() =>
      expect(screen.getByTestId("seed-done")).toHaveTextContent(
        /1 was not sent, so nothing was created for it/i
      )
    );
    expect(within(dialog()).queryByRole("button", { name: /^done$/i })).not.toBeInTheDocument();
    // What was not sent can still be changed, so the steps stay open.
    expect(within(dialog()).getAllByRole("button", { name: /^what$/i }).length).toBeGreaterThan(0);
    fireEvent.click(within(dialog()).getByRole("button", { name: /back to review/i }));

    await waitFor(() =>
      expect(screen.getByTestId("seed-review")).toHaveTextContent(
        /1 commitment was sent\. 1 could not be sent/i
      )
    );
    expect(onClose).not.toHaveBeenCalled();
    // The one that landed has left the tray; the other is the one under review.
    expect(screen.queryByTestId("seed-tray")).not.toBeInTheDocument();
    expect(screen.getByTestId("seed-review")).toHaveTextContent("Clinic rides");

    fireEvent.click(within(dialog()).getByRole("button", { name: /seed this commitment/i }));
    await waitFor(() => expect(screen.getByTestId("seed-done")).toBeInTheDocument());
    fireEvent.click(within(dialog()).getByRole("button", { name: /^done$/i }));
    expect(onClose).toHaveBeenCalled();
    // Its second send carries the id of its first: it can only ever be one commitment.
    expect(createdIds()[2]).toBe(createdIds()[1]);
  });

  it("follows each row to the wallet and the chain, then ends on what was created", async () => {
    // The wallet's answer to the first prompt, given when the test says so.
    let answer: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    mocks.enqueue
      .mockImplementationOnce(async ({ report }) => {
        report?.({ stage: "wallet" });
        await answered;
        report?.({ stage: "confirming", txHash: TX_HASH });
        report?.({ stage: "landed", txHash: TX_HASH });
        return "job-1";
      })
      .mockImplementationOnce(async ({ report }) => {
        // Broadcast, but the chain has not shown it yet: it waits on the pool tab.
        report?.({ stage: "wallet" });
        report?.({ stage: "confirming", txHash: `0x${"cd".repeat(32)}` });
        report?.({ stage: "queued" });
        return "job-2";
      });
    const { onClose } = renderSeed();
    await toReview("Market rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /add another like this/i }));
    await waitFor(() => expect(within(dialog()).getByLabelText(/^title/i)).toBeInTheDocument());
    await toReview("Clinic rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /create all \(2\)/i }));

    // While the wallet asks, the pass says which prompt it is on, of how many.
    await waitFor(() =>
      expect(screen.getByTestId("seed-sending")).toHaveTextContent(
        /confirm in your wallet \(1 of 2\)/i
      )
    );
    expect(within(dialog()).getByText("Creating the Commitments")).toBeInTheDocument();
    answer();

    await waitFor(() => expect(screen.getByTestId("seed-done")).toBeInTheDocument());
    const done = screen.getByTestId("seed-done");
    expect(done).toHaveTextContent(/1 commitment created\./i);
    expect(done).toHaveTextContent(/1 sends later: its row waits on the pool tab with send now/i);
    // Only the one the chain holds links to its transaction.
    const links = within(done).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("View the transaction for “Market rides”");
    expect(links[0]?.getAttribute("href")).toContain(TX_HASH);
    fireEvent.click(within(dialog()).getByRole("button", { name: /^done$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the Not sent mark when the failed commitment is the only one left", async () => {
    mocks.enqueue
      .mockRejectedValueOnce(new Error("execution reverted"))
      .mockResolvedValueOnce("job-2");
    renderSeed();
    await toReview("Market rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /add another like this/i }));
    await waitFor(() => expect(within(dialog()).getByLabelText(/^title/i)).toBeInTheDocument());
    await toReview("Clinic rides");
    fireEvent.click(within(dialog()).getByRole("button", { name: /create all \(2\)/i }));
    await waitFor(() => expect(screen.getByTestId("seed-done")).toBeInTheDocument());
    fireEvent.click(within(dialog()).getByRole("button", { name: /back to review/i }));

    // One landed, so the one that failed is now the only commitment in the
    // sitting. Its mark is what says it was promised and never sent.
    await waitFor(() => expect(screen.queryByTestId("seed-tray")).not.toBeInTheDocument());
    expect(within(screen.getByTestId("seed-tray-current")).getByText(/not sent/i)).toBeVisible();
  });

  it("holds seeding while the offers are more than the steward may hold open", async () => {
    mocks.room = 0;
    renderSeed();
    await toReview();

    expect(screen.getByTestId("seed-review")).toHaveTextContent(/more than you can hold at once/i);
    expect(within(dialog()).getByRole("button", { name: /seed this commitment/i })).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: /add another like this/i })).toBeDisabled();
  });

  it("never overwrites a choice the steward already made with a late default", () => {
    mocks.console = { ...consoleFor(), model: { ...consoleFor().model, season: null } };
    const { settleQueries } = renderMounted();
    const cycleSelect = () => within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement;
    fireEvent.change(cycleSelect(), { target: { value: "13" } });

    mocks.console = consoleFor();
    settleQueries();

    expect(cycleSelect().value).toBe("13");
  });
});
