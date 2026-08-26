#!/usr/bin/env bun

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import * as dotenv from "dotenv";
import { getAddress, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import {
  buildFinalDeploymentArtifact,
  type Checkpoint,
  type FinalSafePlan,
  validateFinalSafePlan,
} from "./deploy/garden-safe-owners";
import { buildReleaseLock, loadReleaseManifest, type ReleaseLock, type ReleaseStage } from "./utils/release-manifest";
import { NetworkManager } from "./utils/network";

const CONTRACTS_ROOT = path.join(__dirname, "..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

const RELEASE_ARTIFACT_MUTATIONS = new Set([
  "packages/contracts/deployments/42161-latest.json",
  "packages/contracts/deployments/42220-latest.json",
]);
const GARDEN_SAFE_ARTIFACT_PATH = "packages/contracts/deployments/42220-settlement-safes.json";
const GARDEN_SAFE_ARTIFACT_MUTATIONS = new Set([GARDEN_SAFE_ARTIFACT_PATH]);
const RELAY_ARTIFACT_MUTATIONS = new Set(["packages/contracts/deployments/garden-account-relay.json"]);
const INTERACTIVE_ARTIFACT_MUTATIONS = new Set([
  ...RELEASE_ARTIFACT_MUTATIONS,
  ...GARDEN_SAFE_ARTIFACT_MUTATIONS,
  ...RELAY_ARTIFACT_MUTATIONS,
]);

export const RELEASE_OPERATOR_COMMANDS = new Map<string, string>([
  ["release:ownership:arbitrum", "one protocol ownership-transfer boundary"],
  ["settlement:garden-accounts:deploy:celo", "one exact GardenAccount coordinator boundary"],
  ["settlement:garden-safes:deploy:celo", "one final native/G$-clear 2-of-3 Garden Safe boundary"],
  ["settlement:garden-relay:deploy", "one zero-value Garden-bound relay boundary"],
  ["settlement:garden-roles:deploy", "one zero-value Roles modifier configuration boundary"],
  ["settlement:garden-roles:enable", "one pre-approved Garden Safe module enable boundary"],
  ["settlement:garden-routes:configure", "one write-once Garden route boundary on the settlement executor"],
] as const);

const FORBIDDEN_ARGUMENTS = new Set([
  "--account",
  "--keystore",
  "--network",
  "--password",
  "--password-file",
  "--private-key",
  "--rpc-url",
  "--sender",
]);

const RELEASE_OPERATOR_ARGUMENTS = new Map<string, ReadonlySet<string>>([
  ["release:ownership:arbitrum", new Set(["--step", "--expected-nonce"])],
  ["settlement:garden-accounts:deploy:celo", new Set(["--plan", "--step", "--receipt"])],
  ["settlement:garden-safes:deploy:celo", new Set(["--plan", "--inventory", "--step", "--receipt"])],
  ["settlement:garden-relay:deploy", new Set(["--plan", "--safe-plan", "--step", "--receipt"])],
  ["settlement:garden-roles:deploy", new Set(["--plan", "--safe-plan", "--broadcast", "--step"])],
  ["settlement:garden-roles:enable", new Set(["--plan", "--broadcast", "--step"])],
  ["settlement:garden-routes:configure", new Set(["--plan", "--safe-plan", "--broadcast", "--step"])],
]);

/**
 * A ceremony stage is the complete, ordered boundary set for one release lane. Running a stage
 * keeps the single-boundary safety properties — the checkout is reasserted before and after every
 * boundary, and the first failure stops the run — while charging the operator one password entry
 * for the lane instead of one per boundary.
 */
export type CeremonyStage =
  | "ownership-arbitrum"
  | "garden-accounts"
  | "garden-safes"
  | "relay"
  | "garden-roles"
  | "garden-roles-enable"
  | "garden-routes";

export const CEREMONY_STAGES = new Map<CeremonyStage, { script: string; boundaries: number; label: string }>([
  [
    "ownership-arbitrum",
    {
      script: "release:ownership:arbitrum",
      boundaries: 8,
      label: "Arbitrum protocol ownership handover",
    },
  ],
  [
    "garden-accounts",
    {
      script: "settlement:garden-accounts:deploy:celo",
      boundaries: 2,
      label: "exact Celo GardenAccount coordinator and atomic initialization",
    },
  ],
  [
    "garden-safes",
    {
      script: "settlement:garden-safes:deploy:celo",
      boundaries: 18,
      label: "final 2-of-3 Garden Safes",
    },
  ],
  [
    "relay",
    {
      script: "settlement:garden-relay:deploy",
      boundaries: 4,
      label: "Garden-bound relay router, relay, destination binding, and Guardian trust",
    },
  ],
  [
    "garden-roles",
    {
      script: "settlement:garden-roles:deploy",
      boundaries: 126,
      label: "Roles modifier deployment, scoping, allowance, executor assignment, and ownership transfer",
    },
  ],
  [
    "garden-roles-enable",
    {
      script: "settlement:garden-roles:enable",
      boundaries: 18,
      label: "pre-approved Garden Safe module enables",
    },
  ],
  [
    "garden-routes",
    {
      script: "settlement:garden-routes:configure",
      boundaries: 18,
      label: "write-once Garden route bindings on the settlement executor",
    },
  ],
]);

export interface SessionOptions {
  commit?: string;
  stage?: CeremonyStage;
  help: boolean;
}

export interface PasswordLease {
  filePath: string;
  close: () => void;
}

export function parseSessionOptions(args: string[]): SessionOptions {
  const options: SessionOptions = { help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--commit") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) throw new Error("--commit requires an exact 40-character commit");
      options.commit = value;
      index += 1;
      continue;
    }
    if (argument === "--stage") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`--stage requires one of: ${[...CEREMONY_STAGES.keys()].join(", ")}`);
      }
      if (!CEREMONY_STAGES.has(value as CeremonyStage)) {
        throw new Error(`Unknown release ceremony stage: ${value}`);
      }
      options.stage = value as CeremonyStage;
      index += 1;
      continue;
    }
    throw new Error(`Unknown release operator option: ${argument}`);
  }
  if (!options.help && (!options.commit || !/^[0-9a-f]{40}$/u.test(options.commit))) {
    throw new Error("Release operator session requires --commit <exact-40-character-candidate>");
  }
  return options;
}

export function tokenizeOperatorCommand(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;
  for (const character of line.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = undefined;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/u.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (escaped || quote) throw new Error("Unclosed quote or escape in operator command");
  if (current) tokens.push(current);
  return tokens;
}

export function assertAllowedOperatorCommand(tokens: string[]): { script: string; args: string[] } {
  if (tokens[0] !== "run" || !tokens[1]) {
    throw new Error("Use: run <allowlisted-package-script> [reviewed arguments]");
  }
  const script = tokens[1];
  if (!RELEASE_OPERATOR_COMMANDS.has(script)) {
    throw new Error(`Release operator script is not allowlisted: ${script}`);
  }
  const args = tokens.slice(2);
  const allowedArguments = RELEASE_OPERATOR_ARGUMENTS.get(script);
  if (!allowedArguments) throw new Error(`Release operator arguments are not configured for ${script}`);
  const seenArguments = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const flag = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
    if (FORBIDDEN_ARGUMENTS.has(flag)) {
      throw new Error(`${flag} is controlled by the frozen release session and may not be overridden`);
    }
    if (!allowedArguments.has(flag)) {
      throw new Error(`Release operator argument is not allowlisted for ${script}: ${flag}`);
    }
    if (seenArguments.has(flag)) throw new Error(`Release operator argument is duplicated for ${script}: ${flag}`);
    seenArguments.add(flag);
    if (argument.includes("=")) {
      if (argument.slice(argument.indexOf("=") + 1).length === 0) throw new Error(`${flag} requires a value`);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    index += 1;
  }
  if (!seenArguments.has("--step")) {
    throw new Error(`${script} requires one explicit --step boundary`);
  }
  return { script, args };
}

export function createPasswordLease(password: string, temporaryRoot = os.tmpdir()): PasswordLease {
  if (!password) throw new Error("Deployer password may not be empty");
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "green-goods-release-"));
  fs.chmodSync(directory, 0o700);
  const filePath = path.join(directory, "foundry-password");
  fs.writeFileSync(filePath, `${password}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  let closed = false;
  return {
    filePath,
    close: () => {
      if (closed) return;
      closed = true;
      if (fs.existsSync(filePath)) {
        const size = fs.statSync(filePath).size;
        if (size > 0) fs.writeFileSync(filePath, Buffer.alloc(size), { flag: "r+" });
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(directory)) fs.rmdirSync(directory);
    },
  };
}

function showHelp(): void {
  console.log(`
Green Goods release operator session

Usage:
  bun run release:operator -- --commit <exact-40-character-candidate>
  bun run release:operator -- --commit <candidate> --stage <ceremony-stage>

The session verifies the exact candidate plus any receipt-backed deployment artifacts, prompts for
the Foundry keystore password, verifies that it unlocks the frozen deployment sender, and accepts
only allowlisted release boundaries. It never accepts a private key, password argument, RPC override,
network override, sender override, raw Forge command, or arbitrary shell command.

Inside the session:
  help
  run <package-script> [reviewed arguments]
  exit

Stage mode runs one lane's complete ordered boundary set from a single password entry. The exact
candidate checkout is still reasserted before and after every boundary and the first failure stops
the run, so the per-boundary safety properties are unchanged; only the number of password prompts
differs. Checkpointed stages resume from their receipt ledger rather than replaying a mined boundary.
The GardenAccount stage always runs both boundaries and binds step 2 to the captured step-1 receipt;
if step 1 already broadcast, recover through the interactive mode with an explicit --receipt.

Ceremony stages:
  ownership-arbitrum                       8 boundaries
  garden-accounts                          2 boundaries
  garden-safes                             18 boundaries
  relay                                    4 boundaries
  garden-roles                             126 boundaries
  garden-roles-enable                      18 boundaries
  garden-routes                            18 boundaries

Unlocking the session is not broadcast authorization. Run only the exact stage and transaction
boundary separately authorized by the release owner. The credential session closes after that
wrapper verifies and checkpoints the selected boundary. The completed core deployment, pool
backfill, and pooling-unpause orchestrators are retired and cannot be replayed from this operator.

Allowlisted package scripts:
${[...RELEASE_OPERATOR_COMMANDS].map(([name, description]) => `  ${name.padEnd(40)} ${description}`).join("\n")}
`);
}

async function readHiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error("Release operator password entry requires an interactive TTY");
  }
  process.stdout.write("Foundry deployer password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") return finish(new Error("Release operator session interrupted"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

export function assertPinnedCheckout(candidateCommit: string, repositoryRoot = REPOSITORY_ROOT): void {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  if (head !== candidateCommit)
    throw new Error(`Candidate mismatch: requested ${candidateCommit}, checkout is ${head}`);
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (status.trim()) throw new Error("Release operator session requires the exact candidate checkout to stay clean");
}

export function assertArtifactCheckout(
  candidateCommit: string,
  repositoryRoot = REPOSITORY_ROOT,
  allowedMutations: ReadonlySet<string> = INTERACTIVE_ARTIFACT_MUTATIONS,
): void {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  if (head !== candidateCommit) {
    throw new Error(`Candidate mismatch: requested ${candidateCommit}, checkout is ${head}`);
  }
  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const unexpected = status
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1))
    .filter((filePath): filePath is string => filePath !== undefined)
    .filter((filePath) => !allowedMutations.has(filePath));
  if (unexpected.length > 0) {
    throw new Error(`Release operator detected concurrent checkout drift: ${unexpected.join(", ")}`);
  }
}

function artifactDirtyPaths(repositoryRoot: string): string[] {
  return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1))
    .filter((filePath): filePath is string => filePath !== undefined);
}

function requireCompleteGardenSafeCheckpoint(planPath: string, plan: FinalSafePlan): Checkpoint {
  const checkpointPath = defaultCheckpointPath(planPath);
  if (!fs.existsSync(planPath) || !fs.existsSync(checkpointPath)) {
    throw new Error(`Garden Safe artifact is missing its reviewed plan/checkpoint: ${planPath}`);
  }
  const checkpoint = readJson<Checkpoint>(checkpointPath);
  const planHash = keccak256(toUtf8Bytes(fs.readFileSync(planPath, "utf8")));
  if (
    checkpoint.schemaVersion !== 1 ||
    checkpoint.planHash !== planHash ||
    checkpoint.completed.length !== plan.entries.length
  ) {
    throw new Error(`Garden Safe artifact lacks complete receipt-backed evidence: ${checkpointPath}`);
  }
  for (const [offset, evidence] of checkpoint.completed.entries()) {
    const boundary = plan.entries[offset];
    if (
      evidence.index !== offset + 1 ||
      getAddress(evidence.safe) !== getAddress(boundary.safe) ||
      getAddress(evidence.garden) !== getAddress(boundary.garden) ||
      !/^0x[0-9a-f]{64}$/iu.test(evidence.transactionHash) ||
      !Number.isSafeInteger(evidence.blockNumber) ||
      evidence.blockNumber < 1
    ) {
      throw new Error(`Garden Safe checkpoint boundary ${offset + 1} was modified`);
    }
  }
  return checkpoint;
}

export function assertVerifiedGardenSafePromotion(
  _candidateCommit: string,
  repositoryRoot: string,
  dirtyPaths: string[],
): void {
  if (dirtyPaths.length !== 1 || dirtyPaths[0] !== GARDEN_SAFE_ARTIFACT_PATH) {
    throw new Error(`Garden Safe ceremony detected unrelated checkout drift: ${dirtyPaths.join(", ")}`);
  }
  const contractsRoot = path.join(repositoryRoot, "packages/contracts");
  const runtimeRoot = path.join(contractsRoot, ".generated/runtime");
  const inventoryPath = path.join(runtimeRoot, "42161-pool-backfill.json");
  const planPath = path.join(runtimeRoot, "42220-garden-safe-final.json");
  const artifactPath = path.join(repositoryRoot, GARDEN_SAFE_ARTIFACT_PATH);
  if (!fs.existsSync(artifactPath) || !fs.existsSync(planPath)) {
    throw new Error("Garden Safe promotion is missing its canonical artifact or final plan");
  }

  const plan = readJson<FinalSafePlan>(planPath);
  validateFinalSafePlan(plan, inventoryPath);
  const checkpoint = requireCompleteGardenSafeCheckpoint(planPath, plan);
  const expected = buildFinalDeploymentArtifact(plan, checkpoint);

  const current = readJson<unknown>(artifactPath);
  const changedPaths = changedPromotionLeafPaths(expected, current).filter(Boolean);
  if (changedPaths.length > 0) {
    throw new Error(`Garden Safe artifact differs from receipt-backed evidence: ${changedPaths.join(", ")}`);
  }
}

export function assertInteractiveSessionStart(
  candidateCommit: string,
  repositoryRoot = REPOSITORY_ROOT,
  validateReleasePromotions: (
    candidate: string,
    root: string,
    paths: string[],
  ) => void = assertVerifiedResumePromotions,
  validateGardenSafePromotion: (
    candidate: string,
    root: string,
    paths: string[],
  ) => void = assertVerifiedGardenSafePromotion,
  allowedMutations: ReadonlySet<string> = INTERACTIVE_ARTIFACT_MUTATIONS,
): void {
  assertArtifactCheckout(candidateCommit, repositoryRoot, allowedMutations);
  const dirty = artifactDirtyPaths(repositoryRoot);
  const releaseArtifacts = dirty.filter((filePath) => RELEASE_ARTIFACT_MUTATIONS.has(filePath));
  const gardenSafeArtifacts = dirty.filter((filePath) => GARDEN_SAFE_ARTIFACT_MUTATIONS.has(filePath));
  if (releaseArtifacts.length > 0) {
    validateReleasePromotions(candidateCommit, repositoryRoot, releaseArtifacts);
  }
  if (gardenSafeArtifacts.length > 0) {
    validateGardenSafePromotion(candidateCommit, repositoryRoot, gardenSafeArtifacts);
  }
}

interface JsonPlan {
  contract?: string;
  authority?: string;
  expectedNonce?: number;
  releaseManifestHash?: string;
  releaseSourceCommit?: string;
  transactions: Array<{ kind?: string; nonce?: number | string }>;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function samePromotionValue(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string" && left.startsWith("0x") && right.startsWith("0x")) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function unsetPromotionValue(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (typeof value === "string" && /^0x0+$/iu.test(value));
}

export function changedPromotionLeafPaths(before: unknown, after: unknown, prefix = ""): string[] {
  const beforeRecord = before && typeof before === "object" && !Array.isArray(before);
  const afterRecord = after && typeof after === "object" && !Array.isArray(after);
  if (beforeRecord || afterRecord) {
    if ((!beforeRecord && !unsetPromotionValue(before)) || (!afterRecord && !unsetPromotionValue(after))) {
      return [prefix];
    }
    const left = beforeRecord ? (before as Record<string, unknown>) : {};
    const right = afterRecord ? (after as Record<string, unknown>) : {};
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap((key) =>
      changedPromotionLeafPaths(left[key], right[key], prefix ? `${prefix}.${key}` : key),
    );
  }
  return samePromotionValue(before, after) ? [] : [prefix];
}

function getPromotionValue(value: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function requireCompleteCheckpoint(
  planPath: string,
  checkpointPath: string,
  lock: ReleaseLock,
): { plan: Record<string, unknown> & { transactions: unknown[] }; evidence: Array<Record<string, unknown>> } {
  if (!fs.existsSync(planPath) || !fs.existsSync(checkpointPath)) {
    throw new Error(`Verified resume promotion is missing its reviewed plan/checkpoint: ${planPath}`);
  }
  const plan = readJson<Record<string, unknown> & { transactions: unknown[] }>(planPath);
  const checkpoint = readJson<Record<string, unknown>>(checkpointPath);
  const evidence = (checkpoint.completed ?? checkpoint.verifiedBoundaries) as
    | Array<Record<string, unknown>>
    | undefined;
  if (
    !Array.isArray(plan.transactions) ||
    !Array.isArray(evidence) ||
    evidence.length !== plan.transactions.length ||
    plan.releaseId !== lock.releaseId ||
    (plan.manifestHash !== undefined && plan.manifestHash !== lock.manifestHash) ||
    (plan.releaseManifestHash !== undefined && plan.releaseManifestHash !== lock.manifestHash) ||
    (plan.sourceCommit !== undefined && plan.sourceCommit !== lock.sourceCommit) ||
    (plan.releaseSourceCommit !== undefined && plan.releaseSourceCommit !== lock.sourceCommit) ||
    (checkpoint.releaseId !== undefined && checkpoint.releaseId !== lock.releaseId) ||
    (checkpoint.manifestHash !== undefined && checkpoint.manifestHash !== lock.manifestHash) ||
    (checkpoint.releaseManifestHash !== undefined && checkpoint.releaseManifestHash !== lock.manifestHash) ||
    (checkpoint.stage !== undefined && checkpoint.stage !== plan.stage) ||
    (checkpoint.network !== undefined && checkpoint.network !== plan.network) ||
    (checkpoint.lastVerifiedStep !== undefined && checkpoint.lastVerifiedStep !== evidence.length)
  ) {
    throw new Error(`Verified resume promotion has incomplete or mismatched evidence: ${planPath}`);
  }
  for (const [offset, item] of evidence.entries()) {
    const cursor = item.step ?? item.index;
    const boundary = plan.transactions[offset] as Record<string, unknown>;
    if (
      cursor !== offset + 1 ||
      (item.label !== undefined && boundary.label !== undefined && item.label !== boundary.label) ||
      (item.expectedNonce !== undefined && boundary.nonce !== undefined && item.expectedNonce !== boundary.nonce) ||
      typeof item.transactionHash !== "string" ||
      !/^0x[0-9a-f]{64}$/iu.test(item.transactionHash) ||
      !Number.isSafeInteger(Number(item.blockNumber)) ||
      Number(item.blockNumber) <= 0
    ) {
      throw new Error(`Verified resume checkpoint is not one contiguous receipt-backed prefix: ${checkpointPath}`);
    }
  }
  if (typeof checkpoint.planHash === "string") {
    const planHash = keccak256(toUtf8Bytes(`${JSON.stringify(plan, null, 2)}\n`));
    if (checkpoint.planHash !== planHash) throw new Error("Verified resume checkpoint belongs to another plan");
  }
  return { plan, evidence };
}

function addExpectedStagePromotions(
  expected: Map<string, unknown>,
  lock: ReleaseLock,
  stage: ReleaseStage,
  evidence: Array<Record<string, unknown>>,
): void {
  for (const identity of lock.identities.filter((item) => item.stage === stage)) {
    if (identity.kind === "library") {
      const root = stage === "pooling" ? "poolingLibraries" : "settlementLibraries";
      expected.set(`${root}.${identity.name}`, identity.address);
      continue;
    }
    const name = `${identity.name[0].toLowerCase()}${identity.name.slice(1)}`;
    expected.set(identity.kind === "implementation" ? `${name}Impl` : name, identity.address);
    if (
      identity.kind === "proxy" &&
      (identity.name === "SettlementModule" || identity.name === "CeloSettlementExecutor")
    ) {
      const receipt = evidence.find((item) => item.label === `proxy:${identity.name}`);
      if (!receipt) throw new Error(`Verified ${identity.name} proxy receipt is missing`);
      expected.set(`releaseReceipts.${name}.transactionHash`, receipt.transactionHash);
      expected.set(`releaseReceipts.${name}.blockNumber`, Number(receipt.blockNumber));
    }
  }
}

export function assertVerifiedResumePromotions(
  candidateCommit: string,
  repositoryRoot: string,
  dirtyPaths: string[],
): void {
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const expectedByArtifact = new Map<string, Map<string, unknown>>([
    ["packages/contracts/deployments/42161-latest.json", new Map()],
    ["packages/contracts/deployments/42220-latest.json", new Map()],
  ]);
  const expectedPromotionsFor = (artifactPath: string): Map<string, unknown> => {
    const expected = expectedByArtifact.get(artifactPath);
    if (!expected) throw new Error(`No verified promotion schema exists for ${artifactPath}`);
    return expected;
  };
  const releaseRoot = path.join(CONTRACTS_ROOT, `.generated/release/${manifest.releaseId}`);
  for (const [stage, network] of [
    ["pooling", "arbitrum"],
    ["settlement-module", "arbitrum"],
    ["credit-registry", "arbitrum"],
    ["settlement-executor", "celo"],
  ] as const) {
    const directory = path.join(releaseRoot, network);
    const planPath = path.join(directory, `${stage}-transaction-plan.json`);
    const checkpointPath = path.join(directory, `${stage}-checkpoint.json`);
    if (
      !fs.existsSync(planPath) ||
      !fs.existsSync(checkpointPath) ||
      completedBoundaries(planPath, checkpointPath) !== readJson<JsonPlan>(planPath).transactions.length
    ) {
      continue;
    }
    const { evidence } = requireCompleteCheckpoint(planPath, checkpointPath, lock);
    addExpectedStagePromotions(
      expectedPromotionsFor(
        network === "arbitrum"
          ? "packages/contracts/deployments/42161-latest.json"
          : "packages/contracts/deployments/42220-latest.json",
      ),
      lock,
      stage,
      evidence,
    );
  }
  const arbitrumExpected = expectedPromotionsFor("packages/contracts/deployments/42161-latest.json");
  for (const mode of ["preparation", "finalization"] as const) {
    const directory = path.join(CONTRACTS_ROOT, `.generated/release-schemas/${mode}`);
    const planPath = path.join(directory, `42161-${mode}-transaction-plan.json`);
    const checkpointPath = path.join(directory, `42161-${mode}-transaction-plan.checkpoint.json`);
    if (
      !fs.existsSync(planPath) ||
      !fs.existsSync(checkpointPath) ||
      completedBoundaries(planPath, checkpointPath) !== readJson<JsonPlan>(planPath).transactions.length
    ) {
      continue;
    }
    const { plan } = requireCompleteCheckpoint(planPath, checkpointPath, lock);
    if (mode === "preparation") {
      arbitrumExpected.set("testimonyResolver", plan.testimonyResolver);
      arbitrumExpected.set("testimonyResolverImpl", plan.testimonyResolverImpl);
    }
    for (const schema of (plan.schemas ?? []) as Array<Record<string, unknown>>) {
      const key = String(schema.key);
      const uidKey = key === "assessmentV3" ? "assessmentV3SchemaUID" : "communityTestimonySchemaUID";
      arbitrumExpected.set(`schemas.${uidKey}`, schema.uid);
      arbitrumExpected.set(`schemas.${key}Schema`, schema.schema);
      arbitrumExpected.set(`schemas.${key}Name`, schema.name);
      arbitrumExpected.set(`schemas.${key}Description`, schema.description);
    }
  }
  for (const artifactPath of dirtyPaths) {
    const expected = expectedByArtifact.get(artifactPath);
    if (!expected) throw new Error(`Release resume artifact is not allowlisted: ${artifactPath}`);
    const baseline = JSON.parse(
      execFileSync("git", ["show", `${candidateCommit}:${artifactPath}`], { cwd: repositoryRoot, encoding: "utf8" }),
    ) as Record<string, unknown>;
    const current = readJson<Record<string, unknown>>(path.join(repositoryRoot, artifactPath));
    for (const changedPath of changedPromotionLeafPaths(baseline, current)) {
      if (!expected.has(changedPath)) throw new Error(`Release resume changed an unowned key: ${changedPath}`);
      const before = getPromotionValue(baseline, changedPath);
      const after = getPromotionValue(current, changedPath);
      if (!unsetPromotionValue(before) || !samePromotionValue(after, expected.get(changedPath))) {
        throw new Error(`Release resume key ${changedPath} is not an exact receipt-backed promotion`);
      }
    }
  }
}

function defaultCheckpointPath(planPath: string): string {
  return planPath.replace(/\.json$/u, ".checkpoint.json");
}

export function completedBoundaries(planPath: string, checkpointPath = defaultCheckpointPath(planPath)): number {
  if (!fs.existsSync(checkpointPath)) return 0;
  const checkpoint = readJson<{
    completed?: unknown[];
    lastVerifiedStep?: number;
    verifiedBoundaries?: unknown[];
  }>(checkpointPath);
  const completed = checkpoint.completed?.length ?? checkpoint.verifiedBoundaries?.length ?? 0;
  if (
    checkpoint.lastVerifiedStep !== undefined &&
    (!Number.isSafeInteger(checkpoint.lastVerifiedStep) ||
      checkpoint.lastVerifiedStep < 0 ||
      checkpoint.lastVerifiedStep !== completed)
  ) {
    throw new Error(`Checkpoint cursor differs from its receipt ledger: ${checkpointPath}`);
  }
  return completed;
}

function verifyDeployerPassword(passwordFile: string): string {
  const manifest = loadReleaseManifest();
  const result = execFileSync("cast", ["wallet", "address", "--account", manifest.ownership.deploymentKeystore], {
    cwd: CONTRACTS_ROOT,
    encoding: "utf8",
    env: { ...process.env, ETH_PASSWORD: passwordFile },
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  const unlocked = getAddress(result);
  const expected = getAddress(manifest.ownership.deploymentSender);
  if (unlocked !== expected)
    throw new Error(`Keystore unlock resolved ${unlocked}, expected frozen sender ${expected}`);
  return unlocked;
}
const GARDEN_SAFE_PLAN_PATH = path.join(CONTRACTS_ROOT, ".generated/runtime/42220-garden-safe-final.json");
const RELAY_PLAN_PATH = path.join(CONTRACTS_ROOT, ".generated/runtime/garden-account-relay.json");
const ROLES_PLAN_PATH = path.join(CONTRACTS_ROOT, ".generated/runtime/42220-garden-roles.json");

/** Checkpoint-resumed stages read their progress from their own reviewed plan. */
const STAGE_PLAN_PATHS: Readonly<Partial<Record<CeremonyStage, string>>> = {
  "ownership-arbitrum": path.join(
    CONTRACTS_ROOT,
    ".generated/release/commitment-pooling-settlement-credit-v1/arbitrum/ownership-transfer-transaction-plan.json",
  ),
  "garden-safes": GARDEN_SAFE_PLAN_PATH,
  "garden-roles": ROLES_PLAN_PATH,
  "garden-roles-enable": path.join(CONTRACTS_ROOT, ".generated/runtime/42220-garden-roles-enable.json"),
  "garden-routes": path.join(CONTRACTS_ROOT, ".generated/runtime/42220-garden-routes.json"),
};

const STAGE_CHECKPOINT_PATHS: Readonly<Partial<Record<CeremonyStage, string>>> = {
  "ownership-arbitrum": path.join(
    CONTRACTS_ROOT,
    ".generated/release/commitment-pooling-settlement-credit-v1/arbitrum/ownership-transfer-checkpoint.json",
  ),
};

export function ownershipBoundaryArguments(boundary: number, pendingNonce: number): string[] {
  if (!Number.isSafeInteger(boundary) || boundary <= 0) throw new Error(`Ownership requires a positive boundary`);
  if (!Number.isSafeInteger(pendingNonce) || pendingNonce < 0) {
    throw new Error(`Ownership requires a non-negative nonce`);
  }
  return ["--step", String(boundary), "--expected-nonce", String(pendingNonce)];
}

export async function executeOwnershipBoundaries(
  boundaries: readonly number[],
  readPendingNonce: () => Promise<number>,
  executeBoundary: (boundary: number, args: string[]) => void | Promise<void>,
): Promise<void> {
  for (const boundary of boundaries) {
    const pendingNonce = await readPendingNonce();
    await executeBoundary(boundary, ownershipBoundaryArguments(boundary, pendingNonce));
  }
}

/**
 * Resolves which boundaries a stage still has to run. Kept pure and separate from execution so the
 * resume arithmetic is provable without a credential session: an over-counted checkpoint is a
 * corrupted ledger rather than a reason to skip work, and a complete stage yields no boundaries
 * instead of replaying a mined transaction.
 */
export function plannedStageBoundaries(stage: CeremonyStage, completed: number): number[] {
  const definition = CEREMONY_STAGES.get(stage);
  if (!definition) throw new Error(`Unknown release ceremony stage: ${stage}`);
  if (!Number.isSafeInteger(completed) || completed < 0) {
    throw new Error(`Checkpointed boundary count must be a non-negative integer: ${completed}`);
  }
  if (completed > definition.boundaries) {
    throw new Error(
      `Stage ${stage} reports ${completed} checkpointed boundaries but its plan defines ${definition.boundaries}`,
    );
  }
  const boundaries: number[] = [];
  for (let boundary = completed + 1; boundary <= definition.boundaries; boundary += 1) boundaries.push(boundary);
  return boundaries;
}

export function transactionHashFromBoundaryOutput(output: string, boundary: number): string {
  const hash = output.match(/0x[0-9a-fA-F]{64}/gu)?.at(-1);
  if (!hash) throw new Error(`Boundary ${boundary} did not report a verified transaction hash`);
  return hash;
}

/**
 * Runs one boundary with the same drift assertions the interactive loop applies: the exact
 * candidate checkout is reasserted immediately before and after the wrapper, and any non-zero exit
 * aborts the stage with the credential session still scoped to this process.
 */
function runStageBoundary(
  script: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  candidateCommit: string,
  capture: boolean,
): string {
  console.log(`Running Bun wrapper: ${script} ${args.join(" ")}`.trim());
  assertInteractiveSessionStart(candidateCommit);
  const result = spawnSync("bun", ["run", script, ...args], {
    cwd: CONTRACTS_ROOT,
    encoding: "utf8",
    env: environment,
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
  });
  const output = capture ? (result.stdout ?? "") : "";
  if (capture) process.stdout.write(output);
  if (result.status !== 0) {
    throw new Error(`Bun wrapper ${script} failed at this boundary; the credential session is closed`);
  }
  assertInteractiveSessionStart(candidateCommit);
  return output;
}

async function runCeremonyStage(
  stage: CeremonyStage,
  candidateCommit: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const definition = CEREMONY_STAGES.get(stage);
  if (!definition) throw new Error(`Unknown release ceremony stage: ${stage}`);

  if (stage === "garden-accounts") {
    // Step 2 must bind the exact step-1 receipt. Capturing step 1 keeps that binding automatic
    // rather than asking the operator to copy a hash between two password-gated sessions.
    const firstOutput = runStageBoundary(definition.script, ["--step", "1"], environment, candidateCommit, true);
    const receipt = transactionHashFromBoundaryOutput(firstOutput, 1);
    console.log(`Binding step-2 to the verified step-1 receipt ${receipt}.`);
    runStageBoundary(definition.script, ["--step", "2", "--receipt", receipt], environment, candidateCommit, false);
    console.log(`Stage ${stage} completed both boundaries.`);
    return;
  }

  if (stage === "relay") {
    // Every relay boundary depends on the previous one's receipt, and consecutive boundaries sit on
    // different chains, so each hash is captured and handed to the next rather than copied by hand.
    // A resumed lane starts at the first uncheckpointed boundary and lets the wrapper recover that
    // boundary's prerequisite from its own checkpoint instead of replaying a mined transaction.
    const completed = completedBoundaries(RELAY_PLAN_PATH);
    const boundaries = plannedStageBoundaries(stage, completed);
    if (boundaries.length === 0) {
      console.log(`Stage ${stage} is already complete with ${completed} checkpointed boundaries.`);
      return;
    }
    if (completed > 0) console.log(`Resuming stage ${stage} after ${completed} checkpointed boundaries.`);
    let receipt: string | undefined;
    for (const boundary of boundaries) {
      console.log(`--- boundary ${boundary} of ${definition.boundaries} ---`);
      const args = ["--step", String(boundary)];
      if (receipt) args.push("--receipt", receipt);
      const output = runStageBoundary(definition.script, args, environment, candidateCommit, true);
      receipt = transactionHashFromBoundaryOutput(output, boundary);
      if (boundary < definition.boundaries) console.log(`Binding boundary ${boundary + 1} to receipt ${receipt}.`);
    }
    console.log(`Stage ${stage} completed all ${definition.boundaries} boundaries.`);
    return;
  }

  if (stage === "ownership-arbitrum") {
    const planPath = STAGE_PLAN_PATHS[stage];
    if (!planPath) throw new Error(`Stage ${stage} has no reviewed plan to resume from`);
    const completed = completedBoundaries(planPath, STAGE_CHECKPOINT_PATHS[stage]);
    const boundaries = plannedStageBoundaries(stage, completed);
    if (boundaries.length === 0) {
      console.log(`Stage ${stage} is already complete with ${completed} checkpointed boundaries.`);
      return;
    }
    if (completed > 0) console.log(`Resuming stage ${stage} after ${completed} checkpointed boundaries.`);
    const manifest = loadReleaseManifest();
    const provider = new JsonRpcProvider(new NetworkManager().getRpcUrl("arbitrum"), 42161, {
      staticNetwork: true,
    });
    try {
      await executeOwnershipBoundaries(
        boundaries,
        async () => provider.getTransactionCount(manifest.ownership.deploymentSender, "pending"),
        (boundary, args) => {
          console.log(`--- boundary ${boundary} of ${definition.boundaries} ---`);
          runStageBoundary(definition.script, args, environment, candidateCommit, false);
        },
      );
    } finally {
      provider.destroy();
    }
    console.log(`Stage ${stage} completed all ${definition.boundaries} boundaries.`);
    return;
  }

  // The Safe wrapper checkpoints every boundary, so a resumed stage continues from the first
  // uncheckpointed boundary instead of replaying a mined Safe deployment.
  const planPath = STAGE_PLAN_PATHS[stage];
  if (!planPath) throw new Error(`Stage ${stage} has no reviewed plan to resume from`);
  const completed = completedBoundaries(planPath);
  const boundaries = plannedStageBoundaries(stage, completed);
  if (boundaries.length === 0) {
    console.log(`Stage ${stage} is already complete with ${completed} checkpointed boundaries.`);
    return;
  }
  if (completed > 0) console.log(`Resuming stage ${stage} after ${completed} checkpointed boundaries.`);
  for (const boundary of boundaries) {
    console.log(`--- boundary ${boundary} of ${definition.boundaries} ---`);
    // The Roles and route lanes carry their own --broadcast in the wrapper's argument set.
    const args =
      stage === "garden-roles" || stage === "garden-roles-enable" || stage === "garden-routes"
        ? ["--broadcast", "--step", String(boundary)]
        : ["--step", String(boundary)];
    runStageBoundary(definition.script, args, environment, candidateCommit, false);
  }
  console.log(`Stage ${stage} completed all ${definition.boundaries} boundaries.`);
}

async function runSession(candidateCommit: string, stage?: CeremonyStage): Promise<void> {
  assertInteractiveSessionStart(candidateCommit);
  const manifest = loadReleaseManifest();
  const password = await readHiddenPassword();
  const lease = createPasswordLease(password);
  const cleanup = () => lease.close();
  const interrupt = () => {
    cleanup();
    process.exit(130);
  };
  const terminate = () => {
    cleanup();
    process.exit(143);
  };
  process.once("exit", cleanup);
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    const signer = verifyDeployerPassword(lease.filePath);
    console.log(`Unlocked frozen deployment sender ${signer} for this process only.`);
    const boundaryEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      APP_ENV: "development",
      ETH_PASSWORD: lease.filePath,
      FOUNDRY_KEYSTORE_ACCOUNT: manifest.ownership.deploymentKeystore,
      GG_RELEASE_OPERATOR_SESSION: candidateCommit,
      PINATA_GATEWAY: "",
      PINATA_JWT: "",
      PINATA_JWT_OP_REF: "",
    };
    if (stage) {
      const definition = CEREMONY_STAGES.get(stage);
      console.log(`Running the ${definition?.label} stage; the credential session closes when it finishes.`);
      await runCeremonyStage(stage, candidateCommit, boundaryEnvironment);
      return;
    }
    console.log("Type help for the allowlist. The session closes after one verified boundary.");
    const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    try {
      while (true) {
        const line = (await terminal.question("release> ")).trim();
        if (!line) continue;
        if (line === "exit" || line === "quit") break;
        if (line === "help") {
          showHelp();
          continue;
        }
        const command = assertAllowedOperatorCommand(tokenizeOperatorCommand(line));
        console.log(`Running Bun wrapper: ${command.script} ${command.args.join(" ")}`.trim());
        assertInteractiveSessionStart(candidateCommit);
        const result = spawnSync("bun", ["run", command.script, ...command.args], {
          cwd: CONTRACTS_ROOT,
          stdio: "inherit",
          env: boundaryEnvironment,
        });
        if (result.status !== 0) {
          throw new Error(`Bun wrapper ${command.script} failed; the credential session is closed`);
        }
        assertInteractiveSessionStart(candidateCommit);
        console.log(
          "Boundary script returned successfully with no concurrent checkout drift. The credential session is closed.",
        );
        break;
      }
    } finally {
      terminal.close();
    }
  } finally {
    cleanup();
    process.off("exit", cleanup);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}

if (import.meta.main) {
  try {
    const options = parseSessionOptions(process.argv.slice(2));
    if (options.help) showHelp();
    else if (options.commit) await runSession(options.commit, options.stage);
    else throw new Error("Release operator candidate commit was not resolved");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
