/**
 * GardenCommitment — the commitment detail screen.
 *
 * Both adversarial rounds found their component-level defects here, in a file
 * nothing mounted. These are the rules the screen is judged against: the act
 * belongs to the seat that can perform it, the sentence is written to the
 * person reading it, and a queued act is not offered twice.
 *
 * @vitest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const mockUseCommitment = vi.fn();
const mockUseOffline = vi.fn();
const mockUseQueueState = vi.fn();
const mockEnqueue = vi.fn();
const mockMutate = vi.fn();
let mockMutationError: unknown = null;

const AVAILABLE = { status: "available", capability: {} } as const;

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    poolId: 7n,
    unitLabel: "hours",
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    metadataCID: null,
    ...overrides,
  };
}

function queueState(overrides: Record<string, unknown> = {}) {
  return {
    pendingCommitmentIds: new Set<string>(),
    failedCount: 0,
    failedCommitmentIds: new Set<string>(),
    hasPendingCreate: false,
    isUnavailable: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    detail: {
      commitment: commitment(overrides.commitment as Record<string, unknown>),
      contributors: (overrides.contributors as unknown[]) ?? [],
      requirements: (overrides.requirements as unknown[]) ?? [],
    },
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    usePrimaryAddress: () => VIEWER,
    useCommitment: () => mockUseCommitment(),
    useCommitmentJobs: () => ({
      enqueue: mockEnqueue,
      isPending: false,
      error: null,
      viewer: VIEWER,
    }),
    useCommitmentMutation: () => ({
      mutate: mockMutate,
      isPending: false,
      error: mockMutationError,
    }),
    useCommitmentQueueState: () => mockUseQueueState(),
    useCommitmentMetadataFor: () => null,
    useActions: () => ({ data: [{ id: "42161-44", title: "Prune the north beds" }] }),
    useOffline: () => mockUseOffline(),
  };
});

const { GardenCommitment } = await import("../../views/Home/Garden/Commitment");

const render = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
      <Routes>
        <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        <Route path="/home/:id/commitments/:commitmentId/proof" element={<p>Proof composer</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("GardenCommitment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationError = null;
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUseQueueState.mockReturnValue(queueState());
    mockUseCommitment.mockReturnValue(detail());
  });

  it("offers the provider their own act and speaks to them", () => {
    render();
    expect(screen.getByText("Keep this moving")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add proof" })).toBeInTheDocument();
  });

  it("opens the proof composer from Add proof instead of leaving the commitment", async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Add proof" }));
    expect(screen.getByText("Proof composer")).toBeInTheDocument();
  });

  it("never offers a provider the confirmation of their own commitment", () => {
    mockUseCommitment.mockReturnValue(
      detail({ commitment: { derivedState: "READY_FOR_CONFIRMATION" } })
    );
    render();

    // The costliest defect the seat axis exists to prevent: they are told their
    // part is done, not asked to confirm work they provided.
    expect(screen.getByText("Waiting on the other person to confirm")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm it was kept" })).not.toBeInTheDocument();
  });

  it("asks the confirmer, and only when it is their turn", () => {
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: {
          derivedState: "READY_FOR_CONFIRMATION",
          creator: OTHER,
          leadProvider: OTHER,
          counterparty: VIEWER,
        },
      })
    );
    render();

    expect(screen.getByText("Ready for you to confirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm it was kept" })).toBeInTheDocument();
  });

  it("gives someone on the team no way to send or confirm", () => {
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: {
          derivedState: "EVIDENCE_SUBMITTED",
          creator: OTHER,
          leadProvider: OTHER,
          counterparty: null,
        },
        contributors: [{ contributor: VIEWER, active: true, isLead: false }],
      })
    );
    render();

    // Their own sentence for this stage, not the lead's: the proof is in and
    // the person leading it decides when to send.
    expect(screen.getByText("The proof is in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send for confirmation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm it was kept" })).not.toBeInTheDocument();
  });

  it("does not offer an act that is already waiting to send, and says so", () => {
    mockUseQueueState.mockReturnValue(queueState({ pendingCommitmentIds: new Set(["9"]) }));
    render();

    expect(screen.queryByRole("button", { name: "Add proof" })).not.toBeInTheDocument();
    expect(screen.getByText(/waiting to send from this phone/i)).toBeInTheDocument();
  });

  it("disables the act rather than offering it when the queue cannot be read", () => {
    // An unreadable queue is not an empty one. Offering the act here is how a
    // claim already waiting to send becomes two claims.
    mockUseQueueState.mockReturnValue(queueState({ isUnavailable: true }));
    render();

    const act = screen.getByRole("button", { name: "Add proof" });
    expect(act).toBeDisabled();
    expect(screen.getByText(/could not check what is waiting to send/i)).toBeInTheDocument();
  });

  it("says when the last send gave up, and offers the act again", () => {
    mockUseQueueState.mockReturnValue(
      queueState({ failedCount: 1, failedCommitmentIds: new Set(["9"]) })
    );
    render();

    expect(screen.getByRole("alert")).toHaveTextContent(/gave up/i);
    expect(screen.getByRole("button", { name: "Add proof" })).toBeEnabled();
  });

  it("queues the act the bar names", async () => {
    const user = userEvent.setup();
    mockUseCommitment.mockReturnValue(
      detail({ commitment: { derivedState: "EVIDENCE_SUBMITTED" } })
    );
    render();

    await user.click(screen.getByRole("button", { name: "Send for confirmation" }));
    expect(mockEnqueue).toHaveBeenCalledWith({
      act: "sendForConfirmation",
      commitmentId: 9n,
      gardenAddress: GARDEN,
    });
  });

  it("queues a confirmation with the garden whose membership gates it", async () => {
    const user = userEvent.setup();
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: {
          derivedState: "READY_FOR_CONFIRMATION",
          creator: OTHER,
          leadProvider: OTHER,
          counterparty: VIEWER,
        },
      })
    );
    render();

    await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
    expect(mockEnqueue).toHaveBeenCalledWith({
      act: "confirm",
      commitmentId: 9n,
      gardenAddress: GARDEN,
    });
  });

  it("claims as the member themselves, scoped to the garden", async () => {
    const user = userEvent.setup();
    mockUseCommitment.mockReturnValue(
      detail({
        commitment: {
          derivedState: "OFFERED",
          creator: OTHER,
          leadProvider: null,
          counterparty: null,
        },
      })
    );
    render();

    await user.click(screen.getByRole("button", { name: "Take this up" }));
    // ClaimType.Individual, and a garden as the context rather than a person.
    expect(mockEnqueue).toHaveBeenCalledWith({
      act: "claim",
      payload: { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
    });
  });

  it("confirms before withdrawing, and says what it costs", async () => {
    const user = userEvent.setup();
    mockUseCommitment.mockReturnValue(detail({ commitment: { derivedState: "OFFERED" } }));
    render();

    await user.click(screen.getByRole("button", { name: "Withdraw this" }));
    expect(screen.getByText("Withdraw this offer?")).toBeInTheDocument();
    expect(screen.getByText(/offering again later is a fresh commitment/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("hands the withdraw reason to the hook as words, never as a CID it made up", async () => {
    const user = userEvent.setup();
    mockUseCommitment.mockReturnValue(detail({ commitment: { derivedState: "OFFERED" } }));
    render();

    await user.click(screen.getByRole("button", { name: "Withdraw this" }));
    await user.type(screen.getByLabelText("Reason (required)"), "Plans changed");
    await user.click(screen.getByRole("button", { name: "Withdraw this offer" }));

    expect(mockMutate).toHaveBeenCalledWith(
      {
        action: "cancelCommitment",
        commitmentId: 9n,
        reason: "Plans changed",
        gardenAddress: GARDEN,
      },
      expect.anything()
    );
    const [input] = mockMutate.mock.calls[0] as [Record<string, unknown>];
    expect(input).not.toHaveProperty("reasonCID");
  });

  it("keeps the dialog open and offers a retry when the reason could not be pinned", async () => {
    const user = userEvent.setup();
    const { CommitmentReasonPinError } = await import("@green-goods/shared");
    mockUseCommitment.mockReturnValue(detail({ commitment: { derivedState: "OFFERED" } }));
    mockMutate.mockImplementation(() => {
      mockMutationError = new CommitmentReasonPinError(new Error("gateway down"));
    });
    const view = render();

    await user.click(screen.getByRole("button", { name: "Withdraw this" }));
    await user.type(screen.getByLabelText("Reason (required)"), "Plans changed");
    await user.click(screen.getByRole("button", { name: "Withdraw this offer" }));
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );

    // Still open, still holding the words, and saying what actually failed.
    expect(screen.getByText("Withdraw this offer?")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason (required)")).toHaveValue("Plans changed");
    expect(screen.getByText(/could not be saved/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says the surface is not ready rather than showing an empty commitment", () => {
    // The real hook never returns a populated detail while unavailable: its
    // query is disabled, so `detail` is null and `isLoading` is false. A
    // fixture that returned both was how the not-found branch hid this.
    mockUseCommitment.mockReturnValue({
      ...detail(),
      detail: null,
      isLoading: false,
      availability: { status: "unavailable", reason: "not-integrated", capability: {} },
    });
    render();

    expect(screen.getByText("Commitments are not ready here yet")).toBeInTheDocument();
    expect(screen.queryByText("Commitment not found")).not.toBeInTheDocument();
  });

  it("offers a way back from a failed read", () => {
    mockUseCommitment.mockReturnValue({ ...detail(), isError: true, detail: null });
    render();

    expect(screen.getByText("Could not open this commitment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("counts each requirement on its own, never as a total", () => {
    mockUseCommitment.mockReturnValue(
      detail({
        requirements: [
          { id: "r0", requirementIndex: 0, actionUID: 44n, requiredCount: 2, approvedCount: 2 },
          { id: "r1", requirementIndex: 1, actionUID: 45n, requiredCount: 4, approvedCount: 1 },
        ],
      })
    );
    render();

    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(screen.queryByText("3 of 6")).not.toBeInTheDocument();
  });

  it("names each requirement by its action, and gives its bar that name", () => {
    mockUseCommitment.mockReturnValue(
      detail({
        requirements: [
          { id: "r0", requirementIndex: 0, actionUID: 44n, requiredCount: 2, approvedCount: 1 },
          { id: "r1", requirementIndex: 1, actionUID: 99n, requiredCount: 1, approvedCount: 0 },
        ],
      })
    );
    render();

    // A known action reads by its title; one the registry cannot name falls
    // back to its position rather than to nothing.
    expect(screen.getByText("Prune the north beds")).toBeInTheDocument();
    expect(screen.getByText("Requirement 2")).toBeInTheDocument();
    const bars = screen.getAllByRole("progressbar");
    expect(bars[0]).toHaveAccessibleName("Prune the north beds");
    expect(bars[1]).toHaveAccessibleName("Requirement 2");
  });

  it("says the commitment's name once, in the screen header", () => {
    render();

    expect(screen.getAllByText("3 hours")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3 hours");
  });
});
