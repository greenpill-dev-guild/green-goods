/**
 * @vitest-environment jsdom
 */

import type {
  ConfirmQueueRow,
  HubConfirmQueueController,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  commitmentFixture,
  toConfirmFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { hubConfirmQueueControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const ROOT = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
const MARIA = "0x1111111111111111111111111111111111111111" as const;

const mocks = vi.hoisted(() => ({
  queue: null as HubConfirmQueueController | null,
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/useHubConfirmQueueController", () => ({
  useHubConfirmQueueController: () => mocks.queue!,
}));

vi.mock("@/views/Garden/Pool/CommitmentDialog", () => ({
  CommitmentDialogPanel: ({ commitmentId, garden }: { commitmentId: string; garden: string }) => (
    <div data-testid="commitment-panel">
      {commitmentId}:{garden}
    </div>
  ),
}));

vi.mock("@/components/AdminReasonDialog", () => ({
  AdminReasonDialog: ({
    isOpen,
    title,
    confirmLabel,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    confirmLabel: string;
    onConfirm: (reason: string) => void | Promise<void>;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={() => void onConfirm("not yet, the beds are half pruned")}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const { HubConfirmQueue } = await import("@/views/Hub/components/HubConfirmQueue");

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "READY_FOR_CONFIRMATION",
    derivedState: "READY_FOR_CONFIRMATION",
    state: "READY_FOR_CONFIRMATION",
    approvedUnits: 0n,
    evidenceCount: 2,
    cycleId: 12n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 6n,
    unitLabel: "hours",
    direction: "OFFER",
    creator: MARIA,
    leadProvider: MARIA,
    confirmers: [],
    confirmationThreshold: 2,
    confirmationCount: 1,
    contributorCount: 1,
    contributorsFrozen: true,
    metadataCID: "bafy-9",
    ...overrides,
  });
}

function row(overrides: Partial<ConfirmQueueRow> = {}): ConfirmQueueRow {
  return {
    commitment: commitment(),
    garden: GARDEN_A,
    gardenName: "Rocinha",
    eligibility: "ORDINARY",
    title: "Prune the north beds",
    ...overrides,
  };
}

function queue(overrides: Partial<HubConfirmQueueController> = {}): HubConfirmQueueController {
  return hubConfirmQueueControllerFixture({
    rows: [],
    acts: {
      confirm: vi.fn().mockResolvedValue("job"),
      notYet: vi.fn().mockResolvedValue("0x1"),
    },
    ...overrides,
  });
}

const refetchToConfirm = vi.fn();
const toConfirm = toConfirmFixture({
  groups: [],
  fallback: [],
  disputed: [],
  count: 0,
  isSteward: true,
  isProtocolSteward: false,
  isLoading: false,
  isError: false,
  refetch: refetchToConfirm,
});

function renderQueue(props: Partial<Parameters<typeof HubConfirmQueue>[0]> = {}) {
  const onOpen = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <HubConfirmQueue
      toConfirm={toConfirm}
      chainId={42161}
      normalizedSearch=""
      selectedCommitmentId={undefined}
      onOpenCommitment={onOpen}
      onCloseCommitment={onClose}
      {...props}
    />
  );
  return { onOpen, onClose };
}

describe("HubConfirmQueue (W13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue = queue();
  });

  it("renders loading and read-error casts that never read as an empty queue", () => {
    mocks.queue = queue({ isLoading: true });
    renderQueue();
    expect(screen.queryByText(/nothing to confirm/i)).not.toBeInTheDocument();
    cleanup();

    mocks.queue = queue({ isError: true });
    renderQueue();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be read/i);
    expect(screen.queryByText(/nothing to confirm/i)).not.toBeInTheDocument();
  });

  it("renders the empty stage when nothing waits", () => {
    renderQueue();
    expect(screen.getByText(/nothing to confirm/i)).toBeInTheDocument();
  });

  it("shows who committed, the title, the garden, the progress and the eligibility, and confirms an ordinary row through the queue", async () => {
    mocks.queue = queue({ rows: [row()] });
    renderQueue();
    const item = screen.getByTestId("hub-confirm-9");
    expect(within(item).getByText("Prune the north beds")).toBeInTheDocument();
    expect(within(item).getByText(/rocinha/i)).toBeInTheDocument();
    expect(within(item).getByText(/1 of 2 confirmed/i)).toBeInTheDocument();
    expect(within(item).getByText(/^ordinary$/i)).toBeInTheDocument();
    fireEvent.click(within(item).getByRole("button", { name: /^confirm$/i }));
    const acts = mocks.queue!.acts;
    await waitFor(() =>
      expect(acts.confirm).toHaveBeenCalledWith(expect.objectContaining({ garden: GARDEN_A }))
    );
  });

  it("labels a garden fallback row and a Green Goods team fallback row, and opens the dialog instead of confirming in place", () => {
    mocks.queue = queue({
      rows: [
        row({ eligibility: "POOL_FALLBACK" }),
        row({
          commitment: commitment({
            id: "42161-11",
            commitmentId: 11n,
            protocolFallbackEnabled: true,
          }),
          garden: ROOT,
          gardenName: "Green Goods",
          eligibility: "PROTOCOL_FALLBACK",
          title: "Survey the wetland",
        }),
      ],
    });
    const { onOpen } = renderQueue();
    expect(
      within(screen.getByTestId("hub-confirm-9")).getByText(/garden fallback/i)
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("hub-confirm-11")).getByText(/green goods team fallback/i)
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId("hub-confirm-9")).getByRole("button", { name: /^confirm…$/i })
    );
    expect(onOpen).toHaveBeenCalledWith("9");
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
  });

  it("raises a reasoned dispute from Not yet", async () => {
    mocks.queue = queue({ rows: [row()] });
    renderQueue();
    fireEvent.click(
      within(screen.getByTestId("hub-confirm-9")).getByRole("button", { name: /not yet/i })
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /raise a dispute/i })).getByRole("button", {
        name: /raise dispute/i,
      })
    );
    const acts = mocks.queue!.acts;
    await waitFor(() =>
      expect(acts.notYet).toHaveBeenCalledWith(
        expect.objectContaining({ garden: GARDEN_A }),
        "not yet, the beds are half pruned"
      )
    );
  });

  it("carries Resolve instead of Confirm on a disputed row", () => {
    mocks.queue = queue({
      rows: [
        row({
          commitment: commitment({
            onchainState: "DISPUTED",
            derivedState: "DISPUTED",
            state: "DISPUTED",
          }),
        }),
      ],
    });
    const { onOpen } = renderQueue();
    const item = screen.getByTestId("hub-confirm-9");
    expect(within(item).queryByRole("button", { name: /^confirm/i })).not.toBeInTheDocument();
    fireEvent.click(within(item).getByRole("button", { name: /resolve/i }));
    expect(onOpen).toHaveBeenCalledWith("9");
  });

  it("opens the commitment dialog for the routed id with the row's garden authority", () => {
    mocks.queue = queue({ rows: [row({ eligibility: "POOL_FALLBACK" })] });
    renderQueue({ selectedCommitmentId: "9" });
    expect(screen.getByTestId("commitment-panel")).toHaveTextContent(`9:${GARDEN_A}`);
  });

  it("inspects a commitment through the garden that owns its pool, not the one confirming", () => {
    // A Green Goods team fallback confirms with the protocol garden's Hat while
    // the record lives in Rocinha's pool. Handing the inspector the protocol
    // garden would read the wrong pool and seat the reader as a local steward.
    mocks.queue = queue({
      rows: [row({ eligibility: "PROTOCOL_FALLBACK", garden: ROOT, poolGarden: GARDEN_A })],
    });
    renderQueue({ selectedCommitmentId: "9" });
    expect(screen.getByTestId("commitment-panel")).toHaveTextContent(`9:${GARDEN_A}`);
  });

  it("offers Not yet only where the pool's own steward authority makes it legal", () => {
    // TerminalLib.raiseDispute admits the pool garden's steward, never a
    // protocol steward reaching into someone else's pool.
    mocks.queue = queue({
      rows: [
        row({ canDispute: true }),
        row({
          commitment: commitment({ id: "42161-11", commitmentId: 11n }),
          eligibility: "PROTOCOL_FALLBACK",
          garden: ROOT,
          poolGarden: GARDEN_A,
          canDispute: false,
        }),
      ],
    });
    renderQueue();
    expect(
      within(screen.getByTestId("hub-confirm-9")).getByRole("button", { name: /not yet/i })
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("hub-confirm-11")).queryByRole("button", { name: /not yet/i })
    ).not.toBeInTheDocument();
  });

  it("retries the confirmation reads from the read-error cast", () => {
    mocks.queue = queue({ isError: true });
    renderQueue();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchToConfirm).toHaveBeenCalled();
  });
});
