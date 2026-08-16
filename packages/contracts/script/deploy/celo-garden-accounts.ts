#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import {
  Contract,
  concat,
  getAddress,
  getCreate2Address,
  Interface,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";
import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { NetworkManager } from "../utils/network";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const PLAN_ROOT = path.join(REPOSITORY_ROOT, ".plans/active/celo-garden-account-safe-ownership");
const EVIDENCE_ROOT = path.join(PLAN_ROOT, "evidence");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_PLAN = path.join(RUNTIME_ROOT, "42220-celo-garden-accounts.json");
const DEFAULT_RAW_BUNDLE = path.join(EVIDENCE_ROOT, "celo-dependency-init-code-2026-08-15.json");
const RELEASE_MANIFEST = path.join(CONTRACTS_ROOT, "config/commitment-pooling-release.json");
const DEPENDENCY_EVIDENCE = path.join(EVIDENCE_ROOT, "deterministic-deployments-42161-2026-02-19.json");
const INITIALIZER_EVIDENCE = path.join(EVIDENCE_ROOT, "garden-account-initializers-42161-494723355.json");
const COORDINATOR_ARTIFACT = path.join(
  CONTRACTS_ROOT,
  ".generated/foundry/out/production/CeloGardenAccountDeploymentCoordinator.sol/CeloGardenAccountDeploymentCoordinator.json",
);

const CELO_CHAIN_ID = 42_220;
const SOURCE_CHAIN_ID = 42_161;
const EXPECTED_GARDEN_COUNT = 18;
const DEPLOYMENT_OPERATOR = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const NICK_CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const MULTICALL_FORWARDER = "0xcA11bde05977b3631167028862bE2a173976CA11";
const ERC6551_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const GARDEN_TOKEN = "0xe1Da335110b1ed48e7df63209f5D424d02276593";
const GARDEN_ACCOUNT_IMPLEMENTATION = "0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692";
const ACCOUNT_SALT = "0x6551655165516551655165516551655165516551655165516551655165516551";
const COORDINATOR_SALT = keccak256(toUtf8Bytes("GreenGoods:CeloGardenAccountDeploymentCoordinator:v1"));

const INFRASTRUCTURE = {
  nickFactory: {
    address: NICK_CREATE2_FACTORY,
    codeHash: "0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989",
  },
  entryPoint: {
    address: ENTRY_POINT,
    codeHash: "0xc93c806e738300b5357ecdc2e971d6438d34d8e4e17b99b758b1f9cac91c8e70",
  },
  multicallForwarder: {
    address: MULTICALL_FORWARDER,
    codeHash: "0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891",
  },
  erc6551Registry: {
    address: ERC6551_REGISTRY,
    codeHash: "0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735",
  },
} as const;

const DEPENDENCY_ORDER = [
  "resolverStub",
  "guardian",
  "workApprovalResolverProxy",
  "assessmentResolverProxy",
  "gardenAccountImplementation",
] as const;

const INITIALIZER_INTERFACE = new Interface([
  "function initialize((address communityToken,string name,string slug,string description,string location,string bannerImage,string metadata,bool openJoining) params)",
]);
const COORDINATOR_INTERFACE = new Interface([
  "function deployAndInitialize((bytes32 salt,bytes initCode)[] dependencies,(uint256 tokenId,bytes initializerCalldata)[] accounts)",
  "function completed() view returns (bool)",
]);
const ACCOUNT_INTERFACE = new Interface([
  "function token() view returns (uint256 chainId,address tokenContract,uint256 tokenId)",
  "function owner() view returns (address)",
  "function communityToken() view returns (address)",
  "function name() view returns (string)",
  "function slug() view returns (string)",
  "function description() view returns (string)",
  "function location() view returns (string)",
  "function bannerImage() view returns (string)",
  "function metadata() view returns (string)",
  "function openJoining() view returns (bool)",
]);

type Command = "plan" | "verify" | "deploy";

interface DependencyEvidenceEntry {
  target: string;
  transactionHash: string;
  salt: string;
  initCodeHash: string;
  initCodeBytes: number;
  runtimeCodeHashAtDeployment: string;
}

type DependencyEvidence = Record<(typeof DEPENDENCY_ORDER)[number], DependencyEvidenceEntry>;

export interface GardenInitializationEntry {
  tokenId: number;
  account: string;
  runtimeCodeHash: string;
  initializerHash: string;
  initializerBytes: number;
  initialization: {
    communityToken: string;
    name: string;
    slug: string;
    description: string;
    location: string;
    bannerImage: string;
    metadata: string;
    openJoining: boolean;
  };
}

interface InitializationEvidence {
  implementation: string;
  registry: string;
  salt: string;
  gardenToken: string;
  entries: GardenInitializationEntry[];
}

interface RawDependencyEntry {
  name: (typeof DEPENDENCY_ORDER)[number];
  sourceTransactionHash: string;
  salt: string;
  initCode: string;
}

interface RawDependencyBundle {
  schemaVersion: 1;
  repositoryCommit: string;
  dependencies: RawDependencyEntry[];
}

interface FoundryArtifact {
  bytecode?: { object?: string } | string;
  deployedBytecode?: { object?: string } | string;
}

interface ReleaseIdentity {
  schemaVersion: number;
  releaseId: string;
  sourceCommit: string;
  create2: { factory: string };
  ownership: {
    deploymentSender: string;
    protocolSafe: string;
    gardenRecoveryOwner: string;
  };
}

export interface PlannedDependency {
  name: string;
  target: string;
  salt: string;
  initCodeHash: string;
  initCodeBytes: number;
  runtimeCodeHash: string;
  initCode?: string;
  observedCodeHash: string | null;
}

export interface PlannedAccount {
  tokenId: number;
  account: string;
  initializerCalldata: string;
  initializerHash: string;
  runtimeCodeHash: string;
  observedCodeHash: string | null;
}

interface PlannedTransaction {
  kind: "DEPLOY_COORDINATOR" | "ATOMIC_DEPLOY_AND_INITIALIZE";
  to: string;
  value: "0";
  data: string;
  nonce: number;
}

export interface CeloGardenAccountPlan {
  schemaVersion: 1;
  kind: "CELO_GARDEN_ACCOUNT_ATOMIC_DEPLOYMENT";
  generatedAt: string;
  releaseId: string;
  releaseManifestHash: string;
  releaseSourceCommit: string;
  chainId: 42220;
  sourceChainId: 42161;
  finalizedBlock: number | null;
  sender: string;
  coordinatorSalt: string;
  coordinator: string | null;
  coordinatorCreationCodeHash: string | null;
  coordinatorRuntimeCodeHash: string | null;
  dependencies: PlannedDependency[];
  accounts: PlannedAccount[];
  transactions: PlannedTransaction[];
  authorityEnabled: false;
  blockers: string[];
}

interface ParsedArguments {
  command: Command;
  planPath: string;
  rawBundlePath: string;
  broadcast: boolean;
  step?: number;
  receipt?: string;
}

dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, stable(value), { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function confinedRuntimePath(value: string): string {
  const resolved = path.resolve(CONTRACTS_ROOT, value);
  if (resolved !== RUNTIME_ROOT && !resolved.startsWith(`${RUNTIME_ROOT}${path.sep}`)) {
    throw new Error(`Plan path must stay inside ${RUNTIME_ROOT}`);
  }
  return resolved;
}

function parseArguments(args: string[]): ParsedArguments {
  const command = args[0] as Command | undefined;
  if (!command || !["plan", "verify", "deploy"].includes(command)) {
    throw new Error("Use: celo-garden-accounts.ts plan|verify|deploy [reviewed options]");
  }
  let planPath = DEFAULT_PLAN;
  let rawBundlePath = DEFAULT_RAW_BUNDLE;
  let broadcast = false;
  let step: number | undefined;
  let receipt: string | undefined;
  for (let index = 1; index < args.length; ++index) {
    const argument = args[index];
    if (argument === "--broadcast") {
      broadcast = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    if (argument === "--plan") planPath = confinedRuntimePath(value);
    else if (argument === "--raw-bundle") rawBundlePath = path.resolve(REPOSITORY_ROOT, value);
    else if (argument === "--step") step = Number(value);
    else if (argument === "--receipt") receipt = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index++;
  }
  if (command === "deploy" && (!broadcast || !Number.isInteger(step) || !step || step < 1 || step > 2)) {
    throw new Error("deploy requires --broadcast and an explicit --step 1|2 boundary");
  }
  if (command !== "deploy" && (broadcast || step !== undefined || receipt !== undefined)) {
    throw new Error(`${command} does not accept broadcast, step, or receipt options`);
  }
  if (receipt && command !== "deploy") throw new Error("--receipt is valid only for deploy");
  return { command, planPath, rawBundlePath, broadcast, step, receipt };
}

function artifactHex(value: FoundryArtifact["bytecode"], label: string): string {
  const candidate = typeof value === "string" ? value : value?.object;
  if (!candidate || !/^0x[0-9a-f]*$/iu.test(candidate) || candidate === "0x") {
    throw new Error(`${label} is missing from the production coordinator artifact`);
  }
  return candidate;
}

export function buildAccountInitializations(evidence: InitializationEvidence): PlannedAccount[] {
  if (
    getAddress(evidence.implementation) !== getAddress(GARDEN_ACCOUNT_IMPLEMENTATION) ||
    getAddress(evidence.registry) !== getAddress(ERC6551_REGISTRY) ||
    getAddress(evidence.gardenToken) !== getAddress(GARDEN_TOKEN) ||
    evidence.salt !== ACCOUNT_SALT ||
    evidence.entries.length !== EXPECTED_GARDEN_COUNT
  ) {
    throw new Error("Garden initializer evidence does not match the frozen identity tuple");
  }

  return evidence.entries.map((entry, index) => {
    if (entry.tokenId !== index) throw new Error(`Garden initializer token order changed at ${index}`);
    const initializerCalldata = INITIALIZER_INTERFACE.encodeFunctionData("initialize", [entry.initialization]);
    if (
      keccak256(initializerCalldata) !== entry.initializerHash ||
      (initializerCalldata.length - 2) / 2 !== entry.initializerBytes
    ) {
      throw new Error(`Garden ${entry.tokenId} initializer no longer matches the frozen hash and length`);
    }
    return {
      tokenId: entry.tokenId,
      account: getAddress(entry.account),
      initializerCalldata,
      initializerHash: entry.initializerHash,
      runtimeCodeHash: entry.runtimeCodeHash,
      observedCodeHash: null,
    };
  });
}

export function validateRawDependencies(
  evidence: DependencyEvidence,
  rawBundle: RawDependencyBundle,
): PlannedDependency[] {
  if (rawBundle.schemaVersion !== 1 || rawBundle.dependencies.length !== DEPENDENCY_ORDER.length) {
    throw new Error("Raw dependency bundle must contain the five reviewed CREATE2 inputs");
  }
  return DEPENDENCY_ORDER.map((name, index) => {
    const expected = evidence[name];
    const supplied = rawBundle.dependencies[index];
    if (
      supplied.name !== name ||
      supplied.sourceTransactionHash !== expected.transactionHash ||
      supplied.salt !== expected.salt ||
      !/^0x[0-9a-f]*$/iu.test(supplied.initCode) ||
      (supplied.initCode.length - 2) / 2 !== expected.initCodeBytes ||
      keccak256(supplied.initCode) !== expected.initCodeHash
    ) {
      throw new Error(`Raw CREATE2 input for ${name} does not match the recovered Arbitrum transaction`);
    }
    return {
      name,
      target: getAddress(expected.target),
      salt: expected.salt,
      initCodeHash: expected.initCodeHash,
      initCodeBytes: expected.initCodeBytes,
      runtimeCodeHash: expected.runtimeCodeHashAtDeployment,
      initCode: supplied.initCode,
      observedCodeHash: null,
    };
  });
}

function buildCoordinatorCall(dependencies: PlannedDependency[], accounts: PlannedAccount[]): string {
  if (dependencies.some((dependency) => !dependency.initCode)) {
    throw new Error("Coordinator call requires every reviewed raw CREATE2 init code");
  }
  return COORDINATOR_INTERFACE.encodeFunctionData("deployAndInitialize", [
    dependencies.map((dependency) => ({ salt: dependency.salt, initCode: dependency.initCode })),
    accounts.map((account) => ({ tokenId: account.tokenId, initializerCalldata: account.initializerCalldata })),
  ]);
}

async function codeHash(
  provider: JsonRpcProvider,
  address: string,
  blockTag: number | "latest",
): Promise<string | null> {
  const code = await provider.getCode(address, blockTag);
  return code === "0x" ? null : keccak256(code);
}

async function buildPlan(rawBundlePath: string): Promise<CeloGardenAccountPlan> {
  const manifest = readJson<ReleaseIdentity>(RELEASE_MANIFEST);
  if (
    manifest.schemaVersion !== 1 ||
    !/^[0-9a-f]{40}$/u.test(manifest.sourceCommit) ||
    getAddress(manifest.create2.factory) !== getAddress(NICK_CREATE2_FACTORY) ||
    getAddress(manifest.ownership.deploymentSender) !== getAddress(DEPLOYMENT_OPERATOR) ||
    getAddress(manifest.ownership.protocolSafe) !== getAddress("0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19") ||
    getAddress(manifest.ownership.gardenRecoveryOwner) !== getAddress("0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C")
  ) {
    throw new Error("Release manifest does not match the frozen GardenAccount deployment identities");
  }
  const dependencyEvidence = readJson<DependencyEvidence>(DEPENDENCY_EVIDENCE);
  const initializerEvidence = readJson<InitializationEvidence>(INITIALIZER_EVIDENCE);
  const accounts = buildAccountInitializations(initializerEvidence);
  const blockers: string[] = [];

  let dependencies: PlannedDependency[] = DEPENDENCY_ORDER.map((name) => {
    const expected = dependencyEvidence[name];
    return {
      name,
      target: getAddress(expected.target),
      salt: expected.salt,
      initCodeHash: expected.initCodeHash,
      initCodeBytes: expected.initCodeBytes,
      runtimeCodeHash: expected.runtimeCodeHashAtDeployment,
      observedCodeHash: null,
    };
  });
  if (!fs.existsSync(rawBundlePath)) {
    blockers.push(`missing reviewed raw CREATE2 bundle: ${rawBundlePath}`);
  } else {
    dependencies = validateRawDependencies(dependencyEvidence, readJson<RawDependencyBundle>(rawBundlePath));
  }

  let coordinator: string | null = null;
  let coordinatorCreationCodeHash: string | null = null;
  let coordinatorRuntimeCodeHash: string | null = null;
  let coordinatorBytecode: string | null = null;
  if (!fs.existsSync(COORDINATOR_ARTIFACT)) {
    blockers.push(`missing production coordinator artifact: ${COORDINATOR_ARTIFACT}`);
  } else {
    const artifact = readJson<FoundryArtifact>(COORDINATOR_ARTIFACT);
    coordinatorBytecode = artifactHex(artifact.bytecode, "Coordinator creation code");
    const runtime = artifactHex(artifact.deployedBytecode, "Coordinator runtime code");
    coordinatorCreationCodeHash = keccak256(coordinatorBytecode);
    coordinatorRuntimeCodeHash = keccak256(runtime);
    coordinator = getAddress(getCreate2Address(NICK_CREATE2_FACTORY, COORDINATOR_SALT, coordinatorCreationCodeHash));
  }

  const plan: CeloGardenAccountPlan = {
    schemaVersion: 1,
    kind: "CELO_GARDEN_ACCOUNT_ATOMIC_DEPLOYMENT",
    generatedAt: new Date().toISOString(),
    releaseId: manifest.releaseId,
    releaseManifestHash: keccak256(toUtf8Bytes(fs.readFileSync(RELEASE_MANIFEST, "utf8"))),
    releaseSourceCommit: manifest.sourceCommit,
    chainId: CELO_CHAIN_ID,
    sourceChainId: SOURCE_CHAIN_ID,
    finalizedBlock: null,
    sender: getAddress(DEPLOYMENT_OPERATOR),
    coordinatorSalt: COORDINATOR_SALT,
    coordinator,
    coordinatorCreationCodeHash,
    coordinatorRuntimeCodeHash,
    dependencies,
    accounts,
    transactions: [],
    authorityEnabled: false,
    blockers,
  };
  if (blockers.length > 0 || !coordinator || !coordinatorBytecode || !coordinatorRuntimeCodeHash) return plan;

  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const [network, finalized] = await Promise.all([provider.getNetwork(), provider.getBlock("finalized")]);
  if (network.chainId !== BigInt(CELO_CHAIN_ID) || !finalized) throw new Error("Celo finalized RPC is unavailable");
  plan.finalizedBlock = finalized.number;

  for (const dependency of plan.dependencies) {
    dependency.observedCodeHash = await codeHash(provider, dependency.target, finalized.number);
    if (dependency.name === "gardenAccountImplementation" && dependency.observedCodeHash) {
      plan.blockers.push(
        "exact GardenAccount implementation already exists; atomic deployment/adoption review required",
      );
    } else if (dependency.observedCodeHash && dependency.observedCodeHash !== dependency.runtimeCodeHash) {
      plan.blockers.push(`${dependency.name} runtime differs from the frozen hash`);
    }
  }
  for (const account of plan.accounts) {
    account.observedCodeHash = await codeHash(provider, account.account, finalized.number);
    if (account.observedCodeHash) plan.blockers.push(`Garden token ${account.tokenId} account already has code`);
  }
  for (const [name, expected] of Object.entries(INFRASTRUCTURE)) {
    const observed = await codeHash(provider, expected.address, finalized.number);
    if (observed !== expected.codeHash) plan.blockers.push(`${name} code differs from the frozen Celo identity`);
  }

  const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
  const observedCoordinatorHash = await codeHash(provider, coordinator, finalized.number);
  if (!observedCoordinatorHash) {
    plan.transactions.push({
      kind: "DEPLOY_COORDINATOR",
      to: getAddress(NICK_CREATE2_FACTORY),
      value: "0",
      data: concat([COORDINATOR_SALT, coordinatorBytecode]),
      nonce: pendingNonce,
    });
    plan.transactions.push({
      kind: "ATOMIC_DEPLOY_AND_INITIALIZE",
      to: coordinator,
      value: "0",
      data: buildCoordinatorCall(plan.dependencies, plan.accounts),
      nonce: pendingNonce + 1,
    });
  } else if (observedCoordinatorHash !== coordinatorRuntimeCodeHash) {
    plan.blockers.push("deterministic coordinator address contains different code");
  } else {
    plan.blockers.push("deterministic coordinator already exists; recover and review its deployment receipt");
  }
  return plan;
}

function validatePlan(plan: CeloGardenAccountPlan): void {
  const manifest = readJson<ReleaseIdentity>(RELEASE_MANIFEST);
  const manifestHash = keccak256(toUtf8Bytes(fs.readFileSync(RELEASE_MANIFEST, "utf8")));
  if (
    plan.schemaVersion !== 1 ||
    plan.kind !== "CELO_GARDEN_ACCOUNT_ATOMIC_DEPLOYMENT" ||
    plan.releaseId !== manifest.releaseId ||
    plan.releaseManifestHash !== manifestHash ||
    plan.releaseSourceCommit !== manifest.sourceCommit ||
    plan.chainId !== CELO_CHAIN_ID ||
    plan.sourceChainId !== SOURCE_CHAIN_ID ||
    !Number.isSafeInteger(plan.finalizedBlock) ||
    (plan.finalizedBlock ?? 0) < 1 ||
    getAddress(plan.sender) !== getAddress(DEPLOYMENT_OPERATOR) ||
    plan.coordinatorSalt !== COORDINATOR_SALT ||
    plan.accounts.length !== EXPECTED_GARDEN_COUNT ||
    plan.dependencies.length !== DEPENDENCY_ORDER.length ||
    plan.authorityEnabled !== false
  ) {
    throw new Error("Celo GardenAccount deployment plan identity changed");
  }

  const dependencyEvidence = readJson<DependencyEvidence>(DEPENDENCY_EVIDENCE);
  for (const [index, name] of DEPENDENCY_ORDER.entries()) {
    const expected = dependencyEvidence[name];
    const dependency = plan.dependencies[index];
    if (
      dependency.name !== name ||
      getAddress(dependency.target) !== getAddress(expected.target) ||
      dependency.salt !== expected.salt ||
      dependency.initCodeHash !== expected.initCodeHash ||
      dependency.initCodeBytes !== expected.initCodeBytes ||
      dependency.runtimeCodeHash !== expected.runtimeCodeHashAtDeployment ||
      !dependency.initCode ||
      (dependency.initCode.length - 2) / 2 !== expected.initCodeBytes ||
      keccak256(dependency.initCode) !== expected.initCodeHash
    ) {
      throw new Error(`Celo GardenAccount dependency ${name} changed after review`);
    }
  }

  const expectedAccounts = buildAccountInitializations(readJson<InitializationEvidence>(INITIALIZER_EVIDENCE));
  for (const [index, expected] of expectedAccounts.entries()) {
    const account = plan.accounts[index];
    if (
      account.tokenId !== expected.tokenId ||
      getAddress(account.account) !== getAddress(expected.account) ||
      account.initializerCalldata !== expected.initializerCalldata ||
      account.initializerHash !== expected.initializerHash ||
      account.runtimeCodeHash !== expected.runtimeCodeHash
    ) {
      throw new Error(`Celo GardenAccount token ${index} changed after review`);
    }
  }

  if (!fs.existsSync(COORDINATOR_ARTIFACT)) throw new Error("Production coordinator artifact is unavailable");
  const artifact = readJson<FoundryArtifact>(COORDINATOR_ARTIFACT);
  const creationCode = artifactHex(artifact.bytecode, "Coordinator creation code");
  const runtimeCode = artifactHex(artifact.deployedBytecode, "Coordinator runtime code");
  const creationCodeHash = keccak256(creationCode);
  const runtimeCodeHash = keccak256(runtimeCode);
  const coordinator = getAddress(getCreate2Address(NICK_CREATE2_FACTORY, COORDINATOR_SALT, creationCodeHash));
  if (
    !plan.coordinator ||
    getAddress(plan.coordinator) !== coordinator ||
    plan.coordinatorCreationCodeHash !== creationCodeHash ||
    plan.coordinatorRuntimeCodeHash !== runtimeCodeHash ||
    plan.transactions.length !== 2
  ) {
    throw new Error("Celo GardenAccount coordinator identity changed after review");
  }

  const expectedTransactions = [
    {
      kind: "DEPLOY_COORDINATOR",
      to: getAddress(NICK_CREATE2_FACTORY),
      value: "0",
      data: concat([COORDINATOR_SALT, creationCode]),
      nonce: plan.transactions[0].nonce,
    },
    {
      kind: "ATOMIC_DEPLOY_AND_INITIALIZE",
      to: coordinator,
      value: "0",
      data: buildCoordinatorCall(plan.dependencies, plan.accounts),
      nonce: plan.transactions[0].nonce + 1,
    },
  ] as const;
  for (const [index, expected] of expectedTransactions.entries()) {
    const transaction = plan.transactions[index];
    if (
      transaction.kind !== expected.kind ||
      getAddress(transaction.to) !== expected.to ||
      transaction.value !== expected.value ||
      transaction.data !== expected.data ||
      transaction.nonce !== expected.nonce
    ) {
      throw new Error(`Celo GardenAccount transaction boundary ${index + 1} changed after review`);
    }
  }
  if (plan.blockers.length > 0) throw new Error(`Celo GardenAccount plan is blocked: ${plan.blockers.join("; ")}`);
}

async function verifyDeployedPlan(plan: CeloGardenAccountPlan): Promise<void> {
  validatePlan(plan);
  const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  if (!plan.coordinator || !plan.coordinatorRuntimeCodeHash) throw new Error("Coordinator identity is incomplete");
  if ((await codeHash(provider, plan.coordinator, "latest")) !== plan.coordinatorRuntimeCodeHash) {
    throw new Error("Coordinator runtime is not deployed at the reviewed address");
  }
  if (!(await new Contract(plan.coordinator, COORDINATOR_INTERFACE, provider).completed())) {
    throw new Error("Coordinator has not completed the atomic deployment");
  }
  for (const dependency of plan.dependencies) {
    if ((await codeHash(provider, dependency.target, "latest")) !== dependency.runtimeCodeHash) {
      throw new Error(`${dependency.name} runtime does not match the reviewed deployment`);
    }
  }
  const evidence = readJson<InitializationEvidence>(INITIALIZER_EVIDENCE);
  for (const [index, accountPlan] of plan.accounts.entries()) {
    if ((await codeHash(provider, accountPlan.account, "latest")) !== accountPlan.runtimeCodeHash) {
      throw new Error(`Garden token ${index} account runtime does not match`);
    }
    const account = new Contract(accountPlan.account, ACCOUNT_INTERFACE, provider);
    const [token, owner, communityToken, name, slug, description, location, bannerImage, metadata, openJoining] =
      await Promise.all([
        account.token(),
        account.owner(),
        account.communityToken(),
        account.name(),
        account.slug(),
        account.description(),
        account.location(),
        account.bannerImage(),
        account.metadata(),
        account.openJoining(),
      ]);
    const expected = evidence.entries[index].initialization;
    if (
      token[0] !== BigInt(SOURCE_CHAIN_ID) ||
      getAddress(token[1]) !== getAddress(GARDEN_TOKEN) ||
      token[2] !== BigInt(index) ||
      getAddress(owner) !== ZeroAddress ||
      getAddress(communityToken) !== getAddress(expected.communityToken) ||
      name !== expected.name ||
      slug !== expected.slug ||
      description !== expected.description ||
      location !== expected.location ||
      bannerImage !== expected.bannerImage ||
      metadata !== expected.metadata ||
      openJoining !== expected.openJoining
    ) {
      throw new Error(`Garden token ${index} initialized state differs from the reviewed evidence`);
    }
  }
}

function credentialArgs(expectedCommit: string): string[] {
  const session = process.env.GG_RELEASE_OPERATOR_SESSION;
  if (session !== expectedCommit) {
    throw new Error("Broadcast release-operator session does not match the reviewed commit");
  }
  const passwordFile = process.env.ETH_PASSWORD;
  if (!passwordFile || !fs.existsSync(passwordFile)) {
    throw new Error("Broadcast requires the release operator's temporary ETH_PASSWORD file");
  }
  return ["--account", process.env.FOUNDRY_KEYSTORE_ACCOUNT ?? "green-goods-deployer", "--password-file", passwordFile];
}

function sendTransaction(transaction: PlannedTransaction, rpcUrl: string, expectedCommit: string): string {
  const output = execCastCaptured(
    [
      "send",
      transaction.to,
      "--data",
      transaction.data,
      "--value",
      transaction.value,
      "--nonce",
      String(transaction.nonce),
      "--chain",
      String(CELO_CHAIN_ID),
      "--rpc-url",
      rpcUrl,
      ...credentialArgs(expectedCommit),
      "--json",
    ],
    { cwd: CONTRACTS_ROOT, env: process.env },
    transaction.kind,
  );
  return parseCastTransactionHash(output, transaction.kind);
}

async function executeBoundary(plan: CeloGardenAccountPlan, step: number, recoveryReceipt?: string): Promise<void> {
  validatePlan(plan);
  const transaction = plan.transactions[step - 1];
  if (!transaction || plan.transactions.length !== 2) {
    throw new Error("Reviewed plan does not contain the expected two transaction boundaries");
  }
  if (step === 2 && !recoveryReceipt) {
    throw new Error("Step 2 requires a separately reviewed step-1 receipt via --receipt");
  }
  const networkManager = new NetworkManager();
  const provider = new JsonRpcProvider(networkManager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  if (step === 2 && recoveryReceipt) {
    const firstReceipt = await provider.getTransactionReceipt(recoveryReceipt);
    const firstTransaction = await provider.getTransaction(recoveryReceipt);
    const expected = plan.transactions[0];
    if (
      !firstReceipt ||
      firstReceipt.status !== 1 ||
      !firstTransaction ||
      getAddress(firstTransaction.from) !== getAddress(plan.sender) ||
      getAddress(firstTransaction.to ?? ZeroAddress) !== getAddress(expected.to) ||
      firstTransaction.data !== expected.data ||
      firstTransaction.value !== 0n ||
      firstTransaction.nonce !== expected.nonce
    ) {
      throw new Error("Step-1 receipt does not match the reviewed coordinator deployment boundary");
    }
    if (
      !plan.coordinator ||
      !plan.coordinatorRuntimeCodeHash ||
      (await codeHash(provider, plan.coordinator, "latest")) !== plan.coordinatorRuntimeCodeHash
    ) {
      throw new Error("Step-1 receipt did not leave the reviewed coordinator runtime deployed");
    }
  }
  const pendingNonce = await provider.getTransactionCount(plan.sender, "pending");
  if (pendingNonce !== transaction.nonce)
    throw new Error(`Expected sender nonce ${transaction.nonce}, live ${pendingNonce}`);
  const transactionHash = sendTransaction(transaction, networkManager.getRpcUrl("celo"), plan.releaseSourceCommit);
  const [receipt, liveTransaction] = await Promise.all([
    provider.waitForTransaction(transactionHash, 1, 120_000),
    provider.getTransaction(transactionHash),
  ]);
  if (
    !receipt ||
    receipt.status !== 1 ||
    !liveTransaction ||
    getAddress(liveTransaction.from) !== getAddress(plan.sender) ||
    getAddress(liveTransaction.to ?? ZeroAddress) !== getAddress(transaction.to) ||
    liveTransaction.data !== transaction.data ||
    liveTransaction.value !== 0n ||
    liveTransaction.nonce !== transaction.nonce
  ) {
    throw new Error(`${transaction.kind} receipt does not match the reviewed boundary`);
  }
  if (step === 1) {
    if (
      !plan.coordinator ||
      (await codeHash(provider, plan.coordinator, "latest")) !== plan.coordinatorRuntimeCodeHash
    ) {
      throw new Error("Coordinator deployment receipt did not produce the reviewed runtime");
    }
  } else {
    await verifyDeployedPlan(plan);
  }
  process.stdout.write(`${transaction.kind} verified as ${transactionHash}; close the credential session.\n`);
}

async function main(args: string[]): Promise<void> {
  const options = parseArguments(args);
  if (options.command === "plan") {
    const plan = await buildPlan(options.rawBundlePath);
    atomicWrite(options.planPath, plan);
    process.stdout.write(
      stable({ planPath: options.planPath, coordinator: plan.coordinator, blockers: plan.blockers }),
    );
    if (plan.blockers.length > 0) throw new Error(`Celo GardenAccount planning blocked: ${plan.blockers.join("; ")}`);
    return;
  }
  const plan = readJson<CeloGardenAccountPlan>(options.planPath);
  if (options.command === "verify") {
    await verifyDeployedPlan(plan);
    process.stdout.write("Verified exact dependencies and 18 initialized same-address Celo GardenAccounts.\n");
    return;
  }
  await executeBoundary(plan, options.step!, options.receipt);
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
