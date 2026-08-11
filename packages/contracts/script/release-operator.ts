#!/usr/bin/env bun

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { getAddress } from "ethers";
import { loadReleaseManifest } from "./utils/release-manifest";

const CONTRACTS_ROOT = path.join(__dirname, "..");
const REPOSITORY_ROOT = path.join(CONTRACTS_ROOT, "../..");

export const RELEASE_OPERATOR_COMMANDS = new Map<string, string>([
  ["assessment:upgrade:arbitrum", "AssessmentResolver upgrade and canonical-v2 pin boundaries"],
  ["pooling:schemas:arbitrum", "TestimonyResolver and AssessmentV3 schema preparation boundaries"],
  ["pooling:deploy:arbitrum", "paused Commitment Pooling library/implementation/proxy boundaries"],
  ["pooling:finalize:arbitrum", "Community Testimony record and resolver finalization boundaries"],
  ["settlement:module:deploy:arbitrum", "paused Arbitrum SettlementModule boundaries"],
  ["credit:registry:deploy:arbitrum", "paused records-only CreditRegistry boundaries"],
  ["pooling:upgrade:arbitrum", "GardenToken and WorkApprovalResolver integration-upgrade boundaries"],
  ["settlement:executor:deploy:celo", "paused CeloSettlementExecutor boundaries"],
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
]);

const BOOLEAN_ARGUMENTS = new Set(["--override-sepolia-gate"]);

export interface SessionOptions {
  commit?: string;
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
  const allowedArguments = RELEASE_OPERATOR_ARGUMENTS.get(script)!;
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

function assertPinnedCheckout(candidateCommit: string): void {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPOSITORY_ROOT, encoding: "utf8" }).trim();
  if (head !== candidateCommit)
    throw new Error(`Candidate mismatch: requested ${candidateCommit}, checkout is ${head}`);
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  if (status.trim()) throw new Error("Release operator session requires a clean checkout before the first boundary");
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

async function runSession(candidateCommit: string): Promise<void> {
  assertPinnedCheckout(candidateCommit);
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
    else await runSession(options.commit!);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
