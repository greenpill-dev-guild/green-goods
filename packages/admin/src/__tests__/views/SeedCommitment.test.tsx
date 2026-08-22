/**
 * @vitest-environment jsdom
 */

import { selectPoolConsoleModel } from "@green-goods/shared";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const CONFIRMER = "0x2222222222222222222222222222222222222222" as const;
const NOW = 1_756_000_000n;

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  protocolRegistered: true,
  settlementActive: false,
  console: {} as Record<string, unknown>,
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    usePoolConsoleController: () => mocks.console,
    useProtocolPool: () => ({
      poolId: mocks.protocolRegistered ? 1n : null,
      rootGarden: "0xcccccccccccccccccccccccccccccccccccccccc",
      isRegistered: mocks.protocolRegistered,
      isLoading: false,
    }),
    useSettlementAccount: () => ({
      detail: mocks.settlementActive
        ? { account: { active: true }, route: null }
        : { account: null, route: null },
      isLoading: false,
    }),
    useActions: () => ({ data: [{ id: "42161-44", title: "Prune trees" }] }),
    useCommitmentJobs: () => ({
      enqueue: mocks.enqueue,
      isPending: false,
      error: null,
      viewer: VIEWER,
    }),
    useMediaQuery: () => true,
  };
});

const { SeedCommitmentDialog } = await import("@/views/Garden/Pool/Seed");

function cycle(overrides: Record<string, unknown> = {}) {
  return {
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
  };
}

function consoleFor() {
  const pool = {
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
  };
  const cycles = [
    cycle(),
    cycle({ id: "42161-13", cycleId: 13n, cycleType: "CAMPAIGN", metadataCID: "bafy-13" }),
  ];
  return {
    chainId: 42161,
    garden: GARDEN,
    viewer: VIEWER,
    isOnline: true,
    availability: { status: "available" },
    pool,
    poolId: 7n,
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
    acts: {},
    isActing: false,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    model: selectPoolConsoleModel({
      pool: pool as never,
      cycles: cycles as never,
      commitments: [],
      pendingClaimCount: 0,
      now: NOW,
    }),
  };
}

function renderSeed(props: { protocolContext?: boolean } = {}) {
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
            protocolContext={props.protocolContext}
          />
        ),
      },
    ],
    { initialEntries: ["/garden/pool/seed"] }
  );
  renderWithProviders(<RouterProvider router={router} />);
  return { onClose };
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

describe("SeedCommitmentDialog (W8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protocolRegistered = true;
    mocks.settlementActive = false;
    mocks.console = consoleFor();
    mocks.enqueue.mockResolvedValue("job-1");
  });

  it("groups the cycle choice as the one season, then the campaigns, then cycle-less, defaulting to the season", () => {
    renderSeed();
    const select = within(dialog()).getByLabelText(/^cycle/i) as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual([
      expect.stringMatching(/season · season of first rains/i),
      expect.stringMatching(/campaign · market rides/i),
      expect.stringMatching(/no cycle/i),
    ]);
    expect(select.value).toBe("12");
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
    const input = mocks.enqueue.mock.calls[0]?.[0] as {
      act: string;
      payload: Record<string, unknown>;
    };
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
      onBehalfOf: VIEWER,
      gardenAddress: GARDEN,
      consideration: { rail: 0, amount: 0n },
    });
    expect((input.payload.metadata as { title: string }).title).toBe("Market rides");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("prefills steward review in protocol context and lets the steward gate an offer", async () => {
    renderSeed({ protocolContext: true });
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
    const input = mocks.enqueue.mock.calls[0]?.[0] as { payload: Record<string, unknown> };
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
    const input = mocks.enqueue.mock.calls[0]?.[0] as { payload: Record<string, unknown> };
    expect(input.payload.protocolFallbackEnabled).toBe(false);
  });
});
