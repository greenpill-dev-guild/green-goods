#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { internal as varlockInternal } from "varlock";
import { loadPinataConfigFromEnv, uploadBufferWithPinata } from "../../../scripts/lib/ipfs-hybrid";
import { NetworkManager } from "./utils/network";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(CONTRACTS_ROOT, "../..");

const ACTION_SLUG = "waste.repair_event";
const ACTION_IMAGE_FILENAME = "waste-repair-event.webp";
const CHAIN_ID = 42161;
const DOMAIN_WASTE = 3;
const DEFAULT_KEYSTORE = "green-goods-deployer";
const TEMP_DIR = path.join(CONTRACTS_ROOT, "script", "temp");
const TEMP_SCRIPT = path.join(TEMP_DIR, "DeployRepairEventArbitrumGenerated.s.sol");

const CAPITAL_ENUM: Record<string, number> = {
  SOCIAL: 0,
  MATERIAL: 1,
  FINANCIAL: 2,
  LIVING: 3,
  INTELLECTUAL: 4,
  EXPERIENTIAL: 5,
  SPIRITUAL: 6,
  CULTURAL: 7,
};

interface ActionTemplate {
  aliasFor?: string;
  steps: string[];
  requirements: {
    materials: string[];
    skills: string[];
    timeEstimate: string;
  };
  tips: string[];
}

interface ActionConfig {
  slug: string;
  title: string;
  description: string;
  capitals: string[];
  startTime: string | number;
  endTime: string | number;
  media: string[];
  uiConfig: Record<string, unknown>;
}

interface ActionsData {
  actions: ActionConfig[];
  templates?: Record<string, ActionTemplate>;
}

interface RepairDeployOptions {
  broadcast: boolean;
  dryRun: boolean;
  sender?: string;
  imageCid?: string;
  instructionsCid?: string;
}

interface InstructionsDocument {
  title: string;
  description: string;
  capitals: string[];
  timeframe: {
    start: number;
    end: number;
  };
  uiConfig: Record<string, unknown>;
  steps: string[];
  requirements: ActionTemplate["requirements"];
  tips: string[];
}

async function ensureVarlockEnvLoaded(): Promise<void> {
  if (process.env.__VARLOCK_ENV) return;

  const entryFilePath = path.join(REPO_ROOT, ".env.schema");
  if (!fs.existsSync(entryFilePath)) {
    throw new Error(`Varlock schema not found: ${entryFilePath}`);
  }

  const envGraph = await varlockInternal.loadVarlockEnvGraph({
    currentEnvFallback: process.env.APP_ENV,
    entryFilePath,
  });

  await envGraph.resolveEnvValues();
  varlockInternal.checkForConfigErrors(envGraph);

  const resolvedEnv = envGraph.getResolvedEnvObject();
  const serializedGraph = envGraph.getSerializedGraph();

  Object.assign(process.env, resolvedEnv, {
    __VARLOCK_ENV: JSON.stringify(serializedGraph),
  });

  varlockInternal.initVarlockEnv();
}

function getPinataConfigForUploads() {
  const config = loadPinataConfigFromEnv();
  return config?.jwt ? config : null;
}

function requirePinataConfigForUploads() {
  const config = getPinataConfigForUploads();
  if (!config) {
    throw new Error(
      "PINATA_JWT or VITE_PINATA_JWT is required for uploads. Reuse existing CIDs with --image-cid/--instructions-cid if you need a no-upload run.",
    );
  }
  return config;
}

function showHelp(): void {
  console.log(`
Deploy Repair Event to Arbitrum

Usage:
  bun run contracts:deploy:action:repair:arbitrum
  bun run contracts:deploy:action:repair:dry:arbitrum

Options:
  --broadcast                 Upload image/instructions and register the action on Arbitrum
  --dry-run                   Preflight summary with no uploads or RPC writes
  --sender <address>          Optional sender override passed to forge
  --image-cid <cid>           Reuse an existing image CID instead of uploading the WebP
  --instructions-cid <cid>    Reuse an existing instructions CID instead of uploading JSON
  --help                      Show this help

Notes:
  - Preferred entrypoint is the root package.json wrapper so env comes from varlock/1Password
  - Uploads use Pinata and require PINATA_JWT (or VITE_PINATA_JWT)
  - Uses Foundry keystore account from FOUNDRY_KEYSTORE_ACCOUNT
  - Defaults to keystore "${DEFAULT_KEYSTORE}" if env var is unset
  - Upload source image: config/action-images/${ACTION_IMAGE_FILENAME}
  `);
}

function parseOptions(args: string[]): RepairDeployOptions {
  let broadcast = false;
  let dryRun = false;
  let sender: string | undefined;
  let imageCid: string | undefined;
  let instructionsCid: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--broadcast":
        broadcast = true;
        break;
      case "--dry-run":
      case "--pure-simulation":
        dryRun = true;
        break;
      case "--sender": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--sender requires an address value");
        sender = value;
        i += 1;
        break;
      }
      case "--image-cid": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--image-cid requires a CID value");
        imageCid = value;
        i += 1;
        break;
      }
      case "--instructions-cid": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--instructions-cid requires a CID value");
        instructionsCid = value;
        i += 1;
        break;
      }
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  if (broadcast === dryRun) {
    throw new Error("Pass exactly one of --broadcast or --dry-run");
  }

  return { broadcast, dryRun, sender, imageCid, instructionsCid };
}

function readActionsData(): ActionsData {
  const actionsPath = path.join(CONTRACTS_ROOT, "config", "actions.json");
  return JSON.parse(fs.readFileSync(actionsPath, "utf8")) as ActionsData;
}

function getRepairEventAction(data: ActionsData): ActionConfig {
  const action = data.actions.find((entry) => entry.slug === ACTION_SLUG);
  if (!action) {
    throw new Error(`Action ${ACTION_SLUG} not found in config/actions.json`);
  }
  return action;
}

function parseTimestamp(value: string | number, fieldName: string): number {
  if (typeof value === "number") return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return Math.floor(parsed.getTime() / 1000);
}

function getTemplateForAction(title: string, templates: Record<string, ActionTemplate>): ActionTemplate {
  const lowerTitle = title.toLowerCase();
  const keywordPriority = ["identify", "observe", "water", "litter", "waste", "plant", "harvest", "workshop"];

  for (const keyword of keywordPriority) {
    if (!lowerTitle.includes(keyword)) continue;
    const template = templates[keyword];
    if (!template) continue;
    if (template.aliasFor) return templates[template.aliasFor] || templates.default;
    return template;
  }

  return (
    templates.default || {
      steps: [],
      requirements: { materials: [], skills: [], timeEstimate: "30-60 minutes" },
      tips: [],
    }
  );
}

function buildInstructionsDocument(
  action: ActionConfig,
  templates: Record<string, ActionTemplate>,
): InstructionsDocument {
  const template = getTemplateForAction(action.title, templates);

  return {
    title: action.title,
    description: action.description,
    capitals: action.capitals,
    timeframe: {
      start: parseTimestamp(action.startTime, "startTime"),
      end: parseTimestamp(action.endTime, "endTime"),
    },
    uiConfig: action.uiConfig,
    steps: template.steps,
    requirements: template.requirements,
    tips: template.tips,
  };
}

async function uploadRepairImage(imagePath: string): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Repair image not found: ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const pinataConfig = requirePinataConfigForUploads();

  console.log("Uploading repair image to Pinata");
  return uploadBufferWithPinata(pinataConfig, imageBuffer, {
    filename: path.basename(imagePath),
    mimeType: "image/webp",
    name: path.basename(imagePath),
    metadata: {
      source: "action-image",
      slug: ACTION_SLUG,
    },
  });
}

async function uploadInstructions(document: InstructionsDocument): Promise<string> {
  const payload = Buffer.from(JSON.stringify(document, null, 2));
  const pinataConfig = requirePinataConfigForUploads();

  console.log("Uploading instructions to Pinata");
  return uploadBufferWithPinata(pinataConfig, payload, {
    filename: `${ACTION_SLUG}.json`,
    mimeType: "application/json",
    name: `${ACTION_SLUG}.json`,
    metadata: {
      source: "action-instructions",
      slug: ACTION_SLUG,
    },
  });
}

function normalizeInstructionsCid(value: string): string {
  return value.replace(/^ipfs:\/\//i, "").trim();
}

function normalizeMediaReference(value: string): string {
  return value.startsWith("ipfs://") ? value : `ipfs://${value.replace(/^ipfs:\/\//i, "").trim()}`;
}

function buildSolidityScript(params: {
  actionRegistry: string;
  title: string;
  slug: string;
  startTime: number;
  endTime: number;
  instructionsCid: string;
  mediaReference: string;
  capitals: string[];
}): string {
  const capitalAssignments = params.capitals
    .map((capital, index) => {
      if (!Object.hasOwn(CAPITAL_ENUM, capital)) {
        throw new Error(`Unsupported capital ${capital} on ${ACTION_SLUG}`);
      }
      return `capitals[${index}] = Capital.${capital};`;
    })
    .join("\n        ");

  return `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { ActionRegistry, Capital, Domain } from "../../src/registries/Action.sol";

contract DeployRepairEventArbitrumGenerated is Script {
    function run() external {
        vm.startBroadcast();

        ActionRegistry registry = ActionRegistry(${params.actionRegistry});

        Capital[] memory capitals = new Capital[](${params.capitals.length});
        ${capitalAssignments}

        string[] memory media = new string[](1);
        media[0] = ${JSON.stringify(params.mediaReference)};

        registry.registerAction(
            ${params.startTime},
            ${params.endTime},
            ${JSON.stringify(params.title)},
            ${JSON.stringify(params.slug)},
            ${JSON.stringify(params.instructionsCid)},
            capitals,
            media,
            Domain.WASTE
        );

        vm.stopBroadcast();
        console.log("Registered action: ${params.slug}");
    }
}
`;
}

function ensureFoundryKeystore(keystoreName: string): void {
  try {
    execFileSync("cast", ["wallet", "address", "--account", keystoreName], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: CONTRACTS_ROOT,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to resolve Foundry keystore "${keystoreName}": ${message}`);
  }
}

function loadActionRegistryAddress(): string {
  const deploymentPath = path.join(CONTRACTS_ROOT, "deployments", `${CHAIN_ID}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file missing: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as {
    actionRegistry?: string;
  };

  if (!deployment.actionRegistry) {
    throw new Error(`actionRegistry missing from ${deploymentPath}`);
  }

  return deployment.actionRegistry;
}

function runForge(scriptPath: string, options: RepairDeployOptions): void {
  const networkManager = new NetworkManager();
  const rpcUrl = networkManager.getRpcUrl("arbitrum");
  const chainId = networkManager.getChainId("arbitrum");
  const forgeArgs = [
    "script",
    `${scriptPath}:DeployRepairEventArbitrumGenerated`,
    "--rpc-url",
    rpcUrl,
    "--chain-id",
    chainId.toString(),
  ];

  if (options.sender) {
    forgeArgs.push("--sender", options.sender);
  } else if (process.env.SENDER_ADDRESS) {
    forgeArgs.push("--sender", process.env.SENDER_ADDRESS);
  }

  if (options.broadcast) {
    const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || DEFAULT_KEYSTORE;
    ensureFoundryKeystore(keystoreName);
    forgeArgs.push("--broadcast", "--account", keystoreName);
    console.log(`🔐 Using Foundry keystore: ${keystoreName}`);
    console.log("💡 Password will be prompted interactively\n");
  }

  console.log(`Executing: forge ${forgeArgs.join(" ")}\n`);

  execFileSync("forge", forgeArgs, {
    stdio: "inherit",
    cwd: CONTRACTS_ROOT,
    env: {
      ...process.env,
      FOUNDRY_PROFILE: "production",
      FORGE_BROADCAST: options.broadcast ? "true" : "false",
    },
  });
}

function writeTempScript(contents: string): string {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(TEMP_SCRIPT, contents);
  return TEMP_SCRIPT;
}

function cleanupTempScript(): void {
  try {
    if (fs.existsSync(TEMP_SCRIPT)) fs.unlinkSync(TEMP_SCRIPT);
  } catch {
    // Best-effort cleanup only.
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  let options: RepairDeployOptions;
  try {
    options = parseOptions(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    showHelp();
    process.exit(1);
  }

  if (options.broadcast) {
    await ensureVarlockEnvLoaded();
  }

  const actionsData = readActionsData();
  const action = getRepairEventAction(actionsData);
  const actionRegistry = loadActionRegistryAddress();
  const startTime = parseTimestamp(action.startTime, "startTime");
  const endTime = parseTimestamp(action.endTime, "endTime");
  const imagePath = path.join(CONTRACTS_ROOT, "config", "action-images", ACTION_IMAGE_FILENAME);

  console.log(`Preparing ${ACTION_SLUG} for Arbitrum`);
  console.log(`Action registry: ${actionRegistry}`);
  console.log(`Start time: ${startTime} (${new Date(startTime * 1000).toISOString()})`);
  console.log(`End time:   ${endTime} (${new Date(endTime * 1000).toISOString()})`);
  console.log(`Image path: ${imagePath}`);

  if (options.dryRun) {
    const scriptPath = writeTempScript(
      buildSolidityScript({
        actionRegistry,
        title: action.title,
        slug: action.slug,
        startTime,
        endTime,
        instructionsCid: options.instructionsCid
          ? normalizeInstructionsCid(options.instructionsCid)
          : "bafybeigdyrunsimulationonlyrepairinstructionscid",
        mediaReference: options.imageCid
          ? normalizeMediaReference(options.imageCid)
          : "ipfs://bafybeigdyrunsimulationonlyrepairimagecid",
        capitals: action.capitals,
      }),
    );

    try {
      console.log("\n🧪 Dry run mode enabled (no uploads, no broadcast)");

      console.log(`\nGenerated script: ${scriptPath}`);
      console.log("\nWould deploy with:");
      console.log(`  title: ${action.title}`);
      console.log(`  slug: ${action.slug}`);
      console.log(`  domain: WASTE (${DOMAIN_WASTE})`);
      console.log(`  capitals: ${action.capitals.join(", ")}`);
      console.log(
        `  instructions CID: ${options.instructionsCid ? normalizeInstructionsCid(options.instructionsCid) : "<upload at runtime>"}`,
      );
      console.log(`  media: ${options.imageCid ? normalizeMediaReference(options.imageCid) : "<upload at runtime>"}`);
      console.log(`\nRun this for the actual deployment: bun run contracts:deploy:action:repair:arbitrum`);
    } finally {
      cleanupTempScript();
    }

    return;
  }

  const instructionsCid = options.instructionsCid
    ? normalizeInstructionsCid(options.instructionsCid)
    : await uploadInstructions(buildInstructionsDocument(action, actionsData.templates ?? {}));
  const imageCid = options.imageCid
    ? normalizeMediaReference(options.imageCid)
    : normalizeMediaReference(await uploadRepairImage(imagePath));

  console.log(`\nInstructions CID: ${instructionsCid}`);
  console.log(`Image reference:  ${imageCid}`);

  const scriptPath = writeTempScript(
    buildSolidityScript({
      actionRegistry,
      title: action.title,
      slug: action.slug,
      startTime,
      endTime,
      instructionsCid,
      mediaReference: imageCid,
      capitals: action.capitals,
    }),
  );

  try {
    runForge(scriptPath, options);
    console.log("\n✅ Repair Event deployed to Arbitrum successfully");
  } finally {
    cleanupTempScript();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ ${message}`);
  process.exit(1);
});
