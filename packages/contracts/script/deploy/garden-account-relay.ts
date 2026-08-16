#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import {
  AbiCoder,
  Contract,
  concat,
  getAddress,
  getCreate2Address,
  Interface,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { NetworkManager } from "../utils/network";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_SAFE_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-final.json");
const DEFAULT_PLAN = path.join(RUNTIME_ROOT, "garden-account-relay.json");
const FROZEN_BINDINGS = path.join(
  REPOSITORY_ROOT,
  ".plans/active/celo-garden-account-safe-ownership/evidence/garden-safe-final-bindings-2026-08-15.json",
);
const ROUTER_ARTIFACT = path.join(
  CONTRACTS_ROOT,
  ".generated/foundry/out/production/GardenActionRouter.sol/GardenActionRouter.json",
);
const RELAY_ARTIFACT = path.join(
  CONTRACTS_ROOT,
  ".generated/foundry/out/production/CeloGardenAccountRelay.sol/CeloGardenAccountRelay.json",
);

const SOURCE_CHAIN_ID = 42_161;
const CELO_CHAIN_ID = 42_220;
const SOURCE_SELECTOR = 4_949_039_107_694_359_620n;
const CELO_SELECTOR = 1_346_049_177_634_351_622n;
const SOURCE_CCIP_ROUTER = "0x141fa059441E0ca23ce184B6A78bafD2A517DdE8";
const CELO_CCIP_ROUTER = "0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62";
const SOURCE_CCIP_ROUTER_CODE_HASH = "0x0eec2ce1cfdadb0003ee4f17f58e99c95f5581d1651372b1178ce3fd0712aabb";
const CELO_CCIP_ROUTER_CODE_HASH = "0xdaa1f3643912dc7775a2348bca8ce0a7740d7f25ee347442164fe469d86312cf";
const NICK_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const IMPLEMENTATION = "0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692";
const GARDEN_TOKEN = "0xe1Da335110b1ed48e7df63209f5D424d02276593";
const GUARDIAN = "0x05F486E3161F895Ad99f041065224F78bDf580a7";
const DEPLOYMENT_OPERATOR = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const GREEN_GOODS_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const DEV_GUILD_SAFE = "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C";
const DESTINATION_GAS_LIMIT = 500_000n;
const ROUTER_SALT = keccak256(toUtf8Bytes("GG_GARDEN_ACTION_ROUTER_V1"));
const RELAY_SALT = keccak256(toUtf8Bytes("GG_CELO_GARDEN_ACCOUNT_RELAY_V1"));

const ROUTER_CONSTRUCTOR_TYPES = [
  "address",
  "uint64",
  "uint64",
  "address",
  "address",
  "address",
  "address",
  "address",
  "uint256",
  "address[]",
  "address[]",
] as const;
const RELAY_CONSTRUCTOR_TYPES = [
  "address",
  "uint64",
  "uint64",
  "address",
  "address",
  "address",
  "address",
  "address",
  "address",
  "address[]",
  "address[]",
] as const;
const ROUTER_INTERFACE = new Interface(["function bindDestinationRelay(address destinationRelay)"]);
const GUARDIAN_INTERFACE = new Interface([
  "function owner() view returns (address)",
  "function isTrustedExecutor(address executor) view returns (bool)",
  "function setTrustedExecutor(address executor,bool trusted)",
]);

type Command = "plan" | "verify";

interface FoundryArtifact {
  bytecode?: { object?: string } | string;
  deployedBytecode?: { object?: string } | string;
}

interface SafePlanEntry {
  tokenId: number;
  garden: string;
  safe: string;
  owners: string[];
  threshold: string;
  initializerHash: string;
  saltNonce: string;
  state: "ABSENT" | "DEPLOYED";
}

interface FrozenBindings {
  schemaVersion: 1;
  kind: "GARDEN_SAFE_FINAL_BINDINGS";
  factory: string;
  singleton: string;
  greenGoodsRecoverySafe: string;
  devGuildRecoverySafe: string;
  entries: Array<{
    tokenId: number;
    garden: string;
    safe: string;
    initializerHash: string;
    saltNonce: string;
  }>;
}

interface SafePlan {
  schemaVersion: number;
  kind: string;
  chainId: number;
  greenGoodsRecoverySafe: string;
  devGuildRecoverySafe: string;
  factory: string;
  singleton: string;
  blockers: string[];
  entries: SafePlanEntry[];
}

export interface RelayPlanInputs {
  routerCreationCode: string;
  routerRuntimeCode: string;
  relayCreationCode: string;
  relayRuntimeCode: string;
  gardens: string[];
  safes: string[];
  sourceNonce: number;
  celoNonce: number;
  sourceFinalizedBlock: number;
  sourceFinalizedBlockHash: string;
  celoFinalizedBlock: number;
  celoFinalizedBlockHash: string;
  generatedAt?: string;
}

export interface PlannedRelayTransaction {
  step: 1 | 2 | 3 | 4;
  chainId: 42161 | 42220;
  kind: "DEPLOY_SOURCE_ROUTER" | "DEPLOY_CELO_RELAY" | "BIND_DESTINATION_RELAY" | "TRUST_CELO_RELAY";
  prerequisiteReceipt: null | "step-1" | "step-2" | "step-3";
  to: string;
  value: "0";
  data: string;
  nonce: number;
}

export interface GardenAccountRelayPlan {
  schemaVersion: 1;
  kind: "GARDEN_ACCOUNT_RELAY_DEPLOYMENT";
  generatedAt: string;
  source: { chainId: 42161; finalizedBlock: number; finalizedBlockHash: string; ccipRouter: string };
  destination: { chainId: 42220; finalizedBlock: number; finalizedBlockHash: string; ccipRouter: string };
  sender: string;
  router: { address: string; salt: string; initCodeHash: string; runtimeCodeHash: string };
  relay: { address: string; salt: string; initCodeHash: string; runtimeCodeHash: string };
  guardian: string;
  gardenBindingHash: string;
  gardenCount: 18;
  authorityEnabled: false;
  valueAuthorityGranted: false;
  transactions: PlannedRelayTransaction[];
  blockers: string[];
}

dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

function artifactHex(value: FoundryArtifact["bytecode"], label: string): string {
  const candidate = typeof value === "string" ? value : value?.object;
  if (!candidate || candidate === "0x" || !/^0x[0-9a-f]+$/iu.test(candidate)) {
    throw new Error(`${label} is missing from the production artifact`);
  }
  return candidate;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function confinedRuntimePath(value: string): string {
  const resolved = path.resolve(CONTRACTS_ROOT, value);
  if (resolved !== RUNTIME_ROOT && !resolved.startsWith(`${RUNTIME_ROOT}${path.sep}`)) {
    throw new Error(`Path must stay inside ${RUNTIME_ROOT}`);
  }
  return resolved;
}

export function parseArguments(args: string[]): { command: Command; safePlanPath: string; planPath: string } {
  const command = args[0] as Command | undefined;
  if (!command || !["plan", "verify"].includes(command)) {
    throw new Error("Use: garden-account-relay.ts plan|verify [--safe-plan <runtime path>] [--plan <runtime path>]");
  }
  let safePlanPath = DEFAULT_SAFE_PLAN;
  let planPath = DEFAULT_PLAN;
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    if (key === "--safe-plan") safePlanPath = confinedRuntimePath(value);
    else if (key === "--plan") planPath = confinedRuntimePath(value);
    else throw new Error(`Unknown argument: ${key}`);
  }
  return { command, safePlanPath, planPath };
}

function initCode(bytecode: string, types: readonly string[], values: readonly unknown[]): string {
  return concat([bytecode, AbiCoder.defaultAbiCoder().encode([...types], [...values])]);
}

export function buildDeterministicRelayPlan(inputs: RelayPlanInputs): GardenAccountRelayPlan {
  if (
    inputs.gardens.length !== 18 ||
    inputs.safes.length !== 18 ||
    new Set(inputs.gardens.map((value) => getAddress(value))).size !== 18 ||
    new Set(inputs.safes.map((value) => getAddress(value))).size !== 18
  ) {
    throw new Error("Relay plan requires 18 unique Garden/account Safe bindings");
  }
  const gardens = inputs.gardens.map(getAddress);
  const safes = inputs.safes.map(getAddress);
  const routerInitCode = initCode(inputs.routerCreationCode, ROUTER_CONSTRUCTOR_TYPES, [
    SOURCE_CCIP_ROUTER,
    SOURCE_SELECTOR,
    CELO_SELECTOR,
    CELO_CCIP_ROUTER,
    DEPLOYMENT_OPERATOR,
    REGISTRY,
    IMPLEMENTATION,
    GARDEN_TOKEN,
    DESTINATION_GAS_LIMIT,
    gardens,
    safes,
  ]);
  const routerCreationCodeHash = keccak256(routerInitCode);
  const router = getAddress(getCreate2Address(NICK_FACTORY, ROUTER_SALT, routerCreationCodeHash));
  const relayInitCode = initCode(inputs.relayCreationCode, RELAY_CONSTRUCTOR_TYPES, [
    CELO_CCIP_ROUTER,
    SOURCE_SELECTOR,
    CELO_SELECTOR,
    router,
    REGISTRY,
    IMPLEMENTATION,
    GARDEN_TOKEN,
    GREEN_GOODS_SAFE,
    DEV_GUILD_SAFE,
    gardens,
    safes,
  ]);
  const relayCreationCodeHash = keccak256(relayInitCode);
  const relay = getAddress(getCreate2Address(NICK_FACTORY, RELAY_SALT, relayCreationCodeHash));
  return {
    schemaVersion: 1,
    kind: "GARDEN_ACCOUNT_RELAY_DEPLOYMENT",
    generatedAt: inputs.generatedAt ?? new Date().toISOString(),
    source: {
      chainId: SOURCE_CHAIN_ID,
      finalizedBlock: inputs.sourceFinalizedBlock,
      finalizedBlockHash: inputs.sourceFinalizedBlockHash,
      ccipRouter: getAddress(SOURCE_CCIP_ROUTER),
    },
    destination: {
      chainId: CELO_CHAIN_ID,
      finalizedBlock: inputs.celoFinalizedBlock,
      finalizedBlockHash: inputs.celoFinalizedBlockHash,
      ccipRouter: getAddress(CELO_CCIP_ROUTER),
    },
    sender: getAddress(DEPLOYMENT_OPERATOR),
    router: {
      address: router,
      salt: ROUTER_SALT,
      initCodeHash: routerCreationCodeHash,
      runtimeCodeHash: keccak256(inputs.routerRuntimeCode),
    },
    relay: {
      address: relay,
      salt: RELAY_SALT,
      initCodeHash: relayCreationCodeHash,
      runtimeCodeHash: keccak256(inputs.relayRuntimeCode),
    },
    guardian: getAddress(GUARDIAN),
    gardenBindingHash: keccak256(AbiCoder.defaultAbiCoder().encode(["address[]", "address[]"], [gardens, safes])),
    gardenCount: 18,
    authorityEnabled: false,
    valueAuthorityGranted: false,
    transactions: [
      {
        step: 1,
        chainId: SOURCE_CHAIN_ID,
        kind: "DEPLOY_SOURCE_ROUTER",
        prerequisiteReceipt: null,
        to: getAddress(NICK_FACTORY),
        value: "0",
        data: concat([ROUTER_SALT, routerInitCode]),
        nonce: inputs.sourceNonce,
      },
      {
        step: 2,
        chainId: CELO_CHAIN_ID,
        kind: "DEPLOY_CELO_RELAY",
        prerequisiteReceipt: "step-1",
        to: getAddress(NICK_FACTORY),
        value: "0",
        data: concat([RELAY_SALT, relayInitCode]),
        nonce: inputs.celoNonce,
      },
      {
        step: 3,
        chainId: SOURCE_CHAIN_ID,
        kind: "BIND_DESTINATION_RELAY",
        prerequisiteReceipt: "step-2",
        to: router,
        value: "0",
        data: ROUTER_INTERFACE.encodeFunctionData("bindDestinationRelay", [relay]),
        nonce: inputs.sourceNonce + 1,
      },
      {
        step: 4,
        chainId: CELO_CHAIN_ID,
        kind: "TRUST_CELO_RELAY",
        prerequisiteReceipt: "step-3",
        to: getAddress(GUARDIAN),
        value: "0",
        data: GUARDIAN_INTERFACE.encodeFunctionData("setTrustedExecutor", [relay, true]),
        nonce: inputs.celoNonce + 1,
      },
    ],
    blockers: [],
  };
}

function validateSafePlan(plan: SafePlan): { gardens: string[]; safes: string[] } {
  const frozen = readJson<FrozenBindings>(FROZEN_BINDINGS);
  if (
    plan.schemaVersion !== 2 ||
    plan.kind !== "GARDEN_SAFE_FINAL" ||
    plan.chainId !== CELO_CHAIN_ID ||
    getAddress(plan.greenGoodsRecoverySafe) !== getAddress(GREEN_GOODS_SAFE) ||
    getAddress(plan.devGuildRecoverySafe) !== getAddress(DEV_GUILD_SAFE) ||
    getAddress(plan.factory) !== getAddress(frozen.factory) ||
    getAddress(plan.singleton) !== getAddress(frozen.singleton) ||
    plan.blockers.length > 0 ||
    plan.entries.length !== 18 ||
    frozen.schemaVersion !== 1 ||
    frozen.kind !== "GARDEN_SAFE_FINAL_BINDINGS" ||
    getAddress(frozen.greenGoodsRecoverySafe) !== getAddress(GREEN_GOODS_SAFE) ||
    getAddress(frozen.devGuildRecoverySafe) !== getAddress(DEV_GUILD_SAFE) ||
    frozen.entries.length !== 18
  ) {
    throw new Error("Final Garden Safe plan is missing, blocked, or identity-incompatible");
  }
  for (const [index, entry] of plan.entries.entries()) {
    const binding = frozen.entries[index];
    const expected = [entry.garden, GREEN_GOODS_SAFE, DEV_GUILD_SAFE].map(getAddress);
    if (
      entry.tokenId !== binding.tokenId ||
      getAddress(entry.garden) !== getAddress(binding.garden) ||
      getAddress(entry.safe) !== getAddress(binding.safe) ||
      entry.initializerHash !== binding.initializerHash ||
      entry.saltNonce !== binding.saltNonce ||
      entry.threshold !== "2" ||
      entry.owners.length !== 3 ||
      new Set(entry.owners.map(getAddress)).size !== 3 ||
      expected.some((owner) => !entry.owners.map(getAddress).includes(owner))
    ) {
      throw new Error(`Garden Safe token ${entry.tokenId} is not the exact final 2-of-3 topology`);
    }
  }
  return {
    gardens: plan.entries.map((entry) => getAddress(entry.garden)),
    safes: plan.entries.map((entry) => getAddress(entry.safe)),
  };
}

function validatePlan(plan: GardenAccountRelayPlan, expected: GardenAccountRelayPlan): void {
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error("GardenAccount relay transaction plan changed after review");
  }
  if (plan.blockers.length > 0 || plan.authorityEnabled || plan.valueAuthorityGranted) {
    throw new Error(`GardenAccount relay plan is blocked: ${plan.blockers.join("; ")}`);
  }
}

async function liveInputs(
  safePlanPath: string,
  snapshot?: { sourceBlock: number; celoBlock: number; generatedAt: string },
): Promise<RelayPlanInputs> {
  if (!fs.existsSync(ROUTER_ARTIFACT) || !fs.existsSync(RELAY_ARTIFACT)) {
    throw new Error("Production router/relay artifacts are missing; run the reviewed Bun production build first");
  }
  const bindings = validateSafePlan(readJson<SafePlan>(safePlanPath));
  const routerArtifact = readJson<FoundryArtifact>(ROUTER_ARTIFACT);
  const relayArtifact = readJson<FoundryArtifact>(RELAY_ARTIFACT);
  const manager = new NetworkManager();
  const source = new JsonRpcProvider(manager.getRpcUrl("arbitrum"), SOURCE_CHAIN_ID, { staticNetwork: true });
  const celo = new JsonRpcProvider(manager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const [sourceBlock, celoBlock, sourceNonce, celoNonce] = await Promise.all([
    source.getBlock(snapshot?.sourceBlock ?? "finalized"),
    celo.getBlock(snapshot?.celoBlock ?? "finalized"),
    source.getTransactionCount(DEPLOYMENT_OPERATOR, "pending"),
    celo.getTransactionCount(DEPLOYMENT_OPERATOR, "pending"),
  ]);
  if (!sourceBlock?.hash || !celoBlock?.hash) throw new Error("Both chains need finalized block identities");
  const [sourceRouterCode, celoRouterCode, guardianOwner] = await Promise.all([
    source.getCode(SOURCE_CCIP_ROUTER, sourceBlock.number),
    celo.getCode(CELO_CCIP_ROUTER, celoBlock.number),
    new Contract(GUARDIAN, GUARDIAN_INTERFACE, celo).owner({ blockTag: celoBlock.number }) as Promise<string>,
  ]);
  if (
    keccak256(sourceRouterCode) !== SOURCE_CCIP_ROUTER_CODE_HASH ||
    keccak256(celoRouterCode) !== CELO_CCIP_ROUTER_CODE_HASH
  ) {
    throw new Error("Official CCIP router code hash drifted");
  }
  if (getAddress(guardianOwner) !== getAddress(DEPLOYMENT_OPERATOR)) {
    throw new Error("Guardian owner differs from the frozen deployment operator");
  }
  return {
    routerCreationCode: artifactHex(routerArtifact.bytecode, "Router creation code"),
    routerRuntimeCode: artifactHex(routerArtifact.deployedBytecode, "Router runtime code"),
    relayCreationCode: artifactHex(relayArtifact.bytecode, "Relay creation code"),
    relayRuntimeCode: artifactHex(relayArtifact.deployedBytecode, "Relay runtime code"),
    gardens: bindings.gardens,
    safes: bindings.safes,
    sourceNonce,
    celoNonce,
    sourceFinalizedBlock: sourceBlock.number,
    sourceFinalizedBlockHash: sourceBlock.hash,
    celoFinalizedBlock: celoBlock.number,
    celoFinalizedBlockHash: celoBlock.hash,
    generatedAt: snapshot?.generatedAt,
  };
}

async function assertPlannedState(plan: GardenAccountRelayPlan): Promise<void> {
  const manager = new NetworkManager();
  const source = new JsonRpcProvider(manager.getRpcUrl("arbitrum"), SOURCE_CHAIN_ID, { staticNetwork: true });
  const celo = new JsonRpcProvider(manager.getRpcUrl("celo"), CELO_CHAIN_ID, { staticNetwork: true });
  const [routerCode, relayCode, relayTrusted] = await Promise.all([
    source.getCode(plan.router.address, plan.source.finalizedBlock),
    celo.getCode(plan.relay.address, plan.destination.finalizedBlock),
    new Contract(GUARDIAN, GUARDIAN_INTERFACE, celo).isTrustedExecutor(plan.relay.address, {
      blockTag: plan.destination.finalizedBlock,
    }) as Promise<boolean>,
  ]);
  if (routerCode !== "0x" || relayCode !== "0x" || relayTrusted) {
    throw new Error("Router/relay deterministic addresses or Guardian trust are not inert at the planned snapshot");
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(args);
  const reviewed =
    options.command === "verify" && fs.existsSync(options.planPath)
      ? readJson<GardenAccountRelayPlan>(options.planPath)
      : undefined;
  if (options.command === "verify" && !reviewed) throw new Error(`Reviewed plan is missing: ${options.planPath}`);
  const inputs = await liveInputs(
    options.safePlanPath,
    reviewed
      ? {
          sourceBlock: reviewed.source.finalizedBlock,
          celoBlock: reviewed.destination.finalizedBlock,
          generatedAt: reviewed.generatedAt,
        }
      : undefined,
  );
  const expected = buildDeterministicRelayPlan(inputs);
  await assertPlannedState(expected);
  if (options.command === "plan") {
    atomicWrite(options.planPath, expected);
    console.log(`Wrote inert four-step relay plan: ${options.planPath}`);
    console.log("No transaction was signed or broadcast. Each later step requires the reviewed prior receipt.");
    return;
  }
  validatePlan(reviewed as GardenAccountRelayPlan, expected);
  console.log("GardenAccount relay plan matches finalized chain state, artifacts, nonces, and all 18 Safe bindings.");
  console.log("No transaction was signed or broadcast.");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
