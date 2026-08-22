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
const mockUseWorks = vi.fn();
const mockUseClaimRequests = vi.fn();
const mockUsePool = vi.fn();
const mockUseHasRole = vi.fn();
const mockUseReason = vi.fn();
const WORK = `0x${"ab".repeat(32)}` as const;
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
    commitmentType: "DOMAIN_IMPACT",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    metadataCID: null,
    ...overrides,
  };
}

function work(overrides: Record<string, unknown> = {}) {
  return {
    id: WORK,
    title: "Pruned the beds",
    actionUID: 44,
    gardenerAddress: VIEWER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "",
    media: [],
    createdAt: 1_700_000_000_000,
    status: "approved",
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
    // Every collection the real reader returns, so a view that reads one the
    // fixture forgot fails here rather than in a garden.
    detail: {
      commitment: commitment(overrides.commitment as Record<string, unknown>),
      contributors: (overrides.contributors as unknown[]) ?? [],
      requirements: (overrides.requirements as unknown[]) ?? [],
      assignments: [],
      workAttributions: (overrides.workAttributions as unknown[]) ?? [],
      evidenceAttributions: [],
      claimRequests: [],
      counterpartCommitments: [],
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
    useActions: () => ({
      data: [
        { id: "42161-44", title: "Prune the north beds" },
        { id: "42161-45", title: "Plant the starts" },
      ],
    }),
    useWorks: () => mockUseWorks(),
    useCommitmentClaimRequests: () => mockUseClaimRequests(),
    useCommitmentPool: () => mockUsePool(),
    useHasRole: (...args: unknown[]) => mockUseHasRole(...args),
    useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha Community Garden" }] }),
    useCommitmentReason: (cid: string | null) => mockUseReason(cid),
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
        <Route path="/home/:id/work/:workId" element={<p>Work detail</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("GardenCommitment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockMutationError = null;
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUseQueueState.mockReturnValue(queueState());
    mockUseCommitment.mockReturnValue(detail());
    mockUseWorks.mockReturnValue({ works: [] });
    mockUseClaimRequests.mockReturnValue({ claimRequests: [] });
    mockUsePool.mockReturnValue({ pool: { poolId: 7n, poolType: "GARDEN" } });
    mockUseHasRole.mockReturnValue({ hasRole: false, isLoading: false });
    mockUseReason.mockReturnValue({ reason: null, isLoading: false, isUnavailable: false });
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

  describe("claims", () => {
    const browse = (overrides: Record<string, unknown> = {}) =>
      detail({
        commitment: {
          derivedState: "OFFERED",
          onchainState: "OFFERED",
          creator: OTHER,
          leadProvider: null,
          counterparty: null,
          claimMode: "APPROVAL_GATED",
          ...overrides,
        },
      });
    const request = (overrides: Record<string, unknown> = {}) => ({
      id: "42161-9-claim",
      chainId: 42161,
      commitmentId: 9n,
      claimant: VIEWER,
      requestSeen: true,
      requestedBy: VIEWER,
      claimType: "INDIVIDUAL",
      gardenContext: GARDEN,
      state: "PENDING",
      reasonCID: null,
      resolutionCode: null,
      requestedAt: 1_700_000_000,
      resolvedAt: null,
      updatedAt: 1_700_000_000,
      ...overrides,
    });

    it("shows a pending request waiting on a steward, and stops offering the act again", () => {
      mockUseCommitment.mockReturnValue(browse());
      mockUseClaimRequests.mockReturnValue({ claimRequests: [request()] });
      render();

      expect(screen.getByText("Waiting for a steward")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ask to take this up" })).not.toBeInTheDocument();
    });

    it("shows the steward's reason for a decline and offers a fresh request, never a retry", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(browse());
      mockUseClaimRequests.mockReturnValue({
        claimRequests: [
          request({ state: "DECLINED", reasonCID: "bafy-reason", resolvedAt: 1_700_100_000 }),
        ],
      });
      mockUseReason.mockReturnValue({
        reason: { version: 1, reason: "Already covered this week" },
        isLoading: false,
        isUnavailable: false,
      });
      render();

      expect(screen.getByText("A steward declined this")).toBeInTheDocument();
      expect(screen.getByText("Already covered this week")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Ask again" }));
      expect(mockEnqueue).toHaveBeenCalledWith({
        act: "claim",
        payload: { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
      });
    });

    it("says when someone else took it up, with a way out and no retry", () => {
      mockUseCommitment.mockReturnValue(
        browse({ derivedState: "ACTIVE", onchainState: "ACCEPTED", leadProvider: OTHER })
      );
      mockUseClaimRequests.mockReturnValue({ claimRequests: [request({ state: "SUPERSEDED" })] });
      render();

      expect(screen.getByText("Taken up by another provider")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back to the pool" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /again/i })).not.toBeInTheDocument();
    });

    it("shows a garden claim's claimant and the steward who asked as two different people", () => {
      mockUseCommitment.mockReturnValue(browse());
      mockUseClaimRequests.mockReturnValue({
        claimRequests: [request({ claimType: "GARDEN", claimant: GARDEN, requestedBy: VIEWER })],
      });
      render();

      expect(screen.getByText("Claimant")).toBeInTheDocument();
      expect(screen.getByText("garden")).toBeInTheDocument();
      expect(screen.getByText("Asked by")).toBeInTheDocument();
      expect(screen.getByText("You")).toBeInTheDocument();
    });

    it("asks a protocol-pool claimant whether they take it up as themselves, and offers the garden only to a steward", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(browse());
      mockUsePool.mockReturnValue({ pool: { poolId: 7n, poolType: "PROTOCOL" } });
      render();

      await user.click(screen.getByRole("button", { name: "Ask to take this up" }));
      expect(screen.getByText("Take this up…")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /As myself/ })).toBeChecked();
      expect(screen.queryByRole("radio", { name: /For Rocinha/ })).not.toBeInTheDocument();
      expect(mockEnqueue).not.toHaveBeenCalled();

      const answers = screen.getAllByRole("button", { name: "Ask to take this up" });
      await user.click(answers[answers.length - 1]!);
      expect(mockEnqueue).toHaveBeenCalledWith({
        act: "claim",
        payload: { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
      });
    });

    it("lets a steward take a protocol-pool commitment up for their garden, as the garden", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(browse());
      mockUsePool.mockReturnValue({ pool: { poolId: 7n, poolType: "PROTOCOL" } });
      mockUseHasRole.mockImplementation((_garden: unknown, _user: unknown, role: string) => ({
        hasRole: role === "operator",
        isLoading: false,
      }));
      render();

      await user.click(screen.getByRole("button", { name: "Ask to take this up" }));
      await user.click(screen.getByRole("radio", { name: /For Rocinha Community Garden/ }));
      const answers = screen.getAllByRole("button", { name: "Ask to take this up" });
      await user.click(answers[answers.length - 1]!);

      // ClaimType.Garden, scoped to this garden: the garden is the claimant and
      // the steward the one who asked, resolved before the job and never after.
      expect(mockEnqueue).toHaveBeenCalledWith({
        act: "claim",
        payload: { commitmentId: 9n, kind: 0, gardenContext: GARDEN, gardenAddress: GARDEN },
      });
    });

    it("claims directly in a garden pool, where a member can only be themselves", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(browse({ claimMode: "OPEN" }));
      render();

      await user.click(screen.getByRole("button", { name: "Take this up" }));
      expect(screen.queryByText("Take this up…")).not.toBeInTheDocument();
      expect(mockEnqueue).toHaveBeenCalledWith({
        act: "claim",
        payload: { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
      });
    });
  });

  describe("the confirmation sheet", () => {
    const ready = (overrides: Record<string, unknown> = {}) =>
      detail({
        commitment: {
          derivedState: "READY_FOR_CONFIRMATION",
          onchainState: "READY_FOR_CONFIRMATION",
          creator: OTHER,
          leadProvider: OTHER,
          counterparty: VIEWER,
          evidenceCount: 2,
          confirmationCount: 0,
          confirmationThreshold: 1,
          ...overrides,
        },
        contributors: [{ contributor: OTHER, active: true, isLead: true }],
      });

    it("asks the cast's own question and offers its two answers", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(ready());
      render();

      await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));

      expect(screen.getByText("Commitment kept?")).toBeInTheDocument();
      expect(screen.getByText("2 items")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Not yet" })).toBeInTheDocument();
      // Nothing was queued by opening the sheet.
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("asks a request's confirmer whether the help arrived, and garden work whether it was done", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(
        ready({
          direction: "REQUEST",
          creator: VIEWER,
          counterparty: OTHER,
          commitmentType: "SUPPORT_SERVICE",
        })
      );
      render();
      await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
      expect(screen.getByText("Did the help arrive?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm the help arrived" })).toBeInTheDocument();
    });

    it("queues the ordinary confirmation from the sheet, with the garden", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(ready());
      render();
      await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
      // The sheet's own answer carries the same words as the bar.
      const answers = screen.getAllByRole("button", { name: "Confirm it was kept" });
      await user.click(answers[answers.length - 1]!);

      expect(mockEnqueue).toHaveBeenCalledWith({
        act: "confirm",
        commitmentId: 9n,
        gardenAddress: GARDEN,
      });
    });

    it("raises a dispute from Not yet with the words as typed, never cancelling anything", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(ready());
      render();
      await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
      await user.click(screen.getByRole("button", { name: "Not yet" }));

      expect(screen.getByText("Tell the stewards")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Not finished yet" }));
      await user.click(screen.getByRole("button", { name: "Send to the stewards" }));

      expect(mockMutate).toHaveBeenCalledWith(
        {
          action: "raiseDispute",
          commitmentId: 9n,
          reason: "Not finished yet",
          gardenAddress: GARDEN,
        },
        expect.anything()
      );
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("says Not yet needs a connection when offline, and keeps the words", async () => {
      const user = userEvent.setup();
      mockUseOffline.mockReturnValue({ isOnline: false });
      mockUseCommitment.mockReturnValue(ready());
      render();
      await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
      await user.click(screen.getByRole("button", { name: "Not yet" }));
      await user.type(screen.getByLabelText("What still needs doing?"), "The far bed");

      expect(screen.getByText(/needs a connection/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send to the stewards" })).toBeDisabled();
      expect(window.localStorage.getItem("gg-commitment-not-yet:42161-9")).toBe("The far bed");
    });

    it("keeps the note and offers a retry when the stewards could not be reached", async () => {
      const user = userEvent.setup();
      mockUseCommitment.mockReturnValue(ready());
      mockMutate.mockImplementation((_input: unknown, options?: { onError?: () => void }) => {
        options?.onError?.();
      });
      render();
      await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
      await user.click(screen.getByRole("button", { name: "Not yet" }));
      await user.click(screen.getByRole("button", { name: "Something looks off" }));
      await user.click(screen.getByRole("button", { name: "Send to the stewards" }));

      expect(screen.getByText(/Could not reach the stewards/i)).toBeInTheDocument();
      expect(screen.getByLabelText("What still needs doing?")).toHaveValue("Something looks off");
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("names who confirmed a kept commitment, and a fallback's reason", () => {
      mockUseCommitment.mockReturnValue(
        detail({
          commitment: {
            derivedState: "FULFILLED",
            onchainState: "FULFILLED",
            fulfilledBy: OTHER,
            confirmationPath: "POOL_FALLBACK",
            fallbackReason: "Nobody local was eligible",
          },
        })
      );
      render();

      expect(
        screen.getByText(/Confirmed by your garden steward, as a fallback/)
      ).toBeInTheDocument();
      expect(screen.getByText("Reason: Nobody local was eligible")).toBeInTheDocument();
    });
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

    // The bar opens the sheet; the sheet's own answer is what queues.
    await user.click(screen.getByRole("button", { name: "Confirm it was kept" }));
    const answers = screen.getAllByRole("button", { name: "Confirm it was kept" });
    await user.click(answers[answers.length - 1]!);
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

  it("offers Link work beside Add proof on garden work, and never on a service", () => {
    render();
    expect(screen.getByRole("button", { name: "Link work" })).toBeInTheDocument();

    mockUseCommitment.mockReturnValue(
      detail({ commitment: { commitmentType: "SUPPORT_SERVICE" } })
    );
    render();
    expect(screen.getAllByRole("button", { name: "Link work" })).toHaveLength(1);
  });

  it("links one of the member's own works at the exact row, and queues it", async () => {
    const user = userEvent.setup();
    mockUseWorks.mockReturnValue({ works: [work()] });
    mockUseCommitment.mockReturnValue(
      detail({
        requirements: [
          { id: "r0", requirementIndex: 0, actionUID: 44n, requiredCount: 2, approvedCount: 0 },
          { id: "r1", requirementIndex: 1, actionUID: 45n, requiredCount: 1, approvedCount: 0 },
        ],
      })
    );
    render();

    await user.click(screen.getByRole("button", { name: "Link work" }));
    expect(screen.getByText("Link work to this commitment")).toBeInTheDocument();
    // Two rows, so the row is a choice; repeated actions never fall back to first-match.
    expect(screen.getByRole("button", { name: "Link this work" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Prune the north beds/ }));
    await user.selectOptions(screen.getByLabelText("Which row it fulfils"), "1");
    await user.click(screen.getByRole("button", { name: "Link this work" }));

    expect(mockEnqueue).toHaveBeenCalledWith({
      act: "workLink",
      payload: {
        clientOperationId: expect.any(String),
        commitmentId: 9n,
        workUID: WORK,
        requirementIndex: 1,
        gardenAddress: GARDEN,
      },
    });
  });

  it("points at approved work of the member's own that nothing has linked yet", async () => {
    const user = userEvent.setup();
    mockUseWorks.mockReturnValue({ works: [work()] });
    mockUseCommitment.mockReturnValue(
      detail({
        requirements: [
          { id: "r0", requirementIndex: 0, actionUID: 44n, requiredCount: 2, approvedCount: 0 },
        ],
      })
    );
    render();

    expect(screen.getByText(/not yet linked/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Link it" }));
    // The row came preselected from the standing row, with its single requirement bound.
    await user.click(screen.getByRole("button", { name: "Link this work" }));

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        act: "workLink",
        payload: expect.objectContaining({ workUID: WORK, requirementIndex: 0 }),
      })
    );
  });

  it("shows linked work by what it did, and opens it", async () => {
    const user = userEvent.setup();
    mockUseWorks.mockReturnValue({ works: [work()] });
    mockUseCommitment.mockReturnValue(
      detail({
        requirements: [
          { id: "r0", requirementIndex: 0, actionUID: 44n, requiredCount: 2, approvedCount: 1 },
        ],
        workAttributions: [
          {
            id: `42161-9-${WORK}`,
            chainId: 42161,
            workUID: WORK,
            commitmentId: 9n,
            linkSeen: true,
            contributor: VIEWER,
            requirementIndex: 0,
            operationKey: null,
            linked: true,
            creditActive: true,
            linkedBy: VIEWER,
            linkedAt: 1_700_000_000,
            unlinkedBy: null,
            unlinkedAt: null,
            updatedAt: 1_700_000_000,
          },
        ],
      })
    );
    render();

    expect(screen.queryByText(/not yet linked/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Prune the north beds" }));
    expect(screen.getByText("Work detail")).toBeInTheDocument();
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
