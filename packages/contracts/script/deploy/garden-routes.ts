#!/usr/bin/env bun

/**
 * Plans and executes the Garden route lane: the eighteen `configureGardenRoute` calls that bind each
 * Garden to its Safe and Roles modifier on the live CeloSettlementExecutor.
 *
 * This is the last irreversible step of the Celo settlement ceremony and the only one with no undo.
 * `configureGardenRoute` is write-once per Garden and per Safe — the executor refuses a second
 * configuration for either — so a route committed against a half-finished Roles ceremony can never
 * be repointed. `setGardenRouteActive` can only deactivate what is already recorded.
 *
 * The executor validates the modifier side of the binding itself (avatar, target, executor
 * membership, default role, and that the executor is not a Safe owner) but cannot see whether the
 * Safe ever enabled the modifier, so a Safe that skipped its enable boundary would still accept a
 * permanently dead route. Every precondition below is therefore checked against live chain state
 * immediately before the boundary broadcasts, not merely reported at plan time.
 *
 * Read-only without `--broadcast`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { Contract, getAddress, Interface, JsonRpcProvider, keccak256, toUtf8Bytes, ZeroAddress } from "ethers";

import { execCastCaptured, parseCastTransactionHash } from "../utils/cast-env";
import { NetworkManager } from "../utils/network";
import { assertReleaseOperatorSession, resolveCheckoutCommit } from "../utils/release-session";
import {
  ALLOWANCE_KEY,
  assertRegisteredSafes,
  buildTransferConditions,
  MAX_PERIOD_AMOUNT,
  modifierSaltNonce,
  PERIOD_DURATION,
  permissionsConfigHash,
  predictModifier,
  ROLE_KEY,
  rolesInitializer,
} from "./garden-roles";

const CONTRACTS_ROOT = path.join(__dirname, "../..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
const RUNTIME_ROOT = path.join(CONTRACTS_ROOT, ".generated/runtime");
const DEFAULT_SAFE_PLAN = path.join(RUNTIME_ROOT, "42220-garden-safe-final.json");
const DEFAULT_PLAN = path.join(RUNTIME_ROOT, "42220-garden-routes.json");
const SETTLEMENT_SAFES = path.join(CONTRACTS_ROOT, "deployments/42220-settlement-safes.json");
const CELO_DEPLOYMENTS = path.join(CONTRACTS_ROOT, "deployments/42220-latest.json");

const CELO_CHAIN_ID = 42_220;
const EXPECTED_GARDEN_COUNT = 18;
const DEPLOYMENT_OPERATOR = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";

const EXECUTOR_INTERFACE = new Interface([
  "function configureGardenRoute(address garden, address safe, address rolesModifier, bytes32 roleKey, bytes32 allowanceKey, bytes32 permissionsConfigHash)",
  "function gardenRouteOf(address garden) view returns (tuple(address safe,address rolesModifier,bytes32 roleKey,bytes32 allowanceKey,bytes32 permissionsConfigHash,bool active))",
  "function safeToGarden(address safe) view returns (address)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
]);
const ROLES_INTERFACE = new Interface([
  "function owner() view returns (address)",
  "function avatar() view returns (address)",
  "function target() view returns (address)",
  "function isModuleEnabled(address module) view returns (bool)",
  "function defaultRoles(address module) view returns (bytes32)",
  "function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint64 timestamp, uint128 balance)",
]);
const SAFE_INTERFACE = new Interface([
  "function isModuleEnabled(address module) view returns (bool)",
  "function isOwner(address owner) view returns (bool)",
]);

dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

interface SafePlanEntry {
  tokenId: number;
  garden: string;
  safe: string;
}

export interface PlannedRoute {
  step: number;
  tokenId: number;
  garden: string;
  safe: string;
  modifier: string;
  permissionsConfigHash: string;
  to: string;
  value: "0";
  data: string;
}

export interface GardenRoutesPlan {
  schemaVersion: 1;
  kind: "GARDEN_ROUTES_PLAN";
  chainId: 42220;
  generatedAt: string;
  executor: string;
  executorOwner: string;
  roleKey: string;
  allowanceKey: string;
  writeOnce: true;
  transactions: PlannedRoute[];
  blockers: string[];
  releaseGate: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

/** Read from the deployment artifact rather than hardcoded, so a redeploy cannot silently diverge. */
function celoSettlementExecutor(): string {
  const deployments = readJson<{ celoSettlementExecutor?: string }>(CELO_DEPLOYMENTS);
  const executor = deployments.celoSettlementExecutor;
  if (!executor || executor === ZeroAddress) {
    throw new Error("deployments/42220-latest.json does not record celoSettlementExecutor");
  }
  return getAddress(executor);
}

/**
 * The permission hash the route commits to is re-derived here from the same inputs the Roles planner
 * used, rather than read from its plan artifact. A route recorded against a hash that no longer
 * matches the reviewed tree would be indistinguishable on chain from a correct one.
 */
export function routePermissionsHash(safe: string, rolesModifier: string): string {
  return permissionsConfigHash(safe, rolesModifier, buildTransferConditions());
}

export function buildRouteTransactions(entries: readonly SafePlanEntry[], executor: string): PlannedRoute[] {
  return entries.map((entry, index) => {
    const safe = getAddress(entry.safe);
    const rolesModifier = predictModifier(rolesInitializer(DEPLOYMENT_OPERATOR, safe), modifierSaltNonce(safe));
    const hash = routePermissionsHash(safe, rolesModifier);
    return {
      step: index + 1,
      tokenId: entry.tokenId,
      garden: getAddress(entry.garden),
      safe,
      modifier: rolesModifier,
      permissionsConfigHash: hash,
      to: getAddress(executor),
      value: "0" as const,
      data: EXECUTOR_INTERFACE.encodeFunctionData("configureGardenRoute", [
        getAddress(entry.garden),
        safe,
        rolesModifier,
        ROLE_KEY,
        ALLOWANCE_KEY,
        hash,
      ]),
    };
  });
}

async function buildPlan(safePlanPath: string): Promise<GardenRoutesPlan> {
  const safePlan = readJson<{ entries: SafePlanEntry[] }>(safePlanPath);
  if (!Array.isArray(safePlan.entries)) throw new Error(`Safe plan ${safePlanPath} has no entries array`);
  const blockers: string[] = [];
  if (safePlan.entries.length !== EXPECTED_GARDEN_COUNT) {
    blockers.push(`Safe plan lists ${safePlan.entries.length} Gardens, expected ${EXPECTED_GARDEN_COUNT}`);
  }
  assertRegisteredSafes(safePlan.entries, SETTLEMENT_SAFES);

  const executor = celoSettlementExecutor();
  const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("celo"), CELO_CHAIN_ID, {
    staticNetwork: true,
  });
  const executorContract = new Contract(executor, EXECUTOR_INTERFACE, provider);

  const owner = getAddress((await executorContract.owner()) as string);
  if (owner !== getAddress(DEPLOYMENT_OPERATOR)) {
    blockers.push(`Executor is owned by ${owner}, not the release operator`);
  }
  if (!((await executorContract.paused()) as boolean)) {
    blockers.push("Executor is not paused; configureGardenRoute requires pause");
  }

  const transactions = buildRouteTransactions(safePlan.entries, executor);
  for (const transaction of transactions) {
    blockers.push(...(await routeReadiness(transaction, executor, provider)));
  }

  return {
    schemaVersion: 1,
    kind: "GARDEN_ROUTES_PLAN",
    chainId: CELO_CHAIN_ID,
    generatedAt: new Date().toISOString(),
    executor,
    executorOwner: owner,
    roleKey: ROLE_KEY,
    allowanceKey: ALLOWANCE_KEY,
    writeOnce: true,
    transactions,
    blockers,
    releaseGate:
      "Routes bind live G$ authority to each Garden Safe and cannot be repointed once written; the " +
      "value-tier gate and a completed, verified Roles ceremony both apply.",
  };
}

/** Everything the readiness policy needs, read once so the policy itself stays pure and testable. */
export interface RouteObservations {
  modifierDeployed: boolean;
  avatar: string;
  target: string;
  modifierOwner: string;
  executorIsRolesMember: boolean;
  executorDefaultRole: string;
  allowanceRefill: bigint;
  allowancePeriod: bigint;
  modifierEnabledOnSafe: boolean;
  executorIsSafeOwner: boolean;
  existingRouteSafe: string;
  safeAssignedToGarden: string;
}

/**
 * The complete readiness of one Garden, expressed as findings rather than thrown errors so a plan can
 * report every unfinished Garden at once instead of stopping at the first.
 *
 * `modifierEnabledOnSafe` is the check the executor itself cannot make: `configureGardenRoute`
 * validates the modifier's view of the Safe but has no way to see whether the Safe ever enabled the
 * modifier, so a Garden that skipped its enable boundary would otherwise commit a permanently dead
 * route. Everything else duplicates a guard the executor already enforces, which is deliberate:
 * reaching a revert on a write-once boundary costs a broadcast and leaves this lane's checkpoint and
 * the chain disagreeing about how far the ceremony got.
 */
export function evaluateRouteReadiness(transaction: PlannedRoute, observed: RouteObservations): string[] {
  const label = `Garden ${transaction.tokenId}`;
  if (!observed.modifierDeployed) {
    return [`${label}: modifier ${transaction.modifier} is not deployed; the Roles stage is unfinished`];
  }

  const findings: string[] = [];
  if (getAddress(observed.avatar) !== transaction.safe)
    findings.push(`${label}: modifier avatar is ${observed.avatar}`);
  if (getAddress(observed.target) !== transaction.safe)
    findings.push(`${label}: modifier target is ${observed.target}`);
  if (getAddress(observed.modifierOwner) !== transaction.safe) {
    findings.push(
      `${label}: modifier is owned by ${observed.modifierOwner}, not its Safe; ownership has not transferred`,
    );
  }
  if (!observed.executorIsRolesMember) findings.push(`${label}: executor is not a Roles member`);
  if (observed.executorDefaultRole !== ROLE_KEY) {
    findings.push(`${label}: executor default role is ${observed.executorDefaultRole}, not the reviewed role key`);
  }
  if (observed.allowanceRefill !== MAX_PERIOD_AMOUNT || observed.allowancePeriod !== PERIOD_DURATION) {
    findings.push(`${label}: allowance does not match the frozen period cap`);
  }
  if (!observed.modifierEnabledOnSafe) {
    findings.push(`${label}: Safe has not enabled the modifier; the enable stage is unfinished for this Garden`);
  }
  if (observed.executorIsSafeOwner) findings.push(`${label}: executor is a Safe owner, which the route forbids`);
  if (getAddress(observed.existingRouteSafe) !== ZeroAddress) {
    findings.push(
      `${label}: route is already configured against ${observed.existingRouteSafe} and cannot be rewritten`,
    );
  }
  if (getAddress(observed.safeAssignedToGarden) !== ZeroAddress) {
    findings.push(`${label}: Safe is already assigned to Garden ${observed.safeAssignedToGarden}`);
  }
  return findings;
}

async function readRouteState(
  transaction: PlannedRoute,
  executor: string,
  provider: JsonRpcProvider,
): Promise<RouteObservations> {
  const empty: RouteObservations = {
    modifierDeployed: false,
    avatar: ZeroAddress,
    target: ZeroAddress,
    modifierOwner: ZeroAddress,
    executorIsRolesMember: false,
    executorDefaultRole: `0x${"00".repeat(32)}`,
    allowanceRefill: 0n,
    allowancePeriod: 0n,
    modifierEnabledOnSafe: false,
    executorIsSafeOwner: false,
    existingRouteSafe: ZeroAddress,
    safeAssignedToGarden: ZeroAddress,
  };
  if ((await provider.getCode(transaction.modifier, "latest")) === "0x") return empty;

  const roles = new Contract(transaction.modifier, ROLES_INTERFACE, provider);
  const safe = new Contract(transaction.safe, SAFE_INTERFACE, provider);
  const executorContract = new Contract(executor, EXECUTOR_INTERFACE, provider);
  const [
    avatar,
    target,
    modifierOwner,
    member,
    defaultRole,
    allowance,
    enabledOnSafe,
    executorIsOwner,
    route,
    assigned,
  ] = await Promise.all([
    roles.avatar() as Promise<string>,
    // `target` collides with ethers' Contract.target property, so resolve the function explicitly.
    roles.getFunction("target").staticCall() as Promise<string>,
    roles.owner() as Promise<string>,
    roles.isModuleEnabled(executor) as Promise<boolean>,
    roles.defaultRoles(executor) as Promise<string>,
    roles.allowances(ALLOWANCE_KEY) as unknown as Promise<bigint[]>,
    safe.isModuleEnabled(transaction.modifier) as Promise<boolean>,
    safe.isOwner(executor) as Promise<boolean>,
    executorContract.gardenRouteOf(transaction.garden) as unknown as Promise<{ safe: string }>,
    executorContract.safeToGarden(transaction.safe) as Promise<string>,
  ]);

  return {
    modifierDeployed: true,
    avatar,
    target,
    modifierOwner,
    executorIsRolesMember: member,
    executorDefaultRole: defaultRole,
    allowanceRefill: allowance[0],
    allowancePeriod: allowance[2],
    modifierEnabledOnSafe: enabledOnSafe,
    executorIsSafeOwner: executorIsOwner,
    existingRouteSafe: route.safe,
    safeAssignedToGarden: assigned,
  };
}

async function routeReadiness(
  transaction: PlannedRoute,
  executor: string,
  provider: JsonRpcProvider,
): Promise<string[]> {
  return evaluateRouteReadiness(transaction, await readRouteState(transaction, executor, provider));
}

export interface RoutesCliOptions {
  command: "plan" | "verify" | "configure";
  safePlanPath: string;
  planPath: string;
  broadcast: boolean;
  step?: number;
}

export function parseArguments(args: string[]): RoutesCliOptions {
  const command = args[0] as RoutesCliOptions["command"] | undefined;
  if (!command || !["plan", "verify", "configure"].includes(command)) {
    throw new Error(
      "Use: garden-routes.ts plan|verify|configure [--safe-plan <path>] [--plan <path>] [--broadcast --step <n>]",
    );
  }
  let safePlanPath = DEFAULT_SAFE_PLAN;
  let planPath = DEFAULT_PLAN;
  let broadcast = false;
  let step: number | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--broadcast") {
      broadcast = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    index += 1;
    if (key === "--safe-plan") safePlanPath = value;
    else if (key === "--plan") planPath = value;
    else if (key === "--step") {
      step = Number(value);
      if (!Number.isInteger(step) || step < 1) throw new Error("--step must be a positive boundary index");
    } else throw new Error(`Unknown argument: ${key}`);
  }
  if (command === "configure") {
    if (!broadcast) throw new Error("configure requires --broadcast");
    if (step === undefined) throw new Error("configure requires one explicit --step boundary");
  } else if (broadcast || step !== undefined) {
    throw new Error(`${command} does not accept --broadcast or --step`);
  }
  return { command, safePlanPath, planPath, broadcast, step };
}

export interface RoutesCheckpointEntry {
  step: number;
  garden: string;
  safe: string;
  transactionHash: string;
  blockNumber: number;
}

export interface RoutesCheckpoint {
  schemaVersion: 1;
  planHash: string;
  completed: RoutesCheckpointEntry[];
}

function checkpointPath(planPath: string): string {
  return planPath.replace(/\.json$/u, ".checkpoint.json");
}

/** Regenerating the plan after a written route must stop the lane, not resume against new addresses. */
export function loadRoutesCheckpoint(planPath: string): RoutesCheckpoint {
  const filePath = checkpointPath(planPath);
  const planHash = keccak256(toUtf8Bytes(fs.readFileSync(planPath, "utf8")));
  if (!fs.existsSync(filePath)) return { schemaVersion: 1, planHash, completed: [] };
  const checkpoint = readJson<RoutesCheckpoint>(filePath);
  if (checkpoint.schemaVersion !== 1 || checkpoint.planHash !== planHash) {
    throw new Error("Checkpoint does not belong to the exact reviewed route plan");
  }
  for (const [offset, entry] of checkpoint.completed.entries()) {
    if (entry.step !== offset + 1) throw new Error("Checkpoint must be a contiguous boundary prefix");
  }
  return checkpoint;
}

export function assertNextRouteBoundary(selected: number, completed: number): number {
  const nextBoundary = completed + 1;
  if (selected !== nextBoundary) {
    throw new Error(`Route configuration must target the next uncheckpointed boundary ${nextBoundary}`);
  }
  return selected;
}

/** A plan that still reports an observable chain-state problem must never broadcast. */
export function assertPlanUnblocked(blockers: readonly string[]): void {
  if (blockers.length > 0) throw new Error(`Route plan is blocked: ${blockers.join("; ")}`);
}

function credentialArgs(): string[] {
  assertReleaseOperatorSession(resolveCheckoutCommit(REPOSITORY_ROOT));
  const passwordFile = process.env.ETH_PASSWORD;
  if (!passwordFile || !fs.existsSync(passwordFile)) {
    throw new Error("Broadcast requires the release operator's temporary ETH_PASSWORD file");
  }
  return ["--account", process.env.FOUNDRY_KEYSTORE_ACCOUNT ?? "green-goods-deployer", "--password-file", passwordFile];
}

export async function executeRouteBoundary(plan: GardenRoutesPlan, step: number, planPath: string): Promise<void> {
  const transaction = plan.transactions[step - 1];
  if (!transaction || transaction.step !== step) throw new Error(`Reviewed plan has no boundary ${step}`);
  const checkpoint = loadRoutesCheckpoint(planPath);
  assertNextRouteBoundary(step, checkpoint.completed.length);

  const manager = new NetworkManager();
  const rpcUrl = manager.getRpcUrl("celo");
  const provider = new JsonRpcProvider(rpcUrl, CELO_CHAIN_ID, { staticNetwork: true });

  // Re-checked against live state rather than trusted from the plan: this boundary cannot be undone,
  // and the plan may have been generated before the enable stage finished.
  const executorContract = new Contract(plan.executor, EXECUTOR_INTERFACE, provider);
  if (!((await executorContract.paused()) as boolean)) {
    throw new Error("Executor is not paused; configureGardenRoute requires pause");
  }
  if (getAddress((await executorContract.owner()) as string) !== getAddress(DEPLOYMENT_OPERATOR)) {
    throw new Error("Executor owner is not the release operator");
  }
  const findings = await routeReadiness(transaction, plan.executor, provider);
  if (findings.length > 0) throw new Error(`Boundary ${step} is not ready: ${findings.join("; ")}`);

  const output = execCastCaptured(
    [
      "send",
      transaction.to,
      "--data",
      transaction.data,
      "--value",
      "0",
      "--chain",
      String(CELO_CHAIN_ID),
      "--rpc-url",
      rpcUrl,
      ...credentialArgs(),
      "--json",
    ],
    { cwd: CONTRACTS_ROOT, env: process.env },
    "CONFIGURE_GARDEN_ROUTE",
  );
  const transactionHash = parseCastTransactionHash(output, "CONFIGURE_GARDEN_ROUTE");
  const receipt = await provider.waitForTransaction(transactionHash, 1, 180_000);
  if (!receipt || receipt.status !== 1) throw new Error("configureGardenRoute did not produce a successful receipt");
  const sent = await provider.getTransaction(transactionHash);
  if (
    !sent ||
    getAddress(sent.from) !== getAddress(DEPLOYMENT_OPERATOR) ||
    getAddress(sent.to ?? ZeroAddress) !== getAddress(transaction.to) ||
    sent.data !== transaction.data ||
    sent.value !== 0n
  ) {
    throw new Error("configureGardenRoute receipt does not match the reviewed boundary");
  }

  const route = (await executorContract.gardenRouteOf(transaction.garden)) as unknown as {
    safe: string;
    rolesModifier: string;
    roleKey: string;
    allowanceKey: string;
    permissionsConfigHash: string;
    active: boolean;
  };
  if (
    getAddress(route.safe) !== transaction.safe ||
    getAddress(route.rolesModifier) !== transaction.modifier ||
    route.roleKey !== ROLE_KEY ||
    route.allowanceKey !== ALLOWANCE_KEY ||
    route.permissionsConfigHash !== transaction.permissionsConfigHash ||
    !route.active
  ) {
    throw new Error("Recorded route does not match the reviewed boundary");
  }

  checkpoint.completed.push({
    step,
    garden: transaction.garden,
    safe: transaction.safe,
    transactionHash,
    blockNumber: receipt.blockNumber,
  });
  atomicWrite(checkpointPath(planPath), checkpoint);
  process.stdout.write(
    `Route boundary ${step}/${plan.transactions.length} for Garden ${transaction.tokenId} verified as ${transactionHash}; close the credential session.\n`,
  );
}

/** Reads back every recorded route, so a finished lane can be proven without re-broadcasting. */
export async function verifyConfiguredRoutes(plan: GardenRoutesPlan): Promise<void> {
  const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("celo"), CELO_CHAIN_ID, {
    staticNetwork: true,
  });
  const executorContract = new Contract(plan.executor, EXECUTOR_INTERFACE, provider);
  const failures: string[] = [];
  for (const transaction of plan.transactions) {
    const route = (await executorContract.gardenRouteOf(transaction.garden)) as unknown as {
      safe: string;
      rolesModifier: string;
      roleKey: string;
      allowanceKey: string;
      permissionsConfigHash: string;
      active: boolean;
    };
    if (getAddress(route.safe) === ZeroAddress) {
      failures.push(`Garden ${transaction.tokenId}: no route recorded`);
      continue;
    }
    if (getAddress(route.safe) !== transaction.safe) failures.push(`Garden ${transaction.tokenId}: Safe mismatch`);
    if (getAddress(route.rolesModifier) !== transaction.modifier) {
      failures.push(`Garden ${transaction.tokenId}: modifier mismatch`);
    }
    if (route.roleKey !== ROLE_KEY) failures.push(`Garden ${transaction.tokenId}: role key mismatch`);
    if (route.allowanceKey !== ALLOWANCE_KEY) failures.push(`Garden ${transaction.tokenId}: allowance key mismatch`);
    if (route.permissionsConfigHash !== transaction.permissionsConfigHash) {
      failures.push(`Garden ${transaction.tokenId}: permissions hash mismatch`);
    }
    if (!route.active) failures.push(`Garden ${transaction.tokenId}: route is inactive`);
  }
  if (failures.length > 0) throw new Error(`Route verification failed: ${failures.join("; ")}`);
  process.stdout.write(`All ${plan.transactions.length} Garden routes match the reviewed plan.\n`);
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  if (options.command === "verify") {
    if (!fs.existsSync(options.planPath)) throw new Error(`Reviewed plan is missing: ${options.planPath}`);
    await verifyConfiguredRoutes(readJson<GardenRoutesPlan>(options.planPath));
    return;
  }

  if (options.command === "configure") {
    if (!fs.existsSync(options.planPath)) throw new Error(`Reviewed plan is missing: ${options.planPath}`);
    const plan = readJson<GardenRoutesPlan>(options.planPath);
    assertPlanUnblocked(plan.blockers);
    await executeRouteBoundary(plan, options.step as number, options.planPath);
    return;
  }

  const plan = await buildPlan(options.safePlanPath);
  atomicWrite(options.planPath, plan);
  process.stdout.write(
    `${JSON.stringify(
      {
        planPath: options.planPath,
        executor: plan.executor,
        boundaries: plan.transactions.length,
        blockers: plan.blockers,
      },
      null,
      2,
    )}\nNo transaction was signed or broadcast.\n`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
