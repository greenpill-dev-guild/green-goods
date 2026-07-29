#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { NetworkManager } from "../../../../../packages/contracts/script/utils/network";
import { redactSensitiveArgs } from "../../../../../packages/contracts/script/utils/cli-parser";

interface RelabelPlan {
  version: number;
  chainId: string;
  caller: string;
  hatsProtocol: string;
  targetCount: number;
  transactions: unknown[];
}

interface Options {
  planPath: string;
  expectedCount: number;
  broadcast: boolean;
}

const CONTRACTS_ROOT = path.resolve(import.meta.dir, "../../../../../packages/contracts");
const REPO_ROOT = path.resolve(CONTRACTS_ROOT, "../..");
const EXPECTED_CALLER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const ARBITRUM_CHAIN_ID = 42_161;

function usage(exitCode = 1): never {
  console.error(`Usage:
  bun relabel.ts --plan <path> --expected-count <n> [--broadcast]

The plan must be a reviewed direct-admin plan stored inside packages/contracts.
Without --broadcast, the command performs a full Arbitrum simulation only.`);
  process.exit(exitCode);
}

function parseOptions(argv: string[]): Options {
  let planPath: string | undefined;
  let expectedCount: number | undefined;
  let broadcast = false;

  for (let index = 0; index < argv.length; index++) {
    switch (argv[index]) {
      case "--plan":
        {
          const planArgument = argv[++index] ?? "";
          planPath = [path.resolve(process.cwd(), planArgument), path.resolve(REPO_ROOT, planArgument)].find(
            (candidate) => fs.existsSync(candidate),
          );
        }
        break;
      case "--expected-count":
        expectedCount = Number(argv[++index]);
        break;
      case "--broadcast":
        broadcast = true;
        break;
      case "--help":
      case "-h":
        usage(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }

  if (!planPath || !fs.existsSync(planPath)) throw new Error("--plan must name an existing direct-admin plan");
  if (!Number.isInteger(expectedCount) || (expectedCount ?? 0) <= 0) {
    throw new Error("--expected-count must be a positive integer");
  }

  const relativePlanPath = path.relative(CONTRACTS_ROOT, planPath);
  if (relativePlanPath.startsWith("..") || path.isAbsolute(relativePlanPath)) {
    throw new Error("Relabel plan must be stored inside packages/contracts");
  }

  return { planPath, expectedCount: expectedCount as number, broadcast };
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const plan = JSON.parse(fs.readFileSync(options.planPath, "utf8")) as RelabelPlan;
  if (
    plan.version !== 1 ||
    plan.chainId !== ARBITRUM_CHAIN_ID.toString() ||
    plan.targetCount !== options.expectedCount ||
    plan.transactions.length !== options.expectedCount
  ) {
    throw new Error("Relabel plan version, chain, or target count does not match the reviewed operation");
  }
  if (plan.caller.toLowerCase() !== EXPECTED_CALLER.toLowerCase()) {
    throw new Error(`Relabel plan caller ${plan.caller} does not match ${EXPECTED_CALLER}`);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(plan.hatsProtocol)) {
    throw new Error(`Invalid Hats Protocol address: ${plan.hatsProtocol}`);
  }

  const networkManager = new NetworkManager();
  const rpcUrl = networkManager.getRpcUrl("arbitrum");
  const forgeArgs = [
    "script",
    "script/RelabelStewardHats.s.sol:RelabelStewardHats",
    "--sig",
    "run()",
    "--rpc-url",
    rpcUrl,
    "--chain-id",
    ARBITRUM_CHAIN_ID.toString(),
    "--sender",
    plan.caller,
  ];

  if (options.broadcast) {
    const account = process.env.FOUNDRY_KEYSTORE_ACCOUNT;
    if (!account) throw new Error("FOUNDRY_KEYSTORE_ACCOUNT is required for broadcast");
    forgeArgs.push("--broadcast", "--account", account);
    console.log(`🔐 Using Foundry keystore: ${account}`);
    console.log("💡 Password will be prompted interactively\n");
  } else {
    console.log("🧪 Steward relabel simulation only (no broadcast)\n");
  }

  console.log(`Plan: ${options.planPath}`);
  console.log(`Targets: ${plan.targetCount}`);
  console.log(`Caller: ${plan.caller}`);
  console.log(`Executing: forge ${redactSensitiveArgs(forgeArgs).join(" ")}\n`);

  execFileSync("forge", forgeArgs, {
    cwd: CONTRACTS_ROOT,
    env: {
      ...process.env,
      STEWARD_RELABEL_PLAN: options.planPath,
    },
    stdio: "inherit",
  });

  console.log(options.broadcast ? "\n✅ Steward relabel broadcast completed" : "\n✅ Steward relabel simulation completed");
}

try {
  main();
} catch (error) {
  console.error(`\n❌ Steward relabel failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
