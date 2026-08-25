/**
 * @vitest-environment jsdom
 */

import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  cycleFixture,
  poolFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { PoolSetupSequenceState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { PoolDocumentPinError } from "@green-goods/shared/modules/commitment-pooling/pool-charter";
import { selectPoolConsoleModel } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { PoolSetupStep } from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
} from "@green-goods/shared/modules/commitment-pooling/types-core";

import { useState } from "react";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEPS_BY_INTENT, type StepId } from "@/views/Garden/Pool/SetupFlow/setupFlowModel";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

type PoolingModule = typeof import("@green-goods/shared/commitment-pooling");
type SetupSequence = ReturnType<PoolingModule["useCommitmentPoolSetupSequence"]>;

const mocks = vi.hoisted(() => ({
  run: vi.fn<SetupSequence["run"]>(),
  retry: vi.fn<SetupSequence["retry"]>(),
  reset: vi.fn<SetupSequence["reset"]>(),
  state: {
    status: "idle",
    steps: [],
    landed: [],
    failedStep: null,
    failure: null,
    error: null,
    cycleId: null,
  } as PoolSetupSequenceState,
  pinPoolCharter: vi.fn(),
  pinCycleMetadata: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/ui/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock(
  "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence")
      >();
    return {
      ...actual,
      useCommitmentPoolSetupSequence: () => ({
        state: mocks.state,
        run: mocks.run,
        retry: mocks.retry,
        reset: mocks.reset,
      }),
    };
  }
);

vi.mock("@green-goods/shared/modules/commitment-pooling/cycle-metadata", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@green-goods/shared/modules/commitment-pooling/cycle-metadata")
    >();
  return {
    ...actual,
    pinCycleMetadata: mocks.pinCycleMetadata,
  };
});

vi.mock("@green-goods/shared/modules/commitment-pooling/pool-charter", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@green-goods/shared/modules/commitment-pooling/pool-charter")
    >();
  return {
    ...actual,
    pinPoolCharter: mocks.pinPoolCharter,
  };
});

const { PoolSetupFlow } = await import("@/views/Garden/Pool/SetupFlow");

const BASE_POOL: CommitmentPoolRecord = poolFixture({
  id: "42161-7",
  chainId: 42161,
  poolId: 7n,
  registrationSeen: true,
  garden: GARDEN,
  gardenId: GARDEN,
  poolType: "GARDEN",
  state: "NOT_READY",
  charterCID: null,
  pauseReasonCID: null,
  pauseReasonBlockNumber: null,
  openSeasonCycleId: null,
  openSeasonCycleEntityId: null,
  openCampaignIds: [],
  openCampaignEntityIds: [],
  providerOpenCommitmentCap: 0n,
  liveCommitmentCount: 0n,
  nonTerminalCycleCount: 0n,
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
  createdAt: 1_700_000_000,
  updatedAt: 1_700_000_100,
});

type ControllerOverrides = Omit<Partial<PoolConsoleController>, "pool" | "poolId"> & {
  pool?: CommitmentPoolRecord | null;
  poolId?: bigint;
};

function controller(overrides: ControllerOverrides = {}): PoolConsoleController {
  const pool = overrides.pool === undefined ? BASE_POOL : overrides.pool;
  const cycles = overrides.cycles ?? [];
  const commitments = overrides.commitments ?? [];
  return poolConsoleControllerFixture({
    chainId: 42161,
    garden: GARDEN,
    viewer: "0x1111111111111111111111111111111111111111",
    pool,
    poolId: pool?.poolId,
    cycles,
    commitments,
    refetch: vi.fn().mockResolvedValue([]),
    ...overrides,
    model:
      overrides.model ??
      selectPoolConsoleModel({
        pool,
        cycles,
        commitments,
        pendingClaimCount: overrides.claims?.length ?? 0,
        now: 1_756_000_000n,
      }),
  });
}

function renderFlow(
  props: {
    intent?: keyof typeof STEPS_BY_INTENT;
    console?: PoolConsoleController;
    cycle?: CommitmentCycleRecord;
  } = {}
) {
  const onClose = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/garden/pool",
        element: (
          <PoolSetupFlow
            open
            intent={props.intent ?? "first-run"}
            cycle={props.cycle}
            console={props.console ?? controller()}
            onClose={onClose}
          />
        ),
      },
    ],
    { initialEntries: ["/garden/pool"] }
  );
  const rendered = renderWithProviders(<RouterProvider router={router} />);
  return { onClose, ...rendered };
}

function renderRoutedFlow() {
  function RoutedFlow() {
    const navigate = useNavigate();
    return (
      <PoolSetupFlow
        open
        intent="first-run"
        console={controller()}
        onClose={() => navigate("/hub")}
      />
    );
  }

  const router = createMemoryRouter(
    [
      { path: "/garden/pool", element: <RoutedFlow /> },
      { path: "/hub", element: <p>Hub workspace</p> },
    ],
    { initialEntries: ["/garden/pool"] }
  );
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

function dialog() {
  return screen.getByRole("dialog");
}

function next() {
  fireEvent.click(within(dialog()).getByRole("button", { name: /^next$/i }));
}

async function fillHow() {
  fireEvent.change(within(dialog()).getByLabelText(/what this pool is for/i), {
    target: { value: "Neighbourly help in Rocinha" },
  });
  const capField = within(dialog()).getByLabelText(/how many commitments/i);
  fireEvent.change(capField, { target: { value: "24" } });
}

function assertStep(step: StepId) {
  if (step === "how") {
    expect(within(dialog()).getByLabelText(/what this pool is for/i)).toBeInTheDocument();
  } else if (step === "cycle") {
    expect(within(dialog()).getByLabelText(/^name/i)).toBeInTheDocument();
  } else if (step === "split") {
    expect(within(dialog()).getByText(/total: 100 %/i)).toBeInTheDocument();
  } else {
    expect(within(dialog()).getByRole("button", { name: /^open/i })).toBeInTheDocument();
  }
}

function makePreparedCycle(type: "SEASON" | "CAMPAIGN") {
  return cycleFixture({
    id: `42161-${type.toLowerCase()}`,
    cycleId: type === "SEASON" ? 50n : 51n,
    poolId: 7n,
    cycleType: type,
    state: "SEEDED",
    startTime: 1n,
    endTime: 2n,
    metadataCID: `bafy-${type.toLowerCase()}`,
  });
}

function fillCycle() {
  fireEvent.change(within(dialog()).getByLabelText(/^name/i), {
    target: { value: "Season of First Rains" },
  });
  fireEvent.change(within(dialog()).getByLabelText(/^starts/i), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(within(dialog()).getByLabelText(/runs through/i), {
    target: { value: "2026-09-30" },
  });
}

describe("PoolSetupFlow (W11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state = {
      status: "idle",
      steps: [],
      landed: [],
      failedStep: null,
      failure: null,
      error: null,
      cycleId: null,
    };
    mocks.pinPoolCharter.mockResolvedValue("bafy-charter");
    mocks.pinCycleMetadata.mockResolvedValue("bafy-season");
    mocks.run.mockResolvedValue({
      status: "complete",
      landed: [],
      failedStep: null,
      failure: null,
      error: null,
      cycleId: 40n,
    });
  });

  it.each(
    Object.entries(STEPS_BY_INTENT)
  )("composes the declared %s steps in order", async (intent, steps) => {
    const cycle =
      intent === "open-season"
        ? makePreparedCycle("SEASON")
        : intent === "open-campaign"
          ? makePreparedCycle("CAMPAIGN")
          : undefined;
    renderFlow({ intent: intent as keyof typeof STEPS_BY_INTENT, cycle });

    for (const [index, step] of steps.entries()) {
      assertStep(step as StepId);
      if (step === "how") await fillHow();
      if (step === "cycle") fillCycle();
      if (index < steps.length - 1) next();
    }
  });

  it.each([
    ["cycle", "The name could not be stored", mocks.pinCycleMetadata],
    ["charter", "The agreement could not be stored", mocks.pinPoolCharter],
  ] as const)("keeps the form open when the %s pin fails", async (document, message, pin) => {
    pin.mockRejectedValueOnce(new PoolDocumentPinError(document, new Error("offline")));
    renderFlow();
    await fillHow();
    next();
    fillCycle();
    next();
    next();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^open season$/i }));

    expect(await within(dialog()).findByText(new RegExp(message, "i"))).toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
    expect(dialog()).toBeInTheDocument();
  });

  it("closes pristine state without a discard prompt", async () => {
    const router = renderRoutedFlow();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/hub"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps editing or discards after a dirty close request", async () => {
    const router = renderRoutedFlow();
    await fillHow();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^cancel$/i }));
    const discardDialog = await screen.findByRole("alertdialog");
    expect(router.state.location.pathname).toBe("/garden/pool");
    fireEvent.click(within(discardDialog).getByRole("button", { name: /keep editing/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    fireEvent.click(within(dialog()).getByRole("button", { name: /^cancel$/i }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /discard/i })
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/hub"));
  });

  it("keeps Continue disabled while the split does not total 100 %", async () => {
    renderFlow();
    await fillHow();
    next();
    fillCycle();
    next();
    expect(within(dialog()).getByText(/total: 100 %/i)).toBeInTheDocument();
    const gardeners = within(dialog()).getByLabelText(/^gardeners/i);
    fireEvent.change(gardeners, { target: { value: "64" } });
    expect(within(dialog()).getByRole("alert")).toHaveTextContent(/exactly 100 %/i);
    expect(within(dialog()).getByRole("button", { name: /^next$/i })).toBeDisabled();
    fireEvent.change(gardeners, { target: { value: "60" } });
    expect(within(dialog()).getByRole("button", { name: /^next$/i })).toBeEnabled();
  });

  it("submits the six first-run writes in order, pinning the charter and the season name first", async () => {
    const pool = controller();
    const { onClose } = renderFlow({ console: pool });
    await fillHow();
    next();
    fillCycle();
    next();
    next();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^open season$/i }));

    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    expect(mocks.pinPoolCharter).toHaveBeenCalledWith({
      purpose: "Neighbourly help in Rocinha",
      gardenAddress: GARDEN,
    });
    expect(mocks.pinCycleMetadata).toHaveBeenCalledWith({
      name: "Season of First Rains",
      gardenAddress: GARDEN,
    });
    const steps = mocks.run.mock.calls[0]?.[0] as PoolSetupStep[];
    expect(steps.map((step) => step.action)).toEqual([
      "setPoolCharter",
      "setProviderOpenCommitmentCap",
      "markPoolReady",
      "seedCycle",
      "openPool",
      "openCycle",
    ]);
    expect(steps[0]).toMatchObject({ poolId: 7n, charterCID: "bafy-charter" });
    expect(steps[1]).toMatchObject({ cap: 24n });
    expect(steps[3]).toMatchObject({
      cycle: { cycleType: "SEASON", metadataCID: "bafy-season" },
      refuseIfPoolHasLiveCycle: true,
    });
    expect(steps[5]).toMatchObject({
      cycleId: "seeded",
      allocation: {
        gardeners: 6000,
        treasury: 1500,
        steward: 1000,
        evaluator: 500,
        community: 500,
        funder: 500,
      },
      recognitionPolicy: { equalParticipationBps: 2000, verifiedContributionBps: 8000 },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(pool.refetch).toHaveBeenCalled();
  });

  it("names what landed when a step fails, and the retry repeats only the unlanded call", async () => {
    mocks.run.mockImplementation(async () => {
      mocks.state = {
        ...mocks.state,
        status: "failed",
        landed: [
          "setPoolCharter",
          "setProviderOpenCommitmentCap",
          "markPoolReady",
          "seedCycle",
          "openPool",
        ],
        failedStep: "openCycle",
        failure: "send-failed",
        error: new Error("reverted"),
        cycleId: 40n,
      };
      return {
        status: "failed",
        landed: mocks.state.landed,
        failedStep: "openCycle",
        failure: "send-failed",
        error: null,
        cycleId: 40n,
      };
    });
    mocks.retry.mockResolvedValue({
      status: "complete",
      landed: [],
      failedStep: null,
      failure: null,
      error: null,
      cycleId: 40n,
    });
    const { onClose } = renderFlow();
    await fillHow();
    next();
    fillCycle();
    next();
    next();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^open season$/i }));

    // The mocked hook's state is read on the next render; a rerender follows the run's resolution.
    await waitFor(() => expect(screen.getByTestId("pool-setup-failed")).toBeInTheDocument());
    expect(screen.getByTestId("pool-setup-landed")).toHaveTextContent(
      /agreement written · commitment limit set · pool marked ready · season prepared · pool opened/i
    );
    expect(screen.getByTestId("pool-setup-failed-step")).toHaveTextContent(
      /season opened with its split/i
    );
    expect(
      within(dialog()).getByText(/retrying repeats only the unlanded step/i)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledTimes(1));
    expect(mocks.run).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("starts every fresh open from today, so a discarded date range never comes back", () => {
    const pool = controller();
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>
            toggle flow
          </button>
          <PoolSetupFlow
            open={open}
            intent="campaign"
            console={pool}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    const router = createMemoryRouter([{ path: "/garden/pool", element: <Harness /> }], {
      initialEntries: ["/garden/pool"],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const startField = () => within(dialog()).getByLabelText(/^starts/i) as HTMLInputElement;
    const endField = () => within(dialog()).getByLabelText(/runs through/i) as HTMLInputElement;
    const toggle = () => screen.getByRole("button", { name: /toggle flow/i, hidden: true });
    const today = new Date().toISOString().slice(0, 10);
    expect(startField().value).toBe(today);

    // A steward names the campaign, moves the range, then thinks better of it.
    fillCycle();
    expect(startField().value).toBe("2026-09-01");

    // Cancel closes the flow; PoolDialogs keeps it mounted on `open={flow !== null}`.
    fireEvent.click(within(dialog()).getByRole("button", { name: /^cancel$/i }));
    fireEvent.click(toggle());

    // Nothing unmounted, so the fresh-open reset is the only thing that clears it.
    expect(startField().value).toBe(today);
    expect(endField().value).not.toBe("2026-09-30");
    expect((within(dialog()).getByLabelText(/^name/i) as HTMLInputElement).value).toBe("");
  });

  it("blocks a second season and names the running one", () => {
    const running = controller({
      pool: {
        ...BASE_POOL,
        state: "OPEN",
        charterCID: "bafy-charter",
        providerOpenCommitmentCap: 24n,
        openSeasonCycleId: 12n,
        nonTerminalCycleCount: 1n,
      },
      cycles: [
        cycleFixture({
          id: "42161-12",
          cycleId: 12n,
          poolId: 7n,
          cycleType: "SEASON",
          state: "OPEN",
          startTime: 1n,
          endTime: 2n,
          metadataCID: "bafy-season",
        }),
      ],
      cycleNames: new Map([["12", { status: "resolved", name: "Season of First Rains" }]]),
    });
    renderFlow({ intent: "season", console: running });
    fillCycle();
    expect(within(dialog()).getByText(/season of first rains.*still running/i)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /^next$/i })).toBeDisabled();
  });

  it("seeds and opens a campaign on an open pool with two writes", async () => {
    const open = controller({
      pool: {
        ...BASE_POOL,
        state: "OPEN",
        charterCID: "bafy-charter",
        providerOpenCommitmentCap: 24n,
      },
    });
    renderFlow({ intent: "campaign", console: open });
    fillCycle();
    next();
    next();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^open campaign$/i }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    const steps = mocks.run.mock.calls[0]?.[0] as PoolSetupStep[];
    expect(steps.map((step) => step.action)).toEqual(["seedCycle", "openCycle"]);
    expect(steps[0]).toMatchObject({ cycle: { cycleType: "CAMPAIGN" } });
    expect(mocks.pinPoolCharter).not.toHaveBeenCalled();
  });
});
