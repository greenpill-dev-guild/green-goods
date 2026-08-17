import {
  createTestIndexer as createEnvioTestIndexer,
  TestHelpers,
  type Address,
  type TestIndexer,
} from "envio";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve as resolvePath } from "node:path";

import "../src/EventHandlers";

type MockEventData = {
  chainId: number;
  block: { timestamp: number; number: number };
  /** Omit to route the event at the address the contract is indexed at. */
  srcAddress?: string;
  transaction: { hash: string; input?: string };
  /** Omit so Envio auto-increments within a block. */
  logIndex?: number;
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

// Envio routes a simulated event to a handler only when its srcAddress is one
// the contract is actually indexed at. Rather than repeat those addresses in
// every test, resolve them from config.yaml so they cannot drift from the
// indexed set. Tests that need a specific address (a dynamically registered
// garden, say) still pass srcAddress explicitly and that always wins.
const CONFIGURED_ADDRESSES: ReadonlyMap<string, Address> = (() => {
  const source = readFileSync(resolvePath(import.meta.dirname, "../config.yaml"), "utf8");
  const byChainAndContract = new Map<string, Address>();
  let chainId: string | null = null;
  let contract: string | null = null;

  for (const line of source.split("\n")) {
    const chain = line.match(/^\s{2}- id:\s*(\d+)\s*$/)?.[1];
    if (chain) {
      chainId = chain;
      contract = null;
      continue;
    }
    const named = line.match(/^\s+- name:\s*(\w+)\s*$/)?.[1];
    if (named) {
      contract = named;
      continue;
    }
    const address = line.match(/^\s+address:\s*"(0x[0-9a-fA-F]{40})"\s*$/)?.[1];
    if (address && chainId && contract) {
      const key = `${chainId}:${contract}`;
      // The regex above proves the 0x-prefixed 40-hex shape, so this is a
      // validated narrowing rather than a blind assertion.
      if (!byChainAndContract.has(key)) byChainAndContract.set(key, address as Address);
      contract = null;
    }
  }
  return byChainAndContract;
})();

function configuredAddress(contract: string, chainId: number): Address | undefined {
  return CONFIGURED_ADDRESSES.get(`${chainId}:${contract}`);
}

/** The address a contract is indexed at, for tests that assert on it. */
export function indexedAddress(contract: string, chainId: number): Address {
  const address = configuredAddress(contract, chainId);
  if (!address) {
    throw new Error(`No indexed address configured for ${contract} on chain ${chainId}`);
  }
  return address;
}

const CHAIN_START_BLOCK = {
  42161: 433_713_812,
  11155111: 10_243_363,
  42220: 74_691_430,
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
  if (chainId !== 42161 && chainId !== 11155111 && chainId !== 42220) {
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
      ...(chainConfigs[42220] ? { 42220: chainConfigs[42220] } : {}),
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
            const indexed = configuredAddress(contract, mockEventData.chainId);
            return {
              ...mockEventData,
              srcAddress: mockEventData.srcAddress ?? indexed ?? mockEventData.srcAddress,
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

export async function serveJsonSequence(
  responses: readonly { readonly body: unknown; readonly statusCode: number }[]
): Promise<{ url: string; requestCount: () => number; close: () => Promise<void> }> {
  let requestCount = 0;
  const server = createServer((_request, response) => {
    const selected = responses[Math.min(requestCount, responses.length - 1)];
    requestCount += 1;
    response.writeHead(selected?.statusCode ?? 500, { "content-type": "application/json" });
    response.end(JSON.stringify(selected?.body ?? { error: "missing test response" }));
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
    requestCount: () => requestCount,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
