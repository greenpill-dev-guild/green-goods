import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as yaml from "js-yaml";

import {
  readMarketplaceLiveState,
  validateIndexerDeploymentCoverage,
  validateMarketplaceReadiness,
} from "./marketplace-readiness";
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
  requireProductCopy: boolean;
  productCopyAcknowledged: boolean;
  checkStewardUpgrade: boolean;
  stewardBaselinePath?: string;
  expectedHatsImplementation?: string;
  stewardProbeAccounts: string[];
}

interface DeploymentRecord {
  actionRegistry: string;
  gardenToken: string;
  gardenAccountImpl?: string;
  gardensModule?: string;
  octantModule?: string;
  cookieJarModule?: string;
  greenGoodsENS?: string;
  octantFactory?: string;
  marketplaceAdapter?: string;
  hypercertExchange?: string;
  hypercertMinter?: string;
  transferManager?: string;
  strategyHypercertFractionOffer?: string;
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
  // Optional: Envio v3 dynamically registered contracts (OctantVault) carry no address.
  address?: string;
}

interface IndexerChain {
  id: number;
  contracts: IndexerContract[];
}

interface IndexerConfig {
  contracts: Array<{ name: string }>;
  // Envio v3 renamed the top-level `networks` key to `chains`.
  chains: IndexerChain[];
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

interface GardensFile {
  gardens?: Array<{ tokenId?: number; address?: string }>;
}

export interface StorageLayoutBaseline {
  storage?: Array<{
    label?: string;
    slot?: string;
    offset?: number;
    type?: string;
  }>;
}

interface StewardGardenBaseline {
  garden: string;
  ownerHatId: string;
  operatorHatId: string;
  evaluatorHatId: string;
  gardenerHatId: string;
  funderHatId: string;
  communityHatId: string;
  adminHatId: string;
  configured: boolean;
}

interface StewardUpgradeBaseline {
  version: 1;
  chainId: string;
  hatsModule: string;
  implementationBefore: string;
  ownerBefore: string;
  hatsProtocolBefore: string;
  gardens: StewardGardenBaseline[];
  probeAccounts?: string[];
}

export function collectStewardGardenCoverageErrors(baselineGardens: string[], liveGardens: string[]): string[] {
  const errors: string[] = [];
  const baselineSet = new Set(baselineGardens.map((garden) => garden.toLowerCase()));
  const liveSet = new Set(liveGardens.map((garden) => garden.toLowerCase()));

  if (baselineSet.size !== liveSet.size) {
    errors.push(`Steward baseline covers ${baselineSet.size} gardens but live inventory contains ${liveSet.size}`);
  }
  for (const garden of liveGardens) {
    if (!baselineSet.has(garden.toLowerCase())) {
      errors.push(`Steward baseline is missing live garden ${garden}`);
    }
  }
  for (const garden of baselineGardens) {
    if (!liveSet.has(garden.toLowerCase())) {
      errors.push(`Steward baseline contains non-live garden ${garden}`);
    }
  }

  return errors;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";
const REPO_ROOT = path.resolve(__dirname, "../../../..");

/** Mask API key segments in RPC URLs to prevent credential leakage in logs. */
function maskRpcApiKey(value: string): string {
  return value.replace(/(\/v\d+\/)[^\s/]+/g, "$1***");
}
const DEFAULT_LOCAL_INDEXER_ENDPOINT = "http://localhost:3006/v1/graphql";
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
  let requireProductCopy = process.env.REQUIRE_PRODUCT_COPY === "true";
  let productCopyAcknowledged = process.env.PRODUCT_COPY_ACKNOWLEDGED === "true";
  let checkStewardUpgrade = false;
  let stewardBaselinePath: string | undefined;
  let expectedHatsImplementation: string | undefined;
  const stewardProbeAccounts: string[] = [];

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
      case "--require-product-copy":
        requireProductCopy = true;
        break;
      case "--ack-product-copy":
        productCopyAcknowledged = true;
        break;
      case "--check-steward-upgrade":
        checkStewardUpgrade = true;
        break;
      case "--steward-baseline":
        stewardBaselinePath = argv[++i];
        break;
      case "--expected-hats-implementation":
        expectedHatsImplementation = argv[++i];
        break;
      case "--steward-probe-account":
        stewardProbeAccounts.push(argv[++i] ?? "");
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
    requireProductCopy,
    productCopyAcknowledged,
    checkStewardUpgrade,
    stewardBaselinePath,
    expectedHatsImplementation,
    stewardProbeAccounts,
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

function hasContractCode(rpcUrl: string, address: string): boolean {
  if (isZeroAddress(address)) return false;
  try {
    const output = execFileSync("cast", ["code", address, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return output !== "" && output !== "0x";
  } catch {
    return false;
  }
}

function parseAddress(output: string): string {
  const match = output.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : ZERO_ADDRESS;
}

function isAddress(value: string | undefined): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) && !isZeroAddress(value);
}

function parseAddressArray(output: string): string[] {
  return output.match(/0x[a-fA-F0-9]{40}/g) ?? [];
}

function parseUint(output: string): bigint {
  const token = output.match(/0x[a-fA-F0-9]+|\d+/)?.[0];
  if (!token) return 0n;
  if (token.startsWith("0x") || token.startsWith("0X")) {
    return BigInt(token);
  }
  return BigInt(token);
}

function parseUintValues(output: string): bigint[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*\(?\s*(0x[a-fA-F0-9]+|\d+)/)?.[1])
    .filter((value): value is string => typeof value === "string")
    .map((value) => BigInt(value));
}

function parseBool(output: string): boolean {
  const trimmed = output.trim().toLowerCase();
  return trimmed === "true" || trimmed === "1";
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function readStorageAddress(rpcUrl: string, contract: string, slot: string): string {
  try {
    const output = execFileSync("cast", ["storage", contract, slot, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const word = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
    return word ? `0x${word.slice(-40)}` : ZERO_ADDRESS;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cast storage failed (${contract} ${slot}): ${maskRpcApiKey(message)}`);
  }
}

function readStorageUint(rpcUrl: string, contract: string, slot: string): bigint {
  try {
    const output = execFileSync("cast", ["storage", contract, slot, "--rpc-url", rpcUrl], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const word = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
    if (!word) throw new Error(`unexpected storage word: ${output}`);
    return BigInt(word);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cast storage failed (${contract} ${slot}): ${maskRpcApiKey(message)}`);
  }
}

export function findStorageSlot(layout: StorageLayoutBaseline, label: string, expectedType: string): string {
  const matches = (layout.storage ?? []).filter((entry) => entry.label === label);
  if (
    matches.length !== 1 ||
    !/^\d+$/.test(matches[0].slot ?? "") ||
    matches[0].offset !== 0 ||
    matches[0].type !== expectedType
  ) {
    throw new Error(`Storage layout must contain one ${expectedType} ${label} at offset zero`);
  }
  return matches[0].slot as string;
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

function loadGardenDeploymentFile(chainId: string): string[] {
  const gardensPath = path.join(__dirname, "../../deployments", `${chainId}-gardens.json`);
  if (!fs.existsSync(gardensPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(gardensPath, "utf8")) as GardensFile;
  return (parsed.gardens ?? [])
    .map((garden) => garden.address)
    .filter((garden): garden is string => typeof garden === "string" && !isZeroAddress(garden));
}

function loadGardensFromChain(options: VerifyOptions, deployment: DeploymentRecord): string[] {
  if (isZeroAddress(deployment.gardenToken) || isZeroAddress(deployment.gardenAccountImpl)) {
    return [];
  }

  const layoutPath = path.join(__dirname, "../../storage-layouts/GardenToken.json");
  const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8")) as StorageLayoutBaseline;
  const nextTokenIdSlot = findStorageSlot(layout, "_nextTokenId", "t_uint256");
  const mintedCount = readStorageUint(options.rpcUrl, deployment.gardenToken as string, nextTokenIdSlot);
  if (mintedCount > 10_000n) {
    throw new Error(`GardenToken live mint count ${mintedCount} exceeds the verification safety limit`);
  }
  const tokenIds = Array.from({ length: Number(mintedCount) }, (_, tokenId) => BigInt(tokenId));

  return tokenIds
    .map((tokenId) => {
      const tokenOwner = parseAddress(
        castCall(options.rpcUrl, deployment.gardenToken as string, "ownerOf(uint256)(address)", [tokenId.toString()]),
      );
      if (isZeroAddress(tokenOwner)) {
        throw new Error(`GardenToken ownerOf(${tokenId}) returned a zero or invalid address`);
      }
      return parseAddress(
        castCall(options.rpcUrl, TOKENBOUND_REGISTRY, "account(address,bytes32,uint256,address,uint256)(address)", [
          deployment.gardenAccountImpl as string,
          TOKENBOUND_SALT,
          options.chainId,
          deployment.gardenToken as string,
          tokenId.toString(),
        ]),
      );
    })
    .filter((garden) => !isZeroAddress(garden));
}

function enumerateGardens(options: VerifyOptions, deployment: DeploymentRecord): string[] {
  const gardens = new Map<string, string>();
  const candidates = [
    deployment.rootGarden?.address,
    ...loadGardenDeploymentFile(options.chainId),
    ...loadGardensFromChain(options, deployment),
  ];

  for (const garden of candidates) {
    if (!garden || isZeroAddress(garden)) continue;
    gardens.set(normalizeAddress(garden), garden);
  }

  return Array.from(gardens.values());
}

function loadStewardUpgradeBaseline(baselinePath: string): StewardUpgradeBaseline {
  const candidates = path.isAbsolute(baselinePath)
    ? [baselinePath]
    : [path.resolve(process.cwd(), baselinePath), path.resolve(REPO_ROOT, baselinePath)];
  const resolvedPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(`Steward upgrade baseline not found; checked: ${candidates.join(", ")}`);
  }

  const baseline = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as StewardUpgradeBaseline;
  if (
    baseline.version !== 1 ||
    !baseline.chainId ||
    !isAddress(baseline.hatsModule) ||
    !isAddress(baseline.implementationBefore) ||
    !isAddress(baseline.ownerBefore) ||
    !isAddress(baseline.hatsProtocolBefore) ||
    !Array.isArray(baseline.gardens) ||
    baseline.gardens.length === 0
  ) {
    throw new Error(`Invalid Steward upgrade baseline: ${resolvedPath}`);
  }

  const hatIdKeys = [
    "ownerHatId",
    "operatorHatId",
    "evaluatorHatId",
    "gardenerHatId",
    "funderHatId",
    "communityHatId",
    "adminHatId",
  ] as const;
  const gardens = new Set<string>();
  for (const garden of baseline.gardens) {
    if (
      !isAddress(garden.garden) ||
      typeof garden.configured !== "boolean" ||
      hatIdKeys.some((key) => !/^\d+$/.test(garden[key]) || BigInt(garden[key]) === 0n)
    ) {
      throw new Error(`Invalid garden record in Steward upgrade baseline: ${resolvedPath}`);
    }
    const normalizedGarden = normalizeAddress(garden.garden);
    if (gardens.has(normalizedGarden)) {
      throw new Error(`Duplicate garden in Steward upgrade baseline: ${garden.garden}`);
    }
    gardens.add(normalizedGarden);
  }
  if (baseline.probeAccounts?.some((account) => !isAddress(account))) {
    throw new Error(`Invalid probe account in Steward upgrade baseline: ${resolvedPath}`);
  }

  return baseline;
}

function readGardenHatIds(options: VerifyOptions, hatsModule: string, garden: string): StewardGardenBaseline {
  const output = castCall(
    options.rpcUrl,
    hatsModule,
    "getGardenHatIds(address)(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
    [garden],
  );
  const values = parseUintValues(output);
  if (values.length < 7) {
    throw new Error(`getGardenHatIds returned fewer than seven ids for ${garden}: ${output}`);
  }

  return {
    garden,
    ownerHatId: values[0].toString(),
    operatorHatId: values[1].toString(),
    evaluatorHatId: values[2].toString(),
    gardenerHatId: values[3].toString(),
    funderHatId: values[4].toString(),
    communityHatId: values[5].toString(),
    adminHatId: values[6].toString(),
    configured: parseBool(castCall(options.rpcUrl, hatsModule, "isConfigured(address)(bool)", [garden])),
  };
}

function validateStewardUpgrade(
  options: VerifyOptions,
  deployment: DeploymentRecord,
  liveGardens: string[],
  failures: string[],
): void {
  if (!options.checkStewardUpgrade) return;

  try {
    if (!options.stewardBaselinePath) {
      failures.push("--check-steward-upgrade requires --steward-baseline <path>");
      return;
    }
    if (!isAddress(options.expectedHatsImplementation)) {
      failures.push("--check-steward-upgrade requires --expected-hats-implementation <address>");
      return;
    }
    if (!isAddress(deployment.hatsModule)) {
      failures.push("deployment.hatsModule is missing or zero");
      return;
    }

    const baseline = loadStewardUpgradeBaseline(options.stewardBaselinePath);
    failures.push(
      ...collectStewardGardenCoverageErrors(
        baseline.gardens.map((garden) => garden.garden),
        liveGardens,
      ),
    );
    const hatsModule = deployment.hatsModule;
    assert(
      baseline.chainId === options.chainId,
      "Steward baseline chain id does not match verification chain",
      failures,
    );
    assert(
      normalizeAddress(baseline.hatsModule) === normalizeAddress(hatsModule),
      "Steward baseline HatsModule proxy does not match deployment artifact",
      failures,
    );

    const implementation = readStorageAddress(options.rpcUrl, hatsModule, EIP1967_IMPLEMENTATION_SLOT);
    assert(
      normalizeAddress(implementation) === normalizeAddress(options.expectedHatsImplementation),
      `HatsModule implementation ${implementation} does not match reviewed ${options.expectedHatsImplementation}`,
      failures,
    );
    assert(
      normalizeAddress(implementation) !== normalizeAddress(baseline.implementationBefore),
      "HatsModule implementation did not change from the pre-upgrade baseline",
      failures,
    );

    const owner = parseAddress(castCall(options.rpcUrl, hatsModule, "owner()(address)"));
    assert(
      normalizeAddress(owner) === normalizeAddress(baseline.ownerBefore),
      `HatsModule owner changed from ${baseline.ownerBefore} to ${owner}`,
      failures,
    );

    const hatsProtocol = parseAddress(castCall(options.rpcUrl, hatsModule, "hats()(address)"));
    assert(
      normalizeAddress(hatsProtocol) === normalizeAddress(baseline.hatsProtocolBefore),
      `Hats protocol reference changed from ${baseline.hatsProtocolBefore} to ${hatsProtocol}`,
      failures,
    );

    const fixedNonWearer = "0x000000000000000000000000000000000000dEaD";
    const fallbackProbes = new Map<string, string>();
    for (const account of [...options.stewardProbeAccounts, ...(baseline.probeAccounts ?? [])]) {
      if (isAddress(account)) fallbackProbes.set(normalizeAddress(account), account);
    }

    for (const expected of baseline.gardens) {
      const current = readGardenHatIds(options, hatsModule, expected.garden);
      for (const key of [
        "ownerHatId",
        "operatorHatId",
        "evaluatorHatId",
        "gardenerHatId",
        "funderHatId",
        "communityHatId",
        "adminHatId",
      ] as const) {
        assert(
          current[key] === expected[key],
          `${expected.garden} ${key} changed from ${expected[key]} to ${current[key]}`,
          failures,
        );
      }
      assert(
        current.configured === expected.configured,
        `${expected.garden} configured changed from ${expected.configured} to ${current.configured}`,
        failures,
      );

      const gardenProbes = new Map<string, string>();
      gardenProbes.set(normalizeAddress(fixedNonWearer), fixedNonWearer);
      try {
        const gardenOwner = parseAddress(castCall(options.rpcUrl, expected.garden, "owner()(address)"));
        if (isAddress(gardenOwner)) gardenProbes.set(normalizeAddress(gardenOwner), gardenOwner);
      } catch {
        // Some historical garden account implementations do not expose owner().
      }
      for (const account of [expected.garden, owner, hatsModule, ...fallbackProbes.values()]) {
        if (isAddress(account)) gardenProbes.set(normalizeAddress(account), account);
      }

      let gardenSawWearer = false;
      let gardenSawNonWearer = false;
      for (const account of gardenProbes.values()) {
        const steward = parseBool(
          castCall(options.rpcUrl, hatsModule, "isStewardOf(address,address)(bool)", [expected.garden, account]),
        );
        const operator = parseBool(
          castCall(options.rpcUrl, hatsModule, "isOperatorOf(address,address)(bool)", [expected.garden, account]),
        );
        assert(steward === operator, `selector mismatch for garden ${expected.garden}, account ${account}`, failures);
        gardenSawWearer ||= steward;
        gardenSawNonWearer ||= !steward;
        if (gardenSawWearer && gardenSawNonWearer) break;
      }
      assert(gardenSawWearer, `selector verification found no live role wearer for ${expected.garden}`, failures);
      assert(gardenSawNonWearer, `selector verification found no non-wearer for ${expected.garden}`, failures);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

function validateIndexerConfig(chainId: string, deployment: DeploymentRecord, failures: string[]): void {
  const indexerPath = path.join(__dirname, "../../../indexer/config.yaml");
  if (!fs.existsSync(indexerPath)) {
    failures.push(`Indexer config not found: ${indexerPath}`);
    return;
  }

  const parsed = yaml.load(fs.readFileSync(indexerPath, "utf8"), {
    schema: yaml.CORE_SCHEMA,
  }) as IndexerConfig;
  const chain = (parsed.chains ?? []).find((item) => item.id.toString() === chainId);
  if (!chain) {
    failures.push(`Indexer config missing chain id ${chainId}`);
    return;
  }

  const coverage = validateIndexerDeploymentCoverage(chainId, parsed, deployment);
  failures.push(...coverage.failures);

  if (coverage.skipped.length > 0) {
    console.log(
      `  indexer policy: skipped deployed contracts without Envio definitions: ${coverage.skipped.join(", ")}`,
    );
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
  expectedGardens: string[],
  failures: string[],
): Promise<void> {
  if (!options.checkIndexerRuntime) {
    return;
  }

  if (expectedGardens.length === 0) {
    failures.push("indexer runtime check requires at least one garden address");
    return;
  }

  const rootGarden = deployment.rootGarden?.address ?? expectedGardens[0];

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

        const expectedGardenSet = new Set(expectedGardens.map((garden) => normalizeAddress(garden)));
        const indexedGardenSet = new Set(gardens.map((garden) => normalizeAddress(garden.id)));
        const missingGardens = expectedGardens.filter((garden) => !indexedGardenSet.has(normalizeAddress(garden)));
        const rootGardenLower = normalizeAddress(rootGarden as string);
        const rootDomainEntry = gardenDomains.find((entry) => normalizeAddress(entry.garden) === rootGardenLower);
        const rootDomainMask = parseNumberish(rootDomainEntry?.domainMask);
        const hasRootDomainMask = Number.isFinite(rootDomainMask) && rootDomainMask === 15;
        const hasActions = actions.length > 0;

        if (missingGardens.length === 0 && hasRootDomainMask && hasActions) {
          console.log("  ✅ local indexer query check passed (all gardens, root domain mask, and actions ingested)");
          return;
        }

        lastObservation = [
          `gardens=${gardens.length}`,
          `actions=${actions.length}`,
          `matchedGardens=${expectedGardenSet.size - missingGardens.length}/${expectedGardenSet.size}`,
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
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`Etherscan source not verified: ${entry.name} (${entry.address}): ${reason}`);
      console.log(`  ${entry.name}: NOT VERIFIED`);
    }
  }
}

function validateOctantVaultReadiness(
  options: VerifyOptions,
  deployment: DeploymentRecord,
  gardens: string[],
  failures: string[],
): void {
  const octantModule = deployment.octantModule ?? ZERO_ADDRESS;
  assert(!isZeroAddress(octantModule), "deployment.octantModule is zero", failures);
  if (isZeroAddress(octantModule)) {
    return;
  }

  const yieldResolver = deployment.yieldSplitter ?? ZERO_ADDRESS;
  const octantFactory = deployment.octantFactory ?? ZERO_ADDRESS;
  const assets = parseAddressArray(castCall(options.rpcUrl, octantModule, "getSupportedAssets()(address[])"));
  const activeAssets: string[] = [];

  for (const asset of assets) {
    const strategy = parseAddress(castCall(options.rpcUrl, octantModule, "supportedAssets(address)(address)", [asset]));
    if (!isZeroAddress(strategy)) {
      activeAssets.push(asset);
    }
  }

  assert(activeAssets.length > 0, "octant has no active supported assets", failures);

  for (const garden of gardens) {
    for (const asset of activeAssets) {
      const vault = parseAddress(
        castCall(options.rpcUrl, octantModule, "getVaultForAsset(address,address)(address)", [garden, asset]),
      );
      assert(!isZeroAddress(vault), `missing Octant vault for garden ${garden} asset ${asset}`, failures);
      if (isZeroAddress(vault)) continue;

      const strategy = parseAddress(
        castCall(options.rpcUrl, octantModule, "vaultStrategies(address)(address)", [vault]),
      );
      assert(!isZeroAddress(strategy), `missing live strategy for vault ${vault}`, failures);

      const autoAllocate = parseBool(castCall(options.rpcUrl, vault, "autoAllocate()(bool)"));
      assert(autoAllocate, `autoAllocate disabled for vault ${vault}`, failures);

      // Verify strategy has non-zero maxDebt (required for auto-allocate to deploy funds)
      if (!isZeroAddress(strategy)) {
        const strategyInfo = castCall(options.rpcUrl, vault, "strategies(address)(uint256,uint256,uint256,uint256)", [
          strategy,
        ]);
        const maxDebt = parseUint(strategyInfo.split("\n")[3] ?? "0");
        assert(
          maxDebt > 0n,
          `strategy ${strategy} has maxDebt=0 on vault ${vault} — auto-allocate will not deploy funds`,
          failures,
        );
      }

      // Verify the live strategy is the effective auto-allocation target (queue head)
      if (autoAllocate && !isZeroAddress(strategy)) {
        const queueAddresses = parseAddressArray(castCall(options.rpcUrl, vault, "get_default_queue()(address[])"));
        assert(queueAddresses.length > 0, `vault ${vault} has autoAllocate=true but empty defaultQueue`, failures);
        if (queueAddresses.length > 0) {
          assert(
            normalizeAddress(queueAddresses[0]) === normalizeAddress(strategy),
            `vault ${vault} queue head mismatch: expected ${strategy}, got ${queueAddresses[0]}`,
            failures,
          );
        }
      }

      // Verify strategy health: asset match + totalAssets queryable + idle fund detection
      if (!isZeroAddress(strategy)) {
        // 1. Strategy's asset() must match the vault's expected asset (ERC4626 compliance)
        try {
          const strategyAsset = parseAddress(castCall(options.rpcUrl, strategy, "asset()(address)"));
          assert(
            normalizeAddress(strategyAsset) === normalizeAddress(asset),
            `strategy ${strategy} asset mismatch: expected ${asset}, got ${strategyAsset}`,
            failures,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(
            `strategy ${strategy} asset() call failed — strategy may not be ERC4626 compliant: ${maskRpcApiKey(message)}`,
          );
        }

        // 2. Strategy's totalAssets() must be queryable (proves Aave communication works)
        let strategyTotalAssets = 0n;
        try {
          strategyTotalAssets = parseUint(castCall(options.rpcUrl, strategy, "totalAssets()(uint256)"));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(
            `strategy ${strategy} totalAssets() call failed — strategy cannot communicate with Aave: ${maskRpcApiKey(message)}`,
          );
        }

        // 3. If vault has deposits and autoAllocate is on, strategy should have non-zero
        //    totalAssets — otherwise deposits are sitting idle, never reaching Aave
        if (autoAllocate) {
          try {
            const vaultTotalAssets = parseUint(castCall(options.rpcUrl, vault, "totalAssets()(uint256)"));
            if (vaultTotalAssets > 0n && strategyTotalAssets === 0n) {
              failures.push(
                `vault ${vault} has ${vaultTotalAssets} total assets but strategy ${strategy} totalAssets=0 — deposits are idle, auto-allocate pipeline is broken`,
              );
            }
          } catch {
            // vault.totalAssets() failure is non-critical here — vault existence was already validated
          }
        }
      }

      // Verify OctantModule has correct vault roles (VAULT_ROLE_BITMASK = 491)
      // Bits: ADD_STRATEGY(0) | REVOKE_STRATEGY(1) | ACCOUNTANT_MANAGER(3) |
      //       REPORTING(5) | DEBT_MANAGER(6) | MAX_DEBT_MANAGER(7) | DEPOSIT_LIMIT(8)
      const VAULT_ROLE_BITMASK = 491n;
      const roleMask = parseUint(castCall(options.rpcUrl, vault, "roles(address)(uint256)", [octantModule]));
      assert(
        (roleMask & VAULT_ROLE_BITMASK) === VAULT_ROLE_BITMASK,
        `vault roles for OctantModule on vault ${vault}: got ${roleMask}, expected all bits of ${VAULT_ROLE_BITMASK} set`,
        failures,
      );

      const accountant = parseAddress(castCall(options.rpcUrl, vault, "accountant()(address)"));
      if (!isZeroAddress(yieldResolver)) {
        assert(
          normalizeAddress(accountant) === normalizeAddress(yieldResolver),
          `vault accountant mismatch for ${vault}: expected ${yieldResolver}, got ${accountant}`,
          failures,
        );

        const registeredVault = parseAddress(
          castCall(options.rpcUrl, yieldResolver, "gardenVaults(address,address)(address)", [garden, asset]),
        );
        assert(
          normalizeAddress(registeredVault) === normalizeAddress(vault),
          `yieldResolver gardenVault mismatch for garden ${garden} asset ${asset}`,
          failures,
        );
      }

      const donationAddress = parseAddress(
        castCall(options.rpcUrl, octantModule, "gardenDonationAddresses(address)(address)", [garden]),
      );
      assert(!isZeroAddress(donationAddress), `garden donation address is zero for ${garden}`, failures);

      if (!isZeroAddress(octantFactory)) {
        const protocolFeeBps = parseUint(
          castCall(options.rpcUrl, octantFactory, "protocolFeeConfig(address)(uint16,address)", [vault]),
        );
        assert(
          protocolFeeBps === 0n,
          `protocol fee should be zero for vault ${vault}, got ${protocolFeeBps}`,
          failures,
        );
      }
    }
  }
}

function validateCookieJars(
  options: VerifyOptions,
  deployment: DeploymentRecord,
  gardens: string[],
  failures: string[],
): void {
  const cookieJarModule = deployment.cookieJarModule ?? ZERO_ADDRESS;
  assert(!isZeroAddress(cookieJarModule), "deployment.cookieJarModule is zero", failures);
  if (isZeroAddress(cookieJarModule)) {
    return;
  }

  const assets = parseAddressArray(castCall(options.rpcUrl, cookieJarModule, "getSupportedAssets()(address[])"));
  assert(assets.length > 0, "cookie jar has no supported assets", failures);

  for (const garden of gardens) {
    for (const asset of assets) {
      const jar = parseAddress(
        castCall(options.rpcUrl, cookieJarModule, "getGardenJar(address,address)(address)", [garden, asset]),
      );
      assert(!isZeroAddress(jar), `missing CookieJar for garden ${garden} asset ${asset}`, failures);
    }
  }
}

function validateSignalPoolYieldWiring(
  options: VerifyOptions,
  deployment: DeploymentRecord,
  gardens: string[],
  failures: string[],
): void {
  const gardensModule = deployment.gardensModule ?? ZERO_ADDRESS;
  const yieldResolver = deployment.yieldSplitter ?? ZERO_ADDRESS;

  assert(!isZeroAddress(gardensModule), "deployment.gardensModule is zero", failures);
  assert(!isZeroAddress(yieldResolver), "deployment.yieldSplitter is zero", failures);
  if (isZeroAddress(gardensModule) || isZeroAddress(yieldResolver)) {
    return;
  }

  const moduleResolver = parseAddress(castCall(options.rpcUrl, gardensModule, "yieldResolver()(address)"));
  assert(
    normalizeAddress(moduleResolver) === normalizeAddress(yieldResolver),
    `gardensModule.yieldResolver != yieldSplitter (${moduleResolver})`,
    failures,
  );

  const resolverModule = parseAddress(castCall(options.rpcUrl, yieldResolver, "gardensModule()(address)"));
  assert(
    normalizeAddress(resolverModule) === normalizeAddress(gardensModule),
    `yieldResolver.gardensModule != gardensModule (${resolverModule})`,
    failures,
  );

  for (const garden of gardens) {
    const pools = parseAddressArray(
      castCall(options.rpcUrl, gardensModule, "getGardenSignalPools(address)(address[])", [garden]),
    );
    const typedPool = parseAddress(
      castCall(options.rpcUrl, gardensModule, "gardenHypercertSignalPools(address)(address)", [garden]),
    );
    const resolverPool = parseAddress(
      castCall(options.rpcUrl, yieldResolver, "gardenHypercertPools(address)(address)", [garden]),
    );
    const treasury = parseAddress(
      castCall(options.rpcUrl, yieldResolver, "gardenTreasuries(address)(address)", [garden]),
    );

    if (pools.length === 0) {
      failures.push(`garden ${garden} has no signal pools; operator pool creation is still required`);
    } else {
      assert(!isZeroAddress(typedPool), `garden ${garden} typed HypercertSignal pool is zero`, failures);
      assert(
        normalizeAddress(resolverPool) === normalizeAddress(typedPool),
        `garden ${garden} resolver hypercert pool ${resolverPool} != typed pool ${typedPool}`,
        failures,
      );
    }

    assert(!isZeroAddress(treasury), `garden ${garden} treasury fallback is zero`, failures);
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
  const allGardens = enumerateGardens(options, deployment);
  const rootGarden = deployment.rootGarden?.address ?? ZERO_ADDRESS;

  console.log(`  enumeratedGardens: ${allGardens.length}`);

  if (options.requireProductCopy && !options.productCopyAcknowledged) {
    failures.push(
      "product copy acknowledgment missing: rerun with --ack-product-copy or PRODUCT_COPY_ACKNOWLEDGED=true",
    );
  }

  assert(!isZeroAddress(deployment.actionRegistry), "deployment.actionRegistry is zero", failures);
  assert(!isZeroAddress(deployment.gardenToken), "deployment.gardenToken is zero", failures);
  assert(!isZeroAddress(deployment.gardenAccountImpl), "deployment.gardenAccountImpl is zero", failures);
  assert(!isZeroAddress(rootGarden), "deployment.rootGarden.address is zero", failures);
  assert(allGardens.length > 0, "failed to enumerate any gardens", failures);

  validateStewardUpgrade(options, deployment, allGardens, failures);
  if (options.checkStewardUpgrade) {
    if (failures.length > 0) {
      console.error("\nVerification failed:");
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      process.exit(1);
    }

    console.log("Verification passed: Steward upgrade invariants are preserved.");
    return;
  }

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
  // The Hypercert marketplace is deployed only on Arbitrum. Sepolia keeps the
  // adapter address for integration compatibility without the exchange stack.
  if (options.network === "arbitrum" && !isZeroAddress(deployment.marketplaceAdapter) && failures.length === 0) {
    const marketplaceState = readMarketplaceLiveState(deployment, {
      call: (to, signature, args = []) => {
        try {
          return castCall(options.rpcUrl, to, signature, args);
        } catch {
          return null;
        }
      },
      hasCode: (address) => hasContractCode(options.rpcUrl, address),
    });
    const marketplace = validateMarketplaceReadiness(deployment, marketplaceState, {
      expectedOwner: process.env.MARKETPLACE_EXPECTED_OWNER || process.env.HYPERCERT_MARKETPLACE_EXPECTED_OWNER,
    });
    failures.push(...marketplace.failures);
  }

  // YieldResolver checks
  if (!isZeroAddress(deployment.yieldSplitter) && failures.length === 0) {
    const yieldResolver = deployment.yieldSplitter as string;
    const octantRef = parseAddress(castCall(options.rpcUrl, yieldResolver, "octantModule()(address)"));
    assert(!isZeroAddress(octantRef), "yieldResolver.octantModule is zero", failures);

    const cookieJarRef = parseAddress(castCall(options.rpcUrl, yieldResolver, "cookieJarModule()(address)"));
    assert(!isZeroAddress(cookieJarRef), "yieldResolver.cookieJarModule is zero", failures);
  }

  if (failures.length === 0) {
    validateSignalPoolYieldWiring(options, deployment, allGardens, failures);
  }

  if (options.requireOctant && failures.length === 0) {
    validateOctantVaultReadiness(options, deployment, allGardens, failures);
  }

  if (options.requireCookieJar && failures.length === 0) {
    validateCookieJars(options, deployment, allGardens, failures);
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
  await validateIndexerRuntime(options, deployment, allGardens, failures);

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

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Verification command failed: ${maskRpcApiKey(message)}`);
    process.exit(1);
  });
}
