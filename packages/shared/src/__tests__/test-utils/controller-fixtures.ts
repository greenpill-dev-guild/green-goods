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
