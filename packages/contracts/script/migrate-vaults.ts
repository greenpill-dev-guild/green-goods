#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

import { CHAIN_ID_MAP, NetworkManager } from "./utils/network";

dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";
const HYPERCERT_SIGNAL_POOL_TYPE = 1n;

type NetworkName = "localhost" | "mainnet" | "arbitrum" | "sepolia" | "celo";

interface DeploymentRecord {
  gardenToken?: string;
  gardenAccountImpl?: string;
  octantFactory?: string;
  octantModule?: string;
  gardensModule?: string;
  yieldSplitter?: string;
  rootGarden?: {
    address?: string;
    tokenId?: number;
  };
}

interface GardensFile {
  gardens?: Array<{ tokenId?: number; address?: string }>;
}

interface RpcLog {
  topics?: string[];
  data?: string;
}

interface MigrateOptions {
  network: NetworkName;
  chainId: string;
  rpcUrl: string;
  dryRun: boolean;
  broadcast: boolean;
  sender?: string;
}

interface VaultStatus {
  garden: string;
  asset: string;
  vault: string;
  strategy: string;
  accountant: string;
  autoAllocate: boolean;
  donationAddress: string;
  resolverVault: string;
  protocolFeeBps: bigint;
}

interface TemplateValidation {
  asset: string;
  template: string;
  errors: string[];
}

interface MigrationPlan {
  octantModule: string;
  gardensModule: string;
  yieldResolver: string;
  vaultGardens: string[];
  vaultAssets: string[];
  typedPoolGardens: string[];
  typedPools: string[];
  resolverPoolGardens: string[];
  resolverPools: string[];
  treasuryGardens: string[];
  treasuries: string[];
}

function parseArgs(argv: string[]): MigrateOptions {
  let network: NetworkName = "arbitrum";
  let rpcUrl = "";
  let chainId = "";
  let dryRun = true;
  let broadcast = false;
  let sender: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--network":
      case "-n":
        network = (argv[++i] ?? network) as NetworkName;
        break;
      case "--rpc-url":
        rpcUrl = argv[++i] ?? rpcUrl;
        break;
      case "--chain-id":
        chainId = argv[++i] ?? chainId;
        break;
      case "--broadcast":
        broadcast = true;
        dryRun = false;
        break;
      case "--dry-run":
        dryRun = true;
        broadcast = false;
        break;
      case "--sender":
        sender = argv[++i] ?? sender;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        break;
    }
  }

  const networkManager = new NetworkManager();
  return {
    network,
    chainId: chainId || CHAIN_ID_MAP[network] || networkManager.getChainId(network).toString(),
    rpcUrl: rpcUrl || networkManager.getRpcUrl(network),
    dryRun,
    broadcast,
    sender,
  };
}

function showHelp(): void {
  console.log(`
Green Goods Vault Migration Runner

Usage:
  bun script/migrate-vaults.ts [options]

Options:
  --network, -n <name>  Network to target (default: arbitrum)
  --rpc-url <url>       Override RPC URL
  --chain-id <id>       Override chain ID / deployment artifact selection
  --dry-run             Read-only audit mode (default)
  --broadcast           Execute enableAutoAllocate on unmigrated vaults
  --sender <address>    Explicit sender for transaction simulation / broadcasting
  --help, -h            Show this help

Environment:
  FOUNDRY_KEYSTORE_ACCOUNT   Foundry keystore name used for broadcast mode
  MIGRATION_PRIVATE_KEY      Optional private key for non-interactive broadcast mode
  PRIVATE_KEY                Fallback private key if MIGRATION_PRIVATE_KEY is unset
  `);
}

function loadDeployment(chainId: string): DeploymentRecord {
  const deploymentPath = path.join(__dirname, "../deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function isZeroAddress(value: string | undefined): boolean {
  return !value || normalizeAddress(value) === ZERO_ADDRESS;
}

function parseAddress(output: string): string {
  const match = output.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : ZERO_ADDRESS;
}

function parseAddressArray(output: string): string[] {
  return output.match(/0x[a-fA-F0-9]{40}/g) ?? [];
}

function parseTopicAddress(topic: string | undefined): string {
  if (!topic) return ZERO_ADDRESS;
  const normalized = topic.toLowerCase();
  if (/^0x[a-f0-9]{64}$/.test(normalized)) {
    return `0x${normalized.slice(-40)}`;
  }
  return parseAddress(topic);
}

function parseBool(output: string): boolean {
  const value = output.trim().toLowerCase();
  return value === "true" || value === "1";
}

function parseUint(output: string): bigint {
  const token = output.match(/0x[a-fA-F0-9]+|\d+/)?.[0];
  if (!token) return 0n;
  return token.startsWith("0x") ? BigInt(token) : BigInt(token);
}

function parseLogDataUint(data: string | undefined): bigint {
  if (!data || data === "0x") return 0n;
  const firstWord = data.slice(0, 66);
  return BigInt(firstWord);
}

function castCall(rpcUrl: string, to: string, signature: string, args: string[] = []): string {
  return execFileSync("cast", ["call", to, signature, ...args, "--rpc-url", rpcUrl], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function tryCastCall(rpcUrl: string, to: string, signature: string, args: string[] = []): string | null {
  try {
    return castCall(rpcUrl, to, signature, args);
  } catch {
    return null;
  }
}

function hasContractCode(rpcUrl: string, address: string): boolean {
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

function castLogs(rpcUrl: string, address: string, signature: string): RpcLog[] {
  try {
    const output = execFileSync(
      "cast",
      [
        "logs",
        "--json",
        "--from-block",
        "0",
        "--to-block",
        "latest",
        "--address",
        address,
        "--rpc-url",
        rpcUrl,
        signature,
      ],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return JSON.parse(output) as RpcLog[];
  } catch {
    return [];
  }
}

function loadGardensFromFile(chainId: string): string[] {
  const gardensPath = path.join(__dirname, "../deployments", `${chainId}-gardens.json`);
  if (!fs.existsSync(gardensPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(gardensPath, "utf8")) as GardensFile;
  return (parsed.gardens ?? [])
    .map((garden) => garden.address)
    .filter((garden): garden is string => typeof garden === "string" && !isZeroAddress(garden));
}

function loadGardensFromChain(options: MigrateOptions, deployment: DeploymentRecord): string[] {
  if (isZeroAddress(deployment.gardenToken) || isZeroAddress(deployment.gardenAccountImpl)) {
    return [];
  }

  const logs = castLogs(options.rpcUrl, deployment.gardenToken as string, "Transfer(address,address,uint256)");
  const mintedTokenIds = logs
    .filter((entry) => normalizeAddress(parseTopicAddress(entry.topics?.[1])) === normalizeAddress(ZERO_ADDRESS))
    .map((entry) => {
      const tokenIdTopic = entry.topics?.[3];
      return tokenIdTopic ? BigInt(tokenIdTopic) : 0n;
    })
    .filter((tokenId) => tokenId > 0n);

  return mintedTokenIds
    .map((tokenId) =>
      parseAddress(
        castCall(options.rpcUrl, TOKENBOUND_REGISTRY, "account(address,bytes32,uint256,address,uint256)(address)", [
          deployment.gardenAccountImpl as string,
          TOKENBOUND_SALT,
          options.chainId,
          deployment.gardenToken as string,
          tokenId.toString(),
        ]),
      ),
    )
    .filter((garden) => !isZeroAddress(garden));
}

function enumerateGardens(options: MigrateOptions, deployment: DeploymentRecord): string[] {
  const deduped = new Map<string, string>();
  const candidates = [
    deployment.rootGarden?.address,
    ...loadGardensFromFile(options.chainId),
    ...loadGardensFromChain(options, deployment),
  ];

  for (const candidate of candidates) {
    if (!candidate || isZeroAddress(candidate)) continue;
    deduped.set(normalizeAddress(candidate), candidate);
  }

  return Array.from(deduped.values());
}

function getActiveAssets(options: MigrateOptions, octantModule: string): string[] {
  const supportedAssets = parseAddressArray(castCall(options.rpcUrl, octantModule, "getSupportedAssets()(address[])"));
  return supportedAssets.filter((asset) => {
    const template = parseAddress(castCall(options.rpcUrl, octantModule, "supportedAssets(address)(address)", [asset]));
    return !isZeroAddress(template);
  });
}

function validateTemplate(rpcUrl: string, asset: string, template: string): TemplateValidation {
  const errors: string[] = [];

  if (isZeroAddress(template)) {
    errors.push("template is zero address");
    return { asset, template, errors };
  }

  if (!hasContractCode(rpcUrl, template)) {
    errors.push("template has no contract code");
    return { asset, template, errors };
  }

  const templateAssetRaw = tryCastCall(rpcUrl, template, "asset()(address)");
  if (!templateAssetRaw) {
    errors.push("template does not implement asset()(address)");
  } else {
    const templateAsset = parseAddress(templateAssetRaw);
    if (isZeroAddress(templateAsset)) {
      errors.push("template asset() returned zero address");
    } else if (normalizeAddress(templateAsset) !== normalizeAddress(asset)) {
      errors.push(`template asset mismatch: expected ${asset}, got ${templateAsset}`);
    }
  }

  const aTokenRaw = tryCastCall(rpcUrl, template, "aToken()(address)");
  if (!aTokenRaw || isZeroAddress(parseAddress(aTokenRaw))) {
    errors.push("template aToken() is missing or zero");
  }

  const aavePoolRaw = tryCastCall(rpcUrl, template, "aavePool()(address)");
  if (!aavePoolRaw || isZeroAddress(parseAddress(aavePoolRaw))) {
    errors.push("template aavePool() is missing or zero");
  }

  const dataProviderRaw = tryCastCall(rpcUrl, template, "dataProvider()(address)");
  if (!dataProviderRaw || isZeroAddress(parseAddress(dataProviderRaw))) {
    errors.push("template does not implement dataProvider()(address)");
  }

  return { asset, template, errors };
}

function validateActiveAssetTemplates(
  options: MigrateOptions,
  octantModule: string,
  assets: string[],
): TemplateValidation[] {
  return assets.map((asset) => {
    const template = parseAddress(castCall(options.rpcUrl, octantModule, "supportedAssets(address)(address)", [asset]));
    return validateTemplate(options.rpcUrl, asset, template);
  });
}

function getVaultStatus(
  options: MigrateOptions,
  deployment: DeploymentRecord,
  garden: string,
  asset: string,
): VaultStatus | null {
  const octantModule = deployment.octantModule as string;
  const yieldResolver = deployment.yieldSplitter ?? ZERO_ADDRESS;
  const octantFactory = deployment.octantFactory ?? ZERO_ADDRESS;
  const vault = parseAddress(
    castCall(options.rpcUrl, octantModule, "getVaultForAsset(address,address)(address)", [garden, asset]),
  );
  if (isZeroAddress(vault)) {
    return null;
  }

  const strategy = parseAddress(castCall(options.rpcUrl, octantModule, "vaultStrategies(address)(address)", [vault]));
  const accountant = parseAddress(castCall(options.rpcUrl, vault, "accountant()(address)"));
  const autoAllocate = parseBool(castCall(options.rpcUrl, vault, "autoAllocate()(bool)"));
  const donationAddress = parseAddress(
    castCall(options.rpcUrl, octantModule, "gardenDonationAddresses(address)(address)", [garden]),
  );
  const resolverVault = !isZeroAddress(yieldResolver)
    ? parseAddress(castCall(options.rpcUrl, yieldResolver, "gardenVaults(address,address)(address)", [garden, asset]))
    : ZERO_ADDRESS;
  const protocolFeeBps = !isZeroAddress(octantFactory)
    ? parseUint(castCall(options.rpcUrl, octantFactory, "protocolFeeConfig(address)(uint16,address)", [vault]))
    : 0n;

  return {
    garden,
    asset,
    vault,
    strategy,
    accountant,
    autoAllocate,
    donationAddress,
    resolverVault,
    protocolFeeBps,
  };
}

function isMigrated(status: VaultStatus, expectedResolver: string): boolean {
  return (
    !isZeroAddress(status.strategy) &&
    status.autoAllocate &&
    normalizeAddress(status.accountant) === normalizeAddress(expectedResolver) &&
    !isZeroAddress(status.donationAddress) &&
    (isZeroAddress(expectedResolver) || normalizeAddress(status.resolverVault) === normalizeAddress(status.vault)) &&
    status.protocolFeeBps === 0n
  );
}

function createMigrationPlan(deployment: DeploymentRecord): MigrationPlan {
  return {
    octantModule: deployment.octantModule ?? ZERO_ADDRESS,
    gardensModule: deployment.gardensModule ?? ZERO_ADDRESS,
    yieldResolver: deployment.yieldSplitter ?? ZERO_ADDRESS,
    vaultGardens: [],
    vaultAssets: [],
    typedPoolGardens: [],
    typedPools: [],
    resolverPoolGardens: [],
    resolverPools: [],
    treasuryGardens: [],
    treasuries: [],
  };
}

function hasMigrationPlanWrites(plan: MigrationPlan): boolean {
  return (
    plan.vaultGardens.length > 0 ||
    plan.typedPoolGardens.length > 0 ||
    plan.resolverPoolGardens.length > 0 ||
    plan.treasuryGardens.length > 0
  );
}

function writeMigrationPlan(options: MigrateOptions, plan: MigrationPlan): string {
  const planDir = path.join(__dirname, "../.generated/migrations");
  fs.mkdirSync(planDir, { recursive: true });
  const planPath = path.join(planDir, `vaults-${options.chainId}-${Date.now()}.json`);
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  return planPath;
}

function executeMigrationPlan(options: MigrateOptions, plan: MigrationPlan): void {
  if (!hasMigrationPlanWrites(plan)) {
    console.log("\nBroadcast plan empty: no migration writes needed");
    return;
  }

  const privateKey = process.env.MIGRATION_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
  const planPath = writeMigrationPlan(options, plan);
  const forgeArgs = [
    "script",
    "script/MigrateVaults.s.sol:MigrateVaults",
    "--sig",
    "run(string)",
    planPath,
    "--rpc-url",
    options.rpcUrl,
    "--chain-id",
    options.chainId,
    "--broadcast",
  ];

  if (options.sender) {
    forgeArgs.push("--sender", options.sender);
  }

  if (privateKey) {
    forgeArgs.push("--private-key", privateKey);
  } else {
    forgeArgs.push("--account", keystoreName);
    console.log(`\nUsing Foundry keystore: ${keystoreName}`);
    console.log("Foundry will prompt once for the migration broadcast session");
  }

  console.log(`\nExecuting migration broadcast plan: ${planPath}`);
  execFileSync("forge", forgeArgs, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      FOUNDRY_PROFILE: "production",
      FORGE_BROADCAST: "true",
    },
  });
}

function loadHypercertSignalPoolsFromEvents(options: MigrateOptions, gardensModule: string): Map<string, string> {
  const hypercertPools = new Map<string, string>();
  const logs = castLogs(options.rpcUrl, gardensModule, "SignalPoolCreated(address,address,uint8,address)");

  for (const entry of logs) {
    if (parseLogDataUint(entry.data) !== HYPERCERT_SIGNAL_POOL_TYPE) continue;
    const garden = parseTopicAddress(entry.topics?.[1]);
    const pool = parseTopicAddress(entry.topics?.[2]);
    if (isZeroAddress(garden) || isZeroAddress(pool)) continue;
    hypercertPools.set(normalizeAddress(garden), pool);
  }

  return hypercertPools;
}

function runSignalPoolWiringBackfill(
  options: MigrateOptions,
  deployment: DeploymentRecord,
  gardens: string[],
  plan: MigrationPlan,
): number {
  const gardensModule = deployment.gardensModule ?? ZERO_ADDRESS;
  const yieldResolver = deployment.yieldSplitter ?? ZERO_ADDRESS;

  console.log("\nSignal pool wiring + treasury backfill");

  if (isZeroAddress(gardensModule) || isZeroAddress(yieldResolver)) {
    console.log("  skipped: gardensModule or yieldSplitter missing from deployment artifact");
    return 1;
  }

  let failures = 0;
  const moduleResolver = parseAddress(castCall(options.rpcUrl, gardensModule, "yieldResolver()(address)"));
  const resolverModule = parseAddress(castCall(options.rpcUrl, yieldResolver, "gardensModule()(address)"));
  if (normalizeAddress(moduleResolver) !== normalizeAddress(yieldResolver)) {
    console.log(`  failure: gardensModule.yieldResolver != yieldSplitter (${moduleResolver})`);
    failures += 1;
  }
  if (normalizeAddress(resolverModule) !== normalizeAddress(gardensModule)) {
    console.log(`  failure: yieldResolver.gardensModule != gardensModule (${resolverModule})`);
    failures += 1;
  }
  if (failures > 0) return failures;

  const eventHypercertPools = loadHypercertSignalPoolsFromEvents(options, gardensModule);
  let wired = 0;
  let treasuryBackfilled = 0;
  let noPools = 0;
  let manualReview = 0;

  for (const garden of gardens) {
    const storedPools = parseAddressArray(
      castCall(options.rpcUrl, gardensModule, "getGardenSignalPools(address)(address[])", [garden]),
    );
    const eventHypercertPool = eventHypercertPools.get(normalizeAddress(garden)) ?? ZERO_ADDRESS;
    let hypercertPool = eventHypercertPool;
    const eventSourced = !isZeroAddress(eventHypercertPool);

    if (storedPools.length === 0) {
      noPools += 1;
      console.log(`- ${garden}`);
      console.log("  pools: none - operator must create pools in admin; new creation will auto-wire");
    } else if (!eventSourced) {
      manualReview += 1;
      hypercertPool = storedPools.length > 1 ? storedPools[1] : ZERO_ADDRESS;
      console.log(`- ${garden}`);
      console.log(`  pools: ${storedPools.length}`);
      console.log(`  hypercertPool: ${hypercertPool}`);
      console.log("  source: array-index fallback only - manual review required, no automatic pool write");
      if (options.broadcast) {
        failures += 1;
      }
    } else {
      console.log(`- ${garden}`);
      console.log(`  hypercertPool: ${hypercertPool}`);
      console.log("  source: SignalPoolCreated(PoolType.HypercertSignal)");
    }

    if (eventSourced) {
      const typedPool = parseAddress(
        castCall(options.rpcUrl, gardensModule, "gardenHypercertSignalPools(address)(address)", [garden]),
      );
      const resolverPool = parseAddress(
        castCall(options.rpcUrl, yieldResolver, "gardenHypercertPools(address)(address)", [garden]),
      );

      if (normalizeAddress(typedPool) !== normalizeAddress(hypercertPool)) {
        console.log(`  typedPool: ${typedPool} -> ${hypercertPool}`);
        if (options.broadcast) {
          plan.typedPoolGardens.push(garden);
          plan.typedPools.push(hypercertPool);
        }
      }

      if (normalizeAddress(resolverPool) !== normalizeAddress(hypercertPool)) {
        console.log(`  resolverPool: ${resolverPool} -> ${hypercertPool}`);
        if (options.broadcast) {
          plan.resolverPoolGardens.push(garden);
          plan.resolverPools.push(hypercertPool);
        }
      }

      const needsSignalWrite =
        normalizeAddress(typedPool) !== normalizeAddress(hypercertPool) ||
        normalizeAddress(resolverPool) !== normalizeAddress(hypercertPool);

      if (!needsSignalWrite) {
        console.log("  result: signal wiring already matched");
      } else if (!options.broadcast) {
        wired += 1;
        console.log("  result: would wire typed pool and/or resolver pool");
      } else {
        wired += 1;
      }
    }

    const treasury = parseAddress(
      castCall(options.rpcUrl, yieldResolver, "gardenTreasuries(address)(address)", [garden]),
    );
    if (isZeroAddress(treasury)) {
      console.log(`  treasury: ${ZERO_ADDRESS} -> ${garden}`);
      if (options.broadcast) {
        plan.treasuryGardens.push(garden);
        plan.treasuries.push(garden);
        treasuryBackfilled += 1;
      } else {
        treasuryBackfilled += 1;
      }
    } else {
      console.log(`  treasury: ${treasury}`);
    }
  }

  console.log("\nSignal wiring summary");
  console.log(`  event-derived hypercert pools: ${eventHypercertPools.size}`);
  console.log(`  wired / would wire: ${wired}`);
  console.log(`  treasury backfilled / would backfill: ${treasuryBackfilled}`);
  console.log(`  no-pool gardens needing operator action: ${noPools}`);
  console.log(`  manual-review fallback candidates: ${manualReview}`);
  console.log(`  failures: ${failures}`);

  return failures;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const deployment = loadDeployment(options.chainId);
  const plan = createMigrationPlan(deployment);

  if (isZeroAddress(deployment.octantModule)) {
    throw new Error("octantModule is missing from deployment artifact");
  }

  if (!options.dryRun && !options.broadcast) {
    throw new Error("Refusing to run in a non-dry, non-broadcast mode");
  }

  console.log("\nVault migration audit");
  console.log(`  network: ${options.network}`);
  console.log(`  chainId: ${options.chainId}`);
  console.log(`  mode: ${options.broadcast ? "broadcast" : "dry-run"}`);

  const gardens = enumerateGardens(options, deployment);
  const assets = getActiveAssets(options, deployment.octantModule as string);
  const templateChecks = validateActiveAssetTemplates(options, deployment.octantModule as string, assets);
  const invalidTemplates = templateChecks.filter((check) => check.errors.length > 0);

  if (invalidTemplates.length > 0) {
    console.log("\nInvalid Octant strategy templates detected:");
    for (const check of invalidTemplates) {
      console.log(`- ${check.asset}`);
      console.log(`  template: ${check.template}`);
      for (const error of check.errors) {
        console.log(`  issue: ${error}`);
      }
    }

    console.log("\nRefusing to run vault migration until supportedAssets point to ERC4626-compatible templates.");
    if (options.network === "arbitrum") {
      console.log("Repair first with: bun run contracts:repair:octant-assets:arbitrum");
      console.log("Validate the repair first with: bun run contracts:repair:octant-assets:dry:arbitrum");
    }
    process.exitCode = 1;
    return;
  }

  console.log(`  gardens: ${gardens.length}`);
  console.log(`  active assets: ${assets.length}\n`);

  let migrated = 0;
  let skipped = 0;
  let missingVaults = 0;
  let failures = 0;

  for (const garden of gardens) {
    for (const asset of assets) {
      const status = getVaultStatus(options, deployment, garden, asset);
      if (!status) {
        missingVaults += 1;
        continue;
      }

      if (isMigrated(status, deployment.yieldSplitter ?? ZERO_ADDRESS)) {
        skipped += 1;
        continue;
      }

      console.log(`- ${garden} / ${asset}`);
      console.log(`  vault: ${status.vault}`);
      console.log(`  strategy: ${status.strategy}`);
      console.log(`  accountant: ${status.accountant}`);
      console.log(`  autoAllocate: ${status.autoAllocate}`);
      console.log(`  donation: ${status.donationAddress}`);
      console.log(`  protocolFeeBps: ${status.protocolFeeBps}`);

      if (options.broadcast) {
        plan.vaultGardens.push(garden);
        plan.vaultAssets.push(asset);
        migrated += 1;
        console.log("  result: queued for migration");
      } else {
        migrated += 1;
        console.log("  result: would migrate");
      }
    }
  }

  failures += runSignalPoolWiringBackfill(options, deployment, gardens, plan);

  console.log("\nSummary");
  console.log(`  would migrate / migrated: ${migrated}`);
  console.log(`  already migrated: ${skipped}`);
  console.log(`  missing vault slots: ${missingVaults}`);
  console.log(`  failures: ${failures}`);

  if (options.broadcast && failures === 0) {
    executeMigrationPlan(options, plan);

    for (let i = 0; i < plan.vaultGardens.length; i++) {
      const refreshed = getVaultStatus(
        options,
        deployment,
        plan.vaultGardens[i] as string,
        plan.vaultAssets[i] as string,
      );
      if (!refreshed || !isMigrated(refreshed, deployment.yieldSplitter ?? ZERO_ADDRESS)) {
        failures += 1;
        console.log(`  verification failed after broadcast: ${plan.vaultGardens[i]} / ${plan.vaultAssets[i]}`);
      }
    }

    for (let i = 0; i < plan.typedPoolGardens.length; i++) {
      const garden = plan.typedPoolGardens[i] as string;
      const pool = plan.typedPools[i] as string;
      const typedPool = parseAddress(
        castCall(options.rpcUrl, plan.gardensModule, "gardenHypercertSignalPools(address)(address)", [garden]),
      );
      if (normalizeAddress(typedPool) !== normalizeAddress(pool)) {
        failures += 1;
        console.log(`  typed pool verification failed after broadcast: ${garden}`);
      }
    }

    for (let i = 0; i < plan.resolverPoolGardens.length; i++) {
      const garden = plan.resolverPoolGardens[i] as string;
      const pool = plan.resolverPools[i] as string;
      const resolverPool = parseAddress(
        castCall(options.rpcUrl, plan.yieldResolver, "gardenHypercertPools(address)(address)", [garden]),
      );
      if (normalizeAddress(resolverPool) !== normalizeAddress(pool)) {
        failures += 1;
        console.log(`  resolver pool verification failed after broadcast: ${garden}`);
      }
    }

    for (let i = 0; i < plan.treasuryGardens.length; i++) {
      const garden = plan.treasuryGardens[i] as string;
      const treasury = plan.treasuries[i] as string;
      const storedTreasury = parseAddress(
        castCall(options.rpcUrl, plan.yieldResolver, "gardenTreasuries(address)(address)", [garden]),
      );
      if (normalizeAddress(storedTreasury) !== normalizeAddress(treasury)) {
        failures += 1;
        console.log(`  treasury verification failed after broadcast: ${garden}`);
      }
    }

    if (failures === 0) {
      console.log("\nBroadcast verification passed");
    } else {
      console.log(`\nBroadcast verification failures: ${failures}`);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
