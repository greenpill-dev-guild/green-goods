#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  AbiCoder,
  Contract,
  concat,
  getAddress,
  getCreate2Address,
  Interface,
  isAddress,
  JsonRpcProvider,
  keccak256,
  toQuantity,
  ZeroAddress,
} from "ethers";
import { redactRpcUrlsInText } from "../utils/cli-parser";
import { assertIsolatedRpc, minedIsolatedReceipt, startIsolatedFork } from "../utils/isolated-fork";
import { NetworkManager } from "../utils/network";
import { CONTRACTS_ROOT } from "../utils/paths";
import { writeReleaseJsonAtomic } from "../utils/release-artifacts";
import { releaseJsonPath, releaseRevision } from "../utils/release-inputs";

/**
 * Each garden's USDC reward Safe on Arbitrum One: one Zodiac factory call per garden creates a
 * locked Hats Signer Gate v2 and, through it, a Safe 1.4.1 whose signers are the garden's
 * stewards. One steward signs alone; once two hold seats, payments need two. Anyone may remove
 * a signer who no longer wears the steward hat. The operation plans the calls, rehearses them on
 * an owned fork, and after the deployer broadcasts them, verifies each gate and records it in
 * `deployments/42161-reward-safes.json`, which is what switches a garden's USDC part on.
 */
export const REWARD_SAFE_CHAIN_ID = 42_161;
export const HSG = {
  hats: "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
  hatsModule: "0x5b943088ecdDBF8E4ae387348A88A654aC5F7266",
  implementation: "0x148057884AC910Bdd93693F230C5c35a8c47CA3b",
  factory: "0x000000000000aDdB49795b0f9bA5BC298cDda236",
  safeSingleton: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
  fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
  /** The gate enables these three MultiSendCallOnly builds itself; none can delegatecall. */
  callOnlyTargets: [
    "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
    "0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B",
    "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
  ],
  /** MultiSend 1.4.1, which can delegatecall, must stay closed. */
  delegatingMultiSend: "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526",
} as const;
const SENTINEL = "0x0000000000000000000000000000000000000001";
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const FALLBACK_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
const SALT_DOMAIN = "GG_GARDEN_REWARD_SAFE_V1";
const RECORD = path.join(CONTRACTS_ROOT, "deployments/42161-reward-safes.json");
const LATEST = path.join(CONTRACTS_ROOT, "deployments/42161-latest.json");
const OUTPUT_DIRECTORY = path.join(CONTRACTS_ROOT, ".generated/reward-safes");

const SETUP_PARAMS =
  "tuple(uint256 ownerHat,uint256[] signerHats,address safe,tuple(uint8 thresholdType,uint120 min,uint120 target) thresholdConfig,bool locked,bool claimableFor,address implementation,address hsgGuard,address[] hsgModules)";
const GATE = new Interface(["function setUp(bytes initializeParams)"]);
const FACTORY = new Interface([
  "function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address)",
]);

export interface RewardSafeManifest {
  schemaVersion: 1;
  releaseId: string;
  chainId: 42161;
  deployer: string;
  gardens: Array<{ tokenId: number; garden: string }>;
}
export interface RewardSafeCall {
  tokenId: number;
  garden: string;
  ownerHat: string;
  signerHat: string;
  saltNonce: string;
  gate: string;
  to: string;
  value: "0";
  data: string;
}
export interface RewardSafePlan {
  schemaVersion: 1;
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  chainId: 42161;
  deployer: string;
  calls: RewardSafeCall[];
  liveBroadcast: false;
}
export interface RewardSafeEntry {
  tokenId: number;
  garden: string;
  safe: string;
  gate: string;
  signerHat: string;
}

const checksummed = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !isAddress(value) || getAddress(value) !== value || BigInt(value) <= 1n)
    throw new Error(`${label} must be a checksummed address`);
  return value;
};
const equal = (actual: unknown, expected: unknown, label: string) => {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`Reward Safe ${label} mismatch`);
};

export function inspectRewardSafeManifest(value: unknown): RewardSafeManifest {
  const root = value as Record<string, unknown>;
  if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("Invalid reward Safe manifest");
  const keys = ["schemaVersion", "releaseId", "chainId", "deployer", "gardens"];
  if (Object.keys(root).sort().join() !== [...keys].sort().join())
    throw new Error("Unexpected reward Safe manifest keys");
  if (root.schemaVersion !== 1 || root.chainId !== REWARD_SAFE_CHAIN_ID)
    throw new Error("Reward Safes are planned for Arbitrum One only");
  if (typeof root.releaseId !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(root.releaseId))
    throw new Error("Invalid reward Safe release id");
  checksummed(root.deployer, "deployer");
  if (!Array.isArray(root.gardens) || root.gardens.length === 0) throw new Error("Name at least one garden");
  const seenTokens = new Set<number>(),
    seenGardens = new Set<string>();
  for (const entry of root.gardens as Array<Record<string, unknown>>) {
    if (!entry || Object.keys(entry).sort().join() !== "garden,tokenId") throw new Error("Invalid garden entry");
    if (!Number.isSafeInteger(entry.tokenId) || (entry.tokenId as number) < 0)
      throw new Error("Invalid garden tokenId");
    const garden = checksummed(entry.garden, "garden").toLowerCase();
    if (seenTokens.has(entry.tokenId as number) || seenGardens.has(garden)) throw new Error("A garden is named twice");
    seenTokens.add(entry.tokenId as number);
    seenGardens.add(garden);
  }
  return root as unknown as RewardSafeManifest;
}

/** Each garden's own salt, so the gate's address follows from the garden and the exact setup. */
export function rewardSafeSaltNonce(garden: string): bigint {
  return BigInt(
    keccak256(
      AbiCoder.defaultAbiCoder().encode(["string", "uint256", "address"], [SALT_DOMAIN, REWARD_SAFE_CHAIN_ID, garden]),
    ),
  );
}

export function rewardSafeCall(tokenId: number, garden: string, ownerHat: bigint, signerHat: bigint): RewardSafeCall {
  if (ownerHat <= 0n || signerHat <= 0n || ownerHat === signerHat) throw new Error("Invalid garden hats");
  const params = AbiCoder.defaultAbiCoder().encode(
    [SETUP_PARAMS],
    [[ownerHat, [signerHat], ZeroAddress, [0, 1, 2], true, true, HSG.implementation, ZeroAddress, []]],
  );
  const initializer = GATE.encodeFunctionData("setUp", [params]);
  const saltNonce = rewardSafeSaltNonce(garden);
  const salt = keccak256(concat([keccak256(initializer), AbiCoder.defaultAbiCoder().encode(["uint256"], [saltNonce])]));
  const proxyCreation = concat([
    "0x602d8060093d393df3363d3d373d3d3d363d73",
    HSG.implementation,
    "0x5af43d82803e903d91602b57fd5bf3",
  ]);
  return {
    tokenId,
    garden,
    ownerHat: ownerHat.toString(),
    signerHat: signerHat.toString(),
    saltNonce: saltNonce.toString(),
    gate: getCreate2Address(HSG.factory, salt, keccak256(proxyCreation)),
    to: HSG.factory,
    value: "0",
    data: FACTORY.encodeFunctionData("deployModule", [HSG.implementation, initializer, saltNonce]),
  };
}

/** The EIP-1167 runtime the factory leaves at a gate; with CREATE2 it binds the exact setup. */
export function gateProxyRuntime(): string {
  return `0x363d3d373d3d3d363d73${HSG.implementation.slice(2)}5af43d82803e903d91602b57fd5bf3`.toLowerCase();
}

/**
 * Adds verified entries to the record. An entry never changes once written: its Safe may have
 * paid or received shares, so a garden already recorded must match exactly, and no Safe or gate
 * may serve two gardens.
 */
export function mergeRewardSafeRecord(
  record: Record<string, unknown>,
  entries: RewardSafeEntry[],
): Record<string, unknown> & { safes: RewardSafeEntry[] } {
  if (record.schemaVersion !== 2 || record.chainId !== REWARD_SAFE_CHAIN_ID || !Array.isArray(record.safes))
    throw new Error("Unexpected reward Safe record");
  const safes = [...(record.safes as RewardSafeEntry[])];
  const lower = (entry: RewardSafeEntry) => [entry.garden, entry.safe, entry.gate].map((a) => a.toLowerCase());
  const sameEntry = (a: RewardSafeEntry, b: RewardSafeEntry) =>
    a.tokenId === b.tokenId &&
    a.garden === b.garden &&
    a.safe === b.safe &&
    a.gate === b.gate &&
    a.signerHat === b.signerHat;
  for (const entry of entries) {
    const existing = safes.find((row) => row.garden.toLowerCase() === entry.garden.toLowerCase());
    if (existing) {
      if (!sameEntry(existing, entry))
        throw new Error(`Garden ${entry.garden} already has a different reward Safe recorded`);
      continue;
    }
    const used = safes.flatMap(lower);
    if (new Set(lower(entry)).size !== 3 || lower(entry).some((address) => used.includes(address)))
      throw new Error(`Garden ${entry.garden} would share a Safe or gate`);
    safes.push(entry);
  }
  return { ...record, safes: safes.sort((a, b) => a.tokenId - b.tokenId) };
}

async function readGarden(provider: JsonRpcProvider, tokenId: number, garden: string, gardenToken: string) {
  const account = new Contract(garden, ["function token() view returns (uint256,address,uint256)"], provider);
  const [chainId, tokenContract, id] = await account.token();
  equal(chainId, REWARD_SAFE_CHAIN_ID, `${garden} chain`);
  equal(tokenContract, gardenToken, `${garden} garden token`);
  equal(id, tokenId, `${garden} token id`);
  const hats = new Contract(
    HSG.hatsModule,
    ["function getGardenHatIds(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)"],
    provider,
  );
  const ids = await hats.getGardenHatIds(garden);
  if (!ids[7]) throw new Error(`Garden ${garden} has no configured hats`);
  return rewardSafeCall(tokenId, garden, ids[0] as bigint, ids[1] as bigint);
}

async function readGardens(provider: JsonRpcProvider, gardens: ReadonlyArray<{ tokenId: number; garden: string }>) {
  equal((await provider.getNetwork()).chainId, REWARD_SAFE_CHAIN_ID, "RPC chain");
  const impl = new Contract(HSG.implementation, ["function version() view returns (string)"], provider);
  equal(await impl.version(), "2.0.0", "Hats Signer Gate version");
  for (const address of [HSG.factory, HSG.hats, HSG.safeSingleton, HSG.fallbackHandler, ...HSG.callOnlyTargets])
    if ((await provider.getCode(address)) === "0x") throw new Error(`No code at ${address}`);
  const gardenToken = JSON.parse(readFileSync(LATEST, "utf8")).gardenToken as string;
  const calls = [];
  for (const { tokenId, garden } of gardens) calls.push(await readGarden(provider, tokenId, garden, gardenToken));
  return calls;
}

async function buildPlan(
  provider: JsonRpcProvider,
  manifest: RewardSafeManifest,
  manifestText: string,
  commit: string,
) {
  const calls = await readGardens(provider, manifest.gardens);
  const plan: RewardSafePlan = {
    schemaVersion: 1,
    releaseId: manifest.releaseId,
    sourceCommit: commit,
    manifestHash: createHash("sha256").update(manifestText).digest("hex"),
    chainId: REWARD_SAFE_CHAIN_ID,
    deployer: manifest.deployer,
    calls,
    liveBroadcast: false,
  };
  return plan;
}

/** Reads one gate and its Safe and checks every setting the plan promised. Returns the Safe. */
export async function inspectRewardSafe(provider: JsonRpcProvider, call: RewardSafeCall) {
  equal(await provider.getCode(call.gate), gateProxyRuntime(), `${call.garden} gate runtime`);
  const gate = new Contract(
    call.gate,
    [
      "function safe() view returns (address)",
      "function implementation() view returns (address)",
      "function locked() view returns (bool)",
      "function claimableFor() view returns (bool)",
      "function ownerHat() view returns (uint256)",
      "function isValidSignerHat(uint256) view returns (bool)",
      "function thresholdConfig() view returns ((uint8,uint120,uint120))",
      "function enabledDelegatecallTargets(address) view returns (bool)",
      "function getModulesPaginated(address,uint256) view returns (address[],address)",
      "function getGuard() view returns (address)",
    ],
    provider,
  );
  const safeAddress = getAddress(await gate.safe());
  equal(await gate.implementation(), HSG.implementation, "gate implementation");
  equal(await gate.locked(), true, "gate locked");
  equal(await gate.claimableFor(), true, "claims for others");
  equal(await gate.ownerHat(), call.ownerHat, "owner hat");
  equal(await gate.isValidSignerHat(call.signerHat), true, "steward hat");
  const [thresholdType, min, target] = await gate.thresholdConfig();
  equal(`${thresholdType}/${min}/${target}`, "0/1/2", "threshold");
  for (const target of HSG.callOnlyTargets)
    equal(await gate.enabledDelegatecallTargets(target), true, "call-only batch");
  equal(await gate.enabledDelegatecallTargets(HSG.delegatingMultiSend), false, "delegating MultiSend closed");
  const [gateModules] = await gate.getModulesPaginated(SENTINEL, 1);
  equal(gateModules.length, 0, "gate modules");
  equal(await gate.getGuard(), ZeroAddress, "gate guard");
  const safe = new Contract(
    safeAddress,
    [
      "function VERSION() view returns (string)",
      "function getModulesPaginated(address,uint256) view returns (address[],address)",
    ],
    provider,
  );
  equal(await safe.VERSION(), "1.4.1", "Safe version");
  const word = async (slot: string) => getAddress(`0x${(await provider.getStorage(safeAddress, slot)).slice(-40)}`);
  equal(await word("0x0"), HSG.safeSingleton, "Safe singleton");
  equal(await word(GUARD_SLOT), call.gate, "Safe guard");
  equal(await word(FALLBACK_SLOT), HSG.fallbackHandler, "Safe fallback handler");
  const [modules, next] = await safe.getModulesPaginated(SENTINEL, 2);
  equal(modules.join(), call.gate, "Safe modules");
  equal(next, SENTINEL, "end of Safe modules");
  return safeAddress;
}

async function simulate(plan: RewardSafePlan, upstream: string) {
  const fork = await startIsolatedFork(upstream, REWARD_SAFE_CHAIN_ID);
  assertIsolatedRpc(fork.rpc);
  const provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  try {
    // Only this owned loopback fork is impersonated and funded.
    await provider.send("anvil_impersonateAccount", [plan.deployer]);
    await provider.send("anvil_setBalance", [plan.deployer, toQuantity(10n ** 18n)]);
    const rows = [];
    for (const call of plan.calls) {
      equal(await provider.getCode(call.gate), "0x", `${call.garden} unused gate address`);
      const hash = await provider.send("eth_sendTransaction", [
        { from: plan.deployer, to: call.to, data: call.data, value: "0x0" },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      if (receipt.status !== 1) throw new Error(`Reward Safe deployment for ${call.garden} reverted`);
      const safe = await inspectRewardSafe(provider, call);
      const owners = await new Contract(safe, ["function getOwners() view returns (address[])"], provider).getOwners();
      const threshold = await new Contract(
        safe,
        ["function getThreshold() view returns (uint256)"],
        provider,
      ).getThreshold();
      equal(owners.join(), call.gate, "the gate holds the only seat until a steward claims one");
      equal(threshold, 1, "initial threshold");
      rows.push({
        tokenId: call.tokenId,
        garden: call.garden,
        gate: call.gate,
        safe,
        gasUsed: String(receipt.gasUsed),
      });
    }
    return { forkBlock: fork.forkBlock, forkBlockHash: fork.forkBlockHash, rows };
  } finally {
    provider.destroy();
    await fork.stop();
  }
}

async function main() {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      "plan-only": { type: "boolean" },
      simulate: { type: "boolean" },
      verify: { type: "boolean" },
      manifest: { type: "string" },
      plan: { type: "string" },
      output: { type: "string" },
    },
  });
  const modes = [values["plan-only"], values.simulate, values.verify].filter(Boolean).length;
  if (
    modes !== 1 ||
    (values["plan-only"] && values.plan) ||
    (!values["plan-only"] && !values.plan) ||
    (values.verify && values.output)
  )
    throw new Error("Select one reward Safe mode: --plan-only, --simulate --plan <file> or --verify --plan <file>");
  const manifestPath = releaseJsonPath(
    path.join(CONTRACTS_ROOT, "config"),
    values.manifest ?? "config/reward-safes-release.json",
  );
  const upstream = new NetworkManager().getRpcUrl("arbitrum");
  const provider = new JsonRpcProvider(upstream);
  try {
    if (values.verify) {
      // A broadcast gate is checked against what its garden's hats give now, not against a commit:
      // its CREATE2 address already binds the exact setup it was created with.
      const input = JSON.parse(readFileSync(releaseJsonPath(OUTPUT_DIRECTORY, values.plan!), "utf8")) as RewardSafePlan;
      const calls = await readGardens(
        provider,
        input.calls.map(({ tokenId, garden }) => ({ tokenId, garden })),
      );
      if (JSON.stringify(calls) !== JSON.stringify(input.calls))
        throw new Error("The plan's gates no longer match their gardens' hats");
      const entries: RewardSafeEntry[] = [];
      for (const call of calls) {
        const safe = await inspectRewardSafe(provider, call);
        entries.push({
          tokenId: call.tokenId,
          garden: call.garden,
          safe,
          gate: getAddress(call.gate),
          signerHat: call.signerHat,
        });
      }
      if (!existsSync(RECORD)) throw new Error("Missing reward Safe record");
      writeReleaseJsonAtomic(RECORD, mergeRewardSafeRecord(JSON.parse(readFileSync(RECORD, "utf8")), entries));
      console.log(
        JSON.stringify({ state: "verified", record: path.relative(CONTRACTS_ROOT, RECORD), entries }, null, 2),
      );
      return;
    }
    const commit = releaseRevision(CONTRACTS_ROOT, manifestPath);
    const manifestText = readFileSync(manifestPath, "utf8");
    const plan = await buildPlan(provider, inspectRewardSafeManifest(JSON.parse(manifestText)), manifestText, commit);
    if (values["plan-only"]) {
      const output = releaseJsonPath(
        OUTPUT_DIRECTORY,
        values.output ?? `.generated/reward-safes/${plan.releaseId}.plan.json`,
      );
      writeReleaseJsonAtomic(output, plan);
      const pending: RewardSafeCall[] = [];
      for (const call of plan.calls) if ((await provider.getCode(call.gate)) === "0x") pending.push(call);
      console.log(
        JSON.stringify(
          {
            state: "planned",
            output: path.relative(CONTRACTS_ROOT, output),
            broadcastBy: plan.deployer,
            calls: pending.map((call) => ({
              tokenId: call.tokenId,
              garden: call.garden,
              gate: call.gate,
              command: `cast send ${call.to} ${call.data} --rpc-url "$ARBITRUM_RPC_URL" --account green-goods-deployer`,
            })),
            alreadyDeployed: plan.calls.filter((call) => !pending.includes(call)).map((call) => call.gate),
            liveBroadcast: false,
          },
          null,
          2,
        ),
      );
      return;
    }
    const input = JSON.parse(readFileSync(releaseJsonPath(OUTPUT_DIRECTORY, values.plan!), "utf8"));
    if (JSON.stringify(input) !== JSON.stringify(plan))
      throw new Error("The plan no longer matches the committed manifest and live garden hats; plan again");
    const result = await simulate(plan, upstream);
    const output = releaseJsonPath(
      OUTPUT_DIRECTORY,
      values.output ?? `.generated/reward-safes/${plan.releaseId}.simulation.json`,
    );
    writeReleaseJsonAtomic(output, {
      sourceCommit: commit,
      releaseId: plan.releaseId,
      ...result,
      liveBroadcast: false,
    });
    console.log(
      JSON.stringify({ state: "simulated", output: path.relative(CONTRACTS_ROOT, output), rows: result.rows }, null, 2),
    );
  } finally {
    provider.destroy();
  }
}

if (import.meta.main)
  main().catch((error) => {
    console.error(redactRpcUrlsInText(error instanceof Error ? error.message : "Reward Safe release failed"));
    process.exitCode = 1;
  });
