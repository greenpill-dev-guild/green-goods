import type {
  CommitmentDialogActs,
  CommitmentDialogController,
  HubConfirmQueueActs,
  HubConfirmQueueController,
  PoolConsoleActs,
  PoolConsoleController,
} from "../../hooks/admin-ui/pool";
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
import { selectConfirmationEligibility } from "../../modules/commitment-pooling/selectors";
import type {
  CommitmentPoolRecord,
  CommitmentReadModel,
  HexString,
} from "../../modules/commitment-pooling/types";
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
