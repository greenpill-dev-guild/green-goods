#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

import type {
  ActionInstructionConfig,
  ActionInstructionConfigV2,
  ActionTranslationMap,
  ActionTranslationRecord,
  WorkInput,
} from "../../shared/src/types/domain";
import { defaultTemplate, instructionTemplates } from "../../shared/src/utils/action/templates";
import {
  ACTION_TRANSLATION_LOCALES,
  buildActionInstructionsV2,
  getActionSourceHash,
  hasActionTranslationContent,
  hasCompleteActionTranslationContent,
  normalizeActionTranslations,
} from "../../shared/src/utils/action/translations";
import { ACTION_INSTRUCTIONS_V2_CACHE_PATH, CONFIG_ROOT, DEPLOYMENTS_ROOT, ensureParentDir } from "./utils/paths";
import { CHAIN_ID_MAP, NetworkManager } from "./utils/network";
import { loadPinataConfigFromEnv, uploadBufferWithPinata } from "../../../scripts/lib/ipfs-hybrid";

dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

type NetworkName = "localhost" | "mainnet" | "arbitrum" | "sepolia" | "celo";
type WorkInputType = WorkInput["type"];

interface RawActionConfig {
  slug: string;
  title: string;
  description?: string;
  uiConfig?: unknown;
  translations?: unknown;
  [key: string]: unknown;
}

interface ActionsFile {
  actions?: RawActionConfig[];
}

interface DeploymentRecord {
  actionRegistry?: string;
}

interface CacheEntry {
  hash: string;
  title: string;
  slug: string;
  payloadHash: string;
  sourceHash: string;
  uploadedAt: string;
}

interface MigrationOptions {
  network: NetworkName;
  chainId: string;
  rpcUrl: string;
  dryRun: boolean;
  uploadOnly: boolean;
  broadcast: boolean;
  preflightOnly: boolean;
  force: boolean;
  translationsPath?: string;
  previewDir?: string;
  slugs: Set<string>;
  uids: Set<number>;
}

interface MigrationPlanItem {
  uid: number;
  slug: string;
  title: string;
  sourceHash: string;
  payload: string;
  payloadHash: string;
  cacheKey: string;
  document: ActionInstructionConfigV2;
  config: ActionInstructionConfig;
}

interface UploadedPlanItem extends MigrationPlanItem {
  cid: string;
}

const ACTIONS_FILE = path.join(CONFIG_ROOT, "actions.json");
const DEFAULT_TRANSLATIONS_FILE = path.join(CONFIG_ROOT, "action-translations.json");
const WORK_INPUT_TYPES = new Set<WorkInputType>([
  "text",
  "textarea",
  "select",
  "multi-select",
  "number",
  "band",
  "repeater",
]);

function showHelp(): void {
  console.log(`
Green Goods Action Instructions v2 Migration

Usage:
  bun script/migrate-action-instructions-v2.ts [options]

Options:
  --network, -n <name>       Network to target (default: arbitrum)
  --rpc-url <url>            Override RPC URL for broadcast mode
  --chain-id <id>            Override deployment artifact selection
  --dry-run                  Build and summarize v2 JSON only (default)
  --preflight-only           Check deployed ActionRegistry batch support only
  --upload-only              Upload v2 JSON to Pinata and update the local cache only
  --broadcast                Upload v2 JSON and call batchUpdateActionInstructions once on-chain
  --force                    Skip on-chain CID checks and send all updates in broadcast mode
  --translations <path>      JSON file with translations keyed by action slug
                              (default: config/action-translations.json when present)
  --slug <slug>              Limit migration to one action slug; repeatable
  --uid <number>             Limit migration to one action UID; repeatable
  --preview-dir <path>       Write generated v2 instruction JSON files for review
  --help, -h                 Show this help

Environment:
  PINATA_JWT                        Required for --upload-only and --broadcast
  FOUNDRY_KEYSTORE_ACCOUNT          Foundry keystore name for --broadcast
  MIGRATION_PRIVATE_KEY             Optional non-interactive broadcast key
  PRIVATE_KEY                       Fallback non-interactive broadcast key
`);
}

function readRequiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): MigrationOptions {
  let network: NetworkName = "arbitrum";
  let rpcUrl = "";
  let chainId = "";
  let dryRun = true;
  let uploadOnly = false;
  let broadcast = false;
  let preflightOnly = false;
  let force = false;
  let translationsPath: string | undefined;
  let previewDir: string | undefined;
  const slugs = new Set<string>();
  const uids = new Set<number>();

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--network":
      case "-n":
        network = readRequiredValue(argv, i, arg) as NetworkName;
        i += 1;
        break;
      case "--rpc-url":
        rpcUrl = readRequiredValue(argv, i, arg);
        i += 1;
        break;
      case "--chain-id":
        chainId = readRequiredValue(argv, i, arg);
        i += 1;
        break;
      case "--dry-run":
        dryRun = true;
        uploadOnly = false;
        broadcast = false;
        preflightOnly = false;
        break;
      case "--preflight-only":
        dryRun = false;
        uploadOnly = false;
        broadcast = false;
        preflightOnly = true;
        break;
      case "--upload-only":
        dryRun = false;
        uploadOnly = true;
        broadcast = false;
        preflightOnly = false;
        break;
      case "--broadcast":
        dryRun = false;
        uploadOnly = false;
        broadcast = true;
        preflightOnly = false;
        break;
      case "--force":
        force = true;
        break;
      case "--translations":
        translationsPath = readRequiredValue(argv, i, arg);
        i += 1;
        break;
      case "--preview-dir":
        previewDir = readRequiredValue(argv, i, arg);
        i += 1;
        break;
      case "--slug":
        slugs.add(readRequiredValue(argv, i, arg));
        i += 1;
        break;
      case "--uid": {
        const value = Number(readRequiredValue(argv, i, arg));
        if (!Number.isInteger(value) || value < 0) {
          throw new Error("--uid requires a non-negative integer");
        }
        uids.add(value);
        i += 1;
        break;
      }
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
      case "--":
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  const networkManager = new NetworkManager();
  const resolvedTranslationsPath =
    translationsPath || (fs.existsSync(DEFAULT_TRANSLATIONS_FILE) ? DEFAULT_TRANSLATIONS_FILE : undefined);
  return {
    network,
    chainId: chainId || CHAIN_ID_MAP[network] || networkManager.getChainId(network).toString(),
    rpcUrl: rpcUrl || networkManager.getRpcUrl(network),
    dryRun,
    uploadOnly,
    broadcast,
    preflightOnly,
    force,
    translationsPath: resolvedTranslationsPath,
    previewDir,
    slugs,
    uids,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((item): item is string => typeof item === "string");
}

function cloneWorkInput(input: WorkInput): WorkInput {
  return {
    ...input,
    options: [...input.options],
    bands: input.bands ? [...input.bands] : undefined,
    repeaterFields: input.repeaterFields?.map(cloneWorkInput),
  };
}

function cloneInstructionConfig(config: ActionInstructionConfig): ActionInstructionConfig {
  return {
    description: config.description,
    uiConfig: {
      media: {
        ...config.uiConfig.media,
        needed: [...config.uiConfig.media.needed],
        optional: [...config.uiConfig.media.optional],
      },
      details: {
        ...config.uiConfig.details,
        inputs: config.uiConfig.details.inputs.map(cloneWorkInput),
      },
      review: { ...config.uiConfig.review },
    },
  };
}

function normalizeWorkInput(value: unknown, fallback?: WorkInput): WorkInput | null {
  if (!isRecord(value) && !fallback) return null;
  const record = isRecord(value) ? value : {};
  const type = WORK_INPUT_TYPES.has(record.type as WorkInputType)
    ? (record.type as WorkInputType)
    : fallback?.type || "text";
  const key = typeof record.key === "string" ? record.key : fallback?.key || "";
  if (!key) return null;

  const input: WorkInput = {
    key,
    title: typeof record.title === "string" ? record.title : fallback?.title || key,
    placeholder: typeof record.placeholder === "string" ? record.placeholder : fallback?.placeholder || "",
    type,
    required: typeof record.required === "boolean" ? record.required : fallback?.required || false,
    options: normalizeStringArray(record.options, fallback?.options || []),
    unit: typeof record.unit === "string" ? record.unit : fallback?.unit,
  };

  if (Array.isArray(record.bands) || fallback?.bands) {
    input.bands = normalizeStringArray(record.bands, fallback?.bands || []);
  }

  if (Array.isArray(record.repeaterFields) || fallback?.repeaterFields) {
    const fallbackFields = fallback?.repeaterFields || [];
    input.repeaterFields = normalizeWorkInputs(record.repeaterFields, fallbackFields);
  }

  return input;
}

function normalizeWorkInputs(value: unknown, fallback: WorkInput[]): WorkInput[] {
  if (!Array.isArray(value)) return fallback.map(cloneWorkInput);
  return value
    .map((item, index) => normalizeWorkInput(item, fallback[index]))
    .filter((item): item is WorkInput => item !== null);
}

function normalizeInstructionConfig(action: RawActionConfig): ActionInstructionConfig {
  const fallback = cloneInstructionConfig(instructionTemplates[action.slug] || defaultTemplate);
  const uiConfig = isRecord(action.uiConfig) ? action.uiConfig : {};
  const media = isRecord(uiConfig.media) ? uiConfig.media : {};
  const details = isRecord(uiConfig.details) ? uiConfig.details : {};
  const review = isRecord(uiConfig.review) ? uiConfig.review : {};

  return {
    description:
      typeof action.description === "string" && action.description.trim() ? action.description : fallback.description,
    uiConfig: {
      media: {
        title: typeof media.title === "string" ? media.title : fallback.uiConfig.media.title,
        description: typeof media.description === "string" ? media.description : fallback.uiConfig.media.description,
        maxImageCount:
          typeof media.maxImageCount === "number" ? media.maxImageCount : fallback.uiConfig.media.maxImageCount,
        minImageCount:
          typeof media.minImageCount === "number" ? media.minImageCount : fallback.uiConfig.media.minImageCount,
        required: typeof media.required === "boolean" ? media.required : fallback.uiConfig.media.required,
        needed: normalizeStringArray(media.needed, fallback.uiConfig.media.needed),
        optional: normalizeStringArray(media.optional, fallback.uiConfig.media.optional),
      },
      details: {
        title: typeof details.title === "string" ? details.title : fallback.uiConfig.details.title,
        description:
          typeof details.description === "string" ? details.description : fallback.uiConfig.details.description,
        feedbackPlaceholder:
          typeof details.feedbackPlaceholder === "string"
            ? details.feedbackPlaceholder
            : fallback.uiConfig.details.feedbackPlaceholder,
        inputs: normalizeWorkInputs(details.inputs, fallback.uiConfig.details.inputs),
      },
      review: {
        title: typeof review.title === "string" ? review.title : fallback.uiConfig.review.title,
        description: typeof review.description === "string" ? review.description : fallback.uiConfig.review.description,
      },
    },
  };
}

function normalizeRawTranslationRecords(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const normalized: Record<string, unknown> = { ...value };
  for (const locale of ACTION_TRANSLATION_LOCALES) {
    const candidate = normalized[locale];
    if (!isRecord(candidate)) continue;
    const hasRecordShape =
      "status" in candidate || "sourceHash" in candidate || "updatedAt" in candidate || "data" in candidate;
    normalized[locale] = hasRecordShape ? candidate : { status: "draft", data: candidate };
  }
  return normalized;
}

function extractTranslationsCandidate(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return "translations" in value ? value.translations : value;
}

function loadExternalTranslations(translationsPath: string | undefined): Record<string, unknown> {
  if (!translationsPath) return {};
  const resolvedPath = path.resolve(process.cwd(), translationsPath);
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as unknown;
  const root = isRecord(parsed) && "actions" in parsed ? parsed.actions : parsed;

  if (Array.isArray(root)) {
    const bySlug: Record<string, unknown> = {};
    for (const item of root) {
      if (!isRecord(item) || typeof item.slug !== "string") continue;
      bySlug[item.slug] = extractTranslationsCandidate(item);
    }
    return bySlug;
  }

  return isRecord(root) ? root : {};
}

function prepareTranslations(
  title: string,
  config: ActionInstructionConfig,
  rawTranslations: unknown,
): ActionTranslationMap {
  const translations = normalizeActionTranslations(normalizeRawTranslationRecords(rawTranslations));
  const sourceHash = getActionSourceHash(title, config);
  const withSourceHash: ActionTranslationMap = {};

  for (const locale of ACTION_TRANSLATION_LOCALES) {
    const record = translations[locale];
    if (!record) continue;
    withSourceHash[locale] = {
      ...record,
      sourceHash: record.sourceHash || sourceHash,
    };
  }

  return withSourceHash;
}

function loadActions(): RawActionConfig[] {
  const data = JSON.parse(fs.readFileSync(ACTIONS_FILE, "utf8")) as ActionsFile;
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error(`No actions found in ${ACTIONS_FILE}`);
  }
  return data.actions;
}

function filterActions(actions: RawActionConfig[], options: MigrationOptions): RawActionConfig[] {
  return actions.filter((action, uid) => {
    const slugMatches = options.slugs.size === 0 || options.slugs.has(action.slug);
    const uidMatches = options.uids.size === 0 || options.uids.has(uid);
    return slugMatches && uidMatches;
  });
}

function buildPlan(actions: RawActionConfig[], options: MigrationOptions): MigrationPlanItem[] {
  const externalTranslations = loadExternalTranslations(options.translationsPath);

  return actions.map((action, uid) => {
    if (!action.slug || !action.title) {
      throw new Error(`Action ${uid} is missing slug or title`);
    }

    const config = normalizeInstructionConfig(action);
    const externalCandidate = extractTranslationsCandidate(externalTranslations[action.slug]);
    const mergedTranslations = {
      ...(isRecord(action.translations) ? action.translations : {}),
      ...(isRecord(externalCandidate) ? externalCandidate : {}),
    };
    const translations = prepareTranslations(action.title, config, mergedTranslations);
    const document = buildActionInstructionsV2(action.title, config, translations);
    const payload = `${JSON.stringify(document, null, 2)}\n`;
    const payloadHash = createHash("sha256").update(payload).digest("hex");
    const sourceHash = getActionSourceHash(action.title, config);

    return {
      uid,
      slug: action.slug,
      title: action.title,
      sourceHash,
      payload,
      payloadHash,
      cacheKey: `${uid}-${payloadHash}`,
      document,
      config,
    };
  });
}

function loadCache(): Record<string, CacheEntry> {
  if (!fs.existsSync(ACTION_INSTRUCTIONS_V2_CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(ACTION_INSTRUCTIONS_V2_CACHE_PATH, "utf8")) as Record<string, CacheEntry>;
}

function saveCache(cache: Record<string, CacheEntry>): void {
  fs.writeFileSync(ensureParentDir(ACTION_INSTRUCTIONS_V2_CACHE_PATH), JSON.stringify(cache, null, 2));
}

function writePreviews(plan: MigrationPlanItem[], previewDir: string | undefined): void {
  if (!previewDir) return;
  const resolvedDir = path.resolve(process.cwd(), previewDir);
  fs.mkdirSync(resolvedDir, { recursive: true });
  for (const item of plan) {
    const filename = `${String(item.uid).padStart(2, "0")}-${item.slug.replace(/[._]/g, "-")}.json`;
    fs.writeFileSync(path.join(resolvedDir, filename), item.payload);
  }
  console.log(`Preview JSON written to ${resolvedDir}`);
}

function describeTranslation(record: ActionTranslationRecord | undefined, item: MigrationPlanItem): string {
  if (!record) return "missing";
  if (!hasActionTranslationContent(record.data)) return `${record.status}, empty`;
  if (record.status !== "reviewed") return record.status;
  if (!hasCompleteActionTranslationContent(item.title, item.config, record.data)) {
    return "reviewed, partial";
  }
  return "reviewed, complete";
}

function printPlanSummary(
  plan: MigrationPlanItem[],
  cache: Record<string, CacheEntry>,
  translationsPath: string | undefined,
): void {
  console.log(`\nPrepared ${plan.length} action instruction document(s).\n`);
  if (translationsPath) {
    console.log(`Translations: ${translationsPath}\n`);
  }
  for (const item of plan) {
    const cacheStatus = cache[item.cacheKey]?.hash ? `cached ${cache[item.cacheKey].hash}` : "not uploaded";
    const localeStatus = ACTION_TRANSLATION_LOCALES.map((locale) => {
      return `${locale}: ${describeTranslation(item.document.translations?.[locale], item)}`;
    }).join(", ");
    console.log(`[${item.uid}] ${item.slug} — ${item.title}`);
    console.log(`  sourceHash: ${item.sourceHash}`);
    console.log(`  translations: ${localeStatus}`);
    console.log(`  v2 CID: ${cacheStatus}`);
  }
}

async function uploadPlan(plan: MigrationPlanItem[], cache: Record<string, CacheEntry>): Promise<UploadedPlanItem[]> {
  const uploaded: UploadedPlanItem[] = [];
  let cacheChanged = false;
  let pinataConfig: ReturnType<typeof loadPinataConfigFromEnv> | null | undefined;

  for (const item of plan) {
    const cached = cache[item.cacheKey];
    if (cached?.hash) {
      console.log(`[${item.uid}] ${item.slug} — cache hit ${cached.hash}`);
      uploaded.push({ ...item, cid: cached.hash });
      continue;
    }

    pinataConfig ??= loadPinataConfigFromEnv();
    if (!pinataConfig?.jwt) {
      throw new Error("PINATA_JWT is required to upload v2 instruction JSON");
    }

    process.stdout.write(`[${item.uid}] ${item.slug} — uploading... `);
    const cid = await uploadBufferWithPinata(pinataConfig, Buffer.from(item.payload), {
      filename: `${item.slug}.instructions.v2.json`,
      mimeType: "application/json",
      name: `${item.slug} instructions v2`,
      metadata: {
        source: "action-instructions-v2",
        schemaVersion: item.document.schemaVersion,
        slug: item.slug,
        uid: String(item.uid),
      },
    });
    console.log(cid);

    cache[item.cacheKey] = {
      hash: cid,
      title: item.title,
      slug: item.slug,
      payloadHash: item.payloadHash,
      sourceHash: item.sourceHash,
      uploadedAt: new Date().toISOString(),
    };
    cacheChanged = true;
    uploaded.push({ ...item, cid });
  }

  if (cacheChanged) saveCache(cache);
  return uploaded;
}

function loadActionRegistry(chainId: string): string {
  const deploymentPath = path.join(DEPLOYMENTS_ROOT, `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment artifact not found: ${deploymentPath}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
  if (!deployment.actionRegistry) {
    throw new Error(`Deployment artifact ${deploymentPath} does not include actionRegistry`);
  }
  return deployment.actionRegistry;
}

function assertBatchInstructionUpdateSupported(actionRegistry: string, rpcUrl: string): void {
  try {
    execFileSync(
      "cast",
      ["call", actionRegistry, "batchUpdateActionInstructions(uint256[],string[])", "[]", "[]", "--rpc-url", rpcUrl],
      {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30_000,
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      "ActionRegistry does not support batchUpdateActionInstructions on this network. " +
        "Upgrade the ActionRegistry implementation before broadcasting the v2 instruction migration. " +
        `Preflight failed: ${reason}`,
    );
  }
}

function stringAsAbiHex(value: string): string {
  return Buffer.from(value, "utf8").toString("hex");
}

function readActionRaw(actionRegistry: string, uid: number, rpcUrl: string): string {
  return execFileSync("cast", ["call", actionRegistry, "getAction(uint256)", uid.toString(), "--rpc-url", rpcUrl], {
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30_000,
  })
    .toString()
    .trim();
}

function assertOnChainActionMatches(rawAction: string, item: UploadedPlanItem): void {
  const slugHex = stringAsAbiHex(item.slug);
  if (!rawAction.includes(slugHex)) {
    throw new Error(
      `On-chain action ${item.uid} does not appear to match slug "${item.slug}". ` + "Refusing to update instructions.",
    );
  }
}

function isCurrentCid(rawAction: string, cid: string): boolean {
  return rawAction.includes(stringAsAbiHex(cid));
}

function formatUintArrayForCast(values: number[]): string {
  return `[${values.map((value) => value.toString()).join(",")}]`;
}

function formatStringArrayForCast(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(",")}]`;
}

function sendInstructionBatchUpdate(actionRegistry: string, items: UploadedPlanItem[], rpcUrl: string): void {
  const privateKey = process.env.MIGRATION_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const keystoreName = process.env.FOUNDRY_KEYSTORE_ACCOUNT || "green-goods-deployer";
  const args = [
    "send",
    actionRegistry,
    "batchUpdateActionInstructions(uint256[],string[])",
    formatUintArrayForCast(items.map((item) => item.uid)),
    formatStringArrayForCast(items.map((item) => item.cid)),
    "--rpc-url",
    rpcUrl,
  ];

  if (privateKey) {
    args.push("--private-key", privateKey);
  } else {
    args.push("--account", keystoreName);
  }

  const output = execFileSync("cast", args, {
    stdio: ["inherit", "pipe", "pipe"],
    timeout: 120_000,
  })
    .toString()
    .trim();
  const txHashMatch = output.match(/transactionHash\s+(0x[a-fA-F0-9]{64})/);
  const txHash = txHashMatch ? txHashMatch[1] : output.slice(0, 80);
  console.log(`  OK batch: ${txHash}`);
}

function updateOnChain(items: UploadedPlanItem[], options: MigrationOptions): void {
  const actionRegistry = loadActionRegistry(options.chainId);
  const pending: UploadedPlanItem[] = [];

  console.log(`\nActionRegistry: ${actionRegistry}`);
  console.log(`Network: ${options.network} (${options.chainId})`);

  for (const item of items) {
    if (options.force) {
      pending.push(item);
      console.log(`[${item.uid}] ${item.slug} — queued (--force)`);
      continue;
    }

    const rawAction = readActionRaw(actionRegistry, item.uid, options.rpcUrl);
    assertOnChainActionMatches(rawAction, item);
    if (isCurrentCid(rawAction, item.cid)) {
      console.log(`[${item.uid}] ${item.slug} — already current`);
    } else {
      pending.push(item);
      console.log(`[${item.uid}] ${item.slug} — needs update ${item.cid}`);
    }
  }

  if (pending.length === 0) {
    console.log("\nAll selected actions already point at the v2 instruction CIDs.");
    return;
  }

  if (!options.broadcast) {
    console.log(`\n${pending.length} action(s) would be updated. Pass --broadcast to execute.`);
    return;
  }

  console.log(`\nSending 1 batchUpdateActionInstructions transaction for ${pending.length} action(s)...\n`);
  for (const item of pending) {
    console.log(`[${item.uid}] ${item.slug} — ${item.cid}`);
  }
  sendInstructionBatchUpdate(actionRegistry, pending, options.rpcUrl);
  console.log(`\nDone: ${pending.length}/${pending.length} instruction CID update(s) sent in one transaction.`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);

  if (options.preflightOnly) {
    const actionRegistry = loadActionRegistry(options.chainId);
    assertBatchInstructionUpdateSupported(actionRegistry, options.rpcUrl);
    console.log(`ActionRegistry ${actionRegistry} supports batchUpdateActionInstructions.`);
    return;
  }

  const allActions = loadActions();
  const selectedActions = filterActions(allActions, options);

  if (selectedActions.length === 0) {
    throw new Error("No actions matched the selected --slug/--uid filters");
  }

  const plan = buildPlan(allActions, options).filter((item) => {
    const slugMatches = options.slugs.size === 0 || options.slugs.has(item.slug);
    const uidMatches = options.uids.size === 0 || options.uids.has(item.uid);
    return slugMatches && uidMatches;
  });
  const cache = loadCache();

  printPlanSummary(plan, cache, options.translationsPath);
  writePreviews(plan, options.previewDir);

  if (options.dryRun) {
    console.log("\nDry run complete. No IPFS uploads or on-chain writes were performed.");
    return;
  }

  if (options.broadcast) {
    const actionRegistry = loadActionRegistry(options.chainId);
    assertBatchInstructionUpdateSupported(actionRegistry, options.rpcUrl);
  }

  const uploaded = await uploadPlan(plan, cache);
  if (options.uploadOnly) {
    console.log("\nUpload-only complete. No on-chain writes were performed.");
    return;
  }

  updateOnChain(uploaded, options);
}

main().catch((error) => {
  console.error("\nFatal:", error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
