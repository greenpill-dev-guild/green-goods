import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as yaml from "js-yaml";

import { CHAIN_ID_MAP, NetworkManager } from "./network";

type NetworkName = "sepolia" | "arbitrum" | "celo" | "mainnet" | "localhost";

interface VerifyOptions {
  network: NetworkName;
  chainId: string;
  rpcUrl: string;
  communitySlug: string;
  requireOctant: boolean;
  requireCookieJar: boolean;
  checkIndexer: boolean;
  checkIndexerRuntime: boolean;
  startLocalIndexer: boolean;
  stopLocalIndexerAfterCheck: boolean;
  indexerUrl: string;
  indexerTimeoutSeconds: number;
  indexerPollSeconds: number;
  checkEtherscan: boolean;
}

interface DeploymentRecord {
  actionRegistry: string;
  gardenToken: string;
  gardenAccountImpl?: string;
  gardensModule?: string;
  octantModule?: string;
  cookieJarModule?: string;
  greenGoodsENS?: string;
  marketplaceAdapter?: string;
  unifiedPowerRegistry?: string;
  yieldSplitter?: string;
  hatsModule?: string;
  karmaGAPModule?: string;
  workResolver?: string;
  workApprovalResolver?: string;
  assessmentResolver?: string;
  hypercertsModule?: string;
  deploymentRegistry?: string;
  rootGarden?: {
    address?: string;
    tokenId?: number;
  };
  [key: string]: unknown;
}

interface IndexerContract {
  name: string;
  address: string;
}

interface IndexerNetwork {
  id: number;
  contracts: IndexerContract[];
}

interface IndexerConfig {
  networks: IndexerNetwork[];
}

interface RuntimeGarden {
  id: string;
  chainId: number;
}

interface RuntimeAction {
  id: string;
  chainId: number;
}

interface RuntimeGardenDomains {
  garden: string;
  domainMask: number | string;
}

interface RuntimeIndexerResponse {
  Garden?: RuntimeGarden[];
  Action?: RuntimeAction[];
  GardenDomains?: RuntimeGardenDomains[];
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Mask API key segments in RPC URLs to prevent credential leakage in logs. */
function maskRpcApiKey(value: string): string {
  return value.replace(/(\/v\d+\/)[^\s/]+/g, "$1***");
}
const DEFAULT_LOCAL_INDEXER_ENDPOINT = "http://localhost:8080/v1/graphql";
const RUNTIME_INDEXER_QUERY = `
  query PostDeployIndexerRuntime($chainId: Int!, $limit: Int!) {
    Garden(where: { chainId: { _eq: $chainId } }, limit: $limit, order_by: { createdAt: desc }) {
      id
      chainId
    }
    Action(where: { chainId: { _eq: $chainId } }, limit: 1, order_by: { createdAt: desc }) {
      id
      chainId
    }
    GardenDomains(where: { chainId: { _eq: $chainId } }, limit: $limit, order_by: { updatedAt: desc }) {
      garden
      domainMask
    }
  }
`;

dotenv.config({
  path: path.join(__dirname, "../../../../.env"),
});

function parseArgs(argv: string[]): VerifyOptions {
  let network: NetworkName = "sepolia";
  let rpcUrl = "";
  let chainId = "";
  let communitySlug = process.env.COMMUNITY_GARDEN_SLUG || "community";
  let requireOctant = process.env.REQUIRE_OCTANT_READY !== "false";
  let requireCookieJar = process.env.REQUIRE_COOKIEJAR_READY !== "false";
  let checkIndexer = true;
  let checkIndexerRuntime = process.env.CHECK_INDEXER_RUNTIME === "true";
  let startLocalIndexer = checkIndexerRuntime;
  let stopLocalIndexerAfterCheck = false;
  let indexerUrl = process.env.POST_DEPLOY_INDEXER_URL || DEFAULT_LOCAL_INDEXER_ENDPOINT;
  let indexerTimeoutSeconds = Number(process.env.INDEXER_SYNC_TIMEOUT_SECONDS || "600");
  let indexerPollSeconds = Number(process.env.INDEXER_SYNC_POLL_SECONDS || "20");
  let checkEtherscan = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--network":
      case "-n":
        network = argv[++i] as NetworkName;
        break;
      case "--rpc-url":
        rpcUrl = argv[++i] ?? "";
        break;
      case "--chain-id":
        chainId = argv[++i] ?? "";
        break;
      case "--community-slug":
        communitySlug = argv[++i] ?? communitySlug;
        break;
      case "--no-octant":
        requireOctant = false;
        break;
      case "--no-cookiejar":
        requireCookieJar = false;
        break;
      case "--skip-indexer":
        checkIndexer = false;
        break;
      case "--check-indexer-runtime":
        checkIndexerRuntime = true;
        startLocalIndexer = true;
        break;
      case "--skip-indexer-runtime":
        checkIndexerRuntime = false;
        startLocalIndexer = false;
        break;
      case "--start-local-indexer":
        startLocalIndexer = true;
        break;
      case "--skip-local-indexer-start":
        startLocalIndexer = false;
        break;
      case "--stop-local-indexer-after-check":
        stopLocalIndexerAfterCheck = true;
        break;
      case "--indexer-url":
        indexerUrl = argv[++i] ?? indexerUrl;
        break;
      case "--indexer-timeout-seconds":
        indexerTimeoutSeconds = Number(argv[++i] ?? indexerTimeoutSeconds.toString());
        break;
      case "--indexer-poll-seconds":
        indexerPollSeconds = Number(argv[++i] ?? indexerPollSeconds.toString());
        break;
      case "--check-etherscan":
        checkEtherscan = true;
        break;
      default:
        break;
    }
  }

  const networkManager = new NetworkManager();
  const resolvedChainId = chainId || CHAIN_ID_MAP[network] || networkManager.getChainId(network).toString();
  const resolvedRpcUrl = rpcUrl || networkManager.getRpcUrl(network);
  if (!Number.isFinite(indexerTimeoutSeconds) || indexerTimeoutSeconds <= 0) {
    indexerTimeoutSeconds = 600;
  }
  if (!Number.isFinite(indexerPollSeconds) || indexerPollSeconds <= 0) {
    indexerPollSeconds = 20;
  }

  return {
    network,
    chainId: resolvedChainId,
    rpcUrl: resolvedRpcUrl,
    communitySlug,
    requireOctant,
    requireCookieJar,
    checkIndexer,
    checkIndexerRuntime,
    startLocalIndexer,
    stopLocalIndexerAfterCheck,
    indexerUrl,
    indexerTimeoutSeconds,
    indexerPollSeconds,
    checkEtherscan,
  };
}

function isZeroAddress(value: string | undefined): boolean {
  return !value || value.toLowerCase() === ZERO_ADDRESS;
}

function castCall(rpcUrl: string, to: string, signature: string, args: string[] = []): string {
  const callArgs = ["call", to, signature, ...args, "--rpc-url", rpcUrl];
  try {
    return execFileSync("cast", callArgs, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cast call failed (${to} ${signature}): ${maskRpcApiKey(message)}`);
  }
}

function parseAddress(output: string): string {
  const match = output.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : ZERO_ADDRESS;
}

function parseAddressArray(output: string): string[] {
  return output.match(/0x[a-fA-F0-9]{40}/g) ?? [];
}

function parseUint(output: string): bigint {
  const token = output.split(/\s+/)[0]?.trim();
  if (!token) return 0n;
  if (token.startsWith("0x") || token.startsWith("0X")) {
    return BigInt(token);
  }
  return BigInt(token);
}

function parseBool(output: string): boolean {
  const trimmed = output.trim().toLowerCase();
  return trimmed === "true" || trimmed === "1";
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function parseNumberish(value: number | string | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseStringValue(output: string): string {
  const trimmed = output.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function assert(condition: boolean, message: string, failures: string[]): void {
  if (!condition) failures.push(message);
}

function loadDeployment(chainId: string): DeploymentRecord {
  const deploymentPath = path.join(__dirname, "../../deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
}

function validateIndexerConfig(chainId: string, deployment: DeploymentRecord, failures: string[]): void {
  const indexerPath = path.join(__dirname, "../../../indexer/config.yaml");
  if (!fs.existsSync(indexerPath)) {
    failures.push(`Indexer config not found: ${indexerPath}`);
    return;
  }

  const parsed = yaml.load(fs.readFileSync(indexerPath, "utf8")) as IndexerConfig;
  const network = parsed.networks.find((item) => item.id.toString() === chainId);
  if (!network) {
    failures.push(`Indexer config missing network id ${chainId}`);
    return;
  }

  const byName = new Map<string, string>();
  for (const contract of network.contracts) {
    byName.set(contract.name, contract.address);
  }

  const mappings: Array<{ deploymentKey: keyof DeploymentRecord; indexerName: string }> = [
    { deploymentKey: "actionRegistry", indexerName: "ActionRegistry" },
    { deploymentKey: "gardenToken", indexerName: "GardenToken" },
    { deploymentKey: "gardenAccountImpl", indexerName: "GardenAccount" },
    { deploymentKey: "hatsModule", indexerName: "HatsModule" },
    { deploymentKey: "octantModule", indexerName: "OctantModule" },
    { deploymentKey: "gardensModule", indexerName: "GardensModule" },
    { deploymentKey: "yieldSplitter", indexerName: "YieldSplitter" },
    { deploymentKey: "cookieJarModule", indexerName: "CookieJarModule" },
    { deploymentKey: "marketplaceAdapter", indexerName: "HypercertMarketplaceAdapter" },
    { deploymentKey: "unifiedPowerRegistry", indexerName: "UnifiedPowerRegistry" },
    { deploymentKey: "greenGoodsENS", indexerName: "GreenGoodsENS" },
  ];

  for (const mapping of mappings) {
    const deploymentAddress = deployment[mapping.deploymentKey] as string | undefined;
    if (isZeroAddress(deploymentAddress)) continue;

    const indexedAddress = byName.get(mapping.indexerName);
    assert(
      !!indexedAddress && !isZeroAddress(indexedAddress),
      `Indexer address missing for ${mapping.indexerName}`,
      failures,
    );
    if (indexedAddress) {
      assert(
        indexedAddress.toLowerCase() === deploymentAddress?.toLowerCase(),
        `Indexer mismatch for ${mapping.indexerName}: expected ${deploymentAddress}, got ${indexedAddress}`,
        failures,
      );
    }
  }
}

function syncIndexerConfigFromDeployment(chainId: string, failures: string[]): boolean {
  const contractsRoot = path.join(__dirname, "../..");
  try {
    execFileSync("bun", ["script/utils/envio-integration.ts", "update", chainId], {
      cwd: contractsRoot,
      stdio: "inherit",
      env: process.env,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`failed to sync indexer config from deployment: ${message}`);
    return false;
  }
}

function startLocalIndexerStack(failures: string[]): boolean {
  const indexerRoot = path.join(__dirname, "../../../indexer");
  try {
    execFileSync("bun", ["run", "dev:docker:detach"], {
      cwd: indexerRoot,
      stdio: "inherit",
      env: process.env,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`failed to start local indexer stack: ${message}`);
    return false;
  }
}

function stopLocalIndexerStack(): void {
  const indexerRoot = path.join(__dirname, "../../../indexer");
  try {
    execFileSync("bun", ["run", "dev:docker:down"], {
      cwd: indexerRoot,
      stdio: "inherit",
      env: process.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to stop local indexer stack: ${message}`);
  }
}

async function queryRuntimeIndexer(
  indexerUrl: string,
  chainId: number,
): Promise<{ data: RuntimeIndexerResponse | null; error: string | null }> {
  try {
    const response = await fetch(indexerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: RUNTIME_INDEXER_QUERY,
        variables: { chainId, limit: 200 },
      }),
    });

    if (!response.ok) {
      return {
        data: null,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const payload = (await response.json()) as {
      data?: RuntimeIndexerResponse;
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      return {
        data: null,
        error: payload.errors.map((error) => error.message || "unknown GraphQL error").join("; "),
      };
    }

    return {
      data: payload.data ?? null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: null,
      error: message,
    };
  }
}

async function validateIndexerRuntime(
  options: VerifyOptions,
  deployment: DeploymentRecord,
  failures: string[],
): Promise<void> {
  if (!options.checkIndexerRuntime) {
    return;
  }

  const rootGarden = deployment.rootGarden?.address;
  if (isZeroAddress(rootGarden)) {
    failures.push("indexer runtime check requires deployment.rootGarden.address");
    return;
  }

  const chainId = Number(options.chainId);
  if (!Number.isFinite(chainId)) {
    failures.push(`indexer runtime check failed: invalid chainId ${options.chainId}`);
    return;
  }

  const indexerUrl = options.indexerUrl || DEFAULT_LOCAL_INDEXER_ENDPOINT;
  const pollSeconds = Math.max(5, options.indexerPollSeconds);
  const timeoutSeconds = Math.max(pollSeconds, options.indexerTimeoutSeconds);
  const deadline = Date.now() + timeoutSeconds * 1000;
  let startedLocalIndexer = false;

  if (options.startLocalIndexer) {
    console.log("\nSyncing indexer config from latest deployment...");
    const synced = syncIndexerConfigFromDeployment(options.chainId, failures);
    if (!synced) {
      return;
    }

    console.log("Starting local indexer stack (docker detach)...");
    startedLocalIndexer = startLocalIndexerStack(failures);
    if (!startedLocalIndexer) {
      return;
    }
  }

  console.log("\nChecking local indexer ingestion...");
  console.log(`  indexerUrl: ${indexerUrl}`);
  console.log(`  timeout: ${timeoutSeconds}s`);

  let lastObservation = "no response";
  try {
    while (Date.now() <= deadline) {
      const result = await queryRuntimeIndexer(indexerUrl, chainId);

      if (!result.error && result.data) {
        const gardens = result.data.Garden ?? [];
        const actions = result.data.Action ?? [];
        const gardenDomains = result.data.GardenDomains ?? [];

        const rootGardenLower = normalizeAddress(rootGarden as string);
        const hasRootGarden = gardens.some((garden) => normalizeAddress(garden.id) === rootGardenLower);
        const rootDomainEntry = gardenDomains.find((entry) => normalizeAddress(entry.garden) === rootGardenLower);
        const rootDomainMask = parseNumberish(rootDomainEntry?.domainMask);
        const hasRootDomainMask = Number.isFinite(rootDomainMask) && rootDomainMask === 15;
        const hasActions = actions.length > 0;

        if (hasRootGarden && hasRootDomainMask && hasActions) {
          console.log("  ✅ local indexer query check passed (root garden, domain mask, and actions ingested)");
          return;
        }

        lastObservation = [
          `gardens=${gardens.length}`,
          `actions=${actions.length}`,
          `rootGarden=${hasRootGarden}`,
          `rootDomainMask=${Number.isFinite(rootDomainMask) ? rootDomainMask : "missing"}`,
        ].join(", ");
      } else {
        lastObservation = `error=${result.error ?? "unknown"}`;
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      const waitSeconds = Math.min(pollSeconds, Math.ceil(remainingMs / 1000));
      console.log(`  waiting ${waitSeconds}s for indexer sync (${lastObservation})`);
      await sleep(waitSeconds * 1000);
    }

    failures.push(`local indexer validation failed after ${timeoutSeconds}s (${lastObservation})`);
  } finally {
    if (startedLocalIndexer && options.stopLocalIndexerAfterCheck) {
      console.log("\nStopping local indexer stack after runtime check...");
      stopLocalIndexerStack();
    }
  }
}

function validateEtherscanVerification(chainId: string, deployment: DeploymentRecord, failures: string[]): void {
  console.log("\nChecking Etherscan source verification...");

  // All explicitly typed deployment fields to check (skip rootGarden — it's a tokenbound account)
  const contractEntries: Array<{ name: string; address: string | undefined }> = [
    { name: "deploymentRegistry", address: deployment.deploymentRegistry },
    { name: "gardenAccountImpl", address: deployment.gardenAccountImpl },
    { name: "gardenToken", address: deployment.gardenToken },
    { name: "actionRegistry", address: deployment.actionRegistry },
    { name: "workResolver", address: deployment.workResolver },
    { name: "workApprovalResolver", address: deployment.workApprovalResolver },
    { name: "assessmentResolver", address: deployment.assessmentResolver },
    { name: "hatsModule", address: deployment.hatsModule },
    { name: "karmaGAPModule", address: deployment.karmaGAPModule },
    { name: "octantModule", address: deployment.octantModule },
    { name: "gardensModule", address: deployment.gardensModule },
    { name: "unifiedPowerRegistry", address: deployment.unifiedPowerRegistry },
    { name: "yieldSplitter", address: deployment.yieldSplitter },
    { name: "cookieJarModule", address: deployment.cookieJarModule },
    { name: "hypercertsModule", address: deployment.hypercertsModule },
    { name: "marketplaceAdapter", address: deployment.marketplaceAdapter },
    { name: "greenGoodsENS", address: deployment.greenGoodsENS },
  ];

  for (const entry of contractEntries) {
    if (isZeroAddress(entry.address)) continue;

    try {
      execFileSync("cast", ["etherscan-source", entry.address as string, "--chain", chainId], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(`  ${entry.name}: verified`);
    } catch {
      failures.push(`Etherscan source not verified: ${entry.name} (${entry.address})`);
      console.log(`  ${entry.name}: NOT VERIFIED`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const failures: string[] = [];

  console.log("\nPost-deploy verification");
  console.log(`  network: ${options.network}`);
  console.log(`  chainId: ${options.chainId}`);
  console.log(`  rpcUrl: ${maskRpcApiKey(options.rpcUrl)}`);
  console.log(`  communitySlug: ${options.communitySlug}\n`);

  const deployment = loadDeployment(options.chainId);
  const rootGarden = deployment.rootGarden?.address ?? ZERO_ADDRESS;

  assert(!isZeroAddress(deployment.actionRegistry), "deployment.actionRegistry is zero", failures);
  assert(!isZeroAddress(deployment.gardenToken), "deployment.gardenToken is zero", failures);
  assert(!isZeroAddress(deployment.gardenAccountImpl), "deployment.gardenAccountImpl is zero", failures);
  assert(!isZeroAddress(rootGarden), "deployment.rootGarden.address is zero", failures);

  if (failures.length === 0) {
    const domainMask = parseUint(
      castCall(options.rpcUrl, deployment.actionRegistry, "gardenDomains(address)(uint8)", [rootGarden]),
    );
    assert(domainMask === 15n, `root garden domain mask expected 15, got ${domainMask}`, failures);
  }

  if (failures.length === 0) {
    const gardensModule = deployment.gardensModule ?? ZERO_ADDRESS;
    assert(!isZeroAddress(gardensModule), "deployment.gardensModule is zero", failures);
    if (!isZeroAddress(gardensModule)) {
      const community = parseAddress(
        castCall(options.rpcUrl, gardensModule, "getGardenCommunity(address)(address)", [rootGarden]),
      );
      assert(!isZeroAddress(community), "root garden community was not created", failures);

      const pools = parseAddressArray(
        castCall(options.rpcUrl, gardensModule, "getGardenSignalPools(address)(address[])", [rootGarden]),
      );
      assert(pools.length > 0, "root garden has no signaling pools (action pool required)", failures);

      const goodsToken = parseAddress(castCall(options.rpcUrl, gardensModule, "goodsToken()(address)"));
      assert(!isZeroAddress(goodsToken), "gardensModule.goodsToken is zero", failures);
      if (!isZeroAddress(goodsToken)) {
        const goodsBalance = parseUint(
          castCall(options.rpcUrl, goodsToken, "balanceOf(address)(uint256)", [rootGarden]),
        );
        assert(goodsBalance > 0n, "root garden GOODS balance is zero", failures);
      }
    }
  }

  // HatsModule checks
  if (!isZeroAddress(deployment.hatsModule) && failures.length === 0) {
    const hatsModule = deployment.hatsModule as string;
    const isConfigured = parseBool(castCall(options.rpcUrl, hatsModule, "isConfigured(address)(bool)", [rootGarden]));
    assert(isConfigured, "hatsModule.isConfigured(rootGarden) is false", failures);

    const communityHatId = parseUint(castCall(options.rpcUrl, hatsModule, "communityHatId()(uint256)"));
    assert(communityHatId > 0n, "hatsModule.communityHatId is zero", failures);

    const gardensHatId = parseUint(castCall(options.rpcUrl, hatsModule, "gardensHatId()(uint256)"));
    assert(gardensHatId > 0n, "hatsModule.gardensHatId is zero", failures);
  }

  // KarmaGAPModule checks (conditional — may not be supported on all chains)
  if (!isZeroAddress(deployment.karmaGAPModule) && failures.length === 0) {
    const karmaGAPModule = deployment.karmaGAPModule as string;
    const isSupported = parseBool(castCall(options.rpcUrl, karmaGAPModule, "isSupported()(bool)"));
    if (isSupported) {
      const projectUID = parseUint(
        castCall(options.rpcUrl, karmaGAPModule, "getProjectUID(address)(bytes32)", [rootGarden]),
      );
      assert(projectUID > 0n, "karmaGAPModule.getProjectUID(rootGarden) is zero", failures);
    }
  }

  // UnifiedPowerRegistry checks
  if (!isZeroAddress(deployment.unifiedPowerRegistry) && failures.length === 0) {
    const upr = deployment.unifiedPowerRegistry as string;
    const isRegistered = parseBool(castCall(options.rpcUrl, upr, "isGardenRegistered(address)(bool)", [rootGarden]));
    assert(isRegistered, "unifiedPowerRegistry.isGardenRegistered(rootGarden) is false", failures);

    const hatsProtocol = parseAddress(castCall(options.rpcUrl, upr, "hatsProtocol()(address)"));
    assert(!isZeroAddress(hatsProtocol), "unifiedPowerRegistry.hatsProtocol is zero", failures);

    const uprGardensModule = parseAddress(castCall(options.rpcUrl, upr, "gardensModule()(address)"));
    assert(!isZeroAddress(uprGardensModule), "unifiedPowerRegistry.gardensModule is zero", failures);
  }

  // HypercertMarketplaceAdapter checks
  if (!isZeroAddress(deployment.marketplaceAdapter) && failures.length === 0) {
    const adapter = deployment.marketplaceAdapter as string;
    const paused = parseBool(castCall(options.rpcUrl, adapter, "paused()(bool)"));
    assert(!paused, "marketplaceAdapter is paused", failures);

    const exchange = parseAddress(castCall(options.rpcUrl, adapter, "exchange()(address)"));
    assert(!isZeroAddress(exchange), "marketplaceAdapter.exchange is zero", failures);

    const hypercertMinter = parseAddress(castCall(options.rpcUrl, adapter, "hypercertMinter()(address)"));
    assert(!isZeroAddress(hypercertMinter), "marketplaceAdapter.hypercertMinter is zero", failures);
  }

  // YieldResolver checks
  if (!isZeroAddress(deployment.yieldSplitter) && failures.length === 0) {
    const yieldResolver = deployment.yieldSplitter as string;
    const octantRef = parseAddress(castCall(options.rpcUrl, yieldResolver, "octantModule()(address)"));
    assert(!isZeroAddress(octantRef), "yieldResolver.octantModule is zero", failures);

    const cookieJarRef = parseAddress(castCall(options.rpcUrl, yieldResolver, "cookieJarModule()(address)"));
    assert(!isZeroAddress(cookieJarRef), "yieldResolver.cookieJarModule is zero", failures);
  }

  if (options.requireOctant && failures.length === 0) {
    const octantModule = deployment.octantModule ?? ZERO_ADDRESS;
    assert(!isZeroAddress(octantModule), "deployment.octantModule is zero", failures);
    if (!isZeroAddress(octantModule)) {
      const assets = parseAddressArray(castCall(options.rpcUrl, octantModule, "getSupportedAssets()(address[])"));
      const activeAssets: string[] = [];
      for (const asset of assets) {
        const strategy = parseAddress(
          castCall(options.rpcUrl, octantModule, "supportedAssets(address)(address)", [asset]),
        );
        if (!isZeroAddress(strategy)) activeAssets.push(asset);
      }
      assert(activeAssets.length > 0, "octant has no active supported assets", failures);
      for (const asset of activeAssets) {
        const vault = parseAddress(
          castCall(options.rpcUrl, octantModule, "getVaultForAsset(address,address)(address)", [rootGarden, asset]),
        );
        assert(!isZeroAddress(vault), `missing Octant vault for asset ${asset}`, failures);
      }
    }
  }

  if (options.requireCookieJar && failures.length === 0) {
    const cookieJarModule = deployment.cookieJarModule ?? ZERO_ADDRESS;
    assert(!isZeroAddress(cookieJarModule), "deployment.cookieJarModule is zero", failures);
    if (!isZeroAddress(cookieJarModule)) {
      const assets = parseAddressArray(castCall(options.rpcUrl, cookieJarModule, "getSupportedAssets()(address[])"));
      assert(assets.length > 0, "cookie jar has no supported assets", failures);
      for (const asset of assets) {
        const jar = parseAddress(
          castCall(options.rpcUrl, cookieJarModule, "getGardenJar(address,address)(address)", [rootGarden, asset]),
        );
        assert(!isZeroAddress(jar), `missing CookieJar for asset ${asset}`, failures);
      }
    }
  }

  if (!isZeroAddress(deployment.greenGoodsENS) && failures.length === 0) {
    const greenGoodsENS = deployment.greenGoodsENS as string;
    const ownerSlug = parseStringValue(
      castCall(options.rpcUrl, greenGoodsENS, "ownerToSlug(address)(string)", [rootGarden]),
    );

    if (options.network === "arbitrum") {
      const envReceiver = process.env.ENS_L1_RECEIVER || ZERO_ADDRESS;
      assert(!isZeroAddress(envReceiver), "ENS_L1_RECEIVER env var is required on arbitrum", failures);
      const l1Receiver = parseAddress(castCall(options.rpcUrl, greenGoodsENS, "l1Receiver()(address)"));
      assert(
        l1Receiver.toLowerCase() === envReceiver.toLowerCase(),
        "greenGoodsENS.l1Receiver != ENS_L1_RECEIVER",
        failures,
      );
      assert(ownerSlug === options.communitySlug, "arbitrum ENS send missing for community slug", failures);
    } else if (options.network === "sepolia") {
      assert(ownerSlug === options.communitySlug, "sepolia ENS ownerToSlug mismatch for community slug", failures);
      const l1Receiver = parseAddress(castCall(options.rpcUrl, greenGoodsENS, "l1Receiver()(address)"));
      assert(!isZeroAddress(l1Receiver), "sepolia ENS receiver (l1Receiver) is zero", failures);
      if (!isZeroAddress(l1Receiver)) {
        const resolved = parseAddress(
          castCall(options.rpcUrl, l1Receiver, "resolve(string)(address)", [options.communitySlug]),
        );
        assert(
          resolved.toLowerCase() === rootGarden.toLowerCase(),
          `sepolia ENS receiver resolve(${options.communitySlug}) mismatch`,
          failures,
        );
      }
    }
  }

  if (options.checkIndexer) {
    validateIndexerConfig(options.chainId, deployment, failures);
  }

  // Indexer runtime check runs independently of onchain failures — the indexer
  // validates its own indexed data, not onchain wiring (e.g. Sepolia has no
  // marketplace exchange, which is an onchain gap, not an indexer gap).
  await validateIndexerRuntime(options, deployment, failures);

  if (options.checkEtherscan) {
    validateEtherscanVerification(options.chainId, deployment, failures);
  }

  if (failures.length > 0) {
    console.error("\nVerification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Verification passed: deployment is ready for frontend/indexer integration checks.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Verification command failed: ${maskRpcApiKey(message)}`);
  process.exit(1);
});
