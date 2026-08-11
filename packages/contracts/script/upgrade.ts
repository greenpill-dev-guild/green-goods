#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { Interface, getAddress, keccak256, toUtf8Bytes, ZeroAddress } from "ethers";
import { NetworkManager } from "./utils/network";
import { CONTRACTS_ROOT, getFoundryBroadcastPath } from "./utils/paths";
import {
  POOLING_INTEGRATION_UPGRADE_KEYS,
  assertProxyOwnership,
  type ProxyOwnerObservation,
} from "./utils/pooling-release";
import { assertSepoliaGate } from "./utils/release-gate";
import { writeReleaseJsonAtomic } from "./utils/release-artifacts";
import { buildReleaseLock, loadReleaseManifest } from "./utils/release-manifest";

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

type ContractName =
  | "action-registry"
  | "garden-token"
  | "yield-resolver"
  | "gardens-module"
  | "signal-pool-yield-wiring"
  | "yield-gardens-wiring"
  | "octant-module"
  | "hats-module"
  | "karma-gap-module"
  | "work-resolver"
  | "work-approval-resolver"
  | "assessment-resolver"
  | "testimony-resolver"
  | "deployment-registry"
  | "greenwill"
  | "commitment-pooling"
  | "all";

const CONTRACT_FUNCTIONS: Record<ContractName, string> = {
  "action-registry": "upgradeActionRegistry()",
  "garden-token": "upgradeGardenToken()",
  "yield-resolver": "upgradeYieldResolver()",
  "gardens-module": "upgradeGardensModule()",
  "signal-pool-yield-wiring": "upgradeYieldGardensWiring()",
  "yield-gardens-wiring": "wireYieldResolverGardensModule()",
  "octant-module": "upgradeOctantModule()",
  "hats-module": "upgradeHatsModule()",
  "karma-gap-module": "upgradeKarmaGAPModule()",
  "work-resolver": "upgradeWorkResolver()",
  "work-approval-resolver": "upgradeWorkApprovalResolver()",
  "assessment-resolver": "upgradeAssessmentResolver()",
  "testimony-resolver": "upgradeTestimonyResolver()",
  "deployment-registry": "upgradeDeployment()",
  greenwill: "upgradeGreenWill()",
  "commitment-pooling": "upgradeCommitmentPoolingIntegrations()",
  all: "upgradeAll()",
};

const ALL_CONTRACTS_FOR_UPGRADE_ALL: readonly ContractName[] = [
  "action-registry",
  "garden-token",
  "work-resolver",
  "work-approval-resolver",
  "assessment-resolver",
  "deployment-registry",
  "yield-resolver",
  "gardens-module",
  "yield-gardens-wiring",
  "octant-module",
  "karma-gap-module",
  // Intentionally exclude HatsModule and GreenWill: both must be upgraded as explicit targets.
];

/**
 * Targets that resolve to more than one proxy. The two existing Commitment Pooling integrations
 * share the release cutover and owner preflight; the yield/gardens pair is grouped for the same
 * reason and additionally cross-wires afterwards.
 */
const GROUPED_DEPLOYMENT_KEYS: Partial<Record<ContractName, readonly string[]>> = {
  "signal-pool-yield-wiring": ["yieldSplitter", "gardensModule"],
  "yield-gardens-wiring": ["yieldSplitter", "gardensModule"],
  "commitment-pooling": POOLING_INTEGRATION_UPGRADE_KEYS,
};

const DEPLOYMENT_KEYS: Partial<Record<Exclude<ContractName, "all">, string>> = {
  "action-registry": "actionRegistry",
  "garden-token": "gardenToken",
  "yield-resolver": "yieldSplitter",
  "gardens-module": "gardensModule",
  "octant-module": "octantModule",
  "hats-module": "hatsModule",
  "karma-gap-module": "karmaGAPModule",
  "work-resolver": "workResolver",
  "work-approval-resolver": "workApprovalResolver",
  "assessment-resolver": "assessmentResolver",
  "testimony-resolver": "testimonyResolver",
  "deployment-registry": "deploymentRegistry",
  greenwill: "greenWill",
};

interface UpgradeOptions {
  contract: ContractName;
  network: string;
  broadcast: boolean;
  dryRun: boolean;
  pureSimulation: boolean;
  txPlan: boolean;
  overrideSepoliaGate: boolean;
  sender?: string;
  expectedNonce?: number;
  planPath?: string;
  releaseStep?: number;
  receiptHash?: string;
}

interface ForgeBroadcastTransaction {
  transactionType?: string;
  contractName?: string | null;
  contractAddress?: string | null;
  function?: string | null;
  transaction?: {
    from?: string;
    to?: string;
    gas?: string;
    value?: string;
    input?: string;
    nonce?: string;
    chainId?: string;
  };
}

interface ForgeBroadcastArtifact {
  transactions?: ForgeBroadcastTransaction[];
  libraries?: string[];
}

interface PersistedUpgradeTransaction {
  index: number;
  from: string | null;
  to: string | null;
  nonce: string | null;
  value: string | null;
  data: string | null;
  contractAddress: string | null;
  function: string | null;
}

interface PersistedUpgradePlan {
  network: string;
  chainId: number;
  contract: ContractName;
  sender: string;
  expectedNonce: number;
  releaseManifestHash?: string;
  transactions: PersistedUpgradeTransaction[];
  upgrades: Array<{
    deploymentKey: string;
    proxy: string;
    ownerAtPlan: string;
    previousImplementation: string;
    newImplementation: string;
    upgradeTransactionIndex: number;
  }>;
  wiring: Array<{
    proxy: string;
    function: string;
    module: string;
    transactionIndex: number;
  }>;
  assessmentSchemaPin?: {
    proxy: string;
    expectedSchemaUID: string;
    transactionIndex: number;
    resumableState: string;
  };
}

interface UpgradeCheckpoint {
  schemaVersion: 1;
  planHash: string;
  completed: Array<{
    step: number;
    transactionHash: string;
    blockNumber: string;
    verifiedAt: string;
  }>;
}

export interface UpgradePreState {
  contractName: ContractName;
  deploymentKey: string;
  proxy: string;
  owner: string;
  implementation: string;
  implementationCodeHash: string;
}

const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const upgradeInterface = new Interface(["function upgradeTo(address)"]);
const assessmentSchemaInterface = new Interface([
  "function schemaUID() view returns (bytes32)",
  "function setSchemaUID(bytes32 uid)",
]);
const poolingIntegrationInterface = new Interface([
  "function setCommitmentPoolingModule(address)",
  "function setCommitmentModule(address)",
]);

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0+$/i.test(value);
}

function resolveDeploymentOutputDir(): string {
  const configured = process.env.DEPLOYMENT_OUTPUT_DIR?.trim();
  const outputDir = configured && configured.length > 0 ? configured : "deployments";
  return path.isAbsolute(outputDir) ? outputDir : path.join(CONTRACTS_ROOT, outputDir);
}

function resolveDeploymentArtifactPath(fileName: string): string {
  return path.join(resolveDeploymentOutputDir(), fileName);
}

function resolveUpgradePlanOutputDir(): string {
  const configured = process.env.UPGRADE_PLAN_OUTPUT_DIR?.trim();
  if (!configured) return path.join(resolveDeploymentOutputDir(), "tx-plans");
  return path.isAbsolute(configured) ? configured : path.join(CONTRACTS_ROOT, configured);
}

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function resolveUpgradeTargets(contract: ContractName, deployment: Record<string, unknown>) {
  const contractsToResolve = contract === "all" ? ALL_CONTRACTS_FOR_UPGRADE_ALL : [contract];
  const resolved: Array<{ contractName: ContractName; deploymentKey: string; address: string }> = [];
  const missing: Array<{ contractName: ContractName; deploymentKey: string }> = [];

  contractsToResolve.forEach((contractName) => {
    // Grouped targets resolve several proxies at once; every half must be present, because a
    // partial upgrade of a pair that shares an invariant is worse than no upgrade.
    const groupedKeys = GROUPED_DEPLOYMENT_KEYS[contractName as keyof typeof GROUPED_DEPLOYMENT_KEYS];
    if (groupedKeys) {
      groupedKeys.forEach((deploymentKey) => {
        const address = deployment[deploymentKey];
        if (!isAddress(address)) {
          missing.push({ contractName, deploymentKey });
          return;
        }
        resolved.push({ contractName, deploymentKey, address });
      });
      return;
    }

    const deploymentKey = DEPLOYMENT_KEYS[contractName as Exclude<ContractName, "all">];
    if (!deploymentKey) {
      missing.push({ contractName, deploymentKey: "<unknown>" });
      return;
    }
    const address = deployment[deploymentKey];
    if (!isAddress(address)) {
      missing.push({ contractName, deploymentKey });
      return;
    }

    resolved.push({ contractName, deploymentKey, address });
  });

  if (contract !== "all" && missing.length > 0) {
    throw new Error(`Missing or invalid ${missing[0].deploymentKey} in deployment artifact`);
  }

  if (resolved.length === 0) {
    throw new Error("No upgrade targets resolved from deployment artifact");
  }

  return { resolved, missing };
}

function runPureSimulation(contract: ContractName, network: string, networkManager: NetworkManager): void {
  const chainId = networkManager.getChainIdString(network);
  const deploymentPath = resolveDeploymentArtifactPath(`${chainId}-latest.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Record<string, unknown>;
  const { resolved: targets, missing } = resolveUpgradeTargets(contract, deployment);

  console.log("🧪 Pure simulation mode enabled (no RPC calls, no upgrade transactions)\n");
  console.log(`Network: ${network} (chainId: ${chainId})`);
  console.log(`Deployment artifact: ${deploymentPath}\n`);

  targets.forEach((target) => {
    console.log(`  - ${target.contractName}: ${target.address}`);
  });

  if (missing.length > 0) {
    console.log("\n⚠️  Skipping targets missing in deployment artifact:");
    missing.forEach((target) => {
      console.log(`  - ${target.contractName} (${target.deploymentKey})`);
    });
  }

  console.log("\n🔨 Running the Bun-wrapped production build preflight...");
  execFileSync("forge", ["build", "--skip", "test"], {
    stdio: "inherit",
    cwd: CONTRACTS_ROOT,
    env: {
      ...process.env,
      FOUNDRY_PROFILE: "production",
    },
  });

  console.log(`\nReviewed target function: ${CONTRACT_FUNCTIONS[contract]}`);
  console.log("Transaction planning requires the matching package --tx-plan target and an explicit sender.");
  console.log("\n✅ Pure simulation preflight completed successfully");
}

/**
 * Read the live `owner()` of every proxy this run would upgrade and prove the declared sender
 * owns all of them, before a single transaction is built. Uses `cast call` so it needs nothing
 * beyond the RPC the run already resolved.
 */
function readStorageAddress(proxy: string, rpcUrl: string): string {
  const raw = execFileSync("cast", ["storage", proxy, EIP1967_IMPLEMENTATION_SLOT, "--rpc-url", rpcUrl], {
    cwd: CONTRACTS_ROOT,
    env: process.env,
    encoding: "utf8",
  }).trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`Unreadable ERC-1967 implementation slot for ${proxy}`);
  return getAddress(`0x${raw.slice(-40)}`);
}

function readCodeHash(address: string, rpcUrl: string): string {
  const code = execFileSync("cast", ["code", address, "--rpc-url", rpcUrl], {
    cwd: CONTRACTS_ROOT,
    env: process.env,
    encoding: "utf8",
  }).trim();
  if (!/^0x[0-9a-fA-F]+$/.test(code) || code === "0x") throw new Error(`No code at ${address}`);
  return keccak256(code as `0x${string}`);
}

function readUpgradePreState(
  options: UpgradeOptions,
  rpcUrl: string,
  networkManager: NetworkManager,
): UpgradePreState[] {
  const chainId = networkManager.getChainIdString(options.network);
  const deploymentPath = resolveDeploymentArtifactPath(`${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Record<string, unknown>;
  const { resolved } = resolveUpgradeTargets(options.contract, deployment);

  const snapshots = resolved.map((target) => {
    const owner = execFileSync("cast", ["call", target.address, "owner()(address)", "--rpc-url", rpcUrl], {
      cwd: CONTRACTS_ROOT,
      env: process.env,
      encoding: "utf8",
    }).trim();
    if (!isAddress(owner)) throw new Error(`Unreadable live owner for ${target.deploymentKey} (${target.address})`);
    const implementation = readStorageAddress(target.address, rpcUrl);
    return {
      contractName: target.contractName,
      deploymentKey: target.deploymentKey,
      proxy: getAddress(target.address),
      owner: getAddress(owner),
      implementation,
      implementationCodeHash: readCodeHash(implementation, rpcUrl),
    };
  });
  const observations: ProxyOwnerObservation[] = snapshots.map((snapshot) => ({
    label: snapshot.deploymentKey,
    address: snapshot.proxy,
    owner: snapshot.owner,
  }));

  console.log("🔑 Live owner preflight:");
  observations.forEach((observation) => {
    console.log(`  - ${observation.label} (${observation.address}) owner: ${observation.owner ?? "unreadable"}`);
  });

  assertProxyOwnership(observations, options.sender ?? process.env.SENDER_ADDRESS);
  console.log("✅ Every proxy owner matches the declared sender");
  snapshots.forEach((snapshot) => {
    console.log(
      `  - ${snapshot.deploymentKey} implementation: ${snapshot.implementation} (${snapshot.implementationCodeHash})`,
    );
  });
  console.log("");
  return snapshots;
}

function showHelp(): void {
  const networkManager = new NetworkManager();
  console.log(`
Green Goods Contract Upgrade Tool

Usage: bun script/upgrade.ts <contract> [options]

Contracts:
  action-registry          Upgrade ActionRegistry
  garden-token            Upgrade GardenToken
  yield-resolver          Upgrade YieldResolver
  gardens-module          Upgrade GardensModule (community + signal pool module)
  signal-pool-yield-wiring  Upgrade YieldResolver, GardensModule, then cross-wire them
  yield-gardens-wiring    Cross-wire YieldResolver ↔ GardensModule after upgrades
  octant-module           Upgrade OctantModule (vault treasury module)
  hats-module             Upgrade HatsModule (explicit target; excluded from all)
  karma-gap-module        Upgrade KarmaGAPModule (Karma GAP integration)
  work-resolver           Upgrade WorkResolver
  work-approval-resolver  Upgrade WorkApprovalResolver
  assessment-resolver     Upgrade AssessmentResolver
  testimony-resolver      Upgrade TestimonyResolver (explicit target; excluded from all)
  deployment-registry     Upgrade Deployment
  greenwill               Upgrade GreenWill (funds-adjacent; explicit target only)
  commitment-pooling      Plan GardenToken and WorkApprovalResolver as one owner-bound group
  all                     Upgrade standard contracts (excludes HatsModule, TestimonyResolver,
                          GreenWill, and commitment-pooling)

Options:
  --network <name>        Network to upgrade on (default: localhost)
  --sender <address>      Override tx sender address for simulation/broadcast
  --dry-run               Run preflight checks without RPC calls
  --pure-simulation       Run compile + deployment preflight only (no RPC calls)
  --tx-plan               Simulate upgrade and persist a transaction plan artifact
  --expected-nonce <n>    Pin and verify the sender nonce for a release-owned upgrade plan
  --plan <path>           Exact reviewed transaction plan required for release-owned broadcast
  --step <index>          Execute exactly one plan transaction boundary
  --receipt <tx-hash>     Recover a mined boundary after local checkpoint persistence failed
  --broadcast             Execute upgrade
  --override-sepolia-gate  Bypass Sepolia gate for Arbitrum/Celo broadcast
  --help                  Show this help

Available networks: ${networkManager.getAvailableNetworks().join(", ")}

Rollback:
  A --tx-plan records every live implementation and code hash plus exact rollback calldata.
  Rollback still requires separate authorization and a fresh live-owner check.

Examples:
  # Phase A plans
  bun run assessment:upgrade:dry:arbitrum
  bun run assessment:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>
  bun run pooling:upgrade:dry:arbitrum
  bun run pooling:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>

  # Phase B form only; each invocation executes and verifies one reviewed boundary
  bun run assessment:upgrade:arbitrum --plan <reviewed-plan.json> --step <index> \
    --expected-nonce <boundary-nonce> --override-sepolia-gate
  `);
}

function parseOptions(args: string[]): UpgradeOptions {
  const contract = args[0] as ContractName;
  let network = "localhost";
  let sender: string | undefined;
  let broadcast = false;
  let dryRun = false;
  let pureSimulation = false;
  let txPlan = false;
  let overrideSepoliaGate = false;
  let expectedNonce: number | undefined;
  let planPath: string | undefined;
  let releaseStep: number | undefined;
  let receiptHash: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--network": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) {
          throw new Error("--network requires a value");
        }
        network = value;
        i++;
        break;
      }
      case "--sender": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) {
          throw new Error("--sender requires an address value");
        }
        sender = value;
        i++;
        break;
      }
      case "--broadcast":
        broadcast = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--pure-simulation":
        pureSimulation = true;
        break;
      case "--tx-plan":
        txPlan = true;
        break;
      case "--expected-nonce": {
        const value = args[i + 1];
        if (!value || !/^\d+$/.test(value)) throw new Error("--expected-nonce requires a non-negative integer");
        expectedNonce = Number(value);
        if (!Number.isSafeInteger(expectedNonce))
          throw new Error("--expected-nonce exceeds JavaScript safe integer range");
        i++;
        break;
      }
      case "--plan": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--plan requires a file path");
        planPath = value;
        i++;
        break;
      }
      case "--step": {
        const value = args[i + 1];
        if (!value || !/^[1-9]\d*$/.test(value)) throw new Error("--step requires a positive integer");
        releaseStep = Number(value);
        i++;
        break;
      }
      case "--receipt": {
        const value = args[i + 1];
        if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("--receipt requires a tx hash");
        receiptHash = value;
        i++;
        break;
      }
      case "--override-sepolia-gate":
        overrideSepoliaGate = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  return {
    contract,
    network,
    broadcast,
    dryRun,
    pureSimulation: pureSimulation || dryRun,
    txPlan,
    overrideSepoliaGate,
    sender,
    expectedNonce,
    planPath,
    releaseStep,
    receiptHash,
  };
}

export function findLatestUpgradeArtifactIn(baseDir: string, functionSignature: string): string {
  const functionName = functionSignature.match(/^([A-Za-z_][A-Za-z0-9_]*)\(/)?.[1];
  if (!functionName) {
    throw new Error(`Invalid upgrade function signature: ${functionSignature}`);
  }
  const candidates = [
    path.join(baseDir, "dry-run", `${functionName}-latest.json`),
    path.join(baseDir, `${functionName}-latest.json`),
    path.join(baseDir, "dry-run", "run-latest.json"),
    path.join(baseDir, "run-latest.json"),
  ];

  const existingCandidates = candidates
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate, priority) => ({
      candidate,
      modifiedAt: fs.statSync(candidate).mtimeMs,
      priority,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt || left.priority - right.priority);

  if (existingCandidates.length > 0) {
    return existingCandidates[0].candidate;
  }

  throw new Error(`Upgrade artifact not found under ${baseDir}`);
}

function findLatestUpgradeArtifact(chainId: number, functionSignature: string): string {
  const baseDir = getFoundryBroadcastPath("Upgrade.s.sol", chainId.toString());
  return findLatestUpgradeArtifactIn(baseDir, functionSignature);
}

function persistTxPlan(options: UpgradeOptions, chainId: number, preState: UpgradePreState[]): string {
  const artifactPath = findLatestUpgradeArtifact(chainId, CONTRACT_FUNCTIONS[options.contract]);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ForgeBroadcastArtifact;
  const transactions = (artifact.transactions ?? []).map((entry, index) => ({
    index,
    transactionType: entry.transactionType ?? null,
    contractName: entry.contractName ?? null,
    contractAddress: entry.contractAddress ?? null,
    function: entry.function ?? null,
    from: entry.transaction?.from ?? null,
    to: entry.transaction?.to ?? null,
    value: entry.transaction?.value ?? "0x0",
    gas: entry.transaction?.gas ?? null,
    nonce: entry.transaction?.nonce ?? null,
    data: entry.transaction?.input ?? null,
  }));
  if (options.expectedNonce !== undefined) {
    const firstNonce = transactions[0]?.nonce;
    const parsedNonce =
      typeof firstNonce === "string" && /^0x[0-9a-f]+$/iu.test(firstNonce)
        ? Number(BigInt(firstNonce))
        : Number(firstNonce);
    if (parsedNonce !== options.expectedNonce) {
      throw new Error(
        `Simulation nonce drift: expected ${options.expectedNonce}, first planned transaction is ${String(firstNonce)}`,
      );
    }
  }
  const upgrades = preState.map((snapshot) => {
    const upgradeTransaction = transactions.find(
      (transaction) =>
        isAddress(transaction.to) &&
        getAddress(transaction.to) === snapshot.proxy &&
        typeof transaction.data === "string" &&
        transaction.data.startsWith(upgradeInterface.getFunction("upgradeTo")!.selector),
    );
    if (!upgradeTransaction || typeof upgradeTransaction.data !== "string") {
      throw new Error(`Upgrade simulation did not contain upgradeTo(address) for ${snapshot.deploymentKey}`);
    }
    const decoded = upgradeInterface.decodeFunctionData("upgradeTo", upgradeTransaction.data);
    const newImplementation = getAddress(decoded[0] as string);
    const createTransaction = transactions.find(
      (transaction) =>
        isAddress(transaction.contractAddress) && getAddress(transaction.contractAddress) === newImplementation,
    );
    if (!createTransaction || typeof createTransaction.data !== "string") {
      throw new Error(`Upgrade simulation did not contain the implementation deployment for ${snapshot.deploymentKey}`);
    }
    return {
      deploymentKey: snapshot.deploymentKey,
      proxy: snapshot.proxy,
      ownerAtPlan: snapshot.owner,
      previousImplementation: snapshot.implementation,
      previousImplementationCodeHash: snapshot.implementationCodeHash,
      newImplementation,
      newImplementationCreationCodeHash: keccak256(createTransaction.data as `0x${string}`),
      deployTransactionIndex: createTransaction.index,
      upgradeTransactionIndex: upgradeTransaction.index,
      rollback: {
        requiredLiveOwner: snapshot.owner,
        to: snapshot.proxy,
        function: "upgradeTo(address)",
        calldata: upgradeInterface.encodeFunctionData("upgradeTo", [snapshot.implementation]),
        preconditions: [
          `code hash at ${snapshot.implementation} equals ${snapshot.implementationCodeHash}`,
          "live proxy owner still equals requiredLiveOwner",
          "current implementation equals newImplementation",
        ],
      },
    };
  });
  const wiring =
    options.contract === "commitment-pooling"
      ? [
          { deploymentKey: "gardenToken", function: "setCommitmentPoolingModule" },
          { deploymentKey: "workApprovalResolver", function: "setCommitmentModule" },
        ].map((expected) => {
          const snapshot = preState.find((candidate) => candidate.deploymentKey === expected.deploymentKey);
          if (!snapshot) throw new Error(`Missing pre-state for ${expected.deploymentKey}`);
          const selector = poolingIntegrationInterface.getFunction(expected.function)!.selector;
          const transaction = transactions.find(
            (candidate) =>
              isAddress(candidate.to) &&
              getAddress(candidate.to) === snapshot.proxy &&
              typeof candidate.data === "string" &&
              candidate.data.startsWith(selector),
          );
          if (!transaction || typeof transaction.data !== "string") {
            throw new Error(`Upgrade simulation did not contain ${expected.function} for ${expected.deploymentKey}`);
          }
          const decoded = poolingIntegrationInterface.decodeFunctionData(expected.function, transaction.data);
          const module = getAddress(decoded[0] as string);
          const frozenModule = buildReleaseLock(loadReleaseManifest()).identities.find(
            (identity) => identity.kind === "proxy" && identity.name === "CommitmentPoolingModule",
          )?.address;
          if (!frozenModule || module !== getAddress(frozenModule)) {
            throw new Error(`${expected.function} does not target the frozen CommitmentPoolingModule proxy`);
          }
          return {
            deploymentKey: expected.deploymentKey,
            proxy: snapshot.proxy,
            function: `${expected.function}(address)`,
            module,
            transactionIndex: transaction.index,
            resumableState: "An exact existing module link is satisfied; any different non-zero link is a conflict.",
          };
        })
      : [];
  let assessmentSchemaPin: PersistedUpgradePlan["assessmentSchemaPin"];
  if (options.contract === "assessment-resolver") {
    const snapshot = preState.find((candidate) => candidate.deploymentKey === "assessmentResolver");
    if (!snapshot) throw new Error("Missing AssessmentResolver pre-state for the v2 schema pin");
    const deployment = JSON.parse(
      fs.readFileSync(resolveDeploymentArtifactPath(`${chainId}-latest.json`), "utf8"),
    ) as Record<string, unknown>;
    const schemas = deployment.schemas as Record<string, unknown> | undefined;
    const expectedSchemaUID = schemas?.assessmentSchemaUID;
    if (typeof expectedSchemaUID !== "string" || !/^0x[0-9a-f]{64}$/iu.test(expectedSchemaUID)) {
      throw new Error("Canonical deployment artifact has no exact Assessment v2 schema UID");
    }
    const selector = assessmentSchemaInterface.getFunction("setSchemaUID")!.selector;
    const transaction = transactions.find(
      (candidate) =>
        isAddress(candidate.to) &&
        getAddress(candidate.to) === snapshot.proxy &&
        typeof candidate.data === "string" &&
        candidate.data.startsWith(selector),
    );
    if (transaction && typeof transaction.data === "string") {
      const decoded = assessmentSchemaInterface.decodeFunctionData("setSchemaUID", transaction.data);
      if (String(decoded[0]).toLowerCase() !== expectedSchemaUID.toLowerCase()) {
        throw new Error("AssessmentResolver schema-pin transaction differs from the canonical v2 UID");
      }
      assessmentSchemaPin = {
        proxy: snapshot.proxy,
        expectedSchemaUID,
        transactionIndex: transaction.index,
        resumableState:
          "The upgraded proxy has the exact v2 UID. Zero requires this pin; the exact UID is satisfied; any other non-zero UID is a conflict.",
      };
    }
  }

  const plansDir = resolveUpgradePlanOutputDir();
  fs.mkdirSync(plansDir, { recursive: true });
  const releaseOwned = ["assessment-resolver", "garden-token", "work-approval-resolver", "commitment-pooling"].includes(
    options.contract,
  );
  const releaseLock = releaseOwned ? buildReleaseLock(loadReleaseManifest()) : undefined;

  const plan = {
    generatedAt: new Date().toISOString(),
    network: options.network,
    chainId,
    contract: options.contract,
    functionSignature: CONTRACT_FUNCTIONS[options.contract],
    sender: options.sender ?? process.env.SENDER_ADDRESS ?? null,
    expectedNonce: options.expectedNonce ?? null,
    releaseManifestHash: releaseLock?.manifestHash ?? null,
    releaseSourceCommit: releaseLock?.sourceCommit ?? null,
    sourceArtifact: path.relative(CONTRACTS_ROOT, artifactPath),
    transactionCount: transactions.length,
    transactions,
    libraries: artifact.libraries ?? [],
    upgrades,
    wiring,
    assessmentSchemaPin,
    transactionBoundaryRule: "Verify the receipt and post-state for one transaction before authorizing the next.",
  };

  const runDate = new Date().toISOString().slice(0, 10);
  let fileName: string;

  if (options.contract === "greenwill") {
    const greenWillImplementation = (artifact.transactions ?? []).find(
      (entry) => entry.transactionType === "CREATE" && entry.contractName === "GreenWill",
    )?.contractAddress;

    if (!isAddress(greenWillImplementation)) {
      throw new Error("GreenWill implementation address was not found in the upgrade simulation artifact");
    }

    fileName = `${chainId}-greenwill-${greenWillImplementation.toLowerCase()}-${runDate}-plan.json`;
  } else {
    fileName = `${chainId}-${options.contract}-${Date.now()}-plan.json`;
  }
  const planPath = path.join(plansDir, fileName);
  writeReleaseJsonAtomic(planPath, plan);

  return planPath;
}

function parsePlannedNonce(value: string | null): number {
  if (typeof value !== "string") throw new Error("Planned transaction is missing its nonce");
  const parsed = /^0x[0-9a-f]+$/iu.test(value) ? Number(BigInt(value)) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid planned nonce: ${value}`);
  return parsed;
}

function parsePlannedValue(value: string | null): bigint {
  if (typeof value !== "string" || !/^(?:0x[0-9a-f]+|[0-9]+)$/iu.test(value)) {
    throw new Error(`Invalid planned transaction value: ${String(value)}`);
  }
  return BigInt(value);
}

function runCastJson(args: string[], rpcUrl: string): Record<string, unknown> {
  const raw = execFileSync("cast", [...args, "--rpc-url", rpcUrl, "--json"], {
    cwd: CONTRACTS_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }).trim();
  return JSON.parse(raw) as Record<string, unknown>;
}

function assertReceiptAndTransaction(
  plan: PersistedUpgradePlan,
  transaction: PersistedUpgradeTransaction,
  transactionHash: string,
  rpcUrl: string,
): { transactionHash: string; blockNumber: string } {
  const receipt = runCastJson(["receipt", transactionHash], rpcUrl);
  const liveTransaction = runCastJson(["tx", transactionHash], rpcUrl);
  const status = String(receipt.status ?? "").toLowerCase();
  if (status !== "0x1" && status !== "1") throw new Error(`Transaction ${transactionHash} did not succeed`);
  if (!isAddress(liveTransaction.from) || getAddress(liveTransaction.from) !== getAddress(plan.sender)) {
    throw new Error(`Receipt sender mismatch for ${transactionHash}`);
  }
  const liveNonce = Number(liveTransaction.nonce);
  if (liveNonce !== parsePlannedNonce(transaction.nonce))
    throw new Error(`Receipt nonce mismatch for ${transactionHash}`);
  const liveInput = String(liveTransaction.input ?? liveTransaction.data ?? "").toLowerCase();
  if (liveInput !== String(transaction.data).toLowerCase())
    throw new Error(`Receipt calldata mismatch for ${transactionHash}`);
  const plannedValue = parsePlannedValue(transaction.value);
  if (plannedValue !== 0n)
    throw new Error(`Release-owned upgrade boundary ${transaction.index + 1} has non-zero value`);
  if (BigInt(String(liveTransaction.value ?? "0x0")) !== plannedValue) {
    throw new Error(`Receipt value mismatch for ${transactionHash}`);
  }
  if (transaction.to) {
    if (!isAddress(liveTransaction.to) || getAddress(liveTransaction.to) !== getAddress(transaction.to)) {
      throw new Error(`Receipt target mismatch for ${transactionHash}`);
    }
  } else if (
    !isAddress(receipt.contractAddress) ||
    !transaction.contractAddress ||
    getAddress(receipt.contractAddress) !== getAddress(transaction.contractAddress)
  ) {
    throw new Error(`Receipt CREATE address mismatch for ${transactionHash}`);
  }
  const blockNumber = String(receipt.blockNumber ?? "");
  if (!blockNumber) throw new Error(`Receipt ${transactionHash} has no block number`);
  return { transactionHash, blockNumber };
}

function verifyUpgradeBoundary(
  plan: PersistedUpgradePlan,
  transaction: PersistedUpgradeTransaction,
  rpcUrl: string,
): void {
  if (!transaction.to) {
    if (!transaction.contractAddress) throw new Error("CREATE boundary has no predicted contract address");
    readCodeHash(transaction.contractAddress, rpcUrl);
    return;
  }
  const upgrade = plan.upgrades.find((candidate) => candidate.upgradeTransactionIndex === transaction.index);
  if (upgrade) {
    const implementation = readStorageAddress(upgrade.proxy, rpcUrl);
    if (implementation !== getAddress(upgrade.newImplementation)) {
      throw new Error(`Post-upgrade implementation mismatch for ${upgrade.deploymentKey}`);
    }
    return;
  }
  const wiring = plan.wiring.find((candidate) => candidate.transactionIndex === transaction.index);
  if (wiring) {
    const getter = wiring.function.startsWith("setCommitmentPoolingModule")
      ? "commitmentPoolingModule()(address)"
      : "commitmentModule()(address)";
    const value = execFileSync("cast", ["call", wiring.proxy, getter, "--rpc-url", rpcUrl], {
      cwd: CONTRACTS_ROOT,
      env: process.env,
      encoding: "utf8",
    }).trim();
    if (!isAddress(value) || getAddress(value) !== getAddress(wiring.module)) {
      throw new Error(`Post-wiring mismatch for ${wiring.function}`);
    }
    return;
  }
  const assessmentSchemaPin =
    plan.assessmentSchemaPin?.transactionIndex === transaction.index ? plan.assessmentSchemaPin : undefined;
  if (assessmentSchemaPin) {
    const value = execFileSync(
      "cast",
      ["call", assessmentSchemaPin.proxy, "schemaUID()(bytes32)", "--rpc-url", rpcUrl],
      { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8" },
    ).trim();
    if (value.toLowerCase() !== assessmentSchemaPin.expectedSchemaUID.toLowerCase()) {
      throw new Error("AssessmentResolver v2 schema UID does not match the reviewed post-upgrade pin");
    }
    return;
  }
  throw new Error(`No post-action verifier is defined for transaction boundary ${transaction.index + 1}`);
}

function assertUpgradeBoundaryPreconditions(
  plan: PersistedUpgradePlan,
  transaction: PersistedUpgradeTransaction,
  rpcUrl: string,
): void {
  if (parsePlannedValue(transaction.value) !== 0n) {
    throw new Error(`Release-owned upgrade boundary ${transaction.index + 1} may not move value`);
  }
  if (typeof transaction.data !== "string" || !/^0x[0-9a-f]*$/iu.test(transaction.data)) {
    throw new Error(`Release-owned upgrade boundary ${transaction.index + 1} has invalid calldata`);
  }
  if (!transaction.to) {
    if (!transaction.contractAddress) throw new Error("CREATE boundary has no predicted contract address");
    try {
      readCodeHash(transaction.contractAddress, rpcUrl);
      throw new Error(
        `Predicted implementation ${transaction.contractAddress} already has code; recover with the exact mined receipt instead of redeploying`,
      );
    } catch (error) {
      if (error instanceof Error && !error.message.startsWith("No code at ")) throw error;
    }
    return;
  }
  const upgrade = plan.upgrades.find((candidate) => candidate.upgradeTransactionIndex === transaction.index);
  const wiring = plan.wiring.find((candidate) => candidate.transactionIndex === transaction.index);
  const assessmentSchemaPin =
    plan.assessmentSchemaPin?.transactionIndex === transaction.index ? plan.assessmentSchemaPin : undefined;
  if (!upgrade && !wiring && !assessmentSchemaPin) {
    throw new Error(`No reviewed release action owns transaction boundary ${transaction.index + 1}`);
  }
  const owner = execFileSync("cast", ["call", transaction.to, "owner()(address)", "--rpc-url", rpcUrl], {
    cwd: CONTRACTS_ROOT,
    env: process.env,
    encoding: "utf8",
  }).trim();
  if (!isAddress(owner) || getAddress(owner) !== getAddress(plan.sender)) {
    throw new Error(`Live owner changed before boundary ${transaction.index + 1}`);
  }
  if (upgrade) {
    const implementation = readStorageAddress(upgrade.proxy, rpcUrl);
    if (implementation !== getAddress(upgrade.previousImplementation)) {
      throw new Error(
        implementation === getAddress(upgrade.newImplementation)
          ? `Upgrade boundary ${transaction.index + 1} already changed state; recover with its exact receipt`
          : `Upgrade boundary ${transaction.index + 1} has unexpected live implementation ${implementation}`,
      );
    }
  }
  if (wiring) {
    const getter = wiring.function.startsWith("setCommitmentPoolingModule")
      ? "commitmentPoolingModule()(address)"
      : "commitmentModule()(address)";
    const current = execFileSync("cast", ["call", wiring.proxy, getter, "--rpc-url", rpcUrl], {
      cwd: CONTRACTS_ROOT,
      env: process.env,
      encoding: "utf8",
    }).trim();
    if (!isAddress(current)) throw new Error(`Unreadable live wiring before boundary ${transaction.index + 1}`);
    if (getAddress(current) !== ZeroAddress) {
      throw new Error(
        getAddress(current) === getAddress(wiring.module)
          ? `Wiring boundary ${transaction.index + 1} already changed state; recover with its exact receipt`
          : `Wiring boundary ${transaction.index + 1} has conflicting live module ${current}`,
      );
    }
  }
  if (assessmentSchemaPin) {
    const liveImplementation = readStorageAddress(assessmentSchemaPin.proxy, rpcUrl);
    const upgradePlan = plan.upgrades.find((candidate) => candidate.proxy === assessmentSchemaPin.proxy);
    if (!upgradePlan || liveImplementation !== getAddress(upgradePlan.newImplementation)) {
      throw new Error("AssessmentResolver schema pin requires the reviewed target implementation to be live first");
    }
    const current = execFileSync(
      "cast",
      ["call", assessmentSchemaPin.proxy, "schemaUID()(bytes32)", "--rpc-url", rpcUrl],
      { cwd: CONTRACTS_ROOT, env: process.env, encoding: "utf8" },
    ).trim();
    if (!/^0x[0-9a-f]{64}$/iu.test(current)) throw new Error("Unreadable AssessmentResolver v2 schema UID");
    if (current.toLowerCase() !== `0x${"0".repeat(64)}`) {
      throw new Error(
        current.toLowerCase() === assessmentSchemaPin.expectedSchemaUID.toLowerCase()
          ? `Assessment schema-pin boundary ${transaction.index + 1} already changed state; recover with its exact receipt`
          : `AssessmentResolver has conflicting live v2 schema UID ${current}`,
      );
    }
  }
}

function executeUpgradeBoundary(
  options: UpgradeOptions,
  rpcUrl: string,
  chainId: number,
  networkManager: NetworkManager,
): void {
  if (
    !options.planPath ||
    options.releaseStep === undefined ||
    options.expectedNonce === undefined ||
    !options.sender
  ) {
    throw new Error("Release-owned broadcast requires --plan, --step, --expected-nonce, and --sender");
  }
  const planPath = path.resolve(CONTRACTS_ROOT, options.planPath);
  if (!fs.existsSync(planPath)) throw new Error(`Upgrade plan not found: ${planPath}`);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as PersistedUpgradePlan;
  if (
    plan.contract !== options.contract ||
    plan.network !== options.network ||
    plan.chainId !== chainId ||
    getAddress(plan.sender) !== getAddress(options.sender)
  ) {
    throw new Error("Upgrade plan does not match the exact contract, network, chain, or sender");
  }
  const lock = buildReleaseLock(loadReleaseManifest());
  if (plan.releaseManifestHash !== lock.manifestHash) throw new Error("Upgrade plan release-manifest hash is stale");
  const transaction = plan.transactions[options.releaseStep - 1];
  if (!transaction || transaction.index !== options.releaseStep - 1) {
    throw new Error(`Upgrade plan has no boundary ${options.releaseStep}`);
  }
  const plannedNonce = parsePlannedNonce(transaction.nonce);
  if (plannedNonce !== options.expectedNonce)
    throw new Error(`Boundary nonce is ${plannedNonce}, not ${options.expectedNonce}`);

  const checkpointPath = planPath.replace(/\.json$/u, ".checkpoint.json");
  const planHash = keccak256(toUtf8Bytes(stable(plan)));
  const checkpoint = fs.existsSync(checkpointPath)
    ? (JSON.parse(fs.readFileSync(checkpointPath, "utf8")) as UpgradeCheckpoint)
    : { schemaVersion: 1 as const, planHash, completed: [] };
  if (checkpoint.planHash !== planHash) throw new Error("Upgrade checkpoint belongs to a different transaction plan");
  const previousSteps = new Set(checkpoint.completed.map((entry) => entry.step));
  if (options.releaseStep > 1 && !previousSteps.has(options.releaseStep - 1)) {
    throw new Error(`Boundary ${options.releaseStep - 1} has no verified receipt checkpoint`);
  }
  const replay = checkpoint.completed.find((entry) => entry.step === options.releaseStep);
  if (replay) {
    assertReceiptAndTransaction(plan, transaction, replay.transactionHash, rpcUrl);
    verifyUpgradeBoundary(plan, transaction, rpcUrl);
    console.log(`Boundary ${options.releaseStep} is already verified; no replay transaction was sent`);
    return;
  }

  const pendingNonce = Number(
    execFileSync("cast", ["nonce", options.sender, "--block", "pending", "--rpc-url", rpcUrl], {
      cwd: CONTRACTS_ROOT,
      env: process.env,
      encoding: "utf8",
    }).trim(),
  );
  let transactionHash = options.receiptHash;
  if (!transactionHash) {
    if (pendingNonce !== plannedNonce) {
      throw new Error(
        `Nonce drift: boundary expects ${plannedNonce}, live pending nonce is ${pendingNonce}. ` +
          "If the boundary mined before local persistence failed, retry this Bun target with --receipt <tx-hash>.",
      );
    }
    assertUpgradeBoundaryPreconditions(plan, transaction, rpcUrl);
    const account = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    const sendArgs = transaction.to
      ? ["send", transaction.to, transaction.data ?? "0x"]
      : ["send", "--create", transaction.data ?? "0x"];
    const receipt = runCastJson(
      [
        ...sendArgs,
        "--chain",
        networkManager.getChainIdString(options.network),
        "--nonce",
        String(plannedNonce),
        "--account",
        account,
      ],
      rpcUrl,
    );
    const candidate = receipt.transactionHash;
    if (typeof candidate !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(candidate)) {
      throw new Error("Bun-wrapped boundary broadcast returned no transaction hash");
    }
    transactionHash = candidate;
  }

  const evidence = assertReceiptAndTransaction(plan, transaction, transactionHash, rpcUrl);
  verifyUpgradeBoundary(plan, transaction, rpcUrl);
  checkpoint.completed.push({
    step: options.releaseStep,
    ...evidence,
    verifiedAt: new Date().toISOString(),
  });
  writeReleaseJsonAtomic(checkpointPath, checkpoint);
  console.log(`Boundary ${options.releaseStep} receipt and post-state verified; checkpoint written atomically`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  let options: UpgradeOptions;
  try {
    options = parseOptions(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    showHelp();
    process.exit(1);
  }

  if (!CONTRACT_FUNCTIONS[options.contract]) {
    console.error(`Unknown contract: ${options.contract}`);
    console.error("Run with --help to see available contracts");
    process.exit(1);
  }

  if (options.broadcast && options.pureSimulation) {
    console.error("Cannot use --broadcast with --dry-run/--pure-simulation");
    process.exit(1);
  }

  if (options.broadcast && options.txPlan) {
    console.error("Cannot use --broadcast with --tx-plan");
    process.exit(1);
  }

  if (options.txPlan && options.pureSimulation) {
    console.error("Cannot use --tx-plan with --dry-run/--pure-simulation");
    process.exit(1);
  }

  if (options.txPlan && !options.sender) {
    console.error("--tx-plan requires an explicit --sender address");
    process.exit(1);
  }

  const releaseOwnedUpgrade = [
    "assessment-resolver",
    "garden-token",
    "work-approval-resolver",
    "commitment-pooling",
  ].includes(options.contract);
  if ((options.txPlan || options.broadcast) && releaseOwnedUpgrade && options.expectedNonce === undefined) {
    console.error("Release-owned upgrade planning/broadcast requires --expected-nonce <n>");
    process.exit(1);
  }

  if (options.broadcast && releaseOwnedUpgrade && !options.sender) {
    console.error("Release-owned upgrade broadcast requires an explicit --sender address");
    process.exit(1);
  }
  if (options.broadcast && releaseOwnedUpgrade && (!options.planPath || options.releaseStep === undefined)) {
    console.error("Release-owned upgrade broadcast requires --plan <path> and --step <index>");
    process.exit(1);
  }

  const networkManager = new NetworkManager();

  if (options.pureSimulation) {
    try {
      runPureSimulation(options.contract, options.network, networkManager);
      process.exit(0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${errorMsg}`);
      process.exit(1);
    }
  }

  let rpcUrl: string;
  let chainId: number;

  try {
    assertSepoliaGate({
      network: options.network,
      broadcast: options.broadcast,
      overrideSepoliaGate: options.overrideSepoliaGate,
    });

    rpcUrl = networkManager.getRpcUrl(options.network);
    chainId = networkManager.getChainId(options.network);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to get network config: ${errorMsg}`);
    process.exit(1);
  }

  if (options.broadcast && releaseOwnedUpgrade) {
    try {
      executeUpgradeBoundary(options, rpcUrl, chainId, networkManager);
      process.exit(0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${errorMsg}`);
      process.exit(1);
    }
  }

  // Anything that will produce a real transaction proves the sender owns every target first.
  // A plain simulation stays runnable without a sender.
  let preState: UpgradePreState[] = [];
  if (options.broadcast || options.txPlan) {
    try {
      preState = readUpgradePreState(options, rpcUrl, networkManager);
      if (releaseOwnedUpgrade && options.expectedNonce !== undefined && options.sender) {
        const pendingNonce = Number(
          execFileSync("cast", ["nonce", options.sender, "--block", "pending", "--rpc-url", rpcUrl], {
            cwd: CONTRACTS_ROOT,
            env: process.env,
            encoding: "utf8",
          }).trim(),
        );
        if (pendingNonce !== options.expectedNonce) {
          throw new Error(`Nonce drift: expected ${options.expectedNonce}, live pending nonce is ${pendingNonce}`);
        }
        console.log(`✅ Pending nonce matches the pinned plan: ${pendingNonce}\n`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${errorMsg}`);
      process.exit(1);
    }
  }

  const forgeArgs = [
    "script",
    "script/Upgrade.s.sol:Upgrade",
    "--sig",
    CONTRACT_FUNCTIONS[options.contract],
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
  if (options.broadcast && options.expectedNonce !== undefined) {
    forgeArgs.push("--nonce", String(options.expectedNonce));
  }

  if (options.broadcast) {
    forgeArgs.push("--broadcast");

    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
    forgeArgs.push("--account", keystoreName);

    console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
    console.log("💡 Password will be prompted interactively\n");
  } else if (options.txPlan) {
    console.log("🗂️ Transaction plan mode enabled (no broadcast, artifacts persisted)\n");
  } else {
    console.log("🔍 Simulation mode - no transactions will be broadcast\n");
  }

  console.log(
    `Running Bun-wrapped ${options.contract} ` +
      `${options.txPlan ? "transaction-plan simulation" : options.broadcast ? "upgrade" : "simulation"}\n`,
  );

  try {
    const poolingModule =
      options.contract === "commitment-pooling"
        ? buildReleaseLock(loadReleaseManifest()).identities.find(
            (identity) => identity.kind === "proxy" && identity.name === "CommitmentPoolingModule",
          )?.address
        : undefined;
    if (options.contract === "commitment-pooling" && !poolingModule) {
      throw new Error("Frozen release lock is missing the CommitmentPoolingModule proxy identity");
    }
    const environment = {
      ...process.env,
      FOUNDRY_PROFILE: "production",
      FORGE_BROADCAST: options.broadcast || options.txPlan ? "true" : "false",
      UPGRADE_REQUIRE_LIVE_DEPENDENCIES: options.broadcast ? "true" : "false",
      ...(poolingModule ? { COMMITMENT_POOLING_MODULE: poolingModule } : {}),
    };
    if (options.txPlan) {
      // The plan artifact contains the reviewable transactions. Suppress Foundry's generated raw
      // command suggestion so the operator surface remains Bun-only.
      execFileSync("forge", forgeArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: CONTRACTS_ROOT,
        env: environment,
        encoding: "utf8",
      });
    } else {
      execFileSync("forge", forgeArgs, { stdio: "inherit", cwd: CONTRACTS_ROOT, env: environment });
    }

    if (options.txPlan) {
      const planPath = persistTxPlan(options, chainId, preState);
      console.log(`\n✅ Upgrade transaction plan saved to ${planPath}`);
    } else {
      console.log("\n✅ Upgrade completed successfully");
    }
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? "";
    const diagnostic = stderr
      .split("\n")
      .map((line) => line.trim())
      .find((line) => /^(error|failed|unexpected)/iu.test(line) && !line.includes("forge script"));
    if (diagnostic) console.error(`\n❌ ${diagnostic}`);
    console.error(`\n❌ Bun-wrapped ${options.contract} upgrade path failed`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
