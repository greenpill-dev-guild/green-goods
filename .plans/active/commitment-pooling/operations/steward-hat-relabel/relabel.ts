#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NetworkManager } from "../../../../../packages/contracts/script/utils/network";
import {
  redactRpcUrlsInText,
  redactSensitiveArgs,
} from "../../../../../packages/contracts/script/utils/cli-parser";

export interface RelabelPlan {
  version: number;
  chainId: string;
  caller: string;
  hatsProtocol: string;
  targetCount: number;
  transactions: unknown[];
}

interface RelabelTransaction {
  tokenId: string;
  garden: string;
  operatorHatId: string;
  currentDetails: string;
  targetDetails: string;
  to: string;
  value: string;
  contractMethod: {
    inputs: Array<{ internalType: string; name: string; type: string }>;
    name: string;
    payable: boolean;
  };
  contractInputsValues: {
    _hatId: string;
    _newDetails: string;
  };
}

interface Options {
  planPath: string;
  expectedCount: number;
  broadcast: boolean;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_ROOT = path.resolve(MODULE_DIR, "../../../../../packages/contracts");
const REPO_ROOT = path.resolve(CONTRACTS_ROOT, "../..");
const REVIEWED_PLAN_PATH = path.join(
  CONTRACTS_ROOT,
  "deployments/tx-plans/42161-steward-relabel-488705295-plan.json",
);
const REVIEWED_PLAN_SHA256 = "ee65f0b10965a22c63c07d1132ee23086f07231cba6ee93005cc923ed6957770";
const REVIEWED_TARGET_COUNT = 18;
const EXPECTED_CALLER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const ARBITRUM_CHAIN_ID = 42_161;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const REVIEWED_PLAN = JSON.parse(fs.readFileSync(REVIEWED_PLAN_PATH, "utf8")) as RelabelPlan;
const UNIVERSAL_HATS = REVIEWED_PLAN.hatsProtocol;

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

export function validateRelabelPlan(plan: RelabelPlan, expectedCount: number): void {
  if (expectedCount !== REVIEWED_TARGET_COUNT) {
    throw new Error(`Relabel target count must equal the reviewed count ${REVIEWED_TARGET_COUNT}`);
  }
  if (
    plan.version !== 1 ||
    plan.chainId !== ARBITRUM_CHAIN_ID.toString() ||
    plan.targetCount !== REVIEWED_TARGET_COUNT ||
    !Array.isArray(plan.transactions) ||
    plan.transactions.length !== REVIEWED_TARGET_COUNT
  ) {
    throw new Error("Relabel plan version, chain, or target count does not match the reviewed operation");
  }
  if (typeof plan.caller !== "string" || plan.caller.toLowerCase() !== EXPECTED_CALLER.toLowerCase()) {
    throw new Error(`Relabel plan caller ${plan.caller} does not match ${EXPECTED_CALLER}`);
  }
  if (
    typeof plan.hatsProtocol !== "string" ||
    plan.hatsProtocol.toLowerCase() !== UNIVERSAL_HATS.toLowerCase()
  ) {
    throw new Error(`Relabel plan Hats Protocol ${plan.hatsProtocol} does not match ${UNIVERSAL_HATS}`);
  }

  const gardenAddresses = new Set<string>();
  const operatorHatIds = new Set<string>();
  const reviewedTransactions = REVIEWED_PLAN.transactions;

  for (let index = 0; index < plan.transactions.length; index++) {
    const transaction = plan.transactions[index] as Partial<RelabelTransaction>;
    const reviewedTransaction = reviewedTransactions[index];
    const expectedTokenId = index.toString();

    if (
      transaction.tokenId !== expectedTokenId ||
      typeof transaction.garden !== "string" ||
      !ADDRESS_PATTERN.test(transaction.garden) ||
      typeof transaction.operatorHatId !== "string" ||
      !/^\d+$/.test(transaction.operatorHatId) ||
      BigInt(transaction.operatorHatId) === 0n
    ) {
      throw new Error(`Relabel transaction ${index} has an invalid reviewed identity`);
    }

    const normalizedGarden = transaction.garden.toLowerCase();
    const normalizedHatId = BigInt(transaction.operatorHatId).toString();
    if (gardenAddresses.has(normalizedGarden) || operatorHatIds.has(normalizedHatId)) {
      throw new Error(`Relabel transaction ${index} duplicates a reviewed garden or operator hat`);
    }
    gardenAddresses.add(normalizedGarden);
    operatorHatIds.add(normalizedHatId);

    if (
      typeof transaction.currentDetails !== "string" ||
      !transaction.currentDetails.endsWith(" Operator") ||
      transaction.currentDetails.slice(0, -" Operator".length).trim().length === 0
    ) {
      throw new Error(`Relabel transaction ${index} has invalid current Operator details`);
    }
    const expectedTarget = `${transaction.currentDetails.slice(0, -" Operator".length)} Steward`;
    if (
      transaction.targetDetails !== expectedTarget ||
      transaction.to?.toLowerCase() !== UNIVERSAL_HATS.toLowerCase() ||
      transaction.value !== "0" ||
      transaction.contractMethod?.name !== "changeHatDetails" ||
      transaction.contractMethod.payable !== false ||
      JSON.stringify(transaction.contractMethod.inputs) !==
        JSON.stringify([
          { internalType: "uint256", name: "_hatId", type: "uint256" },
          { internalType: "string", name: "_newDetails", type: "string" },
        ]) ||
      transaction.contractInputsValues?._hatId !== transaction.operatorHatId ||
      transaction.contractInputsValues._newDetails !== expectedTarget
    ) {
      throw new Error(`Relabel transaction ${index} is not the reviewed changeHatDetails operation`);
    }

    if (JSON.stringify(transaction) !== JSON.stringify(reviewedTransaction)) {
      throw new Error(`Relabel transaction ${index} does not match the checked-in reviewed operation`);
    }
  }
}

export function validateReviewedPlanArtifact(planPath: string, contents: string): void {
  if (path.resolve(planPath) !== REVIEWED_PLAN_PATH) {
    throw new Error(`Relabel plan must be the reviewed artifact ${REVIEWED_PLAN_PATH}`);
  }
  const digest = createHash("sha256").update(contents).digest("hex");
  if (digest !== REVIEWED_PLAN_SHA256) {
    throw new Error(`Relabel plan digest ${digest} does not match the reviewed artifact`);
  }
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const planContents = fs.readFileSync(options.planPath, "utf8");
  validateReviewedPlanArtifact(options.planPath, planContents);
  const plan = JSON.parse(planContents) as RelabelPlan;
  validateRelabelPlan(plan, options.expectedCount);

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

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Steward relabel failed: ${redactRpcUrlsInText(message)}`);
    process.exit(1);
  }
}
