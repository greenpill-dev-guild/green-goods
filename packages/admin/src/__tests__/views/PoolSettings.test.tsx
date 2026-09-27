/**
 * @vitest-environment jsdom
 */

/**
 * Pool settings go through the setup sequence. The planner writes only what
 * changed, the agreement first and pinned before anything is sent; the dialog
 * says how many prompts a save takes, names what a stopped save left saved,
 * and retries only what is left. Which write the chain shows as landed is the
 * sequence's to judge (commitment-pool-setup-sequence.test.tsx).
 */

import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { PoolSetupSequenceState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { poolFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const POOL_ID = 7n;
const AGREEMENT = "Keep the tool library lending.";

type SetupSequenceModule =
  typeof import("@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence");
type SetupSequence = ReturnType<SetupSequenceModule["useCommitmentPoolSetupSequence"]>;

const IDLE: PoolSetupSequenceState = {
  status: "idle",
  steps: [],
  landed: [],
  failedStep: null,
  failure: null,
  error: null,
  cycleId: null,
};

const mocks = vi.hoisted(() => ({
  run: vi.fn<SetupSequence["run"]>(),
  retry: vi.fn<SetupSequence["retry"]>(),
  reset: vi.fn<SetupSequence["reset"]>(),
  state: null as PoolSetupSequenceState | null,
  pinPoolCharter: vi.fn(),
}));

vi.mock(
  "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence",
  async (importOriginal) => ({
    ...(await importOriginal<SetupSequenceModule>()),
    useCommitmentPoolSetupSequence: () => ({
      state: mocks.state,
      run: mocks.run,
      retry: mocks.retry,
      reset: mocks.reset,
      batching: "unavailable",
    }),
  })
);

vi.mock("@green-goods/shared/modules/commitment-pooling/pool-charter", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@green-goods/shared/modules/commitment-pooling/pool-charter")
  >()),
  pinPoolCharter: mocks.pinPoolCharter,
}));

const { planSettingsSteps, settingsActions } = await import("@/views/Garden/Pool/poolSettingsPlan");
const { PoolSettingsDialog } = await import("@/views/Garden/Pool/PoolSettingsDialog");

function controller(overrides: Partial<PoolConsoleController> = {}): PoolConsoleController {
  return poolConsoleControllerFixture({
    chainId: 42161,
    garden: GARDEN,
    pool: poolFixture({ poolId: POOL_ID, garden: GARDEN, providerOpenCommitmentCap: 24n }),
    charter: {
      charter: { version: 1, purpose: AGREEMENT },
      isLoading: false,
      isUnavailable: false,
    },
    refetch: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
}

function renderDialog(console: PoolConsoleController = controller()) {
  const onClose = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/garden/pool",
        element: (
          <PoolSettingsDialog
            open
            console={console}
            target={{ gardenName: "Rocinha", isProtocol: false }}
            onClose={onClose}
          />
        ),
      },
    ],
    { initialEntries: ["/garden/pool"] }
  );
  renderWithProviders(<RouterProvider router={router} />);
  return { onClose, dialog: () => screen.getByRole("dialog", { name: /pool settings/i }) };
}

function stoppedAt(statuses: ["landed" | "failed" | "pending", "landed" | "failed" | "pending"]) {
  return {
    ...IDLE,
    status: "failed" as const,
    steps: [
      { action: "setPoolCharter" as const, status: statuses[0], hash: null, batched: false },
      {
        action: "setProviderOpenCommitmentCap" as const,
        status: statuses[1],
        hash: null,
        batched: false,
      },
    ],
    failure: "send-failed" as const,
  };
}

describe("planSettingsSteps", () => {
  const current = { purpose: AGREEMENT, cap: 24n };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pinPoolCharter.mockResolvedValue("bafy-new-charter");
  });

  it.each([
    { changed: "both", next: { purpose: "Lend all year.", cap: 12n }, pinned: true },
    { changed: "the agreement", next: { purpose: "Lend all year.", cap: 24n }, pinned: true },
    { changed: "the limit", next: { purpose: AGREEMENT, cap: 12n }, pinned: false },
    { changed: "nothing", next: current, pinned: false },
  ])("pins only a changed agreement and plans what $changed needs, as previewed", async ({
    next,
    pinned,
  }) => {
    const steps = await planSettingsSteps({ poolId: POOL_ID, garden: GARDEN, next, current });
    expect(mocks.pinPoolCharter).toHaveBeenCalledTimes(pinned ? 1 : 0);
    const changes = {
      agreement: next.purpose !== current.purpose,
      limit: next.cap !== current.cap,
    };
    expect(steps.map((step) => step.action)).toEqual(settingsActions(changes));
  });

  it("carries the pinned agreement and the new limit into the writes", async () => {
    const steps = await planSettingsSteps({
      poolId: POOL_ID,
      garden: GARDEN,
      next: { purpose: "Lend all year.", cap: 12n },
      current,
    });
    expect(mocks.pinPoolCharter).toHaveBeenCalledWith({
      purpose: "Lend all year.",
      gardenAddress: GARDEN,
    });
    expect(steps).toEqual([
      { action: "setPoolCharter", poolId: POOL_ID, charterCID: "bafy-new-charter" },
      { action: "setProviderOpenCommitmentCap", poolId: POOL_ID, cap: 12n },
    ]);
  });

  it("plans nothing when the agreement cannot be pinned", async () => {
    mocks.pinPoolCharter.mockRejectedValue(new Error("gateway down"));
    await expect(
      planSettingsSteps({
        poolId: POOL_ID,
        garden: GARDEN,
        next: { purpose: "Lend all year.", cap: 12n },
        current,
      })
    ).rejects.toThrow("gateway down");
  });
});

describe("PoolSettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state = IDLE;
    mocks.pinPoolCharter.mockResolvedValue("bafy-new-charter");
    mocks.run.mockResolvedValue({ ...IDLE, status: "complete" });
  });

  it("says how many prompts a save of both settings takes, and sends them agreement first", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/what this pool is for/i), {
      target: { value: "  Lend all year.  " },
    });
    fireEvent.change(screen.getByLabelText(/how many commitments one person/i), {
      target: { value: "12" },
    });
    expect(screen.getByText(/your wallet will ask you twice/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(1));
    expect(mocks.pinPoolCharter).toHaveBeenCalledWith({
      purpose: "Lend all year.",
      gardenAddress: GARDEN,
    });
    expect(mocks.run.mock.calls[0]?.[0].map((step) => step.action)).toEqual([
      "setPoolCharter",
      "setProviderOpenCommitmentCap",
    ]);
  });

  it("keeps the words and sends nothing when the agreement cannot be stored", async () => {
    mocks.pinPoolCharter.mockRejectedValue(new Error("gateway down"));
    renderDialog();
    fireEvent.change(screen.getByLabelText(/what this pool is for/i), {
      target: { value: "Lend all year." },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    expect(await screen.findByText(/the agreement could not be stored/i)).toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/what this pool is for/i)).toHaveValue("Lend all year.");
  });

  it("loads an older agreement past the limit in full, and writes it again only once it fits", () => {
    const older = "x".repeat(1500);
    renderDialog(
      controller({
        charter: {
          charter: { version: 1, purpose: older },
          isLoading: false,
          isUnavailable: false,
        },
      })
    );
    const agreement = screen.getByLabelText(/what this pool is for/i);
    const save = screen.getByRole("button", { name: /save settings/i });
    expect(agreement).toHaveValue(older);
    expect(screen.getByText("1,500 / 420")).toBeInTheDocument();
    // The field says why, not only the red count.
    expect(agreement).toHaveAttribute("aria-invalid", "true");
    expect(agreement).toHaveAccessibleDescription(/shorten this to 420 characters or fewer/i);

    // Only the limit changes, so the older agreement is not written again.
    fireEvent.change(screen.getByLabelText(/how many commitments one person/i), {
      target: { value: "12" },
    });
    expect(save).toBeEnabled();

    fireEvent.change(agreement, { target: { value: "x".repeat(1499) } });
    expect(save).toBeDisabled();
    fireEvent.change(agreement, { target: { value: "x".repeat(420) } });
    expect(save).toBeEnabled();
  });

  it("names what a stopped save left saved, and retries only what is left", async () => {
    mocks.state = stoppedAt(["landed", "failed"]);
    mocks.retry.mockResolvedValue({ ...IDLE, status: "complete" });
    const { dialog } = renderDialog();

    const progress = within(dialog()).getByTestId("pool-settings-progress");
    expect(progress).toHaveTextContent("The new agreement is saved. The commitment limit is not.");
    expect(progress).toHaveTextContent("Your wallet will ask once more.");
    expect(
      within(progress)
        .getAllByRole("listitem")
        .map((row) => row.getAttribute("data-status"))
    ).toEqual(["landed", "failed"]);

    fireEvent.click(within(dialog()).getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledTimes(1));
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("says nothing was saved when the first write stopped, and a retry asks for both", () => {
    mocks.state = stoppedAt(["failed", "pending"]);
    const { dialog } = renderDialog();
    const progress = within(dialog()).getByTestId("pool-settings-progress");
    expect(progress).toHaveTextContent("Nothing was saved. The pool keeps the settings it had.");
    expect(progress).toHaveTextContent("Your wallet will ask 2 more times.");
  });

  it("ends on a done state the steward closes", () => {
    mocks.state = {
      ...stoppedAt(["landed", "landed"]),
      status: "complete",
      failure: null,
    };
    const { dialog, onClose } = renderDialog();
    expect(within(dialog()).getByText("Settings saved.")).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: /^done$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
