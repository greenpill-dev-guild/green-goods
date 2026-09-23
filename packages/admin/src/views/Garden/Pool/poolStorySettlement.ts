/**
 * Settlement story fixtures: the payout controller over a fulfilled Request
 * the story garden took up, priced 250 G$ and paid by the protocol garden, and
 * the module's operations switches. Pass a chain state to move the sequence
 * along; the workflow is derived from it exactly as the real controller does.
 */

import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type {
  CommitmentSettlementController,
  ProtocolFundingOperationsController,
  SettlementOperationsController,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { OntologyChainCapability } from "@green-goods/shared/ontology/types";
import type { CommitmentSettlementChainState } from "@green-goods/shared/modules/commitment-pooling/data-settlement-chain";
import {
  type SettlementChainDisbursement,
  type SettlementChainPlan,
  selectSettlementWorkflow,
} from "@green-goods/shared/modules/commitment-pooling/settlement-workflow";
import type { Address } from "@green-goods/shared/types/domain";
import { STORY_GARDEN, STORY_NOW, STORY_ROOT_GARDEN, STORY_STEWARD } from "./poolStoryActors";
import { STORY_COMMITMENTS, storyCommitment } from "./poolStoryCommitments";
import { storyPoolFunding } from "./poolStoryControllers";

const noop = async (): Promise<`0x${string}`> => "0x0";
const availableCapability: OntologyChainCapability = {
  deployment: "deployed",
  activation: "active",
  integration: "integrated",
  availability: "available",
  evidence: [],
  verified_at: "2026-09-03",
};
const G = 10n ** 18n;
const STORY_GDOLLAR = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a" as Address;

const STORY_PAYER_SAFE = "0xe41a1e446644034f24a4b2e1bfb28fd414dbc66d" as Address;
const STORY_BENEFICIARY_SAFE = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;

export function storySettlementPlan(
  overrides: Partial<SettlementChainPlan> = {}
): SettlementChainPlan {
  return {
    payoutPlanId: 7n,
    payoutKind: "GARDEN_BENEFICIARY",
    status: "DRAFT",
    finalized: false,
    source: STORY_PAYER_SAFE,
    token: STORY_GDOLLAR,
    declaredAmount: 250n * G,
    gardenRetainedAmount: 0n,
    contributorPayoutTotal: 0n,
    beneficiaryGarden: STORY_GARDEN,
    beneficiaryRecipient: STORY_BENEFICIARY_SAFE,
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

export function storySettlementDisbursement(
  overrides: Partial<SettlementChainDisbursement> = {}
): SettlementChainDisbursement {
  return {
    disbursementId: 40n,
    kind: "GARDEN_BENEFICIARY",
    contributor: null,
    recipient: STORY_BENEFICIARY_SAFE,
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

/**
 * The settlement controller over a fulfilled Request the story garden took up,
 * priced 250 G$ and paid by the protocol garden. Pass a chain state to move
 * the sequence along; the workflow is derived from it.
 */
export function storyCommitmentSettlement(
  overrides: Omit<Partial<CommitmentSettlementController>, "chain"> & {
    chain?: Partial<CommitmentSettlementChainState> | null;
  } = {}
): CommitmentSettlementController {
  const commitment = storyCommitment({
    ...STORY_COMMITMENTS[1],
    onchainState: "FULFILLED",
    state: "FULFILLED",
    derivedState: "FULFILLED",
    direction: "REQUEST",
    counterpartyKind: "GARDEN",
    considerationRail: "CELO_SETTLEMENT",
    considerationAmount: 250n * G,
    payerGarden: STORY_ROOT_GARDEN,
    providerGarden: STORY_GARDEN,
  });
  const chain: CommitmentSettlementChainState | null =
    overrides.chain === null
      ? null
      : {
          commitment: {
            state: "FULFILLED",
            direction: "REQUEST",
            counterpartyKind: "GARDEN",
            payerGarden: STORY_ROOT_GARDEN,
            providerGarden: STORY_GARDEN,
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
          payerAccount: { account: STORY_PAYER_SAFE, active: true, chainId: 42220 },
          beneficiaryAccount: { account: STORY_BENEFICIARY_SAFE, active: true, chainId: 42220 },
          recognitionReady: null,
          readAt: Number(STORY_NOW),
          ...overrides.chain,
        };
  const authority = overrides.authority ?? {
    isPayerSteward: true,
    canDispatchOrRetry: true,
    canRequeueOrCancel: true,
    resolved: true,
  };
  const { chain: _chain, ...rest } = overrides;
  const workflow =
    overrides.workflow ??
    selectSettlementWorkflow({
      kind: chain?.kind ?? "GARDEN_BENEFICIARY",
      plan: chain?.plan ?? null,
      rows: chain?.rows ?? [],
      disbursements: chain?.disbursements ?? [],
      gardenerDeliveryEnabled: chain ? chain.gardenerDeliveryEnabled : null,
      sourcePaused: chain ? chain.sourcePaused : null,
      payerAccountActive: chain ? chain.payerAccount?.active === true : null,
      beneficiaryAccountActive: chain ? chain.beneficiaryAccount?.active === true : null,
      recognitionReady: chain?.recognitionReady ?? null,
      authority: {
        viewer: STORY_STEWARD,
        isPayerSteward: authority.isPayerSteward,
        canDispatchOrRetry: authority.canDispatchOrRetry,
        canRequeueOrCancel: authority.canRequeueOrCancel,
      },
      isOnline: true,
      chainRead: chain ? "ready" : "pending",
      isActing: false,
      now: Number(STORY_NOW),
    });
  return {
    chainId: DEFAULT_CHAIN_ID,
    commitmentId: commitment.commitmentId,
    viewer: STORY_STEWARD,
    isOnline: true,
    availability: { status: "available", capability: availableCapability },
    eligibility: { eligible: true, kind: "GARDEN_BENEFICIARY", blockers: [] },
    kind: chain?.kind ?? "GARDEN_BENEFICIARY",
    payerGarden: STORY_ROOT_GARDEN,
    payerAccount: chain?.payerAccount ?? null,
    beneficiaryGarden: STORY_GARDEN,
    beneficiaryAccount: chain?.beneficiaryAccount ?? null,
    declaredAmount: 250n * G,
    token: STORY_GDOLLAR,
    chain,
    chainRead: chain ? "ready" : "pending",
    plan: chain?.plan ?? null,
    rows: chain?.rows ?? [],
    workflow,
    funding: storyPoolFunding(),
    authority,
    acts: {
      createPlan: noop,
      finalizePlan: noop,
      prepareBeneficiary: noop,
      prepareContributor: noop,
      dispatch: noop,
      retry: noop,
      requeue: noop,
      cancel: noop,
    },
    lastAct: null,
    isActing: false,
    refetch: async () => undefined,
    ...rest,
  };
}

export function storySettlementOperations(
  overrides: Partial<SettlementOperationsController> = {}
): SettlementOperationsController {
  return {
    chainId: DEFAULT_CHAIN_ID,
    viewer: STORY_STEWARD,
    availability: { status: "available", capability: availableCapability },
    gardenerDeliveryEnabled: false,
    sourcePaused: false,
    owner: STORY_STEWARD,
    isSettlementOwner: true,
    isDeployer: true,
    canConfigureDelivery: true,
    showControl: true,
    isLoading: false,
    isError: false,
    isPending: false,
    lastAct: null,
    setGardenerDelivery: noop,
    checkDeliveryStatus: async () => undefined,
    refetch: async () => undefined,
    ...overrides,
  };
}

export function storyProtocolFundingOperations(
  overrides: Partial<ProtocolFundingOperationsController> = {}
): ProtocolFundingOperationsController {
  return {
    chainId: DEFAULT_CHAIN_ID,
    viewer: STORY_STEWARD,
    protocolGarden: STORY_ROOT_GARDEN,
    targetGarden: STORY_GARDEN,
    isOnline: true,
    canQueueFunding: true,
    canDispatchOrRetry: true,
    canRequeueOrCancel: true,
    authorityResolved: true,
    showOperations: true,
    sourceFunding: storyPoolFunding(),
    targetFunding: storyPoolFunding({
      snapshot: {
        ...storyPoolFunding().snapshot!,
        safe: STORY_BENEFICIARY_SAFE,
        routeAddresses: {
          account: STORY_BENEFICIARY_SAFE,
          indexed: STORY_BENEFICIARY_SAFE,
          live: STORY_BENEFICIARY_SAFE,
        },
      },
    }),
    rows: [
      {
        id: `${DEFAULT_CHAIN_ID}-40`,
        disbursementId: 40n,
        recipient: STORY_BENEFICIARY_SAFE,
        amount: 2n * G,
        state: "queued",
        executionKey: null,
        canDispatch: true,
        canRetry: false,
        canRequeue: false,
        canCancel: true,
      },
    ],
    lastAct: null,
    isActing: false,
    queueFunding: async () => noop(),
    dispatch: async () => noop(),
    retry: async () => noop(),
    requeue: async () => noop(),
    cancel: async () => noop(),
    refetch: async () => undefined,
    ...overrides,
  };
}
