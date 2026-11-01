/**
 * GardenCommitment renders the shared controller contract. Domain authority,
 * queue selection, and mutation argument mapping are covered with the
 * controller itself; this suite keeps the client-owned copy, navigation, and
 * dialog behavior honest.
 *
 * @vitest-environment happy-dom
 */

import {
  claimFixture,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
  poolFixture,
} from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { gardenCommitmentControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import type {
  CommitmentDetail,
  CommitmentReadModel,
  CommitmentRequirementRecord,
  CommitmentWorkAttributionRecord,
} from "@green-goods/shared/commitment-pooling";
import type {
  GardenCommitmentActs,
  GardenCommitmentController,
} from "@green-goods/shared/hooks/client-ui/commitment/controller.types";
import type { Action, Work } from "@green-goods/shared/types/domain";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor, within } from "../test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const HELPER = "0x3333333333333333333333333333333333333333" as const;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const PROVIDER_GARDEN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const WORK = `0x${"ab".repeat(32)}` as `0x${string}`;

const mockUseController = vi.fn();
const mockReason = vi.fn();
const mockFlush = vi.fn();
const mockRetryAndSend = vi.fn();
const mockDiscardJob = vi.fn();
const mockJoinGarden = vi.fn();
const mockUseServiceAccess = vi.fn();
const mockServiceMutation = vi.fn();
const mockVoucherWallet = vi.fn();
const mockIssuerApproval = vi.fn();
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

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => VIEWER,
}));

vi.mock("@green-goods/shared/config/default-chain", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    DEFAULT_CHAIN_ID: 42161,
  };
});

vi.mock(
  "@green-goods/shared/hooks/client-ui/commitment/useGardenCommitmentController",
  async (importOriginal) => {
    return {
      ...(await importOriginal()),
      useGardenCommitmentController: (...args: unknown[]) => mockUseController(...args),
    };
  }
);

vi.mock("@green-goods/shared/hooks/app/useOffline", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
  };
});

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOnlineStatus: () => true,
  };
});

vi.mock("@green-goods/shared/hooks/garden/useJoinGarden", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useJoinGarden: () => ({
      joinGarden: mockJoinGarden,
      isJoining: false,
      joiningGardenId: null,
      error: null,
      checkOpenJoining: vi.fn(),
    }),
  };
});

vi.mock("@green-goods/shared/providers/JobQueue", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useJobQueue: () => ({ flush: mockFlush, retryAndSend: mockRetryAndSend }),
  };
});

vi.mock("@green-goods/shared/modules/job-queue/default-instance", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    jobQueue: { discardJob: mockDiscardJob },
  };
});

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentReason: (...args: unknown[]) => mockReason(...args),
  useServiceAccess: (...args: unknown[]) => mockUseServiceAccess(...args),
  useServiceAccessMutation: () => ({ mutateAsync: mockServiceMutation, isPending: false }),
  useVoucherWallet: (...args: unknown[]) => mockVoucherWallet(...args),
  useVoucherIssuerApproval: (...args: unknown[]) => mockIssuerApproval(...args),
}));

const { GardenCommitment } = await import("../../views/Home/Garden/Commitment");
const { isCommitmentCreator, selectCommitmentActKind, selectCommitmentSeat } = await import(
  "@green-goods/shared/commitment-pooling"
);
const { serviceAccessStorySnapshot } = await import(
  "../../views/Home/Garden/Commitment/serviceAccessStoryFixtures"
);
const {
  bookingStoryController,
  bookingStorySnapshot,
  bookingStoryWallet,
  rewardStoryController,
  rewardStorySnapshot,
} = await import("../../../../shared/.storybook/voucherBookingFixtures");
const { VOUCHER_STORY_APPROVALS, VOUCHER_STORY_ISSUERS, vouchers } = await import(
  "../../../../shared/.storybook/voucherPilotFixtures"
);

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
      claimGardensKnown: true,
      membershipUnavailable: false,
      retryMembership: vi.fn(),
    },
    seat: "provider",
    actGarden: GARDEN,
    actKind: "addProof",
    joinable: false,
    linkable: true,
    linkableWorks: [],
    queue: {
      hasPendingJob: false,
      sendFailed: false,
      failedJob: null,
      pendingAct: null,
      proofSending: false,
      proofOnItsWay: null,
      sendsFromTap: false,
      isUnavailable: false,
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
        <Route path="/home/:id/commitments/new" element={<ComposerRoute />} />
        <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        <Route path="/home/:id/commitments/:commitmentId/proof" element={<p>Proof composer</p>} />
        <Route path="/home/:id/work/:workId" element={<p>Work detail</p>} />
        <Route path="/home/garden" element={<WorkSubmissionRoute />} />
        <Route path="/home/profile" element={<HelpRoute />} />
        <Route path="/home" element={<HomeRoute />} />
      </Routes>
    </MemoryRouter>
  );
}

function HomeRoute() {
  const location = useLocation();
  return <output data-testid="home-route">{`${location.pathname}${location.search}`}</output>;
}

function HelpRoute() {
  const location = useLocation();
  return <output data-testid="help-route">{`${location.pathname}${location.search}`}</output>;
}

function ComposerRoute() {
  const location = useLocation();
  return <output data-testid="composer-route">{`${location.pathname}${location.search}`}</output>;
}

function WorkSubmissionRoute() {
  const location = useLocation();
  return (
    <>
      <p>Work submission</p>
      <output data-testid="work-submission-query">{location.search}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseServiceAccess.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockVoucherWallet.mockReturnValue({ data: undefined });
  mockIssuerApproval.mockReturnValue({ data: undefined });
  window.localStorage.clear();
  for (const operation of Object.values(mockActs)) operation.mockResolvedValue("0x123");
  mockReason.mockReturnValue({ reason: null, isLoading: false, isUnavailable: false });
  mockUseController.mockReturnValue(controller());
});

describe("GardenCommitment", () => {
  it.each([
    "unknown",
    "earned",
  ] as const)("keeps %s acceptance evidence separate from ordinary legacy controls", (kind) => {
    mockUseController.mockReturnValue(
      controller({
        actKind: "askToTakeUp",
        seat: "bystander",
        detail: detail({
          commitment: {
            onchainState: "OFFERED",
            derivedState: "OFFERED",
            creator: OTHER,
            leadProvider: OTHER,
          },
        }),
      })
    );
    const state = serviceAccessStorySnapshot();
    state.mode = "legacy";
    state.knownService = false;
    state.offer = null;
    state.availableActions = [];
    state.evidence = "onchain";
    state.capabilities.mutation = "unavailable";
    state.capabilities.reasons = ["unsupported-protocol"];
    state.acceptancePolicy = {
      ...state.acceptancePolicy,
      kind,
      knownOptIn: kind === "earned",
      blockGenericMemberAcceptance: kind === "earned",
      earned: {
        ...state.acceptancePolicy.earned,
        status: kind === "earned" ? "bound" : "unknown",
        creator: GARDEN,
        participant: VIEWER,
      },
    };
    mockUseServiceAccess.mockReturnValue({ data: state, refetch: vi.fn() });
    render();
    if (kind === "unknown") {
      expect(screen.getByRole("button", { name: "Ask to take this up" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Service Access" })).not.toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "Ask to take this up" })).not.toBeInTheDocument();
      expect(screen.getByText("Earned voucher consent")).toBeInTheDocument();
    }
  });

  it("draws a voucher booking as a section card whose acts sit only in the action bar", async () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        seat: "bystander",
        detail: detail({
          commitment: { onchainState: "OFFERED", derivedState: "OFFERED", creator: OTHER },
        }),
      })
    );
    const snapshot = bookingStorySnapshot("hubDay", "readyToDeposit");
    mockUseServiceAccess.mockReturnValue({ data: snapshot, refetch: vi.fn() });
    mockServiceMutation.mockResolvedValue({
      kind: "local-rehearsal",
      observationId: "x",
      snapshot,
    });
    mockVoucherWallet.mockReturnValue({
      data: bookingStoryWallet(snapshot, { techAndSun: 9, greenGoods: 0 }),
    });
    mockIssuerApproval.mockReturnValue({ data: VOUCHER_STORY_APPROVALS.techAndSunBootstrap });
    render();
    const section = screen.getByRole("region", { name: "Service Access" });
    expect(within(section).queryAllByRole("button")).toEqual([]);
    expect(
      within(section).getByText("1 Tech and Sun voucher, still in your account")
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Where this stands" })).toHaveTextContent(
      "Tech and Sun approved. Deposit your voucher into the escrow for this booking."
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel Booking" }));
    expect(mockServiceMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "abortVoucherSetup",
        setupId: snapshot.currentVoucherSetupId,
      })
    );
    expect(screen.getByRole("button", { name: "Deposit 1 Voucher" })).toBeInTheDocument();
  });

  it("reads the voucher wallet of the booking's holder, not of the member who agreed", () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        seat: "bystander",
        detail: detail({
          commitment: { onchainState: "OFFERED", derivedState: "OFFERED", creator: OTHER },
        }),
      })
    );
    const snapshot = bookingStorySnapshot("hubDay", "readyToDeposit");
    snapshot.voucherSetups = snapshot.voucherSetups.map((setup) => ({
      ...setup,
      authorization: { ...setup.authorization, holder: HELPER },
    }));
    mockUseServiceAccess.mockReturnValue({ data: snapshot, refetch: vi.fn() });
    render();
    expect(snapshot.key.buyer).not.toBe(HELPER);
    expect(mockVoucherWallet).toHaveBeenLastCalledWith(
      expect.objectContaining({ account: HELPER })
    );
  });

  it("uses the service boundary for known incomplete opt-in instead of generic claim and acceptance", () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: "askToTakeUp",
        seat: "bystander",
        detail: detail({
          commitment: {
            onchainState: "OFFERED",
            derivedState: "OFFERED",
            creator: OTHER,
            leadProvider: OTHER,
          },
        }),
        pendingClaimRequests: [claimFixture({ claimant: VIEWER, state: "PENDING" })],
        roles: { ...controller().roles, stewardsPoolGarden: true },
      })
    );
    mockUseServiceAccess.mockReturnValue({
      data: {
        key: { sourceChainId: 42161, coreModule: GARDEN, commitmentId: 9n, buyer: VIEWER },
        mode: "unavailable",
        knownService: true,
        complete: false,
        evidence: "indexed",
        offer: null,
        consent: null,
        nextRequestNonce: 0n,
        coreState: "OFFERED",
        eligibleBuyerGardens: [],
        personalFeeQuote: null,
        personalPaymentAccount: null,
        availableActions: [],
        personalPurchase: null,
        sourceTimestamp: null,
        sourceBlock: null,
        currentVoucherSetupId: null,
        voucherSetups: [],
        acceptancePolicy: {
          kind: "service",
          knownOptIn: true,
          blockGenericMemberAcceptance: true,
          earned: {
            status: "unknown",
            module: null,
            revision: null,
            termsHash: null,
            acceptedRevision: null,
            acceptedTermsHash: null,
            acceptedCounterparty: null,
            terms: null,
            creator: null,
            creatorConsentRevision: null,
            participant: null,
            participantConsentRevision: null,
            accountRouteAvailable: false,
          },
        },
        pause: { core: null, sourceVoucher: null, destinationVoucher: null },
        capabilities: {
          mutation: "unavailable",
          reasons: ["projection-incomplete"],
          sourceBuyer: VIEWER,
          celoDepositor: null,
          gnosisHolder: null,
          canSignSource: false,
          canSendSource: false,
          canSignCelo: false,
          canSignHolder: false,
          canSendDestination: false,
        },
      },
      refetch: vi.fn(),
    });
    render();
    expect(screen.getByRole("region", { name: "Service Access" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask to take this up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
    expect(mockActs.claimPersonal).not.toHaveBeenCalled();
    expect(mockActs.acceptClaim).not.toHaveBeenCalled();
  });

  it("calls one controller and renders the commitment name and current act", () => {
    render();

    expect(mockUseController).toHaveBeenCalledTimes(1);
    expect(mockUseController).toHaveBeenCalledWith({
      chainId: 42161,
      commitmentId: 9n,
      routeGarden: GARDEN,
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3 hours");
    expect(screen.getByRole("button", { name: "Add Proof" })).toBeInTheDocument();
  });

  describe("a creator's proof (DL-151)", () => {
    const PROOF_MOVES_IT = "No proof added yet. Proof is what moves this forward.";
    /** The page as the controller reads this record, through the real seat and act rules. */
    const open = (overrides: Partial<CommitmentReadModel>, takeUpOpen = false) => {
      const record = commitment({ commitmentType: "SUPPORT_SERVICE", ...overrides });
      const seat = selectCommitmentSeat({ commitment: record, contributors: [], viewer: VIEWER });
      const actKind = selectCommitmentActKind({
        commitment: record,
        seat,
        isCreator: isCommitmentCreator({ commitment: record, viewer: VIEWER }),
      });
      mockUseController.mockReturnValue(
        controller({
          detail: detail({ commitment: record }),
          seat,
          actKind,
          linkable: false,
          takeUpOpen,
        })
      );
      render();
    };
    const untakenOffer = {
      direction: "OFFER",
      creator: VIEWER,
      leadProvider: null,
      counterparty: null,
      onchainState: "OFFERED",
      derivedState: "OFFERED",
    } as const;
    const progress = () => screen.getByRole("region", { name: "Progress and proof" });

    it("leads with Add Proof when the creator is the provider and proof can land", () => {
      open({ direction: "OFFER", creator: VIEWER, leadProvider: VIEWER, counterparty: OTHER });

      expect(screen.getByRole("button", { name: "Add Proof" })).toHaveAttribute(
        "data-component",
        "CommitmentActionBar"
      );
      expect(progress()).toHaveTextContent(PROOF_MOVES_IT);
    });

    it("offers a creator who is not the provider no proof, and no line that asks for any", () => {
      open({ direction: "REQUEST", creator: VIEWER, leadProvider: OTHER, counterparty: OTHER });

      expect(screen.queryByRole("button", { name: "Add Proof" })).not.toBeInTheDocument();
      expect(progress()).toHaveTextContent("No proof added yet.");
      expect(progress()).not.toHaveTextContent("Proof is what moves this forward");
    });

    it("promises no proof on an offer past due, which nobody can take up any more", () => {
      open(untakenOffer, false);

      expect(screen.getByRole("button", { name: "Withdraw This" })).toBeInTheDocument();
      expect(progress()).toHaveTextContent("No proof added yet.");
      expect(progress()).not.toHaveTextContent("once someone takes this up");
    });

    it("keeps Withdraw before anyone takes it up, when the chain takes no proof", () => {
      open(untakenOffer, true);

      expect(screen.getByRole("button", { name: "Withdraw This" })).toHaveAttribute(
        "data-component",
        "CommitmentActionBar"
      );
      expect(screen.queryByRole("button", { name: "Add Proof" })).not.toBeInTheDocument();
      expect(progress()).toHaveTextContent(
        "No proof added yet. You can add it once someone takes this up."
      );
      expect(progress()).not.toHaveTextContent("Proof is what moves this forward");
    });

    it("says it beside required work too, where Add Proof sits second", () => {
      mockUseController.mockReturnValue(
        controller({ detail: detail({ commitment: { commitmentType: "DOMAIN_IMPACT" } }) })
      );
      render();

      expect(screen.getByRole("button", { name: "Link Work" })).toHaveAttribute(
        "data-component",
        "CommitmentActionBar"
      );
      expect(screen.getByRole("button", { name: "Add Proof" })).toHaveAttribute(
        "data-component",
        "CommitmentActionBarSecondary"
      );
      expect(progress()).toHaveTextContent(PROOF_MOVES_IT);
    });
  });

  it("names the reward among what was promised, so it stays in sight after taking one up", () => {
    const wei = 160_000n * 10n ** 18n;
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: {
            direction: "REQUEST",
            commitmentType: "SUPPORT_SERVICE",
            considerationRail: "CELO_SETTLEMENT",
            considerationAmount: wei,
          },
        }),
        metadata: {
          version: 1,
          title: "Complete the climate course",
          reward: { version: 1, usdCents: "2000", goodDollarWei: wei.toString() },
        },
      })
    );
    render();

    const promised = screen.getByRole("region", { name: "What was promised" });
    expect(within(promised).getByText("Reward")).toBeInTheDocument();
    expect(within(promised).getByText("$20.00, paid in G$ after it's kept")).toBeInTheDocument();
  });

  it("makes required work the primary action while keeping optional proof available", () => {
    render();
    expect(screen.getByRole("button", { name: "Link Work" })).toHaveAttribute(
      "data-component",
      "CommitmentActionBar"
    );
    expect(screen.getByRole("button", { name: "Add Proof" })).toHaveAttribute(
      "data-component",
      "CommitmentActionBarSecondary"
    );
  });

  it("keeps proof primary once all required work is approved", () => {
    mockUseController.mockReturnValue(
      controller({ detail: detail({ requirements: [requirement(0, 44n, 2, 2)] }) })
    );
    render();
    expect(screen.getByRole("button", { name: "Add Proof" })).toHaveAttribute(
      "data-component",
      "CommitmentActionBar"
    );
    expect(screen.getByRole("region", { name: "Where this stands" })).toHaveTextContent(
      "The required work is approved"
    );
  });

  it("offers new work alongside eligible existing work", async () => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({ requirements: [requirement(0, 44n, 2, 0)] }),
        linkableWorks: [work()],
        workGarden: GARDEN,
      })
    );
    render();
    await userEvent.click(screen.getByRole("button", { name: "Link Work" }));
    expect(screen.getByRole("radio", { name: /Prune the north beds/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit work for requirement 1" }));
    expect(screen.getByText("Work submission")).toBeInTheDocument();
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
    expect(screen.getByText("Promise not found")).toBeInTheDocument();
  });

  it("renders unavailable and retryable error states from the controller", async () => {
    mockUseController.mockReturnValue(controller({ status: "unavailable", detail: null }));
    const view = render();
    expect(screen.getByText("Promises are not ready here yet")).toBeInTheDocument();

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
    await userEvent.click(screen.getByRole("button", { name: "Add Proof" }));
    expect(screen.getByText("Proof composer")).toBeInTheDocument();
  });

  it("opens the composer on the commitment being made again, in the pool it belongs to", async () => {
    // A protocol commitment is read from the reader's own garden, and the new one
    // has to be composed into the protocol pool, not into the garden it was opened from.
    const PROTOCOL_GARDEN = "0x9999999999999999999999999999999999999999";
    const claimPersonal = vi.fn();
    mockUseController.mockReturnValue(
      controller({
        actKind: "askAgain",
        acts: { ...controller().acts, claimPersonal },
        pool: poolFixture({ poolId: 1n, poolType: "PROTOCOL", garden: PROTOCOL_GARDEN }),
      })
    );
    render();

    await userEvent.click(screen.getByRole("button", { name: "Ask Again" }));

    expect(screen.getByTestId("composer-route")).toHaveTextContent(
      `/home/${PROTOCOL_GARDEN}/commitments/new?direction=request&from=9`
    );
    expect(claimPersonal).not.toHaveBeenCalled();
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
    await userEvent.click(screen.getByRole("button", { name: "Join the Team" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Take This Up" }));
    await userEvent.click(screen.getByRole("button", { name: "Take This Up" }));
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
      controller({ actKind: null, queue: { ...controller().queue, hasPendingJob: true } })
    );
    const view = render();
    expect(screen.getByText(/waiting to send from this phone/i)).toBeInTheDocument();

    mockUseController.mockReturnValue(
      controller({ queue: { ...controller().queue, isUnavailable: true } })
    );
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Add Proof" })).toBeDisabled();

    mockRetryAndSend.mockResolvedValue(undefined);
    mockDiscardJob.mockResolvedValue(true);
    mockFlush.mockResolvedValue(undefined);
    mockUseController.mockReturnValue(
      controller({
        queue: {
          ...controller().queue,
          sendFailed: true,
          failedJob: {
            jobId: "job-9",
            kind: "confirmation",
            at: 1,
            discardable: true,
            reason: null,
            retryable: true,
          },
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
    await userEvent.click(within(alert).getByRole("button", { name: "Try Again" }));
    await userEvent.click(within(alert).getByRole("button", { name: "Discard" }));
    // Trying the act again sends only that act, never the rest of the queue.
    expect(mockRetryAndSend).toHaveBeenCalledWith("job-9");
    expect(mockFlush).not.toHaveBeenCalled();
    expect(mockDiscardJob).toHaveBeenCalledWith("job-9");
  });

  it("delegates send and confirmation acts", async () => {
    mockUseController.mockReturnValue(controller({ actKind: "sendForConfirmation" }));
    const view = render();
    await userEvent.click(screen.getByRole("button", { name: "Send for Confirmation" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Confirm It Was Kept" }));
    const answers = screen.getAllByRole("button", { name: "Confirm It Was Kept" });
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
    await userEvent.click(screen.getByRole("button", { name: "Confirm It Was Kept" }));
    await userEvent.click(screen.getByRole("button", { name: "Not Yet" }));
    await userEvent.type(screen.getByLabelText("What still needs doing?"), "The far bed");
    await userEvent.click(screen.getByRole("button", { name: "Send to the Stewards" }));

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
    await userEvent.click(screen.getByRole("button", { name: "Withdraw This" }));
    await userEvent.type(screen.getByLabelText("Reason (required)"), "Plans changed");

    expect(screen.getByText(/could not be saved/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mockActs.withdraw).toHaveBeenCalledWith("Plans changed");
  });

  it("links eligible provider-garden work from a different route garden", async () => {
    const eligible = work({ gardenAddress: PROVIDER_GARDEN });
    mockActs.linkWork.mockReturnValue(new Promise(() => {}));
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: { providerGarden: PROVIDER_GARDEN },
          requirements: [requirement(0, 44n, 2, 0)],
        }),
        workGarden: PROVIDER_GARDEN,
        works: [eligible],
        linkableWorks: [eligible],
      })
    );
    render();
    await userEvent.click(screen.getByRole("button", { name: "Link Work" }));
    await userEvent.click(screen.getByRole("radio", { name: /Prune the north beds/ }));
    const confirm = screen.getByRole("button", { name: "Link This Work" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);

    expect(mockActs.linkWork).toHaveBeenCalledTimes(2);
    const ids = mockActs.linkWork.mock.calls.map((call) => call[2]);
    expect(new Set(ids)).toHaveLength(1);
  });

  it("launches provider-garden Work and preserves the route garden for return", async () => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: { providerGarden: PROVIDER_GARDEN },
          requirements: [requirement(0, 44n, 2, 0)],
        }),
        workGarden: PROVIDER_GARDEN,
        linkableWorks: [],
      })
    );
    render();

    await userEvent.click(screen.getByRole("button", { name: "Link Work" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit work for requirement 1" }));

    expect(screen.getByText("Work submission")).toBeInTheDocument();
    const params = new URLSearchParams(
      screen.getByTestId("work-submission-query").textContent ?? ""
    );
    expect(params.get("linkCommitmentId")).toBe("9");
    expect(params.get("linkRequirementIndex")).toBe("0");
    expect(params.get("linkActionUID")).toBe("44");
    expect(params.get("linkGarden")).toBe(PROVIDER_GARDEN);
    expect(params.get("linkCommitmentTitle")).toBe("3 hours");
    expect(params.get("linkRequirementLabel")).toBe("1");
    expect(params.get("returnTo")).toBe(`/home/${GARDEN}/commitments/9`);
  });

  it("offers Work submission when existing Work cannot fulfil any requirement", async () => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({ requirements: [requirement(0, 44n, 2, 0)] }),
        linkableWorks: [work({ actionUID: 99 })],
      })
    );
    render();

    await userEvent.click(screen.getByRole("button", { name: "Link Work" }));

    expect(
      screen.getByRole("button", { name: "Submit work for requirement 1" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("explains terminal membership loss without offering a futile retry", () => {
    mockUseController.mockReturnValue(
      controller({
        queue: {
          ...controller().queue,
          sendFailed: true,
          failedJob: {
            jobId: "link-1",
            kind: "workLink",
            at: 1,
            discardable: true,
            reason: "membershipLost",
            retryable: false,
          },
        },
      })
    );
    render();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/no longer have the garden role/i);
    expect(within(alert).queryByRole("button", { name: "Try Again" })).not.toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("names duplicate-action requirement rows uniquely", async () => {
    const eligible = work();
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          requirements: [requirement(0, 44n, 2, 0), requirement(1, 44n, 3, 1)],
        }),
        works: [eligible],
        linkableWorks: [eligible],
      })
    );
    render();

    await userEvent.click(screen.getByRole("button", { name: "Link Work" }));
    await userEvent.click(screen.getByRole("radio", { name: /Prune the north beds/ }));

    const row = screen.getByRole("group", { name: "Which row it fulfills" });
    expect(
      within(row).getByRole("radio", { name: /Requirement 1.*Prune the north beds/ })
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("radio", { name: /Requirement 2.*Prune the north beds/ })
    ).toBeInTheDocument();
    await userEvent.click(
      within(row).getByRole("radio", { name: /Requirement 2.*Prune the north beds/ })
    );
    await userEvent.click(screen.getByRole("button", { name: "Link This Work" }));
    expect(mockActs.linkWork).toHaveBeenCalledWith(WORK, 1, expect.any(String));
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

  it.each([
    ["awaitingApproval", "Linked · waiting for approval"],
    ["readyToReconcile", "Approved · waiting for a steward to count it"],
    ["needsFreshReview", "Approved again · needs a fresh review"],
    ["counted", "Counted toward this promise"],
    ["unavailable", "Counting status unavailable"],
  ] as const)("shows the %s Work-link state honestly", (state, label) => {
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          requirements: [requirement(0, 44n, 2, state === "counted" ? 1 : 0)],
          workAttributions: [attribution({ creditActive: state === "counted" })],
        }),
        works: [work({ status: state === "awaitingApproval" ? "pending" : "approved" })],
        ...({
          workDecisions: {
            byWorkUID: { [WORK.toLowerCase()]: { state } },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
          },
        } as unknown as Partial<GardenCommitmentController>),
      })
    );

    render();

    const status = screen.getByText(label).closest('[role="status"]');
    expect(status).toBeInTheDocument();
    expect(status?.closest("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Open Prune the north beds" })).toHaveAttribute(
      "aria-describedby",
      status?.id
    );
  });

  it("shows a non-member how to join instead of an act, and joins from the card", async () => {
    mockJoinGarden.mockResolvedValue("0xjoin");
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: {
            derivedState: "OFFERED",
            onchainState: "OFFERED",
            creator: OTHER,
            leadProvider: OTHER,
          },
        }),
        seat: "bystander",
        actKind: null,
        roles: { ...controller().roles, isMemberHere: false },
        membership: {
          isMember: false,
          garden: { address: GARDEN, name: "Rocinha Community Garden", openJoining: true },
          unavailable: false,
          retry: vi.fn(),
        },
      })
    );
    render();
    expect(screen.queryByRole("button", { name: "Take This Up" })).not.toBeInTheDocument();
    expect(screen.getByText("Join Rocinha Community Garden to take this up.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    expect(mockJoinGarden).toHaveBeenCalledWith(GARDEN);
  });

  it("points a non-member at the garden when a steward lets people in, and says nothing while membership is unknown", () => {
    const visitor = controller({
      detail: detail({
        commitment: {
          derivedState: "REQUESTED",
          onchainState: "REQUESTED",
          creator: OTHER,
          leadProvider: OTHER,
        },
      }),
      seat: "bystander",
      actKind: null,
      membership: {
        isMember: false,
        garden: { address: GARDEN, name: "Rocinha Community Garden", openJoining: false },
        unavailable: false,
        retry: vi.fn(),
      },
    });
    mockUseController.mockReturnValue(visitor);
    const view = render();
    expect(screen.getByRole("button", { name: "Request to Join" })).toBeInTheDocument();

    mockUseController.mockReturnValue(
      controller({
        ...visitor,
        membership: { isMember: null, garden: null, unavailable: false, retry: vi.fn() },
      })
    );
    view.rerender(
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/9`]}>
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText(/to take this up\./i)).not.toBeInTheDocument();
  });

  it.each([
    [
      "submit",
      "Sending this promise for confirmation",
      "Send for confirmation",
      "Discard unsent submission",
    ],
    ["confirm", "Confirming this promise", "Send confirmation", "Discard unsent confirmation"],
  ] as const)("names a queued %s operation accurately", async (confirmationAction, title, send, discard) => {
    mockRetryAndSend.mockResolvedValue(undefined);
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "confirmation-9",
            kind: "confirmation",
            confirmationAction,
            waitingReason: null,
            discardable: true,
            createdAt: 1,
          },
        },
      })
    );
    render();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: discard })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: send }));
    expect(mockRetryAndSend).toHaveBeenCalledWith("confirmation-9");
  });

  it.each([
    "takeUp",
    "askToTakeUp",
  ] as const)("names queued %s without assuming it requires approval", (actKind) => {
    mockUseController.mockReturnValue(
      controller({
        actKind,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: null,
            discardable: true,
            createdAt: 1,
          },
        },
      })
    );
    render();
    expect(screen.getByRole("button", { name: "Send take-up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard unsent take-up" })).toBeEnabled();
  });

  it("draws a parked act with why it waits, and sends or drops it from the row", async () => {
    mockRetryAndSend.mockResolvedValue(undefined);
    mockDiscardJob.mockResolvedValue(true);
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: "membership-unavailable",
            discardable: true,
            createdAt: 1,
          },
        },
      })
    );
    render();
    expect(screen.queryByText(/your last act here is waiting/i)).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for your membership")).toBeInTheDocument();
    expect(screen.getByText("Taking up this promise")).toBeInTheDocument();
    expect(screen.getByText(/sends once your garden membership lands/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send take-up" }));
    expect(mockRetryAndSend).toHaveBeenCalledWith("claim-9");
    await userEvent.click(screen.getByRole("button", { name: "Discard unsent take-up" }));
    expect(mockDiscardJob).toHaveBeenCalledWith("claim-9");
    expect(mockFlush).not.toHaveBeenCalled();
  });

  describe("a parked act, for a reader who sends from their own tap (a wallet sign-in)", () => {
    const parked = (act: Record<string, unknown>) =>
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          sendsFromTap: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: null,
            discardable: true,
            createdAt: 1,
            ...act,
          },
        },
      });

    // A declined network switch leaves the act marked as a declined signature
    // does ("send-intent-expired"); any other network failure leaves it plain.
    it.each([
      null,
      "send-intent-expired",
    ])("says it was not sent and why, and offers the send and the discard (waiting reason: %s)", (waitingReason) => {
      mockUseController.mockReturnValue(
        parked({
          waitingReason,
          sendFailure: {
            messageId: "app.errors.wallet.wrongNetwork.message",
            values: { network: "Arbitrum One" },
            walletNetwork: true,
          },
        })
      );
      render();

      expect(screen.getByText("Saved on this phone, not sent")).toBeInTheDocument();
      // Only the change of network was declined, so it never reads as a signature.
      expect(screen.queryByText(/signature canceled/i)).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Your wallet needs to be on Arbitrum One for this. Switch it there, then try again."
        )
      ).toBeInTheDocument();
      // Nothing sends it for them, so nothing may say it will.
      expect(screen.queryByText(/sends when you're connected/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send take-up" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Discard unsent take-up" })).toBeEnabled();
    });

    it("says an act that was never tried waits for their send", () => {
      mockUseController.mockReturnValue(parked({}));
      render();

      expect(screen.getByText(/waits on this phone until you send it/i)).toBeInTheDocument();
      expect(screen.queryByText(/sends when you're connected/i)).not.toBeInTheDocument();
    });

    it("never says an act waiting for their membership sends on its own", () => {
      mockUseController.mockReturnValue(parked({ waitingReason: "membership-unavailable" }));
      render();

      expect(screen.getByText("Waiting for your membership")).toBeInTheDocument();
      expect(screen.getByText("Taking up this promise")).toBeInTheDocument();
      expect(screen.getByText(/send it once it has/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/sends once your garden membership lands/i)
      ).not.toBeInTheDocument();
    });
  });

  it("keeps saying a parked act sends itself for a reader the background flush sends for", () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: null,
            discardable: true,
            sendFailure: { messageId: "app.errors.blockchain.network.message" },
            createdAt: 1,
          },
        },
      })
    );
    render();

    expect(screen.getByText(/sends when you're connected/i)).toBeInTheDocument();
  });

  it("locks the parked row while this screen's own send is running", () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        isQueueing: true,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: null,
            discardable: true,
            createdAt: 1,
          },
        },
      })
    );
    render();
    // A discard now could delete the record of a transaction about to broadcast.
    expect(screen.getByText("Sending from this phone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send take-up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard unsent take-up" })).toBeDisabled();
  });

  it("says so when Discard is refused, instead of silently redrawing the row", async () => {
    mockDiscardJob.mockResolvedValue(false);
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: null,
            discardable: true,
            createdAt: 1,
          },
        },
      })
    );
    render();
    await userEvent.click(screen.getByRole("button", { name: "Discard unsent take-up" }));
    expect(mockDiscardJob).toHaveBeenCalledWith("claim-9");
    expect(await screen.findByText(/couldn't be discarded/i)).toBeInTheDocument();
  });

  it("checks a send on record instead of sending it again, and offers no way to drop it", async () => {
    // The transaction may still land; the row asks the chain rather than resend.
    mockRetryAndSend.mockResolvedValue(undefined);
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "claim-9",
            kind: "claim",
            waitingReason: "awaiting-confirmation",
            discardable: false,
            createdAt: 1,
          },
        },
      })
    );
    render();
    expect(screen.getByText("May already be sent")).toBeInTheDocument();
    expect(
      screen.getByText(/can't be discarded or sent twice while we check/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Discard unsent take-up" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Check Again" }));
    expect(mockRetryAndSend).toHaveBeenCalledWith("claim-9");
  });

  it("says a proof from this phone is on its way, with no notice to send it twice", () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "proof-9",
            kind: "evidence",
            waitingReason: "awaiting-confirmation",
            discardable: false,
            createdAt: Date.now(),
          },
          proofSending: true,
          proofOnItsWay: { photos: 2, videos: 0, voiceNotes: 1, links: 1, words: true },
        },
      })
    );
    render();

    expect(
      screen.getByText("Your proof is on its way: 2 photos, 1 voice note, 1 link.")
    ).toBeInTheDocument();
    expect(screen.queryByText("May already be sent")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check Again" })).not.toBeInTheDocument();
  });

  it("says a declined proof is still on this phone, above, in progress and in the history", () => {
    mockUseController.mockReturnValue(
      controller({
        actKind: null,
        queue: {
          ...controller().queue,
          hasPendingJob: true,
          pendingAct: {
            jobId: "proof-9",
            kind: "evidence",
            waitingReason: "send-intent-expired",
            discardable: true,
            createdAt: Date.now(),
          },
        },
      })
    );
    render();

    expect(screen.getByText("Signature canceled. Nothing was sent")).toBeInTheDocument();
    expect(
      screen.getByText("No proof on the promise yet. Yours is still on this phone (see above).")
    ).toBeInTheDocument();
    const line = screen.getByText("Sending was canceled. Nothing was sent").closest("li");
    expect(line).toHaveAttribute("data-local", "true");
  });

  it("offers the membership check again when it could not be read", async () => {
    const retry = vi.fn();
    mockUseController.mockReturnValue(
      controller({
        detail: detail({
          commitment: {
            derivedState: "OFFERED",
            onchainState: "OFFERED",
            creator: OTHER,
            leadProvider: OTHER,
          },
        }),
        seat: "bystander",
        actKind: null,
        membership: { isMember: null, garden: null, unavailable: true, retry },
      })
    );
    render();
    expect(screen.queryByText(/to take this up\./i)).not.toBeInTheDocument();
    expect(screen.getByText(/couldn't check whether you belong/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("a voucher booking on the promise page", () => {
  type BookingSnapshot = ReturnType<typeof bookingStorySnapshot>;
  /** The page over one booking or reward read, with the wallet and approval it reads beside it. */
  function show(
    snapshot: BookingSnapshot,
    page: GardenCommitmentController,
    holds = { techAndSun: 9, greenGoods: 2 }
  ) {
    mockUseController.mockReturnValue(page);
    mockUseServiceAccess.mockReturnValue({ data: snapshot, refetch: vi.fn() });
    mockServiceMutation.mockResolvedValue({
      kind: "local-rehearsal",
      observationId: "x",
      snapshot,
    });
    mockVoucherWallet.mockReturnValue({ data: bookingStoryWallet(snapshot, holds) });
    mockIssuerApproval.mockReturnValue({ data: VOUCHER_STORY_APPROVALS.techAndSunBootstrap });
    render();
  }

  it("names a booking by the voucher its setup froze, after the offer changed it", () => {
    const changed = bookingStorySnapshot("hubDay", "termsChanged");
    const { greenGoods } = VOUCHER_STORY_ISSUERS;
    show(
      {
        ...changed,
        offer: changed.offer && {
          ...changed.offer,
          voucher: { asset: greenGoods.asset, issuer: greenGoods.account, units: vouchers(1) },
        },
      },
      bookingStoryController("hubDay", "OFFERED")
    );
    const section = screen.getByRole("region", { name: "Service Access" });
    expect(section).toHaveTextContent("1 Tech and Sun voucher, still in your account");
    expect(section).not.toHaveTextContent("Green Goods voucher");
  });

  it("says Needs you when the promise waits on the reader under a booking that doesn't", () => {
    show(
      bookingStorySnapshot("hubDay", "transfersPending"),
      bookingStoryController("hubDay", "READY_FOR_CONFIRMATION")
    );
    const band = screen.getByRole("region", { name: "Where this stands" });
    expect(band).toHaveTextContent("Needs you");
    expect(band).toHaveAttribute("data-tone", "attention");
    expect(screen.getByRole("button", { name: "Confirm It Was Kept" })).toBeInTheDocument();
  });

  it("sends the transfers of an approved split whose prompt the reader declined", async () => {
    show(
      bookingStorySnapshot("hubDay", "transfersPending", { legsSent: false }),
      bookingStoryController("hubDay", "READY_FOR_CONFIRMATION")
    );
    await userEvent.click(screen.getByRole("button", { name: "Close the Booking" }));
    expect(mockServiceMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: "executeVoucherFinalLeg", leg: "release" })
    );
  });

  it("sends the deposit's confirmation again when it didn't reach the source", async () => {
    show(
      bookingStorySnapshot("hubDay", "confirmingDeposit", { ackStuck: true }),
      bookingStoryController("hubDay", "OFFERED")
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry Confirmation" }));
    expect(mockServiceMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: "retryVoucherSetupAcknowledgment", reviewedNativeFee: 0n })
    );
  });

  it("says why Deposit can't run while the escrow is paused", async () => {
    show(
      bookingStorySnapshot("hubDay", "readyToDeposit", { pause: { destinationVoucher: true } }),
      bookingStoryController("hubDay", "OFFERED")
    );
    await userEvent.click(screen.getByRole("button", { name: "Deposit 1 Voucher" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Depositing is paused.")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Deposit 1 Voucher" })).toBeDisabled();
  });

  it("offers Exchange Vouchers for too few vouchers only where a pool can quote", async () => {
    show(
      bookingStorySnapshot("hubDay", "readyToDeposit", { held: 0n }),
      bookingStoryController("hubDay", "OFFERED")
    );
    await userEvent.click(screen.getByRole("button", { name: "Deposit 1 Voucher" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("You hold 0 Tech and Sun vouchers.")).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Exchange Vouchers" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("offers Exchange Vouchers only when the pool can quote for vouchers the reader holds", async () => {
    // A pool is set up, but the reader holds none of the voucher it would take.
    const unquotable = (snapshot: BookingSnapshot): BookingSnapshot => ({
      ...snapshot,
      pilot: snapshot.pilot && { ...snapshot.pilot, holdings: { a: 0n, b: 0n } },
    });
    show(
      unquotable(bookingStorySnapshot("hubDay", "readyToDeposit", { held: 0n, exchange: "none" })),
      bookingStoryController("hubDay", "OFFERED")
    );
    await userEvent.click(screen.getByRole("button", { name: "Deposit 1 Voucher" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).queryByRole("button", { name: "Exchange Vouchers" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("gives the too-few-vouchers door no Exchange act when the pool can't quote", () => {
    const short = bookingStorySnapshot("access", "notEnough", { exchange: "none" });
    show(
      { ...short, pilot: short.pilot && { ...short.pilot, holdings: { a: 0n, b: 0n } } },
      bookingStoryController("access", "OFFERED")
    );
    expect(document.querySelector('[data-component="JoinToAct"][data-mode="door"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Exchange Vouchers" })).toBeNull();
  });

  describe("the same offer, read by a buyer and by the person who made it", () => {
    const OPEN_FOR_BOOKING = "Open for booking. Nothing moves until you agree to the exact terms.";
    const OWN_OFFER = "Neighbors can take this up. You can withdraw it until someone does.";

    function creatorPage(
      coreState: Parameters<typeof bookingStoryController>[1] = "OFFERED",
      actKind: GardenCommitmentController["actKind"] = "withdraw"
    ): GardenCommitmentController {
      const page = bookingStoryController("hubDay", coreState);
      return { ...page, viewer: page.detail!.commitment.creator!, seat: "provider", actKind };
    }

    it("offers a buyer the booking", () => {
      show(bookingStorySnapshot("hubDay", "open"), bookingStoryController("hubDay", "OFFERED"));
      expect(screen.getByText(OPEN_FOR_BOOKING)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Service Access" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review and Redeem" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Check Status" })).toBeInTheDocument();
      expect(screen.queryByText("Takes")).not.toBeInTheDocument();
    });

    it("shows a buyer who holds too few vouchers the way to get more", () => {
      show(bookingStorySnapshot("hubDay", "open"), bookingStoryController("hubDay", "OFFERED"), {
        techAndSun: 0,
        greenGoods: 0,
      });
      expect(screen.getByText("You hold 0 Tech and Sun vouchers.")).toBeInTheDocument();
    });

    it.each([
      { holding: "enough vouchers", techAndSun: 9 },
      { holding: "no vouchers", techAndSun: 0 },
    ])("tells its creator holding $holding what it takes and leaves them their own act", ({
      techAndSun,
    }) => {
      show(bookingStorySnapshot("hubDay", "open"), creatorPage(), { techAndSun, greenGoods: 0 });
      expect(screen.getByText(OWN_OFFER)).toBeInTheDocument();
      expect(screen.queryByText(OPEN_FOR_BOOKING)).not.toBeInTheDocument();
      const promised = within(screen.getByRole("region", { name: "What was promised" }));
      expect(promised.getByText("Takes")).toBeInTheDocument();
      expect(promised.getByText("1 Tech and Sun voucher")).toBeInTheDocument();
      expect(screen.queryByText(/^You hold/)).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Service Access" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Review and Redeem" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Check Status" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Withdraw This" })).toBeInTheDocument();
    });

    it.each([
      { state: "ACTIVE", actKind: "addProof", sentence: /^Add proof as you go/, act: "Add Proof" },
      {
        state: "CANCELLED",
        actKind: "offerAgain",
        sentence: /^It has left the pool/,
        act: "Offer It Again",
      },
    ] as const)("keeps the promise's own sentence and act for its creator when $state", ({
      state,
      actKind,
      sentence,
      act,
    }) => {
      show(bookingStorySnapshot("hubDay", "open"), creatorPage(state, actKind));
      expect(screen.getByText(sentence)).toBeInTheDocument();
      expect(screen.queryByText(OPEN_FOR_BOOKING)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: act })).toBeInTheDocument();
    });

    it("tells its creator when nobody can take it up, and leaves them Withdraw", () => {
      const offer = bookingStorySnapshot("hubDay", "open");
      show({ ...offer, pause: { ...offer.pause, sourceVoucher: true } }, creatorPage());
      expect(
        screen.getByText(
          "New bookings are paused, so nobody can take this up for now. You can still withdraw it."
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(OWN_OFFER)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Withdraw This" })).toBeInTheDocument();
    });

    it("keeps a reward's section for its creator, without asking them to agree to it", () => {
      show(
        withReviewedReward(bookingStorySnapshot("hubDay", "open"), `0x${"c".repeat(64)}`),
        creatorPage()
      );
      expect(screen.getByRole("region", { name: "Rewards" })).toBeInTheDocument();
      expect(screen.getByText(OWN_OFFER)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Agree to the Rewards" })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ask for Help" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Check Status" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Withdraw This" })).toBeInTheDocument();
    });
  });

  it("asks a short pool for a smaller exchange, not the same quote again", async () => {
    const quoted = bookingStorySnapshot("access", "notEnough", { exchange: "quoted" });
    const pilot = quoted.pilot!;
    show(
      {
        ...quoted,
        pilot: {
          ...pilot,
          exchange: {
            ...pilot.exchange,
            status: "failed",
            failure: "inventory",
            inventory: vouchers(5),
          },
        },
      },
      bookingStoryController("access", "OFFERED")
    );
    await userEvent.click(screen.getByRole("button", { name: "Exchange Vouchers" }));
    await userEvent.click(screen.getByRole("button", { name: "Try a Smaller Amount" }));
    expect(mockServiceMutation).toHaveBeenCalledWith({
      action: "quotePilotExchange",
      input: vouchers(5),
    });
  });

  it("takes Ask for Help to the app's Help for an agreement the app can't sign", async () => {
    show(
      rewardStorySnapshot("agreementUnavailable", true),
      rewardStoryController("agreementUnavailable", true)
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask for Help" }));
    expect(screen.getByTestId("help-route")).toHaveTextContent("/home/profile?tab=help");
  });

  function withReviewedReward(
    snapshot: BookingSnapshot,
    termsHash: `0x${string}`
  ): BookingSnapshot {
    Object.assign(snapshot, {
      evidence: "onchain",
      availableActions: ["consentEarnedTerms"],
    });
    snapshot.pause.core = false;
    snapshot.capabilities = {
      ...snapshot.capabilities,
      mutation: "onchain",
      reasons: [],
      sourceBuyer: snapshot.key.buyer,
      canSignSource: true,
    };
    snapshot.acceptancePolicy.earned = {
      ...snapshot.acceptancePolicy.earned,
      status: "bound",
      revision: 2n,
      module: VOUCHER_STORY_ISSUERS.techAndSun.account,
      termsHash,
      terms: {
        issuer: VOUCHER_STORY_ISSUERS.techAndSun.account,
        issuerAuthority: VOUCHER_STORY_ISSUERS.techAndSun.account,
        asset: {
          chainId: 100,
          token: VOUCHER_STORY_ISSUERS.techAndSun.asset.token,
          symbol: "TSV",
          decimals: 6,
        },
        totalUnits: vouchers(1),
        allocationPolicy: termsHash,
        serviceTermsRef: termsHash,
        season: 3n,
        issuerApproved: true,
        frozen: true,
      },
      creator: VOUCHER_STORY_ISSUERS.techAndSun.account,
      claimType: "individual",
      viewerConsentRevision: 0n,
      modulePaused: false,
    };
    return snapshot;
  }

  function showEarnedClaimRequests(
    stewardsPoolGarden: boolean,
    earned: Partial<BookingSnapshot["acceptancePolicy"]["earned"]> = {}
  ) {
    const snapshot = withReviewedReward(
      rewardStorySnapshot("agreementUnavailable", true),
      `0x${"c".repeat(64)}`
    );
    Object.assign(snapshot.acceptancePolicy.earned, earned);
    const page = rewardStoryController("agreementUnavailable", true);
    page.detail!.commitment.claimMode = "APPROVAL_GATED";
    page.roles.stewardsPoolGarden = stewardsPoolGarden;
    page.actKind = "askToTakeUp";
    page.canAskAgain = true;
    page.ownRequest = claimFixture({ claimant: page.viewer!, state: "DECLINED" });
    page.pendingClaimRequests = [claimFixture({ claimant: OTHER, state: "PENDING" })];
    page.acts = mockActs;
    show(snapshot, page);
  }

  it("lets a pool-garden steward decide earned reward claims without generic member take-up", async () => {
    showEarnedClaimRequests(true);
    const decisions = within(screen.getByRole("region", { name: "Waiting on you" }));
    await userEvent.click(decisions.getByRole("button", { name: /^Accept$/ }));
    expect(mockActs.acceptClaim).toHaveBeenCalledWith(OTHER);
    await userEvent.click(decisions.getByRole("button", { name: /^Decline$/ }));
    await userEvent.type(
      decisions.getByLabelText("Why not, in a sentence or two"),
      "Try next week"
    );
    await userEvent.click(decisions.getByRole("button", { name: /^Decline$/ }));
    expect(mockActs.declineClaim).toHaveBeenCalledWith(OTHER, "Try next week");
    expect(screen.queryByRole("button", { name: /^Ask again$/ })).not.toBeInTheDocument();
    expect(mockActs.claimPersonal).not.toHaveBeenCalled();
    expect(mockActs.claim).not.toHaveBeenCalled();
  });

  it.each([
    { name: "paused", earned: { modulePaused: true } },
    { name: "unread pause", earned: { modulePaused: null } },
    { name: "unread terms", earned: { terms: null } },
  ])("keeps Decline but disables earned Accept for $name", async ({ earned }) => {
    showEarnedClaimRequests(true, earned);
    const decisions = within(screen.getByRole("region", { name: "Waiting on you" }));
    const accept = decisions.getByRole("button", { name: /^Accept$/ });
    expect(accept).toBeDisabled();
    await userEvent.click(accept);
    expect(mockActs.acceptClaim).not.toHaveBeenCalled();
    await userEvent.click(decisions.getByRole("button", { name: /^Decline$/ }));
    await userEvent.type(decisions.getByLabelText("Why not, in a sentence or two"), "Try later");
    await userEvent.click(decisions.getByRole("button", { name: /^Decline$/ }));
    expect(mockActs.declineClaim).toHaveBeenCalledWith(OTHER, "Try later");
  });

  it("keeps earned member retries behind consent and hides decisions from non-stewards", () => {
    showEarnedClaimRequests(false);
    expect(screen.queryByRole("region", { name: "Waiting on you" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ask again$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agree and Take It Up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Take It Up$/ })).not.toBeInTheDocument();
    expect(mockActs.claimPersonal).not.toHaveBeenCalled();
  });

  it("reviews a combined booking's earned reward before offering the booking's own consent", async () => {
    const terms = `0x${"c".repeat(64)}` as const;
    const snapshot = withReviewedReward(bookingStorySnapshot("hubDay", "open"), terms);
    const page = bookingStoryController("hubDay", "OFFERED");
    const claimPersonal = vi.fn();
    show(snapshot, { ...page, acts: { ...page.acts, claimPersonal } });
    expect(screen.getByRole("region", { name: "Service Access" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Agree to the Rewards" }));
    const sheet = await screen.findByRole("dialog", { name: "Agree to the Rewards" });
    expect(
      within(sheet).getByText(
        "Agreeing records these exact rewards. Then review and agree to the service booking."
      )
    ).toBeInTheDocument();
    const agreed = structuredClone(snapshot);
    agreed.acceptancePolicy.earned.viewerConsentRevision = 2n;
    agreed.availableActions = ["requestClaim"];
    mockServiceMutation.mockResolvedValueOnce({
      kind: "onchain",
      observationId: "reward",
      snapshot: agreed,
    });
    await userEvent.click(within(sheet).getByRole("button", { name: "Agree to the Rewards" }));
    await waitFor(() => expect(mockServiceMutation).toHaveBeenCalledTimes(1));
    expect(mockServiceMutation).toHaveBeenCalledWith({
      action: "consentEarnedTerms",
      expectedRevision: 2n,
      expectedTermsHash: terms,
    });
    expect(claimPersonal).not.toHaveBeenCalled();
  });

  it("keeps an agreed reward on the booking path instead of a generic take-up", async () => {
    const terms = `0x${"c".repeat(64)}` as const;
    const snapshot = withReviewedReward(bookingStorySnapshot("hubDay", "open"), terms);
    snapshot.acceptancePolicy.earned.viewerConsentRevision = 2n;
    snapshot.availableActions = ["requestClaim"];
    const page = bookingStoryController("hubDay", "OFFERED");
    const claimPersonal = vi.fn();
    show(snapshot, { ...page, acts: { ...page.acts, claimPersonal } });
    expect(screen.queryByRole("button", { name: "Take It Up" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review and Redeem" }));
    expect(await screen.findByRole("dialog", { name: "Review and Redeem" })).toBeInTheDocument();
    expect(claimPersonal).not.toHaveBeenCalled();
    expect(mockServiceMutation).not.toHaveBeenCalled();
  });

  it("keeps context-requiring queued reward consent unavailable", () => {
    const snapshot = withReviewedReward(
      rewardStorySnapshot("agreementUnavailable", true),
      `0x${"c".repeat(64)}`
    );
    const page = rewardStoryController("agreementUnavailable", true);
    page.claimNeedsContext = true;
    page.actKind = null;
    page.queue.pendingAct = {
      jobId: "held-claim",
      kind: "claim",
      waitingReason: "reward-agreement-required",
      discardable: true,
      createdAt: 1,
    };
    show(snapshot, page);
    expect(screen.queryByRole("button", { name: "Agree and Take It Up" })).not.toBeInTheDocument();
    expect(mockServiceMutation).not.toHaveBeenCalled();
  });

  it.each([
    { name: "open take-up", actKind: "takeUp" as const, claimMode: "OPEN" as const, queued: false },
    {
      name: "reviewed take-up",
      actKind: "askToTakeUp" as const,
      claimMode: "APPROVAL_GATED" as const,
      queued: false,
    },
    { name: "queued open claim", actKind: null, claimMode: "OPEN" as const, queued: true },
    {
      name: "queued reviewed claim",
      actKind: null,
      claimMode: "APPROVAL_GATED" as const,
      queued: true,
    },
  ])("agrees to the reward before $name", async ({ actKind, claimMode, queued }) => {
    const TERMS = `0x${"c".repeat(64)}` as const;
    // A live open request whose reward its creator froze and this member can agree to.
    const snapshot = rewardStorySnapshot("agreementUnavailable", true);
    withReviewedReward(snapshot, TERMS);
    const page = rewardStoryController("agreementUnavailable", true);
    page.detail!.commitment.claimMode = claimMode;
    page.queue.hasPendingJob = queued;
    page.queue.pendingAct = queued
      ? {
          jobId: "held-claim",
          kind: "claim",
          waitingReason: "reward-agreement-required",
          discardable: true,
          createdAt: 1,
        }
      : null;
    const claimPersonal = vi.fn(async () => "claim-job");
    show(snapshot, { ...page, actKind, acts: { ...page.acts, claimPersonal } });
    expect(screen.queryByRole("button", { name: "Ask for Help" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Agree and Take It Up" }));
    const sheet = await screen.findByRole("dialog", { name: "Agree to the Rewards" });
    expect(
      within(sheet).getByText(
        claimMode === "OPEN"
          ? "Agreeing records these exact rewards. Then you take the promise up, and it's yours right away."
          : /Agreeing records these exact rewards with your request\./
      )
    ).toBeInTheDocument();
    // Once the agreement lands, the read no longer offers it.
    const agreed = structuredClone(snapshot);
    agreed.availableActions = [];
    agreed.acceptancePolicy.earned.viewerConsentRevision = 2n;
    mockServiceMutation.mockResolvedValueOnce({
      kind: "onchain",
      observationId: "x",
      snapshot: agreed,
    });
    await userEvent.click(within(sheet).getByRole("button", { name: "Agree and Take It Up" }));
    expect(mockServiceMutation).toHaveBeenCalledWith({
      action: "consentEarnedTerms",
      expectedRevision: 2n,
      expectedTermsHash: TERMS,
    });
    await waitFor(() => expect(claimPersonal).toHaveBeenCalledTimes(1));
  });
});

describe("a promise whose service read hasn't answered", () => {
  beforeEach(() => {
    mockUseController.mockReturnValue(
      controller({
        actKind: "askToTakeUp",
        seat: "bystander",
        detail: detail({
          commitment: {
            onchainState: "OFFERED",
            derivedState: "OFFERED",
            creator: OTHER,
            leadProvider: OTHER,
          },
        }),
      })
    );
  });

  it("holds the ordinary take-up while the read is on its way", () => {
    mockUseServiceAccess.mockReturnValue({
      data: undefined,
      status: "pending",
      fetchStatus: "fetching",
      isError: false,
      refetch: vi.fn(),
    });
    render();
    expect(screen.queryByRole("button", { name: "Ask to take this up" })).toBeNull();
    expect(screen.queryByText(/couldn't check how this promise/i)).toBeNull();
  });

  it("offers the check again when the read failed, instead of the ordinary take-up", async () => {
    const refetch = vi.fn();
    mockUseServiceAccess.mockReturnValue({
      data: undefined,
      status: "error",
      fetchStatus: "idle",
      isError: true,
      refetch,
    });
    render();
    expect(screen.queryByRole("button", { name: "Ask to take this up" })).toBeNull();
    expect(screen.getByText(/couldn't check how this promise is taken up/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("says why its requests are withheld after it was taken up, too", () => {
    mockUseController.mockReturnValue(controller({ actKind: null, seat: "confirmer" }));
    mockUseServiceAccess.mockReturnValue({
      data: undefined,
      status: "error",
      fetchStatus: "idle",
      isError: true,
      refetch: vi.fn(),
    });
    render();
    expect(screen.getByText(/couldn't check how this promise is taken up/i)).toBeInTheDocument();
  });
});

describe("a request that rewards vouchers", () => {
  function showReward(state: "bothOnTheWay" | "vouchersIn" | "received") {
    const snapshot = rewardStorySnapshot(state, true);
    mockUseController.mockReturnValue(rewardStoryController(state, true));
    mockUseServiceAccess.mockReturnValue({ data: snapshot, refetch: vi.fn() });
    mockVoucherWallet.mockReturnValue({
      data: bookingStoryWallet(snapshot, { techAndSun: 9, greenGoods: 0 }),
    });
    render("4103");
  }

  it("takes arrived vouchers to the wallet's Vouchers tab", async () => {
    showReward("vouchersIn");
    await userEvent.click(screen.getByRole("button", { name: "See Your Vouchers" }));
    expect(screen.getByTestId("home-route")).toHaveTextContent("/home?wallet=vouchers");
  });

  it("offers no way to the vouchers before they arrive", () => {
    showReward("bothOnTheWay");
    expect(screen.queryByRole("button", { name: "See Your Vouchers" })).toBeNull();
  });

  it("leads with the vouchers: the G$ shows once, on its own row in the rewards", () => {
    showReward("received");
    const promised = screen.getByRole("region", { name: "What was promised" });
    expect(within(promised).queryByText("Reward")).toBeNull();
    expect(document.querySelector('[data-component="PromiseReward"]')).toBeNull();
    expect(screen.getByText("2 Tech and Sun vouchers")).toBeInTheDocument();
    expect(screen.getByText("120 G$")).toBeInTheDocument();
  });
});
