#!/usr/bin/env bun

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import * as dotenv from "dotenv";
import { getAddress, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import {
  type BootstrapPlan,
  buildBootstrapDeploymentArtifact,
  buildSwappedDeploymentArtifact,
  type Checkpoint,
  type SwapPlan,
  validateBootstrapPlan,
  validateSwapPlan,
} from "./deploy/garden-safe-owners";
import { NetworkManager } from "./utils/network";
import {
  buildReleaseLock,
  loadReleaseManifest,
  type ReleaseLock,
  type ReleaseManifest,
  type ReleaseStage,
} from "./utils/release-manifest";

const CONTRACTS_ROOT = path.join(__dirname, "..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

const AUTOMATED_RELEASE_MUTATIONS = new Set([
  "packages/contracts/deployments/42161-latest.json",
  "packages/contracts/deployments/42220-latest.json",
]);
const GARDEN_SAFE_ARTIFACT_PATH = "packages/contracts/deployments/42220-settlement-safes.json";
const GARDEN_SAFE_ARTIFACT_MUTATIONS = new Set([GARDEN_SAFE_ARTIFACT_PATH]);
export const AUTOMATED_RELEASE_STAGE_ORDER = [
  "assessment-resolver",
  "schema-preparation",
  "pooling",
  "schema-finalization",
  "settlement-module",
  "credit-registry",
  "pooling-integration-upgrade",
  "settlement-executor",
] as const;

export const AUTOMATED_RELEASE_EXCLUSIONS = [
  "ownership-transfer",
  "pool-registration",
  "pooling-unpause",
  "peer-wiring",
  "safe-zodiac-value-authority",
  "value-movement",
  "indexer-activation",
] as const;

export interface CompleteSequenceAuthorization {
  schemaVersion: 3;
  kind: "PAUSED_RELEASE_COMPLETE_SEQUENCE_AUTHORIZATION";
  operatorCandidateCommit: string;
  releaseId: string;
  releaseManifestHash: string;
  releaseSourceCommit: string;
  terminalState: "paused-deployer-owned";
  authorizedStages: string[];
  excludedActions: string[];
  authorizedBy: string;
  authorizedOn: string;
  authorizationRecord: string;
  authorizationWindow: AuthorizationWindow;
}

export const POOL_BACKFILL_REGISTRATION_BOUNDARIES = 18;

export type PoolCeremonyMode = "pool-backfill" | "pooling-unpause";

export interface AuthorizationWindow {
  notBefore: string;
  expiresAt: string;
}

export interface PoolCeremonyAuthorization {
  schemaVersion: 1;
  kind: "POOL_CEREMONY_AUTHORIZATION";
  mode: PoolCeremonyMode;
  operatorCandidateCommit: string;
  releaseId: string;
  releaseManifestHash: string;
  releaseSourceCommit: string;
  network: "arbitrum";
  chainId: 42161;
  authority: "DEPLOYER";
  planHash: string;
  authorizedBoundaries: number[];
  terminalState: "paused-deployer-owned-18-pools" | "unpaused-deployer-owned-18-pools";
  excludedActions: string[];
  authorizedBy: string;
  authorizedOn: string;
  authorizationRecord: string;
  authorizationWindow: AuthorizationWindow;
}

export const POOL_BACKFILL_EXCLUSIONS = [
  "ownership-transfer",
  "pooling-unpause",
  "peer-wiring",
  "safe-zodiac-value-authority",
  "value-movement",
  "indexer-activation",
] as const;

export const POOL_UNPAUSE_EXCLUSIONS = [
  "ownership-transfer",
  "additional-pool-registration",
  "peer-wiring",
  "safe-zodiac-value-authority",
  "value-movement",
  "indexer-activation",
] as const;

export const RELEASE_OPERATOR_COMMANDS = new Map<string, string>([
  ["assessment:upgrade:arbitrum", "AssessmentResolver upgrade and canonical-v2 pin boundaries"],
  ["pooling:schemas:arbitrum", "TestimonyResolver and AssessmentV3 schema preparation boundaries"],
  ["pooling:deploy:arbitrum", "paused Commitment Pooling library/implementation/proxy boundaries"],
  ["pooling:finalize:arbitrum", "Community Testimony record and resolver finalization boundaries"],
  ["settlement:module:deploy:arbitrum", "paused Arbitrum SettlementModule boundaries"],
  ["credit:registry:deploy:arbitrum", "paused records-only CreditRegistry boundaries"],
  ["pooling:upgrade:arbitrum", "GardenToken and WorkApprovalResolver integration-upgrade boundaries"],
  ["settlement:executor:deploy:celo", "paused CeloSettlementExecutor boundaries"],
  ["settlement:garden-safes:deploy:celo", "native/G$-clear 1-of-2 Garden Safe bootstrap boundaries"],
  ["settlement:garden-safes:swap:celo", "deployer-to-reviewed-owner Garden Safe swap boundaries"],
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
  [
    "assessment:upgrade:arbitrum",
    new Set(["--plan", "--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"]),
  ],
  [
    "pooling:schemas:arbitrum",
    new Set(["--artifact", "--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"]),
  ],
  ["pooling:deploy:arbitrum", new Set(["--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"])],
  [
    "pooling:finalize:arbitrum",
    new Set(["--artifact", "--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"]),
  ],
  [
    "settlement:module:deploy:arbitrum",
    new Set(["--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"]),
  ],
  ["credit:registry:deploy:arbitrum", new Set(["--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"])],
  [
    "pooling:upgrade:arbitrum",
    new Set(["--plan", "--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"]),
  ],
  ["settlement:executor:deploy:celo", new Set(["--step", "--expected-nonce", "--receipt", "--override-sepolia-gate"])],
  ["settlement:garden-safes:deploy:celo", new Set(["--plan", "--inventory", "--step", "--receipt"])],
  ["settlement:garden-safes:swap:celo", new Set(["--plan", "--inventory", "--replacements", "--step", "--receipt"])],
]);

const BOOLEAN_ARGUMENTS = new Set(["--override-sepolia-gate"]);

export interface SessionOptions {
  commit?: string;
  authorization?: string;
  help: boolean;
  deployAll: boolean;
  backfillAll: boolean;
  unpausePooling: boolean;
}

export interface PasswordLease {
  filePath: string;
  close: () => void;
}

export function parseSessionOptions(args: string[]): SessionOptions {
  const options: SessionOptions = { help: false, deployAll: false, backfillAll: false, unpausePooling: false };
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
    if (argument === "--authorization") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) throw new Error("--authorization requires a reviewed JSON file");
      options.authorization = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === "--deploy-all") {
      options.deployAll = true;
      continue;
    }
    if (argument === "--backfill-all") {
      options.backfillAll = true;
      continue;
    }
    if (argument === "--unpause-pooling") {
      options.unpausePooling = true;
      continue;
    }
    throw new Error(`Unknown release operator option: ${argument}`);
  }
  if (!options.help && (!options.commit || !/^[0-9a-f]{40}$/u.test(options.commit))) {
    throw new Error("Release operator session requires --commit <exact-40-character-candidate>");
  }
  if ([options.deployAll, options.backfillAll, options.unpausePooling].filter(Boolean).length > 1) {
    throw new Error("Choose only one automated release mode");
  }
  if ((options.deployAll || options.backfillAll || options.unpausePooling) && !options.authorization) {
    throw new Error("Automated release modes require --authorization <candidate-bound-reviewed-json>");
  }
  if (!options.deployAll && !options.backfillAll && !options.unpausePooling && options.authorization) {
    throw new Error("--authorization is accepted only with an automated release mode");
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
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const flag = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
    if (FORBIDDEN_ARGUMENTS.has(flag)) {
      throw new Error(`${flag} is controlled by the frozen release session and may not be overridden`);
    }
    if (!allowedArguments.has(flag)) {
      throw new Error(`Release operator argument is not allowlisted for ${script}: ${flag}`);
    }
    if (BOOLEAN_ARGUMENTS.has(flag)) {
      if (argument.includes("=")) throw new Error(`${flag} is a boolean flag and takes no value`);
      continue;
    }
    if (argument.includes("=")) {
      if (argument.slice(argument.indexOf("=") + 1).length === 0) throw new Error(`${flag} requires a value`);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    index += 1;
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
  bun run release:deploy:all -- --commit <exact-40-character-candidate> --authorization <reviewed-json>
  bun run release:backfill:all -- --commit <exact-40-character-candidate> --authorization <reviewed-json>
  bun run release:unpause:pooling -- --commit <exact-40-character-candidate> --authorization <reviewed-json>

The session verifies a clean checkout at the exact candidate, prompts for the Foundry keystore
password once, verifies that it unlocks the frozen deployment sender, and then accepts only the
allowlisted Bun package scripts below. It never accepts a private key, password argument, RPC
override, network override, sender override, raw Forge command, or arbitrary shell command.

Inside the session:
  help
  run <package-script> [reviewed arguments]
  exit

Unlocking the session is not broadcast authorization. Run only the exact stage and transaction
boundary separately authorized by the release owner. Every wrapper must verify and checkpoint the
current boundary before another command is entered.

--deploy-all derives fresh nonce-bound plans and executes every remaining deployer-signed paused
candidate stage in dependency order. It resumes verified checkpoints and stops on the first error.
Its separately reviewed authorization JSON must name the same exact operator candidate commit.
Ownership transfer, pool backfill, unpause, peer wiring, Safe authority, and value movement are
excluded from that command.

--backfill-all derives one finalized, root-Protocol-first plan and executes only registration
boundaries 1-18 through the temporary deployment-sender owner. It keeps pooling paused and never
transfers ownership. --unpause-pooling executes only boundary 19 after every registration receipt
and pool ID is verified. Peer wiring, Safe authority, value movement, and ownership transfer remain
excluded from both commands. Each mode requires its own candidate-, plan-, boundary-, and
time-window-bound authorization JSON before the keystore is unlocked.

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

export function assertAutomatedPinnedCheckout(
  candidateCommit: string,
  repositoryRoot = REPOSITORY_ROOT,
  allowedMutations: ReadonlySet<string> = AUTOMATED_RELEASE_MUTATIONS,
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
    throw new Error(`Release automation detected concurrent checkout drift: ${unexpected.join(", ")}`);
  }
}

export function validateCompleteSequenceAuthorization(
  authorization: CompleteSequenceAuthorization,
  manifest: ReleaseManifest,
  lock: ReleaseLock,
  candidateCommit: string,
  now = new Date(),
): void {
  if (
    authorization.schemaVersion !== 3 ||
    authorization.kind !== "PAUSED_RELEASE_COMPLETE_SEQUENCE_AUTHORIZATION" ||
    authorization.operatorCandidateCommit !== candidateCommit ||
    authorization.releaseId !== manifest.releaseId ||
    authorization.releaseManifestHash !== lock.manifestHash ||
    authorization.releaseSourceCommit !== lock.sourceCommit ||
    authorization.terminalState !== "paused-deployer-owned" ||
    JSON.stringify(authorization.authorizedStages) !== JSON.stringify(AUTOMATED_RELEASE_STAGE_ORDER) ||
    JSON.stringify(authorization.excludedActions) !== JSON.stringify(AUTOMATED_RELEASE_EXCLUSIONS) ||
    !authorization.authorizedBy.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(authorization.authorizedOn) ||
    !authorization.authorizationRecord.trim() ||
    !isActiveAuthorizationWindow(authorization.authorizationWindow, now)
  ) {
    throw new Error("Complete release sequence is not bound to the exact reviewed authorization artifact");
  }
}

function isActiveAuthorizationWindow(window: AuthorizationWindow | undefined, now: Date): boolean {
  if (!window) return false;
  const notBefore = Date.parse(window.notBefore);
  const expiresAt = Date.parse(window.expiresAt);
  const current = now.getTime();
  const maximumWindow = 24 * 60 * 60 * 1000;
  return (
    Number.isFinite(notBefore) &&
    Number.isFinite(expiresAt) &&
    expiresAt > notBefore &&
    expiresAt - notBefore <= maximumWindow &&
    current >= notBefore &&
    current <= expiresAt
  );
}

function readReviewedAuthorization<T>(authorizationPath: string, label: string): T {
  if (!fs.existsSync(authorizationPath)) {
    throw new Error(`${label} authorization is missing: ${authorizationPath}`);
  }
  const authorizationStat = fs.lstatSync(authorizationPath);
  if (!authorizationStat.isFile() || authorizationStat.isSymbolicLink() || (authorizationStat.mode & 0o022) !== 0) {
    throw new Error(`${label} authorization must be a regular file without group/world write access`);
  }
  return readJson<T>(authorizationPath);
}

function assertCompleteSequenceAuthorization(candidateCommit: string, authorizationPath: string): void {
  const manifest = loadReleaseManifest();
  validateCompleteSequenceAuthorization(
    readReviewedAuthorization<CompleteSequenceAuthorization>(authorizationPath, "Complete release sequence"),
    manifest,
    buildReleaseLock(manifest),
    candidateCommit,
  );
}

function expectedPoolCeremonyBoundaries(mode: PoolCeremonyMode): number[] {
  if (mode === "pool-backfill") {
    return Array.from({ length: POOL_BACKFILL_REGISTRATION_BOUNDARIES }, (_, offset) => offset + 1);
  }
  return [POOL_BACKFILL_REGISTRATION_BOUNDARIES + 1];
}

export function validatePoolCeremonyAuthorization(
  authorization: PoolCeremonyAuthorization,
  manifest: ReleaseManifest,
  lock: ReleaseLock,
  candidateCommit: string,
  mode: PoolCeremonyMode,
  planHash: string,
  now = new Date(),
): void {
  const backfill = mode === "pool-backfill";
  const expectedTerminalState = backfill ? "paused-deployer-owned-18-pools" : "unpaused-deployer-owned-18-pools";
  const expectedExclusions = backfill ? POOL_BACKFILL_EXCLUSIONS : POOL_UNPAUSE_EXCLUSIONS;
  if (
    authorization.schemaVersion !== 1 ||
    authorization.kind !== "POOL_CEREMONY_AUTHORIZATION" ||
    authorization.mode !== mode ||
    authorization.operatorCandidateCommit !== candidateCommit ||
    authorization.releaseId !== manifest.releaseId ||
    authorization.releaseManifestHash !== lock.manifestHash ||
    authorization.releaseSourceCommit !== lock.sourceCommit ||
    authorization.network !== "arbitrum" ||
    authorization.chainId !== 42161 ||
    authorization.authority !== "DEPLOYER" ||
    authorization.planHash !== planHash ||
    JSON.stringify(authorization.authorizedBoundaries) !== JSON.stringify(expectedPoolCeremonyBoundaries(mode)) ||
    authorization.terminalState !== expectedTerminalState ||
    JSON.stringify(authorization.excludedActions) !== JSON.stringify(expectedExclusions) ||
    !authorization.authorizedBy.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(authorization.authorizedOn) ||
    !authorization.authorizationRecord.trim() ||
    !isActiveAuthorizationWindow(authorization.authorizationWindow, now)
  ) {
    throw new Error(`Pool ceremony ${mode} is not bound to the exact reviewed authorization artifact`);
  }
}

function assertPoolCeremonyAuthorization(
  candidateCommit: string,
  authorizationPath: string,
  mode: PoolCeremonyMode,
): void {
  const planPath = backfillPlanPath();
  if (!fs.existsSync(planPath)) {
    throw new Error(`Pool ceremony authorization requires the reviewed plan: ${planPath}`);
  }
  const manifest = loadReleaseManifest();
  validatePoolCeremonyAuthorization(
    readReviewedAuthorization<PoolCeremonyAuthorization>(authorizationPath, `Pool ceremony ${mode}`),
    manifest,
    buildReleaseLock(manifest),
    candidateCommit,
    mode,
    keccak256(toUtf8Bytes(fs.readFileSync(planPath, "utf8"))),
  );
}

function automatedDirtyPaths(repositoryRoot: string): string[] {
  return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1))
    .filter((filePath): filePath is string => filePath !== undefined);
}

export function assertAutomatedSessionStart(
  candidateCommit: string,
  authorizationPath: string,
  repositoryRoot = REPOSITORY_ROOT,
  validatePromotions: (candidate: string, root: string, paths: string[]) => void = assertVerifiedResumePromotions,
  allowedMutations: ReadonlySet<string> = AUTOMATED_RELEASE_MUTATIONS,
): void {
  assertCompleteSequenceAuthorization(candidateCommit, authorizationPath);
  assertAutomatedResumeStart(candidateCommit, repositoryRoot, validatePromotions, allowedMutations);
}

export function assertAutomatedResumeStart(
  candidateCommit: string,
  repositoryRoot = REPOSITORY_ROOT,
  validatePromotions: (candidate: string, root: string, paths: string[]) => void = assertVerifiedResumePromotions,
  allowedMutations: ReadonlySet<string> = AUTOMATED_RELEASE_MUTATIONS,
): void {
  assertAutomatedPinnedCheckout(candidateCommit, repositoryRoot, allowedMutations);
  const dirty = automatedDirtyPaths(repositoryRoot);
  if (dirty.length > 0) validatePromotions(candidateCommit, repositoryRoot, dirty);
}

function requireCompleteGardenSafeCheckpoint(planPath: string, plan: BootstrapPlan | SwapPlan): Checkpoint {
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
  const bootstrapPath = path.join(runtimeRoot, "42220-garden-safe-bootstrap.json");
  const swapPath = path.join(runtimeRoot, "42220-garden-safe-owner-swap.json");
  const replacementsPath = path.join(runtimeRoot, "42220-garden-safe-replacements.json");
  const artifactPath = path.join(repositoryRoot, GARDEN_SAFE_ARTIFACT_PATH);
  if (!fs.existsSync(artifactPath) || !fs.existsSync(bootstrapPath)) {
    throw new Error("Garden Safe promotion is missing its canonical artifact or bootstrap plan");
  }

  const bootstrap = readJson<BootstrapPlan>(bootstrapPath);
  validateBootstrapPlan(bootstrap, inventoryPath);
  const bootstrapCheckpoint = requireCompleteGardenSafeCheckpoint(bootstrapPath, bootstrap);
  let expected = buildBootstrapDeploymentArtifact(bootstrap, bootstrapCheckpoint);

  if (fs.existsSync(swapPath) && fs.existsSync(defaultCheckpointPath(swapPath))) {
    const swap = readJson<SwapPlan>(swapPath);
    const swapCheckpoint = readJson<Checkpoint>(defaultCheckpointPath(swapPath));
    if (swapCheckpoint.completed.length === swap.entries.length) {
      validateSwapPlan(swap, bootstrapPath, inventoryPath, replacementsPath);
      const completeSwapCheckpoint = requireCompleteGardenSafeCheckpoint(swapPath, swap);
      expected = buildSwappedDeploymentArtifact(swap, bootstrap, bootstrapCheckpoint, completeSwapCheckpoint);
    }
  }

  const current = readJson<unknown>(artifactPath);
  const changedPaths = changedPromotionLeafPaths(expected, current).filter(Boolean);
  if (changedPaths.length > 0) {
    throw new Error(`Garden Safe artifact differs from receipt-backed evidence: ${changedPaths.join(", ")}`);
  }
}

export function assertGardenSafeSessionStart(
  candidateCommit: string,
  repositoryRoot = REPOSITORY_ROOT,
  validatePromotion: (candidate: string, root: string, paths: string[]) => void = assertVerifiedGardenSafePromotion,
  allowedMutations: ReadonlySet<string> = GARDEN_SAFE_ARTIFACT_MUTATIONS,
): void {
  assertAutomatedPinnedCheckout(candidateCommit, repositoryRoot, allowedMutations);
  const dirty = automatedDirtyPaths(repositoryRoot);
  if (dirty.length > 0) validatePromotion(candidateCommit, repositoryRoot, dirty);
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

function latestUpgradePlan(contract: string): string | undefined {
  const directory = path.join(CONTRACTS_ROOT, ".generated/release-upgrades");
  if (!fs.existsSync(directory)) return undefined;
  const manifest = loadReleaseManifest();
  const lock = buildReleaseLock(manifest);
  const candidates = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(`42161-${contract}-`) && name.endsWith("-plan.json"))
    .map((name) => path.join(directory, name))
    .filter((filePath) => {
      const plan = readJson<JsonPlan>(filePath);
      return plan.releaseManifestHash === lock.manifestHash && plan.releaseSourceCommit === lock.sourceCommit;
    })
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return (
    candidates.find((filePath) => {
      const plan = readJson<JsonPlan>(filePath);
      const completed = completedBoundaries(filePath);
      return completed > 0 && completed < plan.transactions.length;
    }) ??
    candidates.find((filePath) => completedBoundaries(filePath) === readJson<JsonPlan>(filePath).transactions.length) ??
    candidates[0]
  );
}

function plannedNonce(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^(?:0x[0-9a-f]+|[0-9]+)$/iu.test(value)) return Number(BigInt(value));
  throw new Error(`Invalid planned nonce: ${String(value)}`);
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

function runAutomatedBunCommand(
  candidateCommit: string,
  passwordFile: string,
  script: string,
  args: string[] = [],
  allowedMutations: ReadonlySet<string> = AUTOMATED_RELEASE_MUTATIONS,
): void {
  assertAutomatedPinnedCheckout(candidateCommit, REPOSITORY_ROOT, allowedMutations);
  const beforeDirty = automatedDirtyPaths(REPOSITORY_ROOT);
  if (beforeDirty.length > 0) assertVerifiedResumePromotions(candidateCommit, REPOSITORY_ROOT, beforeDirty);
  console.log(`\n▶ ${script}${args.length > 0 ? ` ${args.join(" ")}` : ""}`);
  const manifest = loadReleaseManifest();
  const result = spawnSync("bun", ["run", script, ...args], {
    cwd: CONTRACTS_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      APP_ENV: "development",
      ETH_PASSWORD: passwordFile,
      FOUNDRY_KEYSTORE_ACCOUNT: manifest.ownership.deploymentKeystore,
      PINATA_GATEWAY: "",
      PINATA_JWT: "",
      PINATA_JWT_OP_REF: "",
    },
  });
  if (result.status !== 0) throw new Error(`${script} failed; release automation stopped`);
  assertAutomatedPinnedCheckout(candidateCommit, REPOSITORY_ROOT, allowedMutations);
  const afterDirty = automatedDirtyPaths(REPOSITORY_ROOT);
  if (afterDirty.length > 0) assertVerifiedResumePromotions(candidateCommit, REPOSITORY_ROOT, afterDirty);
}

async function pendingNonce(network: "arbitrum" | "celo", sender: string): Promise<number> {
  const manager = new NetworkManager();
  const provider = new JsonRpcProvider(manager.getRpcUrl(network), manager.getChainId(network), {
    staticNetwork: true,
  });
  return await provider.getTransactionCount(sender, "pending");
}

export function planBoundaryExecutionSteps(
  planPath: string,
  checkpointPath = defaultCheckpointPath(planPath),
): number[] {
  const plan = readJson<JsonPlan>(planPath);
  const completed = completedBoundaries(planPath, checkpointPath);
  if (completed > plan.transactions.length) throw new Error(`Checkpoint exceeds plan: ${planPath}`);
  if (plan.transactions.length === 0) return [];
  const firstStep = completed > 0 ? completed : 1;
  return Array.from({ length: plan.transactions.length - firstStep + 1 }, (_, index) => firstStep + index);
}

export function assertPlanCanResume(planPath: string, checkpointPath: string, liveNonce: number): JsonPlan {
  const plan = readJson<JsonPlan>(planPath);
  const completed = completedBoundaries(planPath, checkpointPath);
  if (completed > plan.transactions.length) throw new Error(`Checkpoint exceeds plan: ${planPath}`);
  if (completed < plan.transactions.length) {
    const nextNonce = plannedNonce(plan.transactions[completed]?.nonce);
    if (nextNonce !== liveNonce) {
      throw new Error(
        `Cannot resume ${path.basename(planPath)}: next reviewed nonce is ${nextNonce}, live pending nonce is ${liveNonce}. Preserve this plan and recover the mined boundary with --receipt; do not regenerate it`,
      );
    }
  }
  return plan;
}

export function shouldGenerateReviewedPlan(planPath: string, checkpointPath: string, liveNonce: number): boolean {
  if (!fs.existsSync(planPath)) return true;
  assertPlanCanResume(planPath, checkpointPath, liveNonce);
  return false;
}

function runPlanBoundaries(
  candidateCommit: string,
  passwordFile: string,
  script: string,
  artifactFlag: "--plan" | "--artifact",
  planPath: string,
): void {
  const plan = readJson<JsonPlan>(planPath);
  const checkpointPath = defaultCheckpointPath(planPath);
  const completed = completedBoundaries(planPath, checkpointPath);
  const steps = planBoundaryExecutionSteps(planPath, checkpointPath);
  const relativePlan = path.relative(CONTRACTS_ROOT, planPath);
  for (const step of steps) {
    const nonce = plannedNonce(plan.transactions[step - 1]?.nonce);
    runAutomatedBunCommand(candidateCommit, passwordFile, script, [
      artifactFlag,
      relativePlan,
      "--step",
      String(step),
      "--expected-nonce",
      String(nonce),
      "--override-sepolia-gate",
    ]);
  }
  if (completed === plan.transactions.length) {
    console.log(`✓ ${script} already complete; final receipt and post-state reverified`);
  }
}

async function ensureUpgradeStage(
  candidateCommit: string,
  passwordFile: string,
  contract: "assessment-resolver" | "commitment-pooling",
  planScript: "assessment:upgrade:plan:arbitrum" | "pooling:upgrade:plan:arbitrum",
  broadcastScript: "assessment:upgrade:arbitrum" | "pooling:upgrade:arbitrum",
): Promise<void> {
  const sender = loadReleaseManifest().ownership.deploymentSender;
  let planPath = latestUpgradePlan(contract);
  if (planPath && completedBoundaries(planPath) === readJson<JsonPlan>(planPath).transactions.length) {
    runPlanBoundaries(candidateCommit, passwordFile, broadcastScript, "--plan", planPath);
    return;
  }
  const nonce = await pendingNonce("arbitrum", sender);
  if (!planPath) {
    runAutomatedBunCommand(candidateCommit, passwordFile, planScript, ["--expected-nonce", String(nonce)]);
    planPath = latestUpgradePlan(contract);
  }
  if (!planPath) throw new Error(`${contract} transaction plan was not generated`);
  assertPlanCanResume(planPath, defaultCheckpointPath(planPath), nonce);
  runPlanBoundaries(candidateCommit, passwordFile, broadcastScript, "--plan", planPath);
}

async function ensureSchemaStage(
  candidateCommit: string,
  passwordFile: string,
  mode: "preparation" | "finalization",
  planScript: "pooling:schemas:plan:arbitrum" | "pooling:finalize:plan:arbitrum",
  broadcastScript: "pooling:schemas:arbitrum" | "pooling:finalize:arbitrum",
): Promise<void> {
  const planPath = path.join(CONTRACTS_ROOT, `.generated/release-schemas/${mode}/42161-${mode}-transaction-plan.json`);
  if (fs.existsSync(planPath) && completedBoundaries(planPath) === readJson<JsonPlan>(planPath).transactions.length) {
    runPlanBoundaries(candidateCommit, passwordFile, broadcastScript, "--artifact", planPath);
    return;
  }
  const sender = loadReleaseManifest().ownership.deploymentSender;
  const nonce = await pendingNonce("arbitrum", sender);
  if (shouldGenerateReviewedPlan(planPath, defaultCheckpointPath(planPath), nonce)) {
    runAutomatedBunCommand(candidateCommit, passwordFile, planScript, ["--expected-nonce", String(nonce)]);
  }
  assertPlanCanResume(planPath, defaultCheckpointPath(planPath), nonce);
  runPlanBoundaries(candidateCommit, passwordFile, broadcastScript, "--artifact", planPath);
}

async function ensureReleaseStage(
  candidateCommit: string,
  passwordFile: string,
  stage: "pooling" | "settlement-module" | "credit-registry" | "settlement-executor",
  network: "arbitrum" | "celo",
  planScript: string,
  broadcastScript: string,
): Promise<void> {
  const manifest = loadReleaseManifest();
  const directory = path.join(CONTRACTS_ROOT, `.generated/release/${manifest.releaseId}/${network}`);
  const planPath = path.join(directory, `${stage}-transaction-plan.json`);
  const checkpointPath = path.join(directory, `${stage}-checkpoint.json`);
  let completed = fs.existsSync(planPath) ? completedBoundaries(planPath, checkpointPath) : 0;
  const existingPlan = fs.existsSync(planPath) ? readJson<JsonPlan>(planPath) : undefined;
  if (existingPlan && completed > existingPlan.transactions.length) {
    throw new Error(`Checkpoint exceeds plan: ${planPath}`);
  }
  if (existingPlan && completed === existingPlan.transactions.length && completed > 0) {
    const finalStep = existingPlan.transactions.length;
    runAutomatedBunCommand(candidateCommit, passwordFile, broadcastScript, [
      "--step",
      String(finalStep),
      "--expected-nonce",
      String(plannedNonce(existingPlan.transactions[finalStep - 1]?.nonce)),
      "--override-sepolia-gate",
    ]);
    console.log(`✓ ${stage} already complete; final receipt and full stage state reverified`);
    return;
  }
  const liveNonce = await pendingNonce(network, manifest.ownership.deploymentSender);
  if (shouldGenerateReviewedPlan(planPath, checkpointPath, liveNonce)) {
    runAutomatedBunCommand(candidateCommit, passwordFile, planScript, ["--expected-nonce", String(liveNonce)]);
  }
  assertPlanCanResume(planPath, checkpointPath, liveNonce);
  const plan = readJson<JsonPlan>(planPath);
  completed = completedBoundaries(planPath, checkpointPath);
  for (const step of planBoundaryExecutionSteps(planPath, checkpointPath)) {
    const nonce = plannedNonce(plan.transactions[step - 1]?.nonce);
    runAutomatedBunCommand(candidateCommit, passwordFile, broadcastScript, [
      "--step",
      String(step),
      "--expected-nonce",
      String(nonce),
      "--override-sepolia-gate",
    ]);
  }
  if (completed > 0) console.log(`✓ ${stage} resumed only after boundary ${completed} was reverified`);
}

async function runAutomatedRelease(candidateCommit: string, passwordFile: string): Promise<void> {
  console.log("\nStarting resumable paused-candidate deployment. One password, one command, fail closed.");
  await ensureUpgradeStage(
    candidateCommit,
    passwordFile,
    "assessment-resolver",
    "assessment:upgrade:plan:arbitrum",
    "assessment:upgrade:arbitrum",
  );
  await ensureSchemaStage(
    candidateCommit,
    passwordFile,
    "preparation",
    "pooling:schemas:plan:arbitrum",
    "pooling:schemas:arbitrum",
  );
  await ensureReleaseStage(
    candidateCommit,
    passwordFile,
    "pooling",
    "arbitrum",
    "pooling:deploy:plan:arbitrum",
    "pooling:deploy:arbitrum",
  );
  await ensureSchemaStage(
    candidateCommit,
    passwordFile,
    "finalization",
    "pooling:finalize:plan:arbitrum",
    "pooling:finalize:arbitrum",
  );
  await ensureReleaseStage(
    candidateCommit,
    passwordFile,
    "settlement-module",
    "arbitrum",
    "settlement:module:plan:arbitrum",
    "settlement:module:deploy:arbitrum",
  );
  await ensureReleaseStage(
    candidateCommit,
    passwordFile,
    "credit-registry",
    "arbitrum",
    "credit:registry:plan:arbitrum",
    "credit:registry:deploy:arbitrum",
  );
  await ensureUpgradeStage(
    candidateCommit,
    passwordFile,
    "commitment-pooling",
    "pooling:upgrade:plan:arbitrum",
    "pooling:upgrade:arbitrum",
  );
  await ensureReleaseStage(
    candidateCommit,
    passwordFile,
    "settlement-executor",
    "celo",
    "settlement:executor:plan:celo",
    "settlement:executor:deploy:celo",
  );
  console.log("\nPaused deployer-owned candidates are complete on Arbitrum and Celo.");
  console.log("Next separate command: protocol-pool registration and Garden backfill.");
  console.log("Ownership transfer and unpause remain separate ceremonies.");
}

function backfillPlanPath(): string {
  return path.join(CONTRACTS_ROOT, ".generated/runtime/42161-pool-backfill.json");
}

async function runAutomatedPoolBackfill(candidateCommit: string, passwordFile: string): Promise<void> {
  console.log("\nStarting resumable deployer-owned pool registration. Pooling remains paused.");
  const planPath = backfillPlanPath();
  const checkpointPath = planPath.replace(/\.json$/u, ".checkpoint.json");
  const completed = fs.existsSync(checkpointPath) ? completedBoundaries(planPath) : 0;
  if (!fs.existsSync(planPath)) {
    runAutomatedBunCommand(candidateCommit, passwordFile, "pooling:backfill:dry:arbitrum");
  } else if (completed === 0) {
    const liveNonce = await pendingNonce("arbitrum", loadReleaseManifest().ownership.deploymentSender);
    assertPlanCanResume(planPath, checkpointPath, liveNonce);
  }
  if (!fs.existsSync(planPath)) throw new Error("Deployer pool-backfill plan was not generated");
  const plan = readJson<JsonPlan>(planPath);
  if (
    plan.authority !== "DEPLOYER" ||
    plan.transactions.length !== POOL_BACKFILL_REGISTRATION_BOUNDARIES + 1 ||
    plan.transactions[0]?.kind !== "REGISTER_PROTOCOL" ||
    plan.transactions[POOL_BACKFILL_REGISTRATION_BOUNDARIES]?.kind !== "UNPAUSE"
  ) {
    throw new Error("Pool-backfill plan is not the exact deployer-owned root-first registration plan");
  }
  if (completed > POOL_BACKFILL_REGISTRATION_BOUNDARIES) {
    throw new Error("Pooling unpause is already checkpointed; backfill mode cannot report a paused end state");
  }
  const relativePlan = path.relative(CONTRACTS_ROOT, planPath);
  if (completed > 0) {
    const replayStep = completed;
    runAutomatedBunCommand(candidateCommit, passwordFile, "pooling:backfill:arbitrum", [
      "--plan",
      relativePlan,
      "--step",
      String(replayStep),
      "--expected-nonce",
      String(plannedNonce(plan.transactions[replayStep - 1]?.nonce)),
      "--override-sepolia-gate",
    ]);
  }
  const start = completed + 1;
  if (start > POOL_BACKFILL_REGISTRATION_BOUNDARIES) {
    console.log("✓ all 18 pool registrations are already verified; final receipt and pool state reverified");
    return;
  }
  const liveNonce = await pendingNonce("arbitrum", loadReleaseManifest().ownership.deploymentSender);
  const nextNonce = plannedNonce(plan.transactions[start - 1]?.nonce);
  if (nextNonce !== liveNonce) {
    throw new Error(
      `Cannot resume pool backfill: next reviewed nonce is ${nextNonce}, live pending nonce is ${liveNonce}`,
    );
  }
  for (let step = start; step <= POOL_BACKFILL_REGISTRATION_BOUNDARIES; step += 1) {
    runAutomatedBunCommand(candidateCommit, passwordFile, "pooling:backfill:arbitrum", [
      "--plan",
      relativePlan,
      "--step",
      String(step),
      "--expected-nonce",
      String(plannedNonce(plan.transactions[step - 1]?.nonce)),
      "--override-sepolia-gate",
    ]);
  }
  console.log("\nAll 18 pool registrations are receipt-verified. Pooling remains paused.");
  console.log("Unpause requires the separate release:unpause:pooling command and authorization.");
}

async function runAutomatedPoolUnpause(candidateCommit: string, passwordFile: string): Promise<void> {
  console.log("\nStarting separately authorized Commitment Pooling unpause boundary.");
  const planPath = backfillPlanPath();
  if (!fs.existsSync(planPath)) throw new Error("Pool-backfill plan is missing; complete registration first");
  const plan = readJson<JsonPlan>(planPath);
  if (
    plan.authority !== "DEPLOYER" ||
    plan.transactions.length !== POOL_BACKFILL_REGISTRATION_BOUNDARIES + 1 ||
    plan.transactions[POOL_BACKFILL_REGISTRATION_BOUNDARIES]?.kind !== "UNPAUSE"
  ) {
    throw new Error("Pool-backfill plan has no exact separate unpause boundary");
  }
  const completed = completedBoundaries(planPath);
  if (completed === plan.transactions.length) {
    const boundary = plan.transactions[POOL_BACKFILL_REGISTRATION_BOUNDARIES];
    runAutomatedBunCommand(candidateCommit, passwordFile, "pooling:backfill:arbitrum", [
      "--plan",
      path.relative(CONTRACTS_ROOT, planPath),
      "--step",
      String(POOL_BACKFILL_REGISTRATION_BOUNDARIES + 1),
      "--expected-nonce",
      String(plannedNonce(boundary?.nonce)),
      "--override-sepolia-gate",
    ]);
    console.log("✓ Commitment Pooling is already unpaused; complete receipt and pool state reverified");
    return;
  }
  if (completed !== POOL_BACKFILL_REGISTRATION_BOUNDARIES) {
    throw new Error(`Pooling unpause requires 18 verified registrations; checkpoint has ${completed}`);
  }
  const boundary = plan.transactions[POOL_BACKFILL_REGISTRATION_BOUNDARIES];
  const nonce = plannedNonce(boundary?.nonce);
  const liveNonce = await pendingNonce("arbitrum", loadReleaseManifest().ownership.deploymentSender);
  if (nonce !== liveNonce) {
    throw new Error(`Cannot unpause pooling: reviewed nonce is ${nonce}, live pending nonce is ${liveNonce}`);
  }
  runAutomatedBunCommand(candidateCommit, passwordFile, "pooling:backfill:arbitrum", [
    "--plan",
    path.relative(CONTRACTS_ROOT, planPath),
    "--step",
    String(POOL_BACKFILL_REGISTRATION_BOUNDARIES + 1),
    "--expected-nonce",
    String(nonce),
    "--override-sepolia-gate",
  ]);
  console.log("\nCommitment Pooling unpause receipt and all 18 pool registrations are verified.");
}

async function runSession(candidateCommit: string, options: SessionOptions): Promise<void> {
  if (options.deployAll) {
    if (!options.authorization) throw new Error("Complete release sequence authorization is missing");
    assertAutomatedSessionStart(candidateCommit, options.authorization);
  } else if (options.backfillAll || options.unpausePooling) {
    if (!options.authorization) throw new Error("Pool ceremony authorization is missing");
    assertAutomatedResumeStart(candidateCommit);
    assertPoolCeremonyAuthorization(
      candidateCommit,
      options.authorization,
      options.backfillAll ? "pool-backfill" : "pooling-unpause",
    );
  } else {
    assertGardenSafeSessionStart(candidateCommit);
  }
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
    if (options.deployAll) {
      await runAutomatedRelease(candidateCommit, lease.filePath);
      return;
    }
    if (options.backfillAll) {
      await runAutomatedPoolBackfill(candidateCommit, lease.filePath);
      return;
    }
    if (options.unpausePooling) {
      await runAutomatedPoolUnpause(candidateCommit, lease.filePath);
      return;
    }
    console.log("Type help for the allowlist. Type exit when this authorized operator window closes.");
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
        const gardenSafeCommand = command.script.startsWith("settlement:garden-safes:");
        if (gardenSafeCommand) assertGardenSafeSessionStart(candidateCommit);
        else assertPinnedCheckout(candidateCommit);
        const result = spawnSync("bun", ["run", command.script, ...command.args], {
          cwd: CONTRACTS_ROOT,
          stdio: "inherit",
          env: {
            ...process.env,
            APP_ENV: "development",
            ETH_PASSWORD: lease.filePath,
            FOUNDRY_KEYSTORE_ACCOUNT: manifest.ownership.deploymentKeystore,
            PINATA_GATEWAY: "",
            PINATA_JWT: "",
            PINATA_JWT_OP_REF: "",
          },
        });
        if (result.status !== 0) {
          throw new Error(`Bun wrapper ${command.script} failed; the credential session is closed`);
        }
        if (gardenSafeCommand) assertGardenSafeSessionStart(candidateCommit);
        console.log("Boundary returned successfully. Confirm its receipt/checkpoint before entering another command.");
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
    else if (options.commit) await runSession(options.commit, options);
    else throw new Error("Release operator candidate commit was not resolved");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
