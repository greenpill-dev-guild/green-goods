#!/usr/bin/env bun

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import * as dotenv from "dotenv";
import { getAddress, JsonRpcProvider } from "ethers";
import { NetworkManager } from "./utils/network";
import { buildReleaseLock, loadReleaseManifest } from "./utils/release-manifest";

const CONTRACTS_ROOT = path.join(__dirname, "..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");
dotenv.config({ path: path.join(REPOSITORY_ROOT, ".env"), quiet: true });

const AUTOMATED_RELEASE_MUTATIONS = new Set([
  "packages/contracts/deployments/42161-latest.json",
  "packages/contracts/deployments/42220-latest.json",
]);

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

export const POOL_BACKFILL_REGISTRATION_BOUNDARIES = 18;

export const RELEASE_OPERATOR_COMMANDS = new Map<string, string>([
  ["assessment:upgrade:arbitrum", "AssessmentResolver upgrade and canonical-v2 pin boundaries"],
  ["pooling:schemas:arbitrum", "TestimonyResolver and AssessmentV3 schema preparation boundaries"],
  ["pooling:deploy:arbitrum", "paused Commitment Pooling library/implementation/proxy boundaries"],
  ["pooling:finalize:arbitrum", "Community Testimony record and resolver finalization boundaries"],
  ["settlement:module:deploy:arbitrum", "paused Arbitrum SettlementModule boundaries"],
  ["credit:registry:deploy:arbitrum", "paused records-only CreditRegistry boundaries"],
  ["pooling:upgrade:arbitrum", "GardenToken and WorkApprovalResolver integration-upgrade boundaries"],
  ["settlement:executor:deploy:celo", "paused CeloSettlementExecutor boundaries"],
  ["settlement:garden-safes:deploy:celo", "empty 1-of-2 Garden Safe bootstrap boundaries"],
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
  bun run release:deploy:all -- --commit <exact-40-character-candidate>
  bun run release:backfill:all -- --commit <exact-40-character-candidate>
  bun run release:unpause:pooling -- --commit <exact-40-character-candidate>

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
Ownership transfer, pool backfill, unpause, peer wiring, Safe authority, and value movement are
excluded from that command.

--backfill-all derives one finalized, root-Protocol-first plan and executes only registration
boundaries 1-18 through the temporary deployment-sender owner. It keeps pooling paused and never
transfers ownership. --unpause-pooling executes only boundary 19 after every registration receipt
and pool ID is verified. Peer wiring, Safe authority, value movement, and ownership transfer remain
excluded from both commands.

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

function completedBoundaries(planPath: string): number {
  const checkpointPath = planPath.replace(/\.json$/u, ".checkpoint.json");
  if (!fs.existsSync(checkpointPath)) return 0;
  const checkpoint = readJson<{ completed?: unknown[]; verifiedBoundaries?: unknown[] }>(checkpointPath);
  return checkpoint.completed?.length ?? checkpoint.verifiedBoundaries?.length ?? 0;
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
}

async function pendingNonce(network: "arbitrum" | "celo", sender: string): Promise<number> {
  const manager = new NetworkManager();
  const provider = new JsonRpcProvider(manager.getRpcUrl(network), manager.getChainId(network), {
    staticNetwork: true,
  });
  return await provider.getTransactionCount(sender, "pending");
}

function assertPlanCanResume(planPath: string, liveNonce: number): JsonPlan {
  const plan = readJson<JsonPlan>(planPath);
  const completed = completedBoundaries(planPath);
  if (completed > plan.transactions.length) throw new Error(`Checkpoint exceeds plan: ${planPath}`);
  if (completed < plan.transactions.length) {
    const nextNonce = plannedNonce(plan.transactions[completed]?.nonce);
    if (nextNonce !== liveNonce) {
      throw new Error(
        `Cannot resume ${path.basename(planPath)}: next reviewed nonce is ${nextNonce}, live pending nonce is ${liveNonce}`,
      );
    }
  }
  return plan;
}

function runPlanBoundaries(
  candidateCommit: string,
  passwordFile: string,
  script: string,
  artifactFlag: "--plan" | "--artifact",
  planPath: string,
): void {
  const plan = readJson<JsonPlan>(planPath);
  const start = completedBoundaries(planPath) + 1;
  if (start > plan.transactions.length) {
    console.log(`✓ ${script} already complete`);
    return;
  }
  const relativePlan = path.relative(CONTRACTS_ROOT, planPath);
  for (let step = start; step <= plan.transactions.length; step += 1) {
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
    console.log(`✓ ${contract} already complete`);
    return;
  }
  const nonce = await pendingNonce("arbitrum", sender);
  if (!planPath || completedBoundaries(planPath) === 0) {
    if (!planPath || readJson<JsonPlan>(planPath).expectedNonce !== nonce) {
      runAutomatedBunCommand(candidateCommit, passwordFile, planScript, ["--expected-nonce", String(nonce)]);
      planPath = latestUpgradePlan(contract);
    }
  }
  if (!planPath) throw new Error(`${contract} transaction plan was not generated`);
  assertPlanCanResume(planPath, nonce);
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
    console.log(`✓ schema ${mode} already complete`);
    return;
  }
  const sender = loadReleaseManifest().ownership.deploymentSender;
  const nonce = await pendingNonce("arbitrum", sender);
  if (!fs.existsSync(planPath) || completedBoundaries(planPath) === 0) {
    if (!fs.existsSync(planPath) || readJson<JsonPlan>(planPath).expectedNonce !== nonce) {
      runAutomatedBunCommand(candidateCommit, passwordFile, planScript, ["--expected-nonce", String(nonce)]);
    }
  }
  assertPlanCanResume(planPath, nonce);
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
  if (fs.existsSync(planPath) && fs.existsSync(checkpointPath)) {
    const plan = readJson<JsonPlan>(planPath);
    const checkpoint = readJson<{ lastVerifiedStep?: number }>(checkpointPath);
    if (checkpoint.lastVerifiedStep === plan.transactions.length) {
      console.log(`✓ ${stage} already complete`);
      return;
    }
  }
  runAutomatedBunCommand(candidateCommit, passwordFile, planScript);
  const plan = readJson<JsonPlan>(planPath);
  const checkpoint = fs.existsSync(checkpointPath)
    ? readJson<{ lastVerifiedStep?: number }>(checkpointPath)
    : undefined;
  const start = (checkpoint?.lastVerifiedStep ?? 0) + 1;
  for (let step = start; step <= plan.transactions.length; step += 1) {
    const nonce = await pendingNonce(network, manifest.ownership.deploymentSender);
    runAutomatedBunCommand(candidateCommit, passwordFile, broadcastScript, [
      "--step",
      String(step),
      "--expected-nonce",
      String(nonce),
      "--override-sepolia-gate",
    ]);
  }
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
  if (completed === 0) {
    runAutomatedBunCommand(candidateCommit, passwordFile, "pooling:backfill:dry:arbitrum", [], new Set());
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
  const start = completedBoundaries(planPath) + 1;
  if (start > POOL_BACKFILL_REGISTRATION_BOUNDARIES) {
    console.log("✓ all 18 pool registrations are already verified; pooling remains paused");
    return;
  }
  const liveNonce = await pendingNonce("arbitrum", loadReleaseManifest().ownership.deploymentSender);
  const nextNonce = plannedNonce(plan.transactions[start - 1]?.nonce);
  if (nextNonce !== liveNonce) {
    throw new Error(
      `Cannot resume pool backfill: next reviewed nonce is ${nextNonce}, live pending nonce is ${liveNonce}`,
    );
  }
  const relativePlan = path.relative(CONTRACTS_ROOT, planPath);
  for (let step = start; step <= POOL_BACKFILL_REGISTRATION_BOUNDARIES; step += 1) {
    runAutomatedBunCommand(
      candidateCommit,
      passwordFile,
      "pooling:backfill:arbitrum",
      [
        "--plan",
        relativePlan,
        "--step",
        String(step),
        "--expected-nonce",
        String(plannedNonce(plan.transactions[step - 1]?.nonce)),
        "--override-sepolia-gate",
      ],
      new Set(),
    );
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
    console.log("✓ Commitment Pooling is already unpaused and verified");
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
  runAutomatedBunCommand(
    candidateCommit,
    passwordFile,
    "pooling:backfill:arbitrum",
    [
      "--plan",
      path.relative(CONTRACTS_ROOT, planPath),
      "--step",
      String(POOL_BACKFILL_REGISTRATION_BOUNDARIES + 1),
      "--expected-nonce",
      String(nonce),
      "--override-sepolia-gate",
    ],
    new Set(),
  );
  console.log("\nCommitment Pooling unpause receipt and all 18 pool registrations are verified.");
}

async function runSession(candidateCommit: string, options: SessionOptions): Promise<void> {
  const automated = options.deployAll || options.backfillAll || options.unpausePooling;
  if (options.deployAll) assertAutomatedPinnedCheckout(candidateCommit);
  else if (automated) assertAutomatedPinnedCheckout(candidateCommit, REPOSITORY_ROOT, new Set());
  else assertPinnedCheckout(candidateCommit);
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
        assertPinnedCheckout(candidateCommit);
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
