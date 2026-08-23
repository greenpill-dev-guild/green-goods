/**
 * GardenCommitment renders the shared controller contract. Domain authority,
 * queue selection, and mutation argument mapping are covered with the
 * controller itself; this suite keeps the client-owned copy, navigation, and
 * dialog behavior honest.
 *
 * @vitest-environment jsdom
 */

import type {
  Action,
  CommitmentDetail,
  CommitmentReadModel,
  CommitmentRequirementRecord,
  CommitmentWorkAttributionRecord,
  GardenCommitmentActs,
  GardenCommitmentController,
  Work,
} from "@green-goods/shared";
import {
  claimFixture,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
  gardenCommitmentControllerFixture,
  poolFixture,
} from "@green-goods/shared/testing";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const HELPER = "0x3333333333333333333333333333333333333333" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const WORK = `0x${"ab".repeat(32)}` as `0x${string}`;

const mockUseController = vi.fn();
const mockReason = vi.fn();
const mockFlush = vi.fn();
const mockRetryJob = vi.fn();
const mockDiscardJob = vi.fn();
const mockActs = {
  claim: vi.fn(),
  claimPersonal: vi.fn(),
  linkWork: vi.fn(),
  sendForConfirmation: vi.fn(),
  confirm: vi.fn(),
  notYet: vi.fn(),
  join: vi.fn(),
  withdraw: vi.fn(),
  acceptClaim: vi.fn(),
  declineClaim: vi.fn(),
} satisfies GardenCommitmentActs;

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    DEFAULT_CHAIN_ID: 42161,
    useGardenCommitmentController: (...args: unknown[]) => mockUseController(...args),
    useCommitmentReason: (...args: unknown[]) => mockReason(...args),
    useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
    useJobQueue: () => ({ flush: mockFlush }),
    jobQueue: { retryJob: mockRetryJob, discardJob: mockDiscardJob },
  };
});

const { GardenCommitment } = await import("../../views/Home/Garden/Commitment");

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    commitmentId: 9n,
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    derivedState: "ACTIVE",
    onchainState: "ACCEPTED",
    targetUnits: 3n,
    unitLabel: "hours",
    poolId: 7n,
    commitmentType: "DOMAIN_IMPACT",
    contributorCount: 1,
    contributorsFrozen: false,
    metadataCID: null,
    ...overrides,
  });
}

type DetailOverrides = Omit<Partial<CommitmentDetail>, "commitment"> & {
  commitment?: Partial<CommitmentReadModel>;
};

function detail(overrides: DetailOverrides = {}): CommitmentDetail {
  const { commitment: commitmentOverrides, ...records } = overrides;
  return commitmentDetailFixture({
    commitment: commitment(commitmentOverrides),
    contributors: [],
    ...records,
  });
}

function action(id: number, title: string): Action {
  return {
    id: `42161-${id}`,
    slug: `action-${id}`,
    startTime: 0,
    endTime: 0,
    title,
    description: "",
    capitals: [],
    media: [],
    domain: null,
    createdAt: 0,
    inputs: [],
  };
}

function requirement(
  requirementIndex: number,
  actionUID: bigint,
  requiredCount: number,
  approvedCount: number
): CommitmentRequirementRecord {
  return {
    id: `r${requirementIndex}`,
    chainId: 42161,
    commitmentId: 9n,
    requirementIndex,
    creationSeen: true,
    domain: null,
    actionUID,
    requiredCount,
    approvedCount,
    createdAt: 1,
    updatedAt: 1,
  };
}

function work(overrides: Partial<Work> = {}): Work {
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

function attribution(overrides: Partial<CommitmentWorkAttributionRecord> = {}) {
  return {
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
    ...overrides,
  } satisfies CommitmentWorkAttributionRecord;
}

function controller(
  overrides: Partial<GardenCommitmentController> = {}
): GardenCommitmentController {
  return gardenCommitmentControllerFixture({
    chainId: 42161,
    routeGarden: GARDEN,
    viewer: VIEWER,
    status: "ready",
    detail: detail(),
    metadata: null,
    pool: poolFixture({ poolId: 7n, poolType: "GARDEN", garden: GARDEN }),
    works: [],
    actions: [action(44, "Prune the north beds"), action(45, "Plant the starts")],
    roles: {
      isSteward: false,
      stewardsPoolGarden: false,
      counterpartyGarden: undefined,
      stewardsCounterparty: false,
      garden: undefined,
      isMemberHere: true,
      claimGardens: {
        member: [{ address: GARDEN, name: "Rocinha Community Garden" }],
        stewarded: [],
      },
    },
    seat: "provider",
    actGarden: GARDEN,
    actKind: "addProof",
    joinable: false,
    linkable: true,
    linkableWorks: [],
    queue: {
      pending: false,
      sendFailed: false,
      failedJob: null,
      unavailable: false,
      refresh: vi.fn(),
    },
    confirmation: {
      phase: "ask",
      canNotYet: true,
      gardenAddress: GARDEN,
      membershipNotRequired: false,
    },
    acts: mockActs,
    ...overrides,
  });
}

function render(commitmentId = "9") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/${commitmentId}`]}>
      <Routes>
        <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        <Route path="/home/:id/commitments/:commitmentId/proof" element={<p>Proof composer</p>} />
        <Route path="/home/:id/work/:workId" element={<p>Work detail</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  for (const operation of Object.values(mockActs)) operation.mockResolvedValue("0x123");
  mockReason.mockReturnValue({ reason: null, isLoading: false, isUnavailable: false });
  mockUseController.mockReturnValue(controller());
});

describe("GardenCommitment", () => {
  it("calls one controller and renders the commitment name and current act", () => {
    render();

    expect(mockUseController).toHaveBeenCalledTimes(1);
    expect(mockUseController).toHaveBeenCalledWith({
      chainId: 42161,
      commitmentId: 9n,
      routeGarden: GARDEN,
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3 hours");
    expect(screen.getByRole("button", { name: "Add proof" })).toBeInTheDocument();
  });

  it("parses an invalid route id as not found", () => {
    mockUseController.mockImplementation((input: { commitmentId: bigint | null }) =>
      controller({
        status: input.commitmentId === null ? "notFound" : "ready",
        detail: input.commitmentId === null ? null : detail(),
      })
    );
    render("not-a-number");

    expect(mockUseController).toHaveBeenCalledWith(expect.objectContaining({ commitmentId: null }));
    expect(screen.getByText("Commitment not found")).toBeInTheDocument();
  });

  it("renders unavailable and retryable error states from the controller", async () => {
    mockUseController.mockReturnValue(controller({ status: "unavailable", detail: null }));
    const view = render();
    expect(screen.getByText("Commitments are not ready here yet")).toBeInTheDocument();

    const refetch = vi.fn(async () => undefined);
    mockUseController.mockReturnValue(controller({ status: "error", detail: null, refetch }));
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("opens the proof composer from the controller-selected Add proof act", async () => {
    render();
    await userEvent.click(screen.getByRole("button", { name: "Add proof" }));
    expect(screen.getByText("Proof composer")).toBeInTheDocument();
  });

  it("renders the team and delegates joining to the controller", async () => {
    const roster = [
      contributorFixture({
        commitmentId: 9n,
        contributor: OTHER,
        isLead: true,
        requirementIndexes: [0],
        approvedWorkCredits: 1,
      }),
      contributorFixture({ commitmentId: 9n, contributor: VIEWER, evidenceCredits: 2 }),
    ];
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: { creator: OTHER, leadProvider: OTHER },
          contributors: roster,
          requirements: [requirement(0, 44n, 2, 1)],
        }),
        seat: "bystander",
        actKind: null,
        joinable: true,
      })
    );
    render();

    expect(screen.getByText("Assigned: Prune the north beds")).toBeInTheDocument();
    expect(screen.getByText("1 approved work · no proof yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join the team" }));
    expect(mockActs.join).toHaveBeenCalledTimes(1);
  });

  it("renders the reader's claim state without offering a duplicate act", () => {
    const ownRequest = claimFixture({
      commitmentId: 9n,
      claimant: VIEWER,
      requestedBy: VIEWER,
      state: "PENDING",
    });
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: {
            derivedState: "OFFERED",
            onchainState: "OFFERED",
            creator: OTHER,
            leadProvider: null,
            counterparty: null,
            claimMode: "APPROVAL_GATED",
          },
        }),
        seat: "bystander",
        actKind: null,
        ownRequest,
        canAskAgain: false,
      })
    );
    render();

    expect(screen.getByText("Waiting for a steward")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask to take this up" })).not.toBeInTheDocument();
  });

  it("opens provider context and delegates the chosen claim", async () => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: {
            derivedState: "OFFERED",
            onchainState: "OFFERED",
            creator: OTHER,
            leadProvider: null,
            counterparty: null,
          },
        }),
        seat: "bystander",
        actKind: "takeUp",
        claimNeedsContext: true,
      })
    );
    render();

    await userEvent.click(screen.getByRole("button", { name: "Take this up" }));
    await userEvent.click(screen.getByRole("button", { name: "Take this up" }));
    expect(mockActs.claim).toHaveBeenCalledWith({ kind: "personal", garden: GARDEN });
  });

  it("renders pending steward decisions and delegates accept and decline", async () => {
    const pending = claimFixture({
      commitmentId: 9n,
      claimant: OTHER,
      requestedBy: HELPER,
      state: "PENDING",
    });
    mockUseController.mockReturnValue(
      controller({
        roles: { ...controller().roles, stewardsPoolGarden: true },
        pendingClaimRequests: [pending],
      })
    );
    render();

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mockActs.acceptClaim).toHaveBeenCalledWith(OTHER);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    await userEvent.type(screen.getByLabelText("Why not, in a sentence or two"), "Missing context");
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(mockActs.declineClaim).toHaveBeenCalledWith(OTHER, "Missing context");
  });

  it("renders pending, unreadable, and failed queue states", async () => {
    mockUseController.mockReturnValue(
      controller({ actKind: null, queue: { ...controller().queue, pending: true } })
    );
    const view = render();
    expect(screen.getByText(/waiting to send from this phone/i)).toBeInTheDocument();

    mockUseController.mockReturnValue(
      controller({ queue: { ...controller().queue, unavailable: true } })
    );
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Add proof" })).toBeDisabled();

    mockRetryJob.mockResolvedValue(undefined);
    mockDiscardJob.mockResolvedValue(true);
    mockFlush.mockResolvedValue(undefined);
    mockUseController.mockReturnValue(
      controller({
        queue: {
          ...controller().queue,
          sendFailed: true,
          failedJob: { jobId: "job-9", discardable: true },
        },
      })
    );
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );
    const alert = screen.getByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await userEvent.click(within(alert).getByRole("button", { name: "Discard" }));
    expect(mockRetryJob).toHaveBeenCalledWith("job-9");
    expect(mockDiscardJob).toHaveBeenCalledWith("job-9");
  });

  it("delegates send and confirmation acts", async () => {
    mockUseController.mockReturnValue(controller({ actKind: "sendForConfirmation" }));
    const view = render();
    await userEvent.click(screen.getByRole("button", { name: "Send for confirmation" }));
    expect(mockActs.sendForConfirmation).toHaveBeenCalledTimes(1);

    mockUseController.mockReturnValue(
      controller({
        detail: detail({ commitment: { derivedState: "READY_FOR_CONFIRMATION" } }),
        actKind: "confirm",
      })
    );
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm it was kept" }));
    const answers = screen.getAllByRole("button", { name: "Confirm it was kept" });
    await userEvent.click(answers.at(-1)!);
    expect(mockActs.confirm).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed Not yet note and offers another try", async () => {
    mockActs.notYet.mockRejectedValue(new Error("stewards unavailable"));
    mockUseController.mockReturnValue(
      controller({
        detail: detail({ commitment: { derivedState: "READY_FOR_CONFIRMATION" } }),
        actKind: "confirm",
      })
    );
    render();
    await userEvent.click(screen.getByRole("button", { name: "Confirm it was kept" }));
    await userEvent.click(screen.getByRole("button", { name: "Not yet" }));
    await userEvent.type(screen.getByLabelText("What still needs doing?"), "The far bed");
    await userEvent.click(screen.getByRole("button", { name: "Send to the stewards" }));

    expect(mockActs.notYet).toHaveBeenCalledWith("The far bed");
    expect(screen.getByText(/Could not reach the stewards/i)).toBeInTheDocument();
    expect(screen.getByLabelText("What still needs doing?")).toHaveValue("The far bed");
  });

  it("confirms withdrawal locally and preserves a reason after pin failure", async () => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({ commitment: { derivedState: "OFFERED" } }),
        actKind: "withdraw",
        pinFailed: true,
      })
    );
    render();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw this" }));
    await userEvent.type(screen.getByLabelText("Reason (required)"), "Plans changed");

    expect(screen.getByText(/could not be saved/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockActs.withdraw).toHaveBeenCalledWith("Plans changed");
  });

  it("links an eligible work with one stable operation id", async () => {
    const eligible = work();
    mockActs.linkWork.mockReturnValue(new Promise(() => {}));
    mockUseController.mockReturnValue(
      controller({
        detail: detail({ requirements: [requirement(0, 44n, 2, 0)] }),
        works: [eligible],
        linkableWorks: [eligible],
      })
    );
    render();
    await userEvent.click(screen.getByRole("button", { name: "Link work" }));
    await userEvent.click(screen.getByRole("radio", { name: /Prune the north beds/ }));
    const confirm = screen.getByRole("button", { name: "Link this work" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);

    expect(mockActs.linkWork).toHaveBeenCalledTimes(2);
    const ids = mockActs.linkWork.mock.calls.map((call) => call[2]);
    expect(new Set(ids)).toHaveLength(1);
  });

  it("shows linked work, opens it, and names requirement progress", async () => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          requirements: [requirement(0, 44n, 2, 1), requirement(1, 99n, 1, 0)],
          workAttributions: [attribution()],
        }),
        works: [work()],
      })
    );
    render();

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Requirement 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open Prune the north beds" }));
    expect(screen.getByText("Work detail")).toBeInTheDocument();
  });
});
