/**
 * @vitest-environment happy-dom
 */

/**
 * Seed Promises, the dialog: what the steward's answers become.
 *
 * The tray behind it is Shared's `useSeedTray`, proven on its own with the way
 * copies are sent (`seed-tray-hook`, `commitment-creation-send`). Here it is a
 * stand-in that builds each copy through the dialog's own builder, as the real
 * one does at a first Create, and records what it built. So this proves the
 * dialog's part: the answers each promise is created with, the dollars turned
 * into G$ at the price read for that Create, and what holds Create back.
 */

import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type {
  SeedCopyProgress,
  SeedTrayController,
  SeedTrayRow,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import {
  cycleFixture,
  poolFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import { selectPoolConsoleModel } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";

import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const CONFIRMER = "0x2222222222222222222222222222222222222222" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const NOW = 1_756_000_000n;
/** The rate shown while the steward answers, and a fresher one read at Create. */
const SHOWN_PRICE = 128_647_930_734_508n;
const CREATE_PRICE = 100_000_000_000_000n;

type ActionsModule = typeof import("@green-goods/shared/hooks/blockchain/useBaseLists");
type PoolingModule = typeof import("@green-goods/shared/commitment-pooling");
type TrayModule = typeof import("@green-goods/shared/hooks/admin-ui/pool/useSeedTray");
/** What the dialog's builder made of one copy. */
type BuiltCopy = ReturnType<Parameters<TrayModule["useSeedTray"]>[0]["buildCopy"]>;

const mocks = vi.hoisted(() => ({
  protocolRegistered: true,
  settlementActive: false,
  console: null as PoolConsoleController | null,
  again: null as Record<string, unknown> | null,
  /** Open-commitment room the steward has left; null while it is not read. */
  room: null as number | null,
  price: { status: "loading" } as GoodDollarPriceState,
  readNow: vi.fn(),
  actions: [{ id: "42161-44", title: "Prune trees", startTime: 0, endTime: Date.now() + 60_000 }],
  /** Every copy the tray built, in order. */
  built: [] as BuiltCopy[],
  /** How the wallet answers the next Create. */
  answer: "approve" as "approve" | "decline",
}));

// The stand-in tray: one row in the form plus the kept ones, each copy built
// once at Create through the dialog's builder, as the real tray does.
vi.mock("@green-goods/shared/hooks/admin-ui/pool/useSeedTray", async (importOriginal) => {
  const actual = await importOriginal<TrayModule>();
  const react = await import("react");
  const { commitmentComposerSchema } = await import(
    "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm"
  );
  const useSeedTray: TrayModule["useSeedTray"] = ({ form, buildCopy }) => {
    const [others, setOthers] = react.useState<SeedTrayRow[]>([]);
    const [copies, setCopies] = react.useState<SeedCopyProgress[] | null>(null);
    const locked = copies?.some((copy) => copy.status === "created") ?? false;
    const readAnswers = async () => {
      const parsed = commitmentComposerSchema.safeParse(form.getValues());
      if (parsed.success) return parsed.data;
      await form.trigger();
      return null;
    };
    const tray: SeedTrayController = {
      others,
      size:
        others.reduce((sum, row) => sum + (row.values.count ?? 1), 0) + (form.watch("count") ?? 1),
      mode: "bundle",
      isSending: false,
      copies,
      pass: copies,
      retryCount: copies?.filter((copy) => copy.status === "not-sent").length ?? 0,
      placedOffers: 0,
      currentLocked: locked,
      isLocked: () => locked,
      restart: () => {
        setOthers([]);
        setCopies(null);
      },
      addAnother: async () => {
        const values = await readAnswers();
        if (!values) return;
        setOthers((rows) => [...rows, { clientCommitmentId: `row-${rows.length}`, values }]);
        form.reset(values, { keepDefaultValues: true });
      },
      edit: async () => undefined,
      remove: () => undefined,
      removeCurrent: () => undefined,
      sendAll: async () => {
        const values = await readAnswers();
        if (!values) return "invalid";
        const dueDate = BigInt(Math.floor(Date.now() / 1000) + values.dueInDays * 86_400);
        const built: BuiltCopy[] = [];
        try {
          for (const [row, answers] of [...others.map((kept) => kept.values), values].entries()) {
            const count = answers.count ?? 1;
            const displayGroup =
              count > 1 ? { version: 1 as const, id: `set-group-${row}` } : undefined;
            for (let index = 0; index < count; index += 1) {
              built.push(
                buildCopy(answers, {
                  clientCommitmentId: `copy-${row}-${index}`,
                  dueDate,
                  ...(displayGroup ? { displayGroup } : {}),
                })
              );
            }
          }
        } catch {
          return "blocked";
        }
        mocks.built.push(...built);
        const declined = mocks.answer === "decline";
        setCopies(
          built.map((copy) => ({
            clientCommitmentId: copy.clientCommitmentId,
            status: declined ? "not-sent" : "created",
            ...(declined ? { miss: "declined" as const } : {}),
            txHash: null,
            jobId: null,
          }))
        );
        return declined ? "left" : "sent";
      },
    };
    return tray;
  };
  return { ...actual, useSeedTray, useSeedTrayRoom: () => mocks.room };
});

vi.mock("@green-goods/shared/hooks/blockchain/useGoodDollarPrice", () => ({
  useGoodDollarPrice: () => ({ state: mocks.price, readNow: mocks.readNow }),
}));

// People are named from their Green Goods or ENS name; no test reaches for either.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: undefined }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: undefined }),
}));

vi.mock("@green-goods/shared/hooks/commitment-pooling/useComposeAgainValues", () => ({
  useComposeAgainValues: () => mocks.again,
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController", () => ({
  usePoolConsoleController: () => mocks.console!,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: (() => ({
    data: mocks.actions,
  })) as unknown as ActionsModule["useActions"],
  // The flow names the pool it seeds into, and offers its people, from the gardens list.
  useGardens: (() => ({
    data: [{ id: GARDEN, name: "Rocinha", stewards: [VIEWER], gardeners: [CONFIRMER] }],
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
        enqueue: vi.fn(),
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
const create = () =>
  fireEvent.click(within(dialog()).getByRole("button", { name: /^create( \d+)? promises?$/i }));

function fillWhat(title = "Market rides") {
  fireEvent.change(within(dialog()).getByLabelText(/^title/i), { target: { value: title } });
}

function fillHowMuch(answers: { count?: string } = {}) {
  if (answers.count) {
    fireEvent.change(within(dialog()).getByRole("textbox", { name: /^promises$/i }), {
      target: { value: answers.count },
    });
  }
  fireEvent.change(within(dialog()).getByLabelText(/^unit/i), { target: { value: "rides" } });
  fireEvent.change(within(dialog()).getByLabelText(/^amount/i), { target: { value: "16" } });
}

/** From the first step to the Proof step, with the answers a promise cannot do without. */
async function toProof(answers: { title?: string; count?: string } = {}) {
  fillWhat(answers.title);
  next();
  await waitFor(() => expect(within(dialog()).getByLabelText(/^unit/i)).toBeInTheDocument());
  fillHowMuch(answers);
  next();
  await waitFor(() => expect(screen.getByTestId("seed-confirmers")).toBeInTheDocument());
}

async function toReview(answers: { title?: string; count?: string } = {}) {
  await toProof(answers);
  next();
  await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
}

describe("SeedCommitmentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protocolRegistered = true;
    mocks.settlementActive = false;
    mocks.again = null;
    mocks.room = null;
    mocks.price = { status: "loading" };
    mocks.readNow.mockResolvedValue({ price: CREATE_PRICE, readAt: Date.now() });
    mocks.actions = [
      { id: "42161-44", title: "Prune trees", startTime: 0, endTime: Date.now() + 60_000 },
    ];
    mocks.console = consoleFor();
    mocks.built = [];
    mocks.answer = "approve";
  });

  it("groups the cycle choice as the one season, then the campaigns, then cycle-less, defaulting to the season", () => {
    renderSeed();
    // Every step names the pool the promises land in.
    expect(within(dialog()).getAllByText("Rocinha’s pool").length).toBeGreaterThan(0);
    const select = within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual([
      expect.stringMatching(/season · season of first rains/i),
      expect.stringMatching(/campaign · market rides/i),
      expect.stringMatching(/no cycle/i),
    ]);
    expect(select.value).toBe("12");
  });

  it("opens on the earlier promise's answers, the steward's extras included, in this pool's season", async () => {
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
    // The season is this pool's own, never the earlier promise's.
    expect((within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement).value).toBe("12");
  });

  it("creates a promise with the steward's answers, and ends on Done", async () => {
    const { onClose } = renderSeed();
    await toProof();
    fireEvent.change(within(dialog()).getByLabelText(/^add a confirmer/i), {
      target: { value: CONFIRMER },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: /^add$/i }));
    // The pilot default: the Green Goods team may step in, and it is on.
    expect(within(dialog()).getByRole("checkbox", { name: /green goods team/i })).toBeChecked();
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    create();

    await waitFor(() => expect(mocks.built).toHaveLength(1));
    expect(mocks.built[0]).toMatchObject({
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
      // commitment, and this flow never seeds one.
      onBehalfOf: ZERO_ADDRESS,
      gardenAddress: GARDEN,
      consideration: { rail: 0, amount: 0n },
    });
    // A single promise joins no group.
    expect(mocks.built[0]?.metadata).not.toHaveProperty("displayGroup");
    await waitFor(() => expect(screen.getByTestId("seed-review")).toHaveTextContent(/created/i));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^done$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("gives every copy of a set the one deadline, the one group, and dollars in G$ at the price read for this Create", async () => {
    mocks.settlementActive = true;
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    renderSeed();
    await toProof({ title: "Household water survey", count: "10" });
    fireEvent.click(within(dialog()).getByRole("radio", { name: /^yes/i }));
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "5.00" },
    });
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    create();

    await waitFor(() => expect(mocks.built).toHaveLength(10));
    // The rate is read again just before Create, and that one fixes every amount.
    expect(mocks.readNow).toHaveBeenCalledTimes(1);
    const expected = (500n * 10n ** 34n) / CREATE_PRICE;
    for (const copy of mocks.built) {
      expect(copy.consideration).toMatchObject({ rail: 2, amount: expected });
      expect(copy.metadata).toMatchObject({ displayGroup: { version: 1, id: "set-group-0" } });
    }
    expect(new Set(mocks.built.map((copy) => copy.dueDate)).size).toBe(1);
    expect(new Set(mocks.built.map((copy) => copy.clientCommitmentId)).size).toBe(10);
  });

  it("holds Create, and says why, while today's G$ price can't be read", async () => {
    mocks.settlementActive = true;
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    const { settleQueries } = renderMounted();
    await toProof();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /^yes/i }));
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "5.00" },
    });
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    mocks.price = { status: "unavailable", reason: "paused" };
    settleQueries();

    expect(within(dialog()).getByRole("button", { name: /^create promise$/i })).toBeDisabled();
    expect(screen.getByTestId("seed-prompt-count")).toHaveTextContent(
      /today's G\$ price can't be read/i
    );
    expect(mocks.built).toEqual([]);
  });

  it("creates no rewarded payload if the fresh reserve read fails after review", async () => {
    mocks.settlementActive = true;
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    renderSeed();
    await toProof();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /^yes/i }));
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "5.00" },
    });
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    mocks.readNow.mockRejectedValueOnce(new Error("reserve read reverted"));
    create();
    await waitFor(() => expect(mocks.readNow).toHaveBeenCalled());
    expect(mocks.built).toEqual([]);
    await waitFor(() => expect(screen.getByTestId("seed-review")).toHaveTextContent(/price/i));
  });

  it("keeps the reward at No until the garden's settlement account is active", async () => {
    renderSeed();
    await toProof();
    expect(within(dialog()).getByRole("radio", { name: /^yes/i })).toBeDisabled();
    expect(within(dialog()).getByText(/settlement account to be active/i)).toBeInTheDocument();
    expect(within(dialog()).queryByLabelText(/^amount for each/i)).not.toBeInTheDocument();
  });

  it("says a broken reward in the steward's language, not in the schema's own words", async () => {
    mocks.settlementActive = true;
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    renderSeed();
    await toProof();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /^yes/i }));
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "0" },
    });
    // The schema says this as a message id; a raw one reaching the DOM is the
    // regression, and only a catalog lookup turns it back into a sentence.
    await waitFor(() =>
      expect(
        within(dialog()).getByText("Enter an amount in dollars above zero, like 5.00.")
      ).toBeInTheDocument()
    );
    expect(dialog().textContent).not.toContain("cockpit.garden.pool.seed.error");
  });

  it("prefills steward review when the pool is the protocol's, and lets the steward gate an offer", async () => {
    // Context comes from the pool itself, never from where the flow was opened.
    mocks.console = consoleFor("PROTOCOL");
    renderSeed();
    // The protocol pool keeps its warning in the body, not only in its defaults.
    expect(
      within(dialog()).getByText("Writing to the Green Goods protocol pool")
    ).toBeInTheDocument();
    await toProof();
    expect(within(dialog()).getByRole("radio", { name: /steward-reviewed/i })).toBeChecked();
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    create();
    await waitFor(() => expect(mocks.built).toHaveLength(1));
    expect(mocks.built[0]?.claimMode).toBe(1);
  });

  it("disables the Green Goods team fallback with a reason when no protocol pool is registered, and stores it off", async () => {
    mocks.protocolRegistered = false;
    renderSeed();
    await toProof();
    const fallback = within(dialog()).getByRole("checkbox", { name: /green goods team/i });
    expect(fallback).toBeDisabled();
    expect(fallback).not.toBeChecked();
    expect(within(dialog()).getByText(/no green goods protocol pool/i)).toBeInTheDocument();
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    create();
    await waitFor(() => expect(mocks.built).toHaveLength(1));
    expect(mocks.built[0]?.protocolFallbackEnabled).toBe(false);
  });

  it("refuses the zero address as a named confirmer, which no threshold could ever reach", async () => {
    renderSeed();
    await toProof();
    const draft = within(dialog()).getByLabelText(/^add a confirmer/i);
    fireEvent.change(draft, { target: { value: ZERO_ADDRESS } });
    fireEvent.click(within(dialog()).getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(
        within(dialog()).getByText("Enter a confirmer's own name or address.")
      ).toBeInTheDocument()
    );
    // Nobody was named: no chip to remove.
    expect(
      within(screen.getByTestId("seed-confirmers")).queryByRole("button", { name: /^remove /i })
    ).not.toBeInTheDocument();
  });

  it("builds nothing when a chosen action closes after the review", async () => {
    renderSeed();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /garden work/i }));
    fillWhat("Prune the trees");
    next();
    await waitFor(() => expect(within(dialog()).getByLabelText(/^amount/i)).toBeInTheDocument());
    fireEvent.change(within(dialog()).getByLabelText(/^amount/i), { target: { value: "2" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Add Action" }));
    fireEvent.change(within(dialog()).getByLabelText("Action"), { target: { value: "44" } });
    next();
    await waitFor(() => expect(screen.getByTestId("seed-confirmers")).toBeInTheDocument());
    next();
    await waitFor(() => expect(screen.getByTestId("seed-review")).toBeInTheDocument());
    mocks.actions[0]!.endTime = Date.now() - 1;
    create();

    await waitFor(() =>
      expect(screen.getByTestId("seed-review")).toHaveTextContent(/nothing was sent/i)
    );
    expect(mocks.built).toEqual([]);
  });

  it("keeps the answers open to change after the wallet declines, and offers Try Again", async () => {
    mocks.answer = "decline";
    renderSeed();
    await toReview();
    create();

    await waitFor(() =>
      expect(screen.getByTestId("seed-review")).toHaveTextContent(/nothing was created/i)
    );
    expect(within(dialog()).getByRole("button", { name: /^try again$/i })).toBeEnabled();
    expect(within(dialog()).getByRole("button", { name: /edit what/i })).toBeEnabled();
  });

  it("adds another like this: back on the first step with the same answers, and Create counts both", async () => {
    renderSeed();
    await toReview({ title: "Market rides" });
    fireEvent.click(within(dialog()).getByRole("button", { name: /add another like this/i }));

    await waitFor(() =>
      expect(within(dialog()).getByLabelText(/^title/i)).toHaveValue("Market rides")
    );
    await toReview({ title: "Clinic rides" });
    expect(within(dialog()).getByRole("button", { name: /^create 2 promises$/i })).toBeEnabled();
    // How many times the wallet will ask sits beside the button that asks.
    expect(screen.getByTestId("seed-prompt-count")).toHaveTextContent(/once, for all 2/i);
  });

  it("holds seeding while the offers are more than the steward may hold open", async () => {
    mocks.room = 0;
    renderSeed();
    await toReview();

    expect(screen.getByTestId("seed-review")).toHaveTextContent(/more than you can hold at once/i);
    expect(within(dialog()).getByRole("button", { name: /^create promise$/i })).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: /add another like this/i })).toBeDisabled();
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
    // answers is how the same promise reaches the queue twice.
    await waitFor(() => expect(within(dialog()).getByLabelText(/^title/i)).toBeInTheDocument());
    expect(within(dialog()).getByLabelText(/^title/i)).toHaveValue("");
    expect(mocks.built).toEqual([]);
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
    await toProof();
    expect(within(dialog()).getByRole("checkbox", { name: /green goods team/i })).toBeChecked();
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
