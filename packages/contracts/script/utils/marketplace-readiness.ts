export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const MARKETPLACE_STRATEGY_ID = 1n;

export interface DeploymentRecord {
  actionRegistry?: string;
  gardenToken?: string;
  gardenAccountImpl?: string;
  hatsModule?: string;
  octantModule?: string;
  gardensModule?: string;
  yieldSplitter?: string;
  cookieJarFactory?: string;
  cookieJarModule?: string;
  hypercertMinter?: string;
  hypercertExchange?: string;
  transferManager?: string;
  strategyHypercertFractionOffer?: string;
  hypercertsModule?: string;
  marketplaceAdapter?: string;
  unifiedPowerRegistry?: string;
  greenGoodsENS?: string;
  greenWill?: string;
  [key: string]: unknown;
}

export interface MarketplaceStrategyState {
  id: bigint;
  isActive: boolean;
  implementation: string;
}

export interface MarketplaceLiveState {
  adapter: {
    address: string;
    hasCode: boolean;
    paused: boolean;
    owner: string;
    exchange: string;
    hypercertMinter: string;
    authorizedModule: boolean;
  };
  module: {
    address: string;
    hasCode: boolean;
    paused: boolean;
    owner: string;
    marketplaceAdapter: string;
    hypercertMinter: string;
  };
  exchange: {
    address: string;
    hasCode: boolean;
    transferManager: string;
    strategy: MarketplaceStrategyState;
  };
  hypercertMinter: {
    address: string;
    hasCode: boolean;
  };
  transferManager: {
    address: string;
    hasCode: boolean;
  };
  strategyHypercertFractionOffer: {
    address: string;
    hasCode: boolean;
  };
}

export interface MarketplaceValidationOptions {
  expectedOwner?: string;
  requireMarketplaceConfig?: boolean;
}

export interface MarketplaceValidationResult {
  failures: string[];
}

export interface MarketplaceConfigurationCall {
  target: string;
  contract: "HypercertMarketplaceAdapter" | "HypercertsModule";
  signature: string;
  args: Array<string | boolean>;
  reason: string;
}

export interface IndexerContractDefinition {
  name: string;
}

export interface IndexerContractConfig {
  name: string;
  address: string;
}

export interface IndexerNetworkConfig {
  id: number;
  contracts: IndexerContractConfig[];
}

export interface IndexerConfig {
  contracts: IndexerContractDefinition[];
  networks: IndexerNetworkConfig[];
}

export interface IndexerCoverageResult {
  failures: string[];
  checked: string[];
  skipped: string[];
}

export interface MarketplaceStateReader {
  call(to: string, signature: string, args?: string[]): string | null;
  hasCode(address: string): boolean;
}

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function isZeroAddress(value: string | undefined): boolean {
  return !value || normalizeAddress(value) === ZERO_ADDRESS;
}

export function parseAddress(output: string | null | undefined): string {
  const match = output?.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : ZERO_ADDRESS;
}

export function parseBool(output: string | null | undefined): boolean {
  const token = output?.trim().split(/\s+/)[0]?.toLowerCase();
  return token === "true" || token === "1";
}

function readAddress(reader: MarketplaceStateReader, to: string, signature: string, args: string[] = []): string {
  if (isZeroAddress(to)) return ZERO_ADDRESS;
  return parseAddress(reader.call(to, signature, args));
}

function readBool(reader: MarketplaceStateReader, to: string, signature: string, args: string[] = []): boolean {
  if (isZeroAddress(to)) return false;
  return parseBool(reader.call(to, signature, args));
}

function readStrategy(reader: MarketplaceStateReader, exchange: string): MarketplaceStrategyState {
  const output = isZeroAddress(exchange)
    ? null
    : reader.call(exchange, "strategyInfo(uint256)(bool,uint16,uint16,uint16,bytes4,bool,address)", [
        MARKETPLACE_STRATEGY_ID.toString(),
      ]);

  return {
    id: MARKETPLACE_STRATEGY_ID,
    isActive: parseBool(output),
    implementation: parseAddress(output),
  };
}

export function readMarketplaceLiveState(
  deployment: DeploymentRecord,
  reader: MarketplaceStateReader,
): MarketplaceLiveState {
  const adapter = deployment.marketplaceAdapter ?? ZERO_ADDRESS;
  const module = deployment.hypercertsModule ?? ZERO_ADDRESS;
  const exchange = deployment.hypercertExchange ?? ZERO_ADDRESS;
  const minter = deployment.hypercertMinter ?? ZERO_ADDRESS;
  const transferManager = deployment.transferManager ?? ZERO_ADDRESS;
  const strategy = deployment.strategyHypercertFractionOffer ?? ZERO_ADDRESS;

  return {
    adapter: {
      address: adapter,
      hasCode: !isZeroAddress(adapter) && reader.hasCode(adapter),
      paused: readBool(reader, adapter, "paused()(bool)"),
      owner: readAddress(reader, adapter, "owner()(address)"),
      exchange: readAddress(reader, adapter, "exchange()(address)"),
      hypercertMinter: readAddress(reader, adapter, "hypercertMinter()(address)"),
      authorizedModule: readBool(reader, adapter, "authorizedModules(address)(bool)", [module]),
    },
    module: {
      address: module,
      hasCode: !isZeroAddress(module) && reader.hasCode(module),
      paused: readBool(reader, module, "paused()(bool)"),
      owner: readAddress(reader, module, "owner()(address)"),
      marketplaceAdapter: readAddress(reader, module, "marketplaceAdapter()(address)"),
      hypercertMinter: readAddress(reader, module, "hypercertMinter()(address)"),
    },
    exchange: {
      address: exchange,
      hasCode: !isZeroAddress(exchange) && reader.hasCode(exchange),
      transferManager: readAddress(reader, exchange, "transferManager()(address)"),
      strategy: readStrategy(reader, exchange),
    },
    hypercertMinter: {
      address: minter,
      hasCode: !isZeroAddress(minter) && reader.hasCode(minter),
    },
    transferManager: {
      address: transferManager,
      hasCode: !isZeroAddress(transferManager) && reader.hasCode(transferManager),
    },
    strategyHypercertFractionOffer: {
      address: strategy,
      hasCode: !isZeroAddress(strategy) && reader.hasCode(strategy),
    },
  };
}

function shouldRequireMarketplaceConfig(deployment: DeploymentRecord, options: MarketplaceValidationOptions): boolean {
  if (options.requireMarketplaceConfig !== undefined) return options.requireMarketplaceConfig;
  return !isZeroAddress(deployment.marketplaceAdapter) || !isZeroAddress(deployment.hypercertsModule);
}

function requireDeploymentAddress(
  deployment: DeploymentRecord,
  key: keyof DeploymentRecord,
  failures: string[],
): string {
  const value = deployment[key] as string | undefined;
  if (isZeroAddress(value)) {
    failures.push(`deployment.${String(key)} is zero or missing`);
    return ZERO_ADDRESS;
  }
  return value as string;
}

function assertAddressMatch(label: string, actual: string, expected: string, failures: string[]): void {
  if (isZeroAddress(expected)) return;
  if (normalizeAddress(actual) !== normalizeAddress(expected)) {
    failures.push(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

function assertHasCode(label: string, hasCode: boolean, address: string, failures: string[]): void {
  if (!hasCode) {
    failures.push(`${label} has no bytecode at ${address}`);
  }
}

export function validateMarketplaceReadiness(
  deployment: DeploymentRecord,
  state: MarketplaceLiveState,
  options: MarketplaceValidationOptions = {},
): MarketplaceValidationResult {
  const failures: string[] = [];

  if (!shouldRequireMarketplaceConfig(deployment, options)) {
    return { failures };
  }

  const marketplaceAdapter = requireDeploymentAddress(deployment, "marketplaceAdapter", failures);
  const hypercertsModule = requireDeploymentAddress(deployment, "hypercertsModule", failures);
  const hypercertExchange = requireDeploymentAddress(deployment, "hypercertExchange", failures);
  const hypercertMinter = requireDeploymentAddress(deployment, "hypercertMinter", failures);
  const transferManager = requireDeploymentAddress(deployment, "transferManager", failures);
  const strategyHypercertFractionOffer = requireDeploymentAddress(
    deployment,
    "strategyHypercertFractionOffer",
    failures,
  );

  assertHasCode("marketplaceAdapter", state.adapter.hasCode, marketplaceAdapter, failures);
  assertHasCode("hypercertsModule", state.module.hasCode, hypercertsModule, failures);
  assertHasCode("hypercertExchange", state.exchange.hasCode, hypercertExchange, failures);
  assertHasCode("hypercertMinter", state.hypercertMinter.hasCode, hypercertMinter, failures);
  assertHasCode("transferManager", state.transferManager.hasCode, transferManager, failures);
  assertHasCode(
    "strategyHypercertFractionOffer",
    state.strategyHypercertFractionOffer.hasCode,
    strategyHypercertFractionOffer,
    failures,
  );

  if (state.adapter.paused) {
    failures.push("marketplaceAdapter is paused");
  }
  if (state.module.paused) {
    failures.push("hypercertsModule is paused");
  }

  assertAddressMatch("marketplaceAdapter.exchange", state.adapter.exchange, hypercertExchange, failures);
  assertAddressMatch("marketplaceAdapter.hypercertMinter", state.adapter.hypercertMinter, hypercertMinter, failures);
  assertAddressMatch(
    "hypercertsModule.marketplaceAdapter",
    state.module.marketplaceAdapter,
    marketplaceAdapter,
    failures,
  );
  assertAddressMatch("hypercertsModule.hypercertMinter", state.module.hypercertMinter, hypercertMinter, failures);
  assertAddressMatch("hypercertExchange.transferManager", state.exchange.transferManager, transferManager, failures);

  const expectedOwner = options.expectedOwner;
  if (!isZeroAddress(expectedOwner)) {
    assertAddressMatch("marketplaceAdapter.owner", state.adapter.owner, expectedOwner as string, failures);
    assertAddressMatch("hypercertsModule.owner", state.module.owner, expectedOwner as string, failures);
  }

  if (!state.adapter.authorizedModule) {
    failures.push(`marketplaceAdapter.authorizedModules(${hypercertsModule}) is false`);
  }

  if (state.exchange.strategy.id !== MARKETPLACE_STRATEGY_ID) {
    failures.push(
      `hypercertExchange strategy id expected ${MARKETPLACE_STRATEGY_ID}, got ${state.exchange.strategy.id}`,
    );
  }
  if (!state.exchange.strategy.isActive) {
    failures.push(`hypercertExchange strategy ${MARKETPLACE_STRATEGY_ID} is not active`);
  }
  assertAddressMatch(
    `hypercertExchange strategy ${MARKETPLACE_STRATEGY_ID} implementation`,
    state.exchange.strategy.implementation,
    strategyHypercertFractionOffer,
    failures,
  );

  return { failures };
}

export function buildMarketplaceConfigurationCalls(
  deployment: DeploymentRecord,
  state: MarketplaceLiveState,
): MarketplaceConfigurationCall[] {
  const adapter = deployment.marketplaceAdapter ?? ZERO_ADDRESS;
  const module = deployment.hypercertsModule ?? ZERO_ADDRESS;
  const exchange = deployment.hypercertExchange ?? ZERO_ADDRESS;
  const minter = deployment.hypercertMinter ?? ZERO_ADDRESS;
  const calls: MarketplaceConfigurationCall[] = [];

  if (!isZeroAddress(exchange) && normalizeAddress(state.adapter.exchange) !== normalizeAddress(exchange)) {
    calls.push({
      target: adapter,
      contract: "HypercertMarketplaceAdapter",
      signature: "setExchange(address)",
      args: [exchange],
      reason: "adapter exchange does not match deployment.hypercertExchange",
    });
  }

  if (!isZeroAddress(minter) && normalizeAddress(state.adapter.hypercertMinter) !== normalizeAddress(minter)) {
    calls.push({
      target: adapter,
      contract: "HypercertMarketplaceAdapter",
      signature: "setHypercertMinter(address)",
      args: [minter],
      reason: "adapter minter does not match deployment.hypercertMinter",
    });
  }

  if (!isZeroAddress(minter) && normalizeAddress(state.module.hypercertMinter) !== normalizeAddress(minter)) {
    calls.push({
      target: module,
      contract: "HypercertsModule",
      signature: "setHypercertMinter(address)",
      args: [minter],
      reason: "module minter does not match deployment.hypercertMinter",
    });
  }

  if (!state.adapter.authorizedModule) {
    calls.push({
      target: adapter,
      contract: "HypercertMarketplaceAdapter",
      signature: "setAuthorizedModule(address,bool)",
      args: [module, true],
      reason: "adapter does not authorize HypercertsModule",
    });
  }

  return calls;
}

const INDEXER_MAPPINGS: Array<{ deploymentKey: keyof DeploymentRecord; indexerName: string }> = [
  { deploymentKey: "actionRegistry", indexerName: "ActionRegistry" },
  { deploymentKey: "gardenToken", indexerName: "GardenToken" },
  { deploymentKey: "gardenAccountImpl", indexerName: "GardenAccount" },
  { deploymentKey: "hatsModule", indexerName: "HatsModule" },
  { deploymentKey: "octantModule", indexerName: "OctantModule" },
  { deploymentKey: "gardensModule", indexerName: "GardensModule" },
  { deploymentKey: "yieldSplitter", indexerName: "YieldSplitter" },
  { deploymentKey: "cookieJarFactory", indexerName: "CookieJarFactory" },
  { deploymentKey: "cookieJarModule", indexerName: "CookieJarModule" },
  { deploymentKey: "hypercertMinter", indexerName: "HypercertMinter" },
  { deploymentKey: "marketplaceAdapter", indexerName: "HypercertMarketplaceAdapter" },
  { deploymentKey: "unifiedPowerRegistry", indexerName: "UnifiedPowerRegistry" },
  { deploymentKey: "greenGoodsENS", indexerName: "GreenGoodsENS" },
  { deploymentKey: "greenWill", indexerName: "GreenWill" },
];

export function validateIndexerDeploymentCoverage(
  chainId: string,
  config: IndexerConfig,
  deployment: DeploymentRecord,
): IndexerCoverageResult {
  const failures: string[] = [];
  const checked: string[] = [];
  const skipped: string[] = [];

  const definedContracts = new Set((config.contracts ?? []).map((contract) => contract.name));
  const network = (config.networks ?? []).find((item) => item.id.toString() === chainId);
  if (!network) {
    return {
      failures: [`Indexer config missing network id ${chainId}`],
      checked,
      skipped,
    };
  }

  const networkContracts = new Map<string, string>();
  for (const contract of network.contracts ?? []) {
    networkContracts.set(contract.name, contract.address);
  }

  for (const mapping of INDEXER_MAPPINGS) {
    const deploymentAddress = deployment[mapping.deploymentKey] as string | undefined;
    if (isZeroAddress(deploymentAddress)) continue;

    if (!definedContracts.has(mapping.indexerName)) {
      skipped.push(mapping.indexerName);
      continue;
    }

    checked.push(mapping.indexerName);
    const indexedAddress = networkContracts.get(mapping.indexerName);
    if (isZeroAddress(indexedAddress)) {
      failures.push(`Indexer address missing for ${mapping.indexerName}`);
      continue;
    }
    if (normalizeAddress(indexedAddress as string) !== normalizeAddress(deploymentAddress as string)) {
      failures.push(
        `Indexer mismatch for ${mapping.indexerName}: expected ${deploymentAddress}, got ${indexedAddress}`,
      );
    }
  }

  return { failures, checked, skipped };
}
