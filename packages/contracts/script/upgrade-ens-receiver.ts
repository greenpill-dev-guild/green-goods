#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { Interface } from "ethers";
import { NetworkManager } from "./utils/network";

const CONTRACTS_ROOT = path.join(__dirname, "..");
const PROJECT_ROOT = path.join(CONTRACTS_ROOT, "..", "..");
const DEFAULT_MIGRATION_INPUT_PATHS = [
  path.join(PROJECT_ROOT, "reports", "ens-registrations.json"),
  path.join(PROJECT_ROOT, "reports", "ens-registrations-mainnet.json"),
];
const ENS_RECEIVER_INTERFACE = new Interface([
  "event NameRegistered(string slug, address indexed owner, uint8 nameType, bytes32 indexed messageId)",
  "event NameReleased(string slug, address indexed previousOwner, bytes32 indexed messageId)",
]);
const NAME_REGISTERED_TOPIC = ENS_RECEIVER_INTERFACE.getEvent("NameRegistered").topicHash.toLowerCase();
const NAME_RELEASED_TOPIC = ENS_RECEIVER_INTERFACE.getEvent("NameReleased").topicHash.toLowerCase();
const HISTORICAL_MAINNET_LOG_PROVIDERS = [
  { name: "publicnode", url: "https://ethereum-rpc.publicnode.com", maxBlockRange: 50_000 },
  { name: "drpc", url: "https://eth.drpc.org", maxBlockRange: 10_000 },
];

// Load environment variables from root .env
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

type Command = "deploy-sepolia" | "deploy-mainnet" | "update-l1-receiver" | "migrate";

interface Options {
  command: Command;
  network: string;
  broadcast: boolean;
  pureSimulation: boolean;
  newReceiver?: string;
  registrationsFile?: string;
  sender?: string;
}

interface MigrationRegistrationInput {
  slug?: string;
  owner?: string;
  nameType?: number | string;
}

interface MigrationFileInput {
  newReceiver?: string;
  slugs?: string[];
  owners?: string[];
  nameTypes?: Array<number | string>;
  registrations?: MigrationRegistrationInput[];
}

interface PreparedMigrationInput {
  count: number;
  filePath: string;
  newReceiver: string;
  sourceDescription: string;
  previousReceiver?: string;
}

interface HistoricalLogProvider {
  name: string;
  url: string;
  maxBlockRange: number;
}

interface JsonRpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionIndex: string;
  logIndex: string;
}

function getDeploymentPath(chainId: number): string {
  return path.join(CONTRACTS_ROOT, "deployments", `${chainId}-latest.json`);
}

function resolveExistingPath(filePath: string): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), filePath),
    path.resolve(PROJECT_ROOT, filePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveMigrationSourcePath(inputPath?: string): string | undefined {
  if (inputPath) {
    return resolveExistingPath(inputPath);
  }

  return DEFAULT_MIGRATION_INPUT_PATHS.find((candidate) => fs.existsSync(candidate));
}

function readEnsReceiverFromDeployment(chainId: number): string | undefined {
  const deploymentPath = getDeploymentPath(chainId);
  if (!fs.existsSync(deploymentPath)) {
    return undefined;
  }

  try {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as { ensReceiver?: unknown };
    return isAddress(deployment.ensReceiver) ? deployment.ensReceiver : undefined;
  } catch {
    return undefined;
  }
}

function readPreviousEnsReceiverFromDeployment(chainId: number): string | undefined {
  const deploymentPath = getDeploymentPath(chainId);
  if (!fs.existsSync(deploymentPath)) {
    return undefined;
  }

  try {
    const deployment = JSON.parse(
      fs.readFileSync(deploymentPath, "utf8"),
    ) as { previousEnsReceiver?: unknown };
    return isAddress(deployment.previousEnsReceiver) ? deployment.previousEnsReceiver : undefined;
  } catch {
    return undefined;
  }
}

function readJsonFile<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function getMainnetDeployBroadcastPath(command: Command): string {
  switch (command) {
    case "deploy-mainnet":
      return path.join(CONTRACTS_ROOT, "broadcast", "UpgradeENSReceiver.s.sol", "1", "deployMainnet-latest.json");
    case "deploy-sepolia":
      return path.join(CONTRACTS_ROOT, "broadcast", "UpgradeENSReceiver.s.sol", "11155111", "deploySepolia-latest.json");
    default:
      return path.join(CONTRACTS_ROOT, "broadcast", "UpgradeENSReceiver.s.sol", "1", "run-latest.json");
  }
}

function readCreatedContractFromBroadcastArtifact(
  filePath: string,
  contractName: string,
): { contractAddress?: string; blockNumber?: number } | undefined {
  const broadcast = readJsonFile<{
    transactions?: Array<{ contractName?: string; contractAddress?: string }>;
    receipts?: Array<{ blockNumber?: string }>;
  }>(filePath);

  if (!broadcast?.transactions?.length) {
    return undefined;
  }

  const txIndex = broadcast.transactions.findIndex(
    (tx) => tx.contractName === contractName && isAddress(tx.contractAddress),
  );
  if (txIndex === -1) {
    return undefined;
  }

  const tx = broadcast.transactions[txIndex];
  const receipt = broadcast.receipts?.[txIndex];
  return {
    contractAddress: tx.contractAddress,
    blockNumber: receipt?.blockNumber ? Number.parseInt(receipt.blockNumber, 16) : undefined,
  };
}

function resolveLegacyEnsReceiverAddress(): string | undefined {
  const previousReceiver = readPreviousEnsReceiverFromDeployment(1);
  if (previousReceiver) {
    return previousReceiver;
  }

  const initialDeploy = readCreatedContractFromBroadcastArtifact(
    path.join(CONTRACTS_ROOT, "broadcast", "Deploy.s.sol", "1", "run-latest.json"),
    "GreenGoodsENSReceiver",
  );

  return isAddress(initialDeploy?.contractAddress) ? initialDeploy.contractAddress : undefined;
}

async function jsonRpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}-${Date.now()}`,
      method,
      params,
    }),
  });

  const payload = (await response.json()) as { result?: T; error?: { code?: number; message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message || `RPC error ${payload.error.code ?? "unknown"}`);
  }

  return payload.result as T;
}

async function resolveHistoricalMainnetProvider(): Promise<HistoricalLogProvider> {
  for (const provider of HISTORICAL_MAINNET_LOG_PROVIDERS) {
    try {
      await jsonRpcRequest<string>(provider.url, "eth_blockNumber", []);
      return provider;
    } catch {
      continue;
    }
  }

  throw new Error(
    "Could not reach any historical mainnet log provider. Checked: " +
      HISTORICAL_MAINNET_LOG_PROVIDERS.map((provider) => provider.name).join(", "),
  );
}

async function findContractCreationBlock(
  provider: HistoricalLogProvider,
  contractAddress: string,
  upperBound?: number,
): Promise<number> {
  const latestBlockHex = await jsonRpcRequest<string>(provider.url, "eth_blockNumber", []);
  let low = 0;
  let high = upperBound ?? Number.parseInt(latestBlockHex, 16);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const code = await jsonRpcRequest<string>(provider.url, "eth_getCode", [contractAddress, `0x${mid.toString(16)}`]);
    if (code && code !== "0x") {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low;
}

async function fetchLogsInRange(
  provider: HistoricalLogProvider,
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<JsonRpcLog[]> {
  const allLogs: JsonRpcLog[] = [];

  for (let start = fromBlock; start <= toBlock; start += provider.maxBlockRange) {
    const end = Math.min(start + provider.maxBlockRange - 1, toBlock);
    const chunkLogs = await jsonRpcRequest<JsonRpcLog[]>(provider.url, "eth_getLogs", [
      {
        fromBlock: `0x${start.toString(16)}`,
        toBlock: `0x${end.toString(16)}`,
        address,
      },
    ]);
    allLogs.push(...chunkLogs);
  }

  return allLogs;
}

async function prepareMigrationInputFromHistory(options: Options): Promise<PreparedMigrationInput> {
  if (options.pureSimulation) {
    throw new Error(
      "migrate auto-discovery requires read-only RPC log access and cannot run with --pure-simulation. " +
        "Run without --pure-simulation or pass --registrations-file.",
    );
  }

  const previousReceiver = resolveLegacyEnsReceiverAddress();
  if (!isAddress(previousReceiver)) {
    throw new Error(
      "Could not resolve the previous ENS receiver. Add previousEnsReceiver to deployments/1-latest.json or pass --registrations-file.",
    );
  }

  const newReceiver = options.newReceiver ?? readEnsReceiverFromDeployment(1);
  if (!isAddress(newReceiver)) {
    throw new Error("migrate requires --new-receiver or a valid ensReceiver in deployments/1-latest.json");
  }

  const provider = await resolveHistoricalMainnetProvider();
  const initialDeployArtifact = readCreatedContractFromBroadcastArtifact(
    path.join(CONTRACTS_ROOT, "broadcast", "Deploy.s.sol", "1", "run-latest.json"),
    "GreenGoodsENSReceiver",
  );
  const oldReceiverDeployedAt =
    initialDeployArtifact?.contractAddress?.toLowerCase() === previousReceiver.toLowerCase()
      ? initialDeployArtifact.blockNumber
      : undefined;

  const currentDeployArtifact = readCreatedContractFromBroadcastArtifact(
    getMainnetDeployBroadcastPath("deploy-mainnet"),
    "GreenGoodsENSReceiver",
  );
  const newReceiverDeployedAt =
    currentDeployArtifact?.contractAddress?.toLowerCase() === newReceiver.toLowerCase()
      ? currentDeployArtifact.blockNumber
      : undefined;

  const fromBlock = oldReceiverDeployedAt ?? (await findContractCreationBlock(provider, previousReceiver, newReceiverDeployedAt));
  const latestBlockHex = await jsonRpcRequest<string>(provider.url, "eth_blockNumber", []);
  const latestBlock = Number.parseInt(latestBlockHex, 16);
  const toBlock = newReceiverDeployedAt ? Math.max(fromBlock, newReceiverDeployedAt - 1) : latestBlock;
  const logs = await fetchLogsInRange(provider, previousReceiver, fromBlock, toBlock);

  logs.sort(
    (left, right) =>
      Number.parseInt(left.blockNumber, 16) - Number.parseInt(right.blockNumber, 16) ||
      Number.parseInt(left.transactionIndex, 16) - Number.parseInt(right.transactionIndex, 16) ||
      Number.parseInt(left.logIndex, 16) - Number.parseInt(right.logIndex, 16),
  );

  const activeRegistrations = new Map<string, { owner: string; nameType: number }>();

  for (const log of logs) {
    const topic0 = log.topics[0]?.toLowerCase();
    if (topic0 === NAME_REGISTERED_TOPIC) {
      const [slug, owner, nameType] = ENS_RECEIVER_INTERFACE.decodeEventLog("NameRegistered", log.data, log.topics);
      activeRegistrations.set(String(slug), {
        owner: String(owner),
        nameType: Number(nameType),
      });
      continue;
    }

    if (topic0 === NAME_RELEASED_TOPIC) {
      const [slug] = ENS_RECEIVER_INTERFACE.decodeEventLog("NameReleased", log.data, log.topics);
      activeRegistrations.delete(String(slug));
    }
  }

  const slugs = [...activeRegistrations.keys()];
  const owners = slugs.map((slug) => activeRegistrations.get(slug)?.owner ?? "");
  const nameTypes = slugs.map((slug) => activeRegistrations.get(slug)?.nameType ?? 0);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gg-ens-migrate-"));
  const normalizedPath = path.join(tempDir, "registrations.json");
  fs.writeFileSync(normalizedPath, JSON.stringify({ slugs, owners, nameTypes }, null, 2) + "\n");

  return {
    count: slugs.length,
    filePath: normalizedPath,
    newReceiver,
    previousReceiver,
    sourceDescription:
      `auto-discovered from ${previousReceiver} via ${provider.name} ` +
      `(blocks ${fromBlock}-${toBlock}, ${logs.length} log(s))`,
  };
}

function showHelp(): void {
  console.log(`
ENS Receiver Migration Tool
============================

Redeploys GreenGoodsENSReceiver with NameWrapper support.

Commands:
  deploy-sepolia        Deploy new ENSReceiver on Sepolia (same-chain, unwrapped)
  deploy-mainnet        Deploy new ENSReceiver on Mainnet (cross-chain, NameWrapper)
  update-l1-receiver    Update l1Receiver on L2 GreenGoodsENS (run after mainnet deploy)
  migrate               Migrate registrations from old to new receiver

Options:
  --network <name>      Network (default: sepolia)
  --broadcast           Execute transactions (default: simulation only)
  --pure-simulation     Validate inputs and compile without RPC calls
  --new-receiver <addr> New receiver address (optional override for update-l1-receiver)
  --registrations-file  JSON file for migrate ({ slugs, owners, nameTypes } or registrations[])
                       Defaults to reports/ens-registrations.json when present
  --sender <addr>       Override tx sender address
  --help                Show this help

Examples:
  # Dry-run Sepolia migration
  bun script/upgrade-ens-receiver.ts deploy-sepolia --network sepolia

  # Execute Sepolia migration
  bun script/upgrade-ens-receiver.ts deploy-sepolia --network sepolia --broadcast

  # Deploy on mainnet
  bun script/upgrade-ens-receiver.ts deploy-mainnet --network mainnet --broadcast

  # Update Arbitrum l1Receiver after mainnet deploy
  bun script/upgrade-ens-receiver.ts update-l1-receiver --network arbitrum --broadcast

  # Override the receiver address explicitly if needed
  bun script/upgrade-ens-receiver.ts update-l1-receiver --network arbitrum \\
    --new-receiver 0x... --broadcast

  # Preflight mainnet deploy without RPC access
  bun script/upgrade-ens-receiver.ts deploy-mainnet --network mainnet --pure-simulation

  # Migrate registrations from the default file at reports/ens-registrations.json
  bun script/upgrade-ens-receiver.ts migrate --network mainnet --broadcast

  # Or provide a repo-root relative file explicitly
  bun script/upgrade-ens-receiver.ts migrate --network mainnet \\
    --registrations-file reports/registrations.json --broadcast
  `);
}

const COMMAND_SIGS: Record<Command, string> = {
  "deploy-sepolia": "deploySepolia()",
  "deploy-mainnet": "deployMainnet()",
  "update-l1-receiver": "updateL1Receiver(address)",
  migrate: "migrateRegistrationsFromFile(address,string)",
};

function parseOptions(args: string[]): Options {
  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const command = args[0] as Command;
  if (!COMMAND_SIGS[command]) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  let network = "sepolia";
  let broadcast = false;
  let pureSimulation = false;
  let newReceiver: string | undefined;
  let registrationsFile: string | undefined;
  let sender: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--network": {
        const value = args[++i];
        if (!value || value.startsWith("-")) throw new Error("--network requires a value");
        network = value;
        break;
      }
      case "--broadcast":
        broadcast = true;
        break;
      case "--pure-simulation":
        pureSimulation = true;
        break;
      case "--new-receiver": {
        const value = args[++i];
        if (!value || !value.startsWith("0x")) throw new Error("--new-receiver requires an address");
        newReceiver = value;
        break;
      }
      case "--registrations-file": {
        const value = args[++i];
        if (!value || value.startsWith("-")) throw new Error("--registrations-file requires a path");
        registrationsFile = value;
        break;
      }
      case "--sender": {
        const value = args[++i];
        if (!value || value.startsWith("-")) throw new Error("--sender requires an address");
        sender = value;
        break;
      }
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { command, network, broadcast, pureSimulation, newReceiver, registrationsFile, sender };
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isPublicNodeRpc(rpcUrl: string): boolean {
  try {
    const { hostname } = new URL(rpcUrl);
    const parts = hostname.toLowerCase().split(".");
    const domain = parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
    return domain === "publicnode.com";
  } catch {
    return false;
  }
}

function assertBroadcastSafeRpc(options: Options, rpcUrl: string): void {
  if (!options.broadcast) {
    return;
  }

  if (options.network === "mainnet" && isPublicNodeRpc(rpcUrl)) {
    throw new Error(
      "Mainnet broadcast via publicnode.com is blocked/unstable for Foundry storage reads. " +
        "Set ETHEREUM_RPC_URL to a dedicated provider or configure ALCHEMY_API_KEY/ALCHEMY_KEY/VITE_ALCHEMY_API_KEY.",
    );
  }
}

function normalizeNameType(value: number | string | undefined, index: number): 0 | 1 {
  if (value === 0 || value === "0") return 0;
  if (value === 1 || value === "1") return 1;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "gardener") return 0;
    if (normalized === "garden") return 1;
  }

  throw new Error(`Invalid nameType at index ${index}. Use 0|1 or gardener|garden.`);
}

async function prepareMigrationInput(options: Options): Promise<PreparedMigrationInput | null> {
  if (options.command !== "migrate") {
    return null;
  }

  const sourcePath = resolveMigrationSourcePath(options.registrationsFile);
  if (!sourcePath && options.registrationsFile) {
    throw new Error(`Migration file not found: ${options.registrationsFile}`);
  }
  if (!sourcePath) {
    return prepareMigrationInputFromHistory(options);
  }

  const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as MigrationFileInput;
  const slugs: string[] = [];
  const owners: string[] = [];
  const nameTypes: number[] = [];

  if (Array.isArray(parsed.registrations)) {
    parsed.registrations.forEach((registration, index) => {
      if (!registration.slug?.trim()) {
        throw new Error(`Missing slug at registrations[${index}]`);
      }
      if (!isAddress(registration.owner)) {
        throw new Error(`Invalid owner at registrations[${index}]`);
      }

      slugs.push(registration.slug.trim());
      owners.push(registration.owner);
      nameTypes.push(normalizeNameType(registration.nameType, index));
    });
  } else {
    if (!Array.isArray(parsed.slugs) || !Array.isArray(parsed.owners) || !Array.isArray(parsed.nameTypes)) {
      throw new Error("Migration file must contain either registrations[] or parallel slugs/owners/nameTypes arrays");
    }

    if (parsed.slugs.length !== parsed.owners.length || parsed.slugs.length !== parsed.nameTypes.length) {
      throw new Error("Migration file arrays must have the same length");
    }

    parsed.slugs.forEach((slug, index) => {
      if (!slug?.trim()) {
        throw new Error(`Missing slug at slugs[${index}]`);
      }
      if (!isAddress(parsed.owners?.[index])) {
        throw new Error(`Invalid owner at owners[${index}]`);
      }

      slugs.push(slug.trim());
      owners.push(parsed.owners[index] as string);
      nameTypes.push(normalizeNameType(parsed.nameTypes?.[index], index));
    });
  }

  const newReceiver = options.newReceiver ?? parsed.newReceiver ?? readEnsReceiverFromDeployment(1);
  if (!isAddress(newReceiver)) {
    throw new Error("migrate requires --new-receiver, newReceiver in the JSON file, or deployments/1-latest.json ensReceiver");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gg-ens-migrate-"));
  const normalizedPath = path.join(tempDir, "registrations.json");
  fs.writeFileSync(normalizedPath, JSON.stringify({ slugs, owners, nameTypes }, null, 2) + "\n");

  return {
    count: slugs.length,
    filePath: normalizedPath,
    newReceiver,
    sourceDescription: sourcePath,
  };
}

function validateInputs(
  options: Options,
  chainId: number,
  preparedMigration: PreparedMigrationInput | null,
): void {
  const deploymentPath = getDeploymentPath(chainId);
  const mainnetDeploymentPath = getDeploymentPath(1);
  const networksPath = path.join(CONTRACTS_ROOT, "deployments", "networks.json");

  switch (options.command) {
    case "deploy-sepolia":
      if (options.network !== "sepolia") {
        throw new Error("deploy-sepolia must be run with --network sepolia");
      }
      if (!fs.existsSync(deploymentPath)) throw new Error(`Deployment artifact not found: ${deploymentPath}`);
      if (!fs.existsSync(networksPath)) throw new Error(`Network config not found: ${networksPath}`);
      break;
    case "deploy-mainnet":
      if (options.network !== "mainnet") {
        throw new Error("deploy-mainnet must be run with --network mainnet");
      }
      if (!fs.existsSync(mainnetDeploymentPath)) throw new Error(`Deployment artifact not found: ${mainnetDeploymentPath}`);
      if (!fs.existsSync(networksPath)) throw new Error(`Network config not found: ${networksPath}`);
      break;
    case "update-l1-receiver":
      if (!fs.existsSync(deploymentPath)) throw new Error(`Deployment artifact not found: ${deploymentPath}`);
      if (!isAddress(options.newReceiver) && !readEnsReceiverFromDeployment(1)) {
        throw new Error(
          "update-l1-receiver requires --new-receiver or a valid ensReceiver in deployments/1-latest.json",
        );
      }
      break;
    case "migrate":
      if (!preparedMigration) throw new Error("Prepared migration input missing");
      if (!fs.existsSync(preparedMigration.filePath)) {
        throw new Error(`Prepared migration file not found: ${preparedMigration.filePath}`);
      }
      break;
  }
}

function runPureSimulation(
  options: Options,
  chainId: number,
  preparedMigration: PreparedMigrationInput | null,
): void {
  validateInputs(options, chainId, preparedMigration);

  console.log("🧪 Pure simulation mode enabled (no RPC calls, no transactions)\n");
  console.log(`Network: ${options.network} (chainId: ${chainId})`);
  console.log(`Command: ${options.command}`);

  if (options.command === "update-l1-receiver" && options.newReceiver) {
    console.log(`New receiver: ${options.newReceiver}`);
  } else if (options.command === "update-l1-receiver") {
    const deploymentReceiver = readEnsReceiverFromDeployment(1);
    if (deploymentReceiver) {
      console.log(`New receiver: ${deploymentReceiver} (from deployments/1-latest.json)`);
    }
  }

  if (options.command === "migrate" && preparedMigration) {
    console.log(`New receiver: ${preparedMigration.newReceiver}`);
    console.log(`Registrations: ${preparedMigration.count}`);
    console.log(`Prepared file: ${preparedMigration.filePath}`);
  }

  console.log("\n🔨 Running build preflight...");
  execFileSync("bun", ["run", "build"], {
    stdio: "inherit",
    cwd: CONTRACTS_ROOT,
    env: { ...process.env, FOUNDRY_PROFILE: "production" },
  });

  const commandArgs = buildForgeArgs(options, "<resolved at runtime>", chainId, preparedMigration);
  console.log("\nWould execute:");
  console.log(`forge ${commandArgs.join(" ")}`);
  console.log("\n✅ ENS receiver preflight completed successfully");
}

function buildForgeArgs(
  options: Options,
  rpcUrl: string,
  chainId: number,
  preparedMigration: PreparedMigrationInput | null,
): string[] {
  const sig = COMMAND_SIGS[options.command];
  const sigArgs: string[] = [];

  if (options.command === "update-l1-receiver") {
    const newReceiver = options.newReceiver ?? readEnsReceiverFromDeployment(1);
    if (!newReceiver) {
      throw new Error("update-l1-receiver requires --new-receiver or deployments/1-latest.json ensReceiver");
    }
    sigArgs.push(newReceiver);
  }

  if (options.command === "migrate") {
    if (!preparedMigration) {
      throw new Error("Prepared migration input is required for migrate");
    }
    sigArgs.push(preparedMigration.newReceiver, preparedMigration.filePath);
  }

  const forgeArgs = [
    "script",
    "script/UpgradeENSReceiver.s.sol:UpgradeENSReceiver",
    "--sig",
    sig,
    ...sigArgs,
    "--rpc-url",
    rpcUrl,
    "--chain-id",
    chainId.toString(),
  ];

  if (options.sender) {
    forgeArgs.push("--sender", options.sender);
  } else if (process.env.SENDER_ADDRESS) {
    forgeArgs.push("--sender", process.env.SENDER_ADDRESS);
  }

  if (options.broadcast) {
    forgeArgs.push("--broadcast");
    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    forgeArgs.push("--account", keystoreName);
    console.log(`Using Foundry keystore: ${keystoreName}`);
  } else {
    console.log("Simulation mode - no transactions will be broadcast\n");
  }

  return forgeArgs;
}

function updateDeploymentArtifact(chainId: number, newReceiverAddress: string): void {
  const deploymentPath = getDeploymentPath(chainId);
  if (!fs.existsSync(deploymentPath)) {
    console.log(`\nDeployment artifact not found at ${deploymentPath} — update manually`);
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const oldReceiver = deployment.ensReceiver;
  if (isAddress(oldReceiver) && oldReceiver.toLowerCase() !== newReceiverAddress.toLowerCase()) {
    deployment.previousEnsReceiver = oldReceiver;
  }
  deployment.ensReceiver = newReceiverAddress;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + "\n");

  console.log(`\nDeployment artifact updated:`);
  console.log(`  ${deploymentPath}`);
  console.log(`  ensReceiver: ${oldReceiver} -> ${newReceiverAddress}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseOptions(args);

  const networkManager = new NetworkManager();
  const chainId = networkManager.getChainId(options.network);
  const preparedMigration = await prepareMigrationInput(options);

  if (options.pureSimulation) {
    runPureSimulation(options, chainId, preparedMigration);
    return;
  }

  validateInputs(options, chainId, preparedMigration);

  let rpcUrl: string;
  try {
    rpcUrl = networkManager.getRpcUrl(options.network);
    assertBroadcastSafeRpc(options, rpcUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} Use --pure-simulation to validate without RPC access.`);
  }

  console.log(`Network: ${options.network} (chainId: ${chainId})`);
  console.log(`Command: ${options.command}\n`);

  if (preparedMigration) {
    console.log(`Prepared ${preparedMigration.count} ENS registration(s) from ${preparedMigration.sourceDescription}`);
    console.log(`Prepared file: ${preparedMigration.filePath}\n`);
  }

  if (options.command === "migrate" && preparedMigration && preparedMigration.count === 0) {
    console.log("No active ENS registrations were found on the previous receiver.");
    console.log("Migration is a no-op; nothing needs to be broadcast.");
    return;
  }

  const forgeArgs = buildForgeArgs(options, rpcUrl, chainId, preparedMigration);
  console.log(`Executing: forge ${forgeArgs.join(" ")}\n`);

  try {
    execFileSync("forge", forgeArgs, {
      stdio: "inherit",
      cwd: CONTRACTS_ROOT,
      env: { ...process.env, FOUNDRY_PROFILE: "production" },
    });

    console.log("\nMigration step completed successfully");

    // Auto-update deployment artifact after successful broadcast deploy
    if (options.broadcast && (options.command === "deploy-sepolia" || options.command === "deploy-mainnet")) {
      const candidatePaths = [
        getMainnetDeployBroadcastPath(options.command),
        path.join(CONTRACTS_ROOT, "broadcast", "UpgradeENSReceiver.s.sol", chainId.toString(), "run-latest.json"),
      ];

      let updated = false;
      for (const broadcastPath of candidatePaths) {
        const createTx = readCreatedContractFromBroadcastArtifact(broadcastPath, "GreenGoodsENSReceiver");
        if (createTx?.contractAddress) {
          updateDeploymentArtifact(chainId, createTx.contractAddress);
          updated = true;
          break;
        }
      }

      if (!updated) {
        console.log(`\nNOTE: Could not read GreenGoodsENSReceiver deployment output from broadcast artifacts`);
        console.log(`  Checked: ${candidatePaths.join(", ")}`);
        console.log(`  Update deployments/${chainId}-latest.json manually: ensReceiver → <NEW_ADDRESS>`);
      }
    }

    // Print next steps based on command
    if (options.command === "deploy-mainnet" && options.broadcast) {
      console.log("\nNEXT: Run update-l1-receiver on Arbitrum with the new receiver address");
    }
  } catch (error) {
    console.error("\nMigration step failed", error);
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  console.error("\nENS receiver command failed", error);
  process.exit(1);
}
