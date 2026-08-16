import {
  createTestIndexer as createEnvioTestIndexer,
  TestHelpers,
  type Address,
  type TestIndexer,
} from "envio";
import { createServer } from "node:http";

import "../src/EventHandlers";

type MockEventData = {
  chainId: number;
  block: { timestamp: number; number: number };
  srcAddress: string;
  transaction: { hash: string; input?: string };
  logIndex: number;
};

type MockEvent = MockEventData & {
  contract: string;
  event: string;
  params: Record<string, unknown>;
};

type EventArguments = Record<string, unknown> & {
  mockEventData: MockEventData;
};

type EventTestApi = {
  createMockEvent: (args: EventArguments) => MockEvent;
  processEvent: (args: { event: MockEvent; mockDb: TestIndexer }) => Promise<TestIndexer>;
};

const CHAIN_START_BLOCK = {
  42161: 433_713_812,
  11155111: 10_243_363,
} as const;
type SupportedChainId = keyof typeof CHAIN_START_BLOCK;
type ProcessConfig = Parameters<TestIndexer["process"]>[0];
type SimulatedEvent = NonNullable<
  NonNullable<ProcessConfig["chains"][SupportedChainId]>["simulate"]
>[number];
type MutableChainConfig = {
  startBlock: number;
  endBlock: number;
  simulate: SimulatedEvent[];
};

const nextBlockByIndexer = new WeakMap<TestIndexer, Map<SupportedChainId, number>>();

function normalizeChainId(chainId: number): SupportedChainId {
  if (chainId !== 42161 && chainId !== 11155111) {
    throw new Error(`Unsupported Green Goods test chain: ${chainId}`);
  }
  return chainId;
}

function allocateBlock(mockDb: TestIndexer, event: MockEvent, chainId: SupportedChainId): number {
  let nextBlockByChain = nextBlockByIndexer.get(mockDb);
  if (!nextBlockByChain) {
    nextBlockByChain = new Map();
    nextBlockByIndexer.set(mockDb, nextBlockByChain);
  }

  const nextBlock = nextBlockByChain.get(chainId) ?? CHAIN_START_BLOCK[chainId];
  const blockNumber =
    event.block.number >= CHAIN_START_BLOCK[chainId] ? event.block.number : nextBlock;
  nextBlockByChain.set(chainId, Math.max(nextBlock, blockNumber + 1));
  return blockNumber;
}

function toSimulatedEvent(event: MockEvent, blockNumber: number): SimulatedEvent {
  return {
    contract: event.contract,
    event: event.event,
    params: event.params,
    srcAddress: event.srcAddress as Address,
    logIndex: event.logIndex,
    block: {
      ...event.block,
      number: blockNumber,
    },
    transaction: event.transaction,
  } as SimulatedEvent;
}

export async function processEvents(
  mockDb: TestIndexer,
  events: readonly MockEvent[]
): Promise<TestIndexer> {
  if (events.length === 0) return mockDb;

  const chainConfigs: Partial<Record<SupportedChainId, MutableChainConfig>> = {};

  for (const event of events) {
    const chainId = normalizeChainId(event.chainId);
    const blockNumber = allocateBlock(mockDb, event, chainId);
    const existing = chainConfigs[chainId];

    if (existing) {
      existing.startBlock = Math.min(existing.startBlock, blockNumber);
      existing.endBlock = Math.max(existing.endBlock, blockNumber);
      existing.simulate.push(toSimulatedEvent(event, blockNumber));
    } else {
      chainConfigs[chainId] = {
        startBlock: blockNumber,
        endBlock: blockNumber,
        simulate: [toSimulatedEvent(event, blockNumber)],
      };
    }
  }

  const processConfig: ProcessConfig = {
    chains: {
      ...(chainConfigs[42161] ? { 42161: chainConfigs[42161] } : {}),
      ...(chainConfigs[11155111] ? { 11155111: chainConfigs[11155111] } : {}),
    },
  };

  await mockDb.process(processConfig);
  return mockDb;
}

async function processEvent(mockDb: TestIndexer, event: MockEvent): Promise<TestIndexer> {
  return processEvents(mockDb, [event]);
}

function createContract<const Events extends readonly string[]>(
  contract: string,
  _events: Events
): { [Event in Events[number]]: EventTestApi } {
  return new Proxy(
    {},
    {
      get(_target, eventKey) {
        const event = String(eventKey);
        return {
          createMockEvent(args: EventArguments): MockEvent {
            const { mockEventData, ...params } = args;
            return {
              ...mockEventData,
              contract,
              event,
              params,
            };
          },
          processEvent: ({ event: mockEvent, mockDb }: { event: MockEvent; mockDb: TestIndexer }) =>
            processEvent(mockDb, mockEvent),
        };
      },
    }
  ) as { [Event in Events[number]]: EventTestApi };
}

export const Addresses = TestHelpers.Addresses;
export const ActionRegistry = createContract("ActionRegistry", [
  "ActionRegistered",
  "GardenDomainsUpdated",
  "ActionStartTimeUpdated",
  "ActionEndTimeUpdated",
  "ActionTitleUpdated",
  "ActionInstructionsUpdated",
  "ActionMediaUpdated",
] as const);
export const CookieJarFactory = createContract("CookieJarFactory", [
  "JarCreated",
  "MetadataUpdated",
] as const);
export const GardenAccount = createContract("GardenAccount", [
  "NameUpdated",
  "DescriptionUpdated",
  "LocationUpdated",
  "BannerImageUpdated",
  "GAPProjectCreated",
  "OpenJoiningUpdated",
] as const);
export const GardenToken = createContract("GardenToken", ["GardenMinted"] as const);
export const GreenWill = createContract("GreenWill", [
  "BadgeClassConfigured",
  "BadgeIssued",
] as const);
export const HatsModule = createContract("HatsModule", ["RoleGranted", "RoleRevoked"] as const);
export const HypercertMinter = createContract("HypercertMinter", [
  "TransferSingle",
  "ClaimStored",
] as const);
export const OctantModule = createContract("OctantModule", [
  "VaultCreated",
  "HarvestTriggered",
  "EmergencyPaused",
  "DonationAddressUpdated",
] as const);
export const OctantVault = createContract("OctantVault", ["Deposit", "Withdraw"] as const);
export const YieldSplitter = createContract("YieldSplitter", ["YieldSplit"] as const);
export const SettlementModule = createContract("SettlementModule", [
  "SettlementDeploymentPinned",
  "FundingConfigurationLocked",
  "FundingPledged",
  "FundingDepositRecorded",
  "FundingConsumed",
  "FundingWithdrawn",
  "SettlementAccountRegistered",
  "SettlementRecoveryUpdated",
  "SettlementAccountStatusChanged",
  "CcipRouteUpdated",
  "GardenerDeliveryStatusChanged",
  "BatchSizeLimitUpdated",
  "DispatcherUpdated",
  "FeeReserveMinimumUpdated",
  "HatsModuleUpdated",
  "CommitmentPoolingModuleUpdated",
  "CreditRegistryUpdated",
  "PausedSet",
  "CommitmentPayoutPlanCreated",
  "ContributorPayoutSet",
  "CommitmentPayoutSnapshotCommitted",
  "CommitmentPayoutPlanFinalized",
  "DisbursementQueued",
  "LoanPrincipalQueued",
  "BatchCreated",
  "SettlementCommandDispatched",
  "SettlementCommandRetried",
  "SettlementAcknowledged",
  "DuplicateAcknowledgmentIgnored",
  "StaleAcknowledgmentIgnored",
  "StrandedSubjectFailed",
  "DisbursementRequeued",
  "DisbursementCancelled",
  "BatchCancelled",
  "FeeReserveFunded",
  "ExcessFeesWithdrawn",
] as const);
export const CommitmentPoolingModule = createContract("CommitmentPoolingModule", [
  "PoolRegistered",
  "PoolCharterUpdated",
  "PoolReady",
  "PoolOpened",
  "PoolPaused",
  "PoolResumed",
  "PoolClosed",
  "PoolComposted",
  "PoolReopened",
  "CycleSeeded",
  "CycleOpened",
  "CycleClosed",
  "CycleComposted",
  "CycleCancelled",
  "CommitmentSeriesCreated",
  "CommitmentSeriesMetadataUpdated",
  "CommitmentSeriesRested",
  "CommitmentSeriesResumed",
  "CommitmentSeriesRetired",
  "CommitmentCreated",
  "ConsiderationDeclared",
  "ValueDeclared",
  "ConfirmerRuleSet",
  "ClaimRequested",
  "ClaimDeclined",
  "CommitmentAccepted",
  "ExchangeAccepted",
  "ContributorAdded",
  "ContributorRemoved",
  "ContributorRequirementAssigned",
  "ContributorRosterFrozen",
  "WorkLinked",
  "WorkUnlinked",
  "ApprovedWorkCounted",
  "ApprovedWorkReversed",
  "EvidenceAttached",
  "AssessmentAttached",
  "CommitmentReadyForConfirmation",
  "ConfirmationRecorded",
  "CommitmentFulfilled",
  "CommitmentCancelled",
  "CommitmentExpired",
  "CommitmentDisputed",
  "DisputeResolved",
  "ConsiderationPaid",
  "ModuleDependencyUpdated",
  "ModuleSchemaUIDUpdated",
  "ModulePauseStatusChanged",
] as const);
export const CommitmentRegistry = createContract("CommitmentRegistry", [
  "ModuleUpdated",
  "ClassRegistered",
  "ProviderOpenCommitmentCapUpdated",
  "UnitsCommitted",
  "UnitsReleased",
  "UnitsFulfilled",
] as const);
export const CeloSettlementExecutor = createContract("CeloSettlementExecutor", [
  "ExecutorDeploymentPinned",
  "SourcePeerUpdated",
  "GardenRouteConfigured",
  "GardenRouteStatusChanged",
  "CapsUpdated",
  "FeePolicyUpdated",
  "PeriodicCapUpdated",
  "AcknowledgmentFeeReserveMinimumUpdated",
  "AcknowledgmentFeeReserveFunded",
  "ExcessAcknowledgmentFeesWithdrawn",
  "PausedSet",
  "SettlementExecutionStored",
  "DuplicateSettlementMessage",
  "AcknowledgmentSent",
  "AcknowledgmentDeferred",
] as const);

export function createTestIndexer(): TestIndexer {
  return createEnvioTestIndexer();
}

export async function serveJson(
  body: unknown,
  statusCode = 200
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_request, response) => {
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve the local JSON test server address");
  }

  return {
    url: `http://127.0.0.1:${address.port}/metadata.json`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
