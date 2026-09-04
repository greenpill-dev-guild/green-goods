import type {
  CommitmentDialogActs,
  CommitmentDialogController,
  HubConfirmQueueActs,
  HubConfirmQueueController,
  PoolConsoleActs,
  PoolConsoleController,
} from "../../hooks/admin-ui/pool";
import type {
  GardenCommitmentActs,
  GardenCommitmentController,
  ProofComposerController,
} from "../../hooks/client-ui/commitment";
import type { CommitmentsToConfirm } from "../../hooks/commitment-pooling/useCommitmentsToConfirm";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  MARIA,
  NOW,
  TUNDE,
} from "../../modules/commitment-pooling/demo/demo-builders";
import { selectPromiseKeptRate } from "../../modules/commitment-pooling/disclosure";
import { selectCommitmentActPermissions } from "../../modules/commitment-pooling/commitment-act-permissions";
import { selectPoolConsoleModel } from "../../modules/commitment-pooling/pool-console";
import { selectProofReadiness } from "../../hooks/client-ui/commitment/proofReadiness";
import {
  selectCommitmentSeat,
  selectConfirmationEligibility,
} from "../../modules/commitment-pooling/selectors";
import type { CommitmentPoolRecord, HexString } from "../../modules/commitment-pooling/types";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  cycleFixture,
  poolFixture,
  toConfirmFixture,
} from "./commitment-pooling-fixtures";

const successfulTransaction = async (): Promise<HexString> => "0x0";
const successfulJob = async (): Promise<string> => "fixture-job";

const gardenCommitmentActs: GardenCommitmentActs = {
  claim: successfulJob,
  claimPersonal: successfulJob,
  linkWork: successfulJob,
  sendForConfirmation: successfulJob,
  confirm: successfulJob,
  notYet: successfulTransaction,
  join: successfulTransaction,
  withdraw: successfulTransaction,
  acceptClaim: successfulTransaction,
  declineClaim: successfulTransaction,
};

export function gardenCommitmentControllerFixture(
  overrides: Partial<GardenCommitmentController> = {}
): GardenCommitmentController {
  const detail = overrides.detail === undefined ? commitmentDetailFixture() : overrides.detail;
  const pool = overrides.pool === undefined ? poolFixture() : overrides.pool;
  const viewer = overrides.viewer === undefined ? TUNDE : overrides.viewer;
  const seat =
    overrides.seat ??
    (detail
      ? selectCommitmentSeat({
          commitment: detail.commitment,
          contributors: detail.contributors
            .filter((row) => row.active)
            .map((row) => row.contributor),
          viewer: viewer ?? undefined,
        })
      : null);
  return {
    chainId: DEMO_CHAIN_ID,
    routeGarden: DEMO_GARDEN,
    workGarden: detail?.commitment.providerGarden ?? null,
    viewer,
    isOnline: true,
    status: detail ? "ready" : "notFound",
    availability: { status: "available", capability: availableCapability },
    detail,
    metadata: { version: 1, title: "Repair tool handles" },
    pool,
    works: [],
    actions: [],
    roles: {
      isSteward: false,
      stewardsPoolGarden: false,
      counterpartyGarden: undefined,
      stewardsCounterparty: false,
      garden: undefined,
      isMemberHere: false,
      claimGardens: { member: [], stewarded: [] },
    },
    seat,
    actGarden: detail?.commitment.providerGarden ?? DEMO_GARDEN,
    actKind: null,
    joinable: false,
    linkable: false,
    linkableWorks: [],
    workDecisions: {
      decisions: [],
      byWorkUID: new Map(),
      isLoading: false,
      isError: false,
      readAvailable: true,
      refetch: async () => undefined,
    },
    ownRequest: null,
    pendingClaimRequests: [],
    canAskAgain: false,
    claimNeedsContext: false,
    queue: {
      hasPendingJob: false,
      sendFailed: false,
      failedJob: null,
      isUnavailable: false,
      refresh: () => undefined,
    },
    confirmation: {
      phase: "ask",
      canNotYet: false,
      gardenAddress: DEMO_GARDEN,
      membershipNotRequired: false,
    },
    pinFailed: false,
    isQueueing: false,
    isSending: false,
    acts: gardenCommitmentActs,
    refetch: async () => undefined,
    ...overrides,
  };
}

export function proofComposerControllerFixture(
  overrides: Partial<ProofComposerController> = {}
): ProofComposerController {
  const detail =
    overrides.detail === undefined
      ? commitmentDetailFixture({
          commitment: commitmentFixture({ creator: TUNDE, leadProvider: TUNDE }),
        })
      : overrides.detail;
  const media = overrides.media ?? [];
  const audioNotes = overrides.audioNotes ?? [];
  const note = overrides.note ?? "";
  const links = overrides.links ?? [];
  const credited = overrides.credited ?? [TUNDE];
  const isProcessing = overrides.isProcessing ?? false;
  const isRecording = overrides.isRecording ?? false;
  const hasAnything =
    media.length > 0 || audioNotes.length > 0 || note.trim().length > 0 || links.length > 0;

  return {
    status: detail ? "ready" : "notYours",
    availability: { status: "available", capability: availableCapability },
    isOnline: true,
    viewer: TUNDE,
    detail,
    commitment: detail?.commitment ?? null,
    metadata: { version: 1, title: "Repair tool handles" },
    roster: [
      { address: TUNDE, isLead: true },
      { address: MARIA, isLead: false },
    ],
    media,
    audioNotes,
    note,
    setNote: () => undefined,
    links,
    setLinks: () => undefined,
    credited,
    clientEvidenceId: "fixture-evidence-id",
    isProcessing,
    isRecording,
    recordingElapsed: 0,
    isPending: false,
    linkInvalid: false,
    imageUrls: [],
    readiness: (beat) =>
      selectProofReadiness({
        beat,
        isProcessing,
        isRecording,
        hasAnything,
        creditedCount: credited.length,
        links,
      }),
    toggleCredit: () => undefined,
    toggleRecording: () => undefined,
    pick: async () => ({ rejectedCount: 0 }),
    removeMedia: () => undefined,
    removeAudio: () => undefined,
    submit: async () => true,
    refetch: async () => undefined,
    ...overrides,
  };
}

const poolActs: PoolConsoleActs = {
  pause: successfulTransaction,
  resume: successfulTransaction,
  closePool: successfulTransaction,
  compostPool: successfulTransaction,
  reopenPool: successfulTransaction,
  cancelCycle: successfulTransaction,
  closeCycle: successfulTransaction,
  compostCycle: successfulTransaction,
  expire: successfulTransaction,
  acceptClaim: successfulTransaction,
  declineClaim: successfulTransaction,
  saveSettings: async () => undefined,
};

type PoolConsoleFixtureOverrides = Omit<Partial<PoolConsoleController>, "pool" | "poolId"> & {
  pool?: CommitmentPoolRecord | null;
};

export function poolConsoleControllerFixture(
  overrides: PoolConsoleFixtureOverrides = {}
): PoolConsoleController {
  const { pool: poolOverride, ...controllerOverrides } = overrides;
  const pool = poolOverride === undefined ? poolFixture() : poolOverride;
  const cycles =
    controllerOverrides.cycles ?? (pool ? [cycleFixture({ poolId: pool.poolId })] : []);
  const commitments = controllerOverrides.commitments ?? (pool ? [commitmentFixture()] : []);
  const claims = controllerOverrides.claims ?? [];
  return {
    chainId: DEMO_CHAIN_ID,
    garden: DEMO_GARDEN,
    viewer: TUNDE,
    isOnline: true,
    availability: { status: "available", capability: availableCapability },
    pool: pool ? { ...pool, promiseKeptRate: selectPromiseKeptRate(pool) } : null,
    poolId: pool?.poolId,
    model:
      controllerOverrides.model ??
      selectPoolConsoleModel({
        pool,
        cycles,
        commitments,
        pendingClaimCount: claims.length,
        now: BigInt(NOW),
      }),
    cycles,
    cycleNames: new Map(),
    commitments,
    titles: new Map(),
    claims,
    charter: { charter: null, isLoading: false, isUnavailable: false },
    pauseReason: { reason: null, isLoading: false, isUnavailable: false },
    pendingCreates: [],
    queueUnavailable: false,
    funding: {
      snapshot: null,
      isError: false,
      isFetching: false,
      isLoading: true,
      isRefetching: false,
      hasStaleBalance: false,
      lastReadAt: null,
      ledgerReadAt: null,
      refetch: async () => undefined,
    },
    acts: poolActs,
    isActing: false,
    isLoading: false,
    isError: false,
    refetch: async () => [],
    ...controllerOverrides,
  };
}

const confirmQueueActs: HubConfirmQueueActs = {
  confirm: successfulJob,
  notYet: successfulTransaction,
};

type HubConfirmQueueFixtureOverrides = Partial<HubConfirmQueueController> & {
  toConfirm?: CommitmentsToConfirm;
};

export function hubConfirmQueueControllerFixture(
  overrides: HubConfirmQueueFixtureOverrides = {}
): HubConfirmQueueController {
  const { toConfirm = toConfirmFixture(), ...controllerOverrides } = overrides;
  type Row = HubConfirmQueueController["rows"][number];
  const rows: HubConfirmQueueController["rows"] = [
    ...toConfirm.groups.flatMap((group) =>
      group.rows.map(
        (row): Row => ({
          commitment: row.commitment,
          garden: group.garden,
          gardenName: group.gardenName,
          eligibility: "ORDINARY",
          title: null,
          poolGarden: row.poolGarden,
          canDispute: row.canDispute,
        })
      )
    ),
    ...toConfirm.fallback.map(
      (row): Row => ({
        commitment: row.commitment,
        garden: row.garden,
        gardenName: row.gardenName,
        eligibility: row.path,
        title: null,
        poolGarden: row.poolGarden,
        canDispute: row.canDispute,
      })
    ),
    ...(toConfirm.disputed ?? []).map(
      (row): Row => ({
        commitment: row.commitment,
        garden: row.garden,
        gardenName: row.gardenName,
        eligibility: "DISPUTED",
        title: null,
        poolGarden: row.garden,
        canDispute: true,
      })
    ),
  ];
  return {
    rows,
    isOnline: true,
    isLoading: false,
    isError: false,
    isConfirming: false,
    isDisputing: false,
    acts: confirmQueueActs,
    ...controllerOverrides,
  };
}

const dialogActs: CommitmentDialogActs = {
  cancel: successfulTransaction,
  markReady: successfulTransaction,
  sendForConfirmation: successfulJob,
  attachAssessment: successfulTransaction,
  raiseDispute: successfulTransaction,
  resolveDispute: successfulTransaction,
  expire: successfulTransaction,
  confirmOrdinary: successfulJob,
  confirmFallback: successfulTransaction,
  acceptClaim: successfulTransaction,
  declineClaim: successfulTransaction,
  syncWorkDecisions: successfulTransaction,
};

export function commitmentDialogControllerFixture(
  overrides: Partial<CommitmentDialogController> = {}
): CommitmentDialogController {
  const commitment =
    overrides.commitment === undefined ? commitmentFixture() : overrides.commitment;
  const detail =
    overrides.detail === undefined
      ? commitment
        ? commitmentDetailFixture({ commitment })
        : null
      : overrides.detail;
  const activeContributors =
    overrides.activeContributors ??
    (detail?.contributors ?? []).filter((row) => row.active).map((row) => row.contributor);
  const viewer = overrides.viewer ?? TUNDE;
  const isLocalSteward = overrides.isLocalSteward ?? true;
  const confirmation =
    overrides.confirmation ??
    selectConfirmationEligibility({
      state: commitment?.onchainState ?? "",
      viewer,
      contributors: activeContributors,
      alreadyConfirmed: false,
      ordinaryEligible: false,
      ordinaryReachable: true,
      localFallbackSteward: isLocalSteward,
      protocolFallbackSteward: false,
      protocolFallbackEnabled: commitment?.protocolFallbackEnabled === true,
    });
  const can =
    overrides.can ??
    selectCommitmentActPermissions({
      commitment,
      viewer,
      requirementCount: detail?.requirements.length ?? 0,
      isPoolSteward: isLocalSteward,
      isParty: false,
      disputeAuthorized: false,
      onRoster: false,
      poolPaused: false,
      poolUnread: false,
      cycleUnread: false,
      submissionReady: false,
      overrideReady: false,
      hasPendingJob: false,
      isDue: false,
      confirmation,
    });
  return {
    chainId: DEMO_CHAIN_ID,
    garden: DEMO_GARDEN,
    viewer,
    isOnline: true,
    availability: { status: "available", capability: availableCapability },
    commitment,
    detail,
    title: "Repair tool handles",
    note: null,
    cycle: cycleFixture(),
    events: [],
    disputeReason: { reason: null, isLoading: false, isUnavailable: false },
    cancelReason: { reason: null, isLoading: false, isUnavailable: false },
    assessments: [],
    assessmentsLoading: false,
    activeContributors,
    seat: "bystander",
    isLocalSteward,
    isProtocolSteward: false,
    onRoster: false,
    poolPaused: false,
    ordinaryReachable: true,
    confirmation,
    isDue: false,
    hasPendingJob: false,
    can,
    reconciliation: {
      candidates: [],
      count: 0,
      decisionUIDs: [],
      readAvailable: true,
      isLoading: false,
      isError: false,
      pendingReadback: false,
      succeeded: false,
      readbackStatus: "idle",
      unavailableReadback: false,
      needsFreshReview: false,
      error: null,
      refetch: async () => undefined,
    },
    acts: dialogActs,
    isActing: false,
    isLoading: false,
    isError: false,
    unavailable: false,
    notFound: false,
    refetch: async () => [],
    ...overrides,
  };
}

// ── Settlement ──────────────────────────────────────────────────────────────

import type {
  CommitmentSettlementController,
  SettlementOperationsController,
} from "../../hooks/admin-ui/pool/controller.types";
import type { CommitmentSettlementChainState } from "../../modules/commitment-pooling/data-settlement-chain";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types";
import {
  selectSettlementEligibility,
  selectSettlementWorkflow,
  type SettlementChainDisbursement,
  type SettlementChainPlan,
} from "../../modules/commitment-pooling/settlement-workflow";
import type { Address } from "../../types/domain";

export const SETTLEMENT_PAYER_GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
export const SETTLEMENT_PROVIDER_GARDEN = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
export const SETTLEMENT_PAYER_SAFE = "0xe41a1e446644034f24a4b2e1bfb28fd414dbc66d" as Address;
export const SETTLEMENT_PROVIDER_SAFE = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;
export const SETTLEMENT_TOKEN = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a" as Address;
export const SETTLEMENT_OWNER = "0x1b9ac97ea62f69521a14cbe6f45eb24ad6612c19" as Address;
const G = 10n ** 18n;

/** A fulfilled Request a garden took up, priced 250 G$ on the Celo rail. */
export function settlementCommitmentFixture(overrides: Partial<CommitmentReadModel> = {}) {
  return commitmentFixture({
    commitmentId: 9n,
    onchainState: "FULFILLED",
    state: "FULFILLED",
    derivedState: "FULFILLED",
    direction: "REQUEST",
    counterpartyKind: "GARDEN",
    considerationRail: "CELO_SETTLEMENT",
    considerationAmount: 250n * G,
    payerGarden: SETTLEMENT_PAYER_GARDEN,
    providerGarden: SETTLEMENT_PROVIDER_GARDEN,
    ...overrides,
  });
}

export function settlementPlanFixture(
  overrides: Partial<SettlementChainPlan> = {}
): SettlementChainPlan {
  return {
    payoutPlanId: 7n,
    payoutKind: "GARDEN_BENEFICIARY",
    status: "DRAFT",
    finalized: false,
    source: SETTLEMENT_PAYER_SAFE,
    token: SETTLEMENT_TOKEN,
    declaredAmount: 250n * G,
    gardenRetainedAmount: 0n,
    contributorPayoutTotal: 0n,
    beneficiaryGarden: SETTLEMENT_PROVIDER_GARDEN,
    beneficiaryRecipient: SETTLEMENT_PROVIDER_SAFE,
    beneficiaryAmount: 250n * G,
    beneficiaryDisbursementId: null,
    payablePayoutCount: 1,
    preparedPayoutCount: 0,
    confirmedPayoutCount: 0,
    failedPayoutCount: 0,
    cancelledPayoutCount: 0,
    ...overrides,
  };
}

export function settlementDisbursementFixture(
  overrides: Partial<SettlementChainDisbursement> = {}
): SettlementChainDisbursement {
  return {
    disbursementId: 40n,
    kind: "GARDEN_BENEFICIARY",
    contributor: null,
    recipient: SETTLEMENT_PROVIDER_SAFE,
    amount: 250n * G,
    state: "QUEUED",
    batchId: null,
    attempt: 0,
    failureCode: null,
    cancelledFromState: null,
    dispatchedAt: null,
    acknowledgmentPending: false,
    ...overrides,
  };
}

export function settlementChainStateFixture(
  overrides: Partial<CommitmentSettlementChainState> = {}
): CommitmentSettlementChainState {
  return {
    commitment: {
      state: "FULFILLED",
      direction: "REQUEST",
      counterpartyKind: "GARDEN",
      payerGarden: SETTLEMENT_PAYER_GARDEN,
      providerGarden: SETTLEMENT_PROVIDER_GARDEN,
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: 250n * G,
      considerationSource: null,
      considerationToken: null,
      eligibleContributorCount: 1,
    },
    kind: "GARDEN_BENEFICIARY",
    payoutPlanId: null,
    plan: null,
    rows: [],
    disbursements: [],
    gardenerDeliveryEnabled: false,
    sourcePaused: false,
    payerAccount: { account: SETTLEMENT_PAYER_SAFE, active: true, chainId: 42220 },
    beneficiaryAccount: { account: SETTLEMENT_PROVIDER_SAFE, active: true, chainId: 42220 },
    recognitionReady: null,
    readAt: NOW,
    ...overrides,
  };
}

const settlementActs: CommitmentSettlementController["acts"] = {
  createPlan: successfulTransaction,
  finalizePlan: successfulTransaction,
  prepareBeneficiary: successfulTransaction,
  prepareContributor: successfulTransaction,
  dispatch: successfulTransaction,
  retry: successfulTransaction,
  requeue: successfulTransaction,
  cancel: successfulTransaction,
};

/**
 * The settlement controller as the admin section reads it. The workflow is
 * derived from the supplied chain state and authority unless overridden, so a
 * test that sets `chain` gets the matching steps for free.
 */
export function commitmentSettlementControllerFixture(
  overrides: Partial<CommitmentSettlementController> & {
    commitment?: CommitmentReadModel;
  } = {}
): CommitmentSettlementController {
  const commitment = overrides.commitment ?? settlementCommitmentFixture();
  const chain = overrides.chain === undefined ? settlementChainStateFixture() : overrides.chain;
  const availability = overrides.availability ?? {
    status: "available" as const,
    capability: availableCapability,
  };
  const eligibility =
    overrides.eligibility ?? selectSettlementEligibility({ commitment, availability });
  const kind = overrides.kind ?? chain?.kind ?? eligibility.kind;
  const authority = overrides.authority ?? {
    isPayerSteward: true,
    canDispatchOrRetry: true,
    canRequeueOrCancel: true,
    resolved: true,
  };
  const viewer = "viewer" in overrides ? overrides.viewer : TUNDE;
  const isOnline = overrides.isOnline ?? true;
  const isActing = overrides.isActing ?? false;
  const chainRead = overrides.chainRead ?? (chain ? "ready" : "pending");
  const workflow =
    overrides.workflow ??
    selectSettlementWorkflow({
      kind: kind ?? "GARDEN_BENEFICIARY",
      plan: chain?.plan ?? null,
      rows: chain?.rows ?? [],
      disbursements: chain?.disbursements ?? [],
      gardenerDeliveryEnabled: chain ? chain.gardenerDeliveryEnabled : null,
      sourcePaused: chain ? chain.sourcePaused : null,
      payerAccountActive: chain ? chain.payerAccount?.active === true : null,
      beneficiaryAccountActive:
        chain && kind === "GARDEN_BENEFICIARY" ? chain.beneficiaryAccount?.active === true : null,
      recognitionReady: chain?.recognitionReady ?? null,
      authority: {
        viewer: viewer ?? undefined,
        isPayerSteward: authority.isPayerSteward,
        canDispatchOrRetry: authority.canDispatchOrRetry,
        canRequeueOrCancel: authority.canRequeueOrCancel,
      },
      isOnline,
      chainRead,
      isActing,
      now: NOW,
    });
  return {
    chainId: DEMO_CHAIN_ID,
    commitmentId: commitment.commitmentId,
    viewer: viewer ?? undefined,
    isOnline,
    availability,
    eligibility,
    kind,
    payerGarden: commitment.payerGarden ?? null,
    payerAccount: chain?.payerAccount ?? null,
    beneficiaryGarden:
      chain?.plan?.beneficiaryGarden ??
      (kind === "GARDEN_BENEFICIARY" ? (commitment.providerGarden ?? null) : null),
    beneficiaryAccount: chain?.beneficiaryAccount ?? null,
    declaredAmount: chain?.plan?.declaredAmount ?? commitment.considerationAmount ?? null,
    token: chain?.plan?.token ?? SETTLEMENT_TOKEN,
    chain,
    chainRead,
    plan: chain?.plan ?? null,
    rows: chain?.rows ?? [],
    workflow,
    funding: {
      snapshot: null,
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      isError: false,
      hasStaleBalance: false,
      lastReadAt: null,
      ledgerReadAt: null,
      refetch: async () => undefined,
    },
    authority,
    acts: settlementActs,
    lastAct: null,
    isActing,
    refetch: async () => undefined,
    ...overrides,
  };
}

export function settlementOperationsControllerFixture(
  overrides: Partial<SettlementOperationsController> = {}
): SettlementOperationsController {
  const viewer = "viewer" in overrides ? overrides.viewer : TUNDE;
  const owner = "owner" in overrides ? (overrides.owner ?? null) : SETTLEMENT_OWNER;
  const isSettlementOwner =
    overrides.isSettlementOwner ??
    Boolean(viewer && owner && owner.toLowerCase() === viewer.toLowerCase());
  const isDeployer = overrides.isDeployer ?? false;
  return {
    chainId: DEMO_CHAIN_ID,
    viewer: viewer ?? undefined,
    availability: { status: "available", capability: availableCapability },
    gardenerDeliveryEnabled: false,
    sourcePaused: false,
    owner,
    isSettlementOwner,
    isDeployer,
    canConfigureDelivery: isSettlementOwner,
    showControl: isSettlementOwner || isDeployer,
    isLoading: false,
    isError: false,
    isPending: false,
    lastAct: null,
    setGardenerDelivery: successfulTransaction,
    checkDeliveryStatus: async () => undefined,
    refetch: async () => undefined,
    ...overrides,
  };
}
