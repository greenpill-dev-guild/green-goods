#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { getAddress, isAddress, verifyMessage } from "viem";

declare module "fastify" {
  interface FastifyRequest {
    sessionAddress?: string;
  }
}

const ROOT_DIR = path.join(__dirname, "../../..");
const CONTRACTS_DIR = path.join(ROOT_DIR, "packages/contracts");
const CONTRACT_ENV_OVERRIDE_KEYS = [
  "SENDER_ADDRESS",
  "COOKIE_JAR_FACTORY_ADDRESS",
  "GARDENS_REGISTRY_FACTORY",
  "GARDENS_ALLO_ADDRESS",
  "GARDENS_COUNCIL_SAFE",
  "OCTANT_FACTORY_ADDRESS",
  "OCTANT_WETH_ASSET",
  "OCTANT_WETH_STRATEGY",
  "OCTANT_DAI_ASSET",
  "OCTANT_DAI_STRATEGY",
  "OCTANT_FALLBACK_ASSET",
  "OCTANT_FALLBACK_STRATEGY",
  "OCTANT_STRATEGY_OWNER",
  "OCTANT_WETH_ATOKEN",
  "OCTANT_DAI_ATOKEN",
] as const;

const HOST = process.env.OPS_RUNNER_HOST || "127.0.0.1";
const PORT = Number(process.env.OPS_RUNNER_PORT || "8787");
const NONCE_TTL_MS = Number(process.env.OPS_RUNNER_NONCE_TTL_SEC || "300") * 1000;
const SESSION_TTL_MS = Number(process.env.OPS_RUNNER_SESSION_TTL_SEC || "43200") * 1000;
const ARTIFACT_OUTPUT_DIR = resolveArtifactOutputDir();

const allowedOrigins = new Set(
  (process.env.OPS_RUNNER_ALLOWED_ORIGINS || "http://localhost:3002,http://127.0.0.1:3002")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
);

const NETWORK_CHAIN_IDS = {
  localhost: 31337,
  mainnet: 1,
  sepolia: 11155111,
  arbitrum: 42161,
  celo: 42220,
} as const;

type NetworkName = keyof typeof NETWORK_CHAIN_IDS;

type UpgradeContractName =
  | "action-registry"
  | "garden-token"
  | "gardener-account"
  | "octant-module"
  | "work-resolver"
  | "work-approval-resolver"
  | "assessment-resolver"
  | "deployment-registry"
  | "all";

const UPGRADE_CONTRACTS = new Set<UpgradeContractName>([
  "action-registry",
  "garden-token",
  "gardener-account",
  "octant-module",
  "work-resolver",
  "work-approval-resolver",
  "assessment-resolver",
  "deployment-registry",
  "all",
]);

type JobType = "deploy-plan" | "finalize-deploy" | "upgrade-plan" | "finalize-upgrade" | "run-script";
type JobStatus = "queued" | "running" | "succeeded" | "failed";
type LogStream = "stdout" | "stderr" | "system";

interface JobLogEntry {
  id: number;
  at: string;
  stream: LogStream;
  message: string;
}

interface OpsJob {
  id: string;
  type: JobType;
  status: JobStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  logs: JobLogEntry[];
}

interface DeployRequest {
  network: NetworkName;
  sender?: string;
  updateSchemasOnly?: boolean;
  force?: boolean;
  deploymentSalt?: string;
  syncEnvio?: boolean;
}

interface UpgradeRequest {
  network: NetworkName;
  contract: UpgradeContractName;
  sender?: string;
}

interface RunScriptRequest {
  scriptId: string;
  network?: NetworkName;
}

interface ForgeBroadcastArtifact {
  transactions?: Array<{
    hash?: string | null;
    transactionType?: string | null;
    contractName?: string | null;
    function?: string | null;
    transaction?: {
      from?: string;
      to?: string;
      gas?: string;
      value?: string;
      nonce?: string;
      input?: string;
      chainId?: string;
    };
  }>;
}

interface ScriptDefinition {
  id: string;
  description: string;
  cwd: "root" | "contracts";
  command: string;
  args: string[];
}

const SCRIPT_DEFINITIONS: Record<string, ScriptDefinition> = {
  "upload-action-images": {
    id: "upload-action-images",
    description: "Upload action image assets and update CIDs",
    cwd: "root",
    command: "bun",
    args: ["run", "upload:action-images"],
  },
  "upload-action-images:dry-run": {
    id: "upload-action-images:dry-run",
    description: "Dry-run action image compression pipeline",
    cwd: "root",
    command: "bun",
    args: ["run", "upload:action-images:dry-run"],
  },
  "envio-update": {
    id: "envio-update",
    description: "Update Envio config for a network chain",
    cwd: "contracts",
    command: "bun",
    args: ["script/utils/envio-integration.ts", "update", "{chainId}"],
  },
  "deploy-status": {
    id: "deploy-status",
    description: "Print deployment status for a network",
    cwd: "contracts",
    command: "bun",
    args: ["script/deploy.ts", "status", "{network}"],
  },
};

interface JobLogger {
  log: (stream: LogStream, message: string) => void;
}

class JobQueue {
  private readonly jobs = new Map<string, OpsJob>();
  private readonly queue: string[] = [];
  private readonly events = new EventEmitter();
  private running = false;
  private logCursor = 0;

  constructor(private readonly executeJob: (job: OpsJob, logger: JobLogger) => Promise<Record<string, unknown>>) {
    this.events.setMaxListeners(0);
  }

  create(type: JobType, payload: Record<string, unknown>, requestedBy: string): OpsJob {
    const now = new Date().toISOString();
    const job: OpsJob = {
      id: randomUUID(),
      type,
      status: "queued",
      requestedBy,
      createdAt: now,
      updatedAt: now,
      payload,
      result: null,
      error: null,
      logs: [],
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.emitStatus(job);
    this.run();

    return job;
  }

  list(): OpsJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(jobId: string): OpsJob | undefined {
    return this.jobs.get(jobId);
  }

  onLog(jobId: string, listener: (entry: JobLogEntry) => void): () => void {
    const key = `log:${jobId}`;
    this.events.on(key, listener);
    return () => this.events.off(key, listener);
  }

  onStatus(jobId: string, listener: (job: OpsJob) => void): () => void {
    const key = `status:${jobId}`;
    this.events.on(key, listener);
    return () => this.events.off(key, listener);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift();
      if (!jobId) continue;

      const job = this.jobs.get(jobId);
      if (!job) continue;

      this.setStatus(job, "running");

      const logger: JobLogger = {
        log: (stream, message) => this.appendLog(job, stream, message),
      };

      try {
        const result = await this.executeJob(job, logger);
        job.result = result;
        this.setStatus(job, "succeeded");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        job.error = message;
        this.appendLog(job, "system", `ERROR: ${message}`);
        this.setStatus(job, "failed");
      }
    }

    this.running = false;
  }

  private setStatus(job: OpsJob, status: JobStatus): void {
    job.status = status;
    job.updatedAt = new Date().toISOString();
    this.emitStatus(job);
  }

  private emitStatus(job: OpsJob): void {
    this.events.emit(`status:${job.id}`, job);
  }

  private appendLog(job: OpsJob, stream: LogStream, message: string): void {
    const lines = message.split(/\r?\n/).map((line) => line.trimEnd());
    for (const line of lines) {
      if (!line) continue;
      const entry: JobLogEntry = {
        id: ++this.logCursor,
        at: new Date().toISOString(),
        stream,
        message: line,
      };
      job.logs.push(entry);
      if (job.logs.length > 2000) {
        job.logs.shift();
      }
      this.events.emit(`log:${job.id}`, entry);
    }
  }
}

interface AuthChallenge {
  message: string;
  expiresAt: number;
}

interface AuthSession {
  address: string;
  expiresAt: number;
}

const challenges = new Map<string, AuthChallenge>();
const sessions = new Map<string, AuthSession>();

function resolveArtifactOutputDir(): string {
  const configured = process.env.OPS_RUNNER_ARTIFACT_DIR?.trim();
  const outputDir = configured && configured.length > 0 ? configured : ".ops/artifacts";
  return path.isAbsolute(outputDir) ? outputDir : path.join(ROOT_DIR, outputDir);
}

function normalizeNetwork(value: unknown): NetworkName {
  if (typeof value !== "string") {
    throw new Error("network is required");
  }

  if (!(value in NETWORK_CHAIN_IDS)) {
    throw new Error(`Unsupported network: ${value}`);
  }

  return value as NetworkName;
}

function normalizeSender(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error("sender must be a valid 0x address");
  }
  return getAddress(value);
}

function getChainId(network: NetworkName): number {
  return NETWORK_CHAIN_IDS[network];
}

function parseDeployRequest(body: unknown): DeployRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const payload = body as Record<string, unknown>;
  return {
    network: normalizeNetwork(payload.network),
    sender: normalizeSender(payload.sender),
    updateSchemasOnly: Boolean(payload.updateSchemasOnly),
    force: Boolean(payload.force),
    deploymentSalt: typeof payload.deploymentSalt === "string" ? payload.deploymentSalt : undefined,
    syncEnvio:
      payload.syncEnvio === undefined ? true : payload.syncEnvio === true || payload.syncEnvio === "true",
  };
}

function parseUpgradeRequest(body: unknown): UpgradeRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const payload = body as Record<string, unknown>;
  const contract = payload.contract;
  if (typeof contract !== "string" || !UPGRADE_CONTRACTS.has(contract as UpgradeContractName)) {
    throw new Error("Unsupported contract for upgrade");
  }

  return {
    network: normalizeNetwork(payload.network),
    contract: contract as UpgradeContractName,
    sender: normalizeSender(payload.sender),
  };
}

function parseRunScriptRequest(body: unknown): RunScriptRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const payload = body as Record<string, unknown>;
  const scriptId = payload.scriptId;
  if (typeof scriptId !== "string" || !SCRIPT_DEFINITIONS[scriptId]) {
    throw new Error("Unsupported script id");
  }

  let network: NetworkName | undefined;
  if (payload.network !== undefined) {
    network = normalizeNetwork(payload.network);
  }

  return { scriptId, network };
}

function findForgeArtifact(scriptName: string, chainId: number, preferDryRun: boolean): string {
  const baseDir = path.join(CONTRACTS_DIR, "broadcast", scriptName, chainId.toString());
  const candidates = preferDryRun
    ? [path.join(baseDir, "dry-run", "run-latest.json"), path.join(baseDir, "run-latest.json")]
    : [path.join(baseDir, "run-latest.json"), path.join(baseDir, "dry-run", "run-latest.json")];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Forge artifact not found for ${scriptName} at chain ${chainId}`);
}

function readForgeArtifact(artifactPath: string): ForgeBroadcastArtifact {
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ForgeBroadcastArtifact;
}

function persistTxPlan(params: {
  kind: "deploy" | "upgrade";
  network: NetworkName;
  chainId: number;
  label: string;
  sender: string | null;
  sourceArtifact: string;
}): string {
  const artifact = readForgeArtifact(params.sourceArtifact);
  const transactions = (artifact.transactions ?? []).map((entry, index) => ({
    index,
    transactionType: entry.transactionType ?? null,
    contractName: entry.contractName ?? null,
    function: entry.function ?? null,
    from: entry.transaction?.from ?? null,
    to: entry.transaction?.to ?? null,
    value: entry.transaction?.value ?? "0x0",
    gas: entry.transaction?.gas ?? null,
    nonce: entry.transaction?.nonce ?? null,
    data: entry.transaction?.input ?? null,
  }));

  const txPlansDir = path.join(ARTIFACT_OUTPUT_DIR, "tx-plans");
  fs.mkdirSync(txPlansDir, { recursive: true });

  const filePath = path.join(
    txPlansDir,
    `${params.chainId}-${params.kind}-${params.label}-${Date.now()}-plan.json`
  );

  const txPlan = {
    generatedAt: new Date().toISOString(),
    network: params.network,
    chainId: params.chainId,
    kind: params.kind,
    label: params.label,
    sender: params.sender,
    sourceArtifact: params.sourceArtifact,
    transactionCount: transactions.length,
    transactions,
  };

  fs.writeFileSync(filePath, `${JSON.stringify(txPlan, null, 2)}\n`, "utf8");
  return filePath;
}

function readLatestPlan(chainId: number, contract: UpgradeContractName): string {
  const txPlansDir = path.join(ARTIFACT_OUTPUT_DIR, "tx-plans");
  if (!fs.existsSync(txPlansDir)) {
    throw new Error("tx plan directory not found");
  }

  const files = fs
    .readdirSync(txPlansDir)
    .filter((file) => file.startsWith(`${chainId}-${contract}-`) && file.endsWith("-plan.json"))
    .map((file) => ({ file, mtimeMs: fs.statSync(path.join(txPlansDir, file)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (files.length === 0) {
    throw new Error(`No tx plan found for ${contract} on chain ${chainId}`);
  }

  return path.join(txPlansDir, files[0].file);
}

function redactArg(arg: string): string {
  if (arg.startsWith("0x") && arg.length > 42) return "[REDACTED]";
  return arg;
}

async function runCommand(params: {
  logger: JobLogger;
  command: string;
  args: string[];
  cwd: string;
  extraEnv?: Record<string, string>;
}): Promise<void> {
  const prettyCommand = [params.command, ...params.args.map(redactArg)].join(" ");
  params.logger.log("system", `$ ${prettyCommand}`);

  await new Promise<void>((resolve, reject) => {
    const envForCommand: NodeJS.ProcessEnv = {
      ...process.env,
      ...params.extraEnv,
    };

    // Ops runner should rely on deployment/config defaults for address wiring.
    // Remove env override knobs before invoking contracts scripts.
    if (params.cwd === CONTRACTS_DIR) {
      for (const key of CONTRACT_ENV_OVERRIDE_KEYS) {
        delete envForCommand[key];
      }
    }

    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      env: envForCommand,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const attachStream = (stream: NodeJS.ReadableStream | null, type: LogStream): void => {
      if (!stream) return;
      let buffer = "";
      stream.on("data", (chunk: Buffer | string) => {
        buffer += chunk.toString();
        let nextBreak = buffer.indexOf("\n");
        while (nextBreak >= 0) {
          const line = buffer.slice(0, nextBreak);
          params.logger.log(type, line);
          buffer = buffer.slice(nextBreak + 1);
          nextBreak = buffer.indexOf("\n");
        }
      });
      stream.on("end", () => {
        if (buffer.length > 0) {
          params.logger.log(type, buffer);
        }
      });
    };

    attachStream(child.stdout, "stdout");
    attachStream(child.stderr, "stderr");

    child.on("error", (error) => reject(error));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command exited with code ${code} and signal ${signal ?? "none"}`));
    });
  });
}

function getDeploymentArtifactPath(chainId: number): string {
  return path.join(ARTIFACT_OUTPUT_DIR, `${chainId}-latest.json`);
}

function toSerializableJob(job: OpsJob, includeLogs: boolean): Record<string, unknown> {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    requestedBy: job.requestedBy,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    payload: job.payload,
    result: job.result,
    error: job.error,
    ...(includeLogs ? { logs: job.logs } : {}),
  };
}

async function executeJob(job: OpsJob, logger: JobLogger): Promise<Record<string, unknown>> {
  switch (job.type) {
    case "deploy-plan":
      return executeDeployPlan(job.payload, logger);
    case "finalize-deploy":
      return executeFinalizeDeploy(job.payload, logger);
    case "upgrade-plan":
      return executeUpgradePlan(job.payload, logger);
    case "finalize-upgrade":
      return executeFinalizeUpgrade(job.payload, logger);
    case "run-script":
      return executeScript(job.payload, logger);
    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

async function executeDeployPlan(payload: Record<string, unknown>, logger: JobLogger): Promise<Record<string, unknown>> {
  const request = parseDeployRequest(payload);
  const chainId = getChainId(request.network);

  const args = ["script/deploy.ts", "core", "--network", request.network, "--dry-run", "--save-artifacts"];
  if (request.sender) args.push("--sender", request.sender);
  if (request.updateSchemasOnly) args.push("--update-schemas");
  if (request.force) args.push("--force");
  if (request.deploymentSalt) args.push("--salt", request.deploymentSalt);

  await runCommand({
    logger,
    command: "bun",
    args,
    cwd: CONTRACTS_DIR,
    extraEnv: {
      DEPLOYMENT_OUTPUT_DIR: ARTIFACT_OUTPUT_DIR,
    },
  });

  const forgeArtifactPath = findForgeArtifact("Deploy.s.sol", chainId, true);
  const planPath = persistTxPlan({
    kind: "deploy",
    network: request.network,
    chainId,
    label: "core",
    sender: request.sender ?? null,
    sourceArtifact: forgeArtifactPath,
  });

  const deploymentArtifactPath = getDeploymentArtifactPath(chainId);

  return {
    chainId,
    network: request.network,
    txPlanPath: planPath,
    forgeArtifactPath,
    deploymentArtifactPath: fs.existsSync(deploymentArtifactPath) ? deploymentArtifactPath : null,
  };
}

async function executeFinalizeDeploy(
  payload: Record<string, unknown>,
  logger: JobLogger
): Promise<Record<string, unknown>> {
  const request = parseDeployRequest(payload);
  const chainId = getChainId(request.network);

  const args = ["script/deploy.ts", "core", "--network", request.network, "--broadcast"];
  if (request.sender) args.push("--sender", request.sender);
  if (request.updateSchemasOnly) args.push("--update-schemas");
  if (request.force) args.push("--force");
  if (request.deploymentSalt) args.push("--salt", request.deploymentSalt);

  await runCommand({
    logger,
    command: "bun",
    args,
    cwd: CONTRACTS_DIR,
    extraEnv: {
      DEPLOYMENT_OUTPUT_DIR: ARTIFACT_OUTPUT_DIR,
    },
  });

  let envioUpdated = false;
  if (request.syncEnvio ?? true) {
    try {
      await runCommand({
        logger,
        command: "bun",
        args: ["script/utils/envio-integration.ts", "update", chainId.toString()],
        cwd: CONTRACTS_DIR,
      });
      envioUpdated = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.log("system", `Envio update failed: ${message}`);
      envioUpdated = false;
    }
  }

  const forgeArtifactPath = findForgeArtifact("Deploy.s.sol", chainId, false);
  const artifact = readForgeArtifact(forgeArtifactPath);
  const txHashes = (artifact.transactions ?? [])
    .map((entry) => entry.hash)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const deploymentArtifactPath = getDeploymentArtifactPath(chainId);

  return {
    chainId,
    network: request.network,
    forgeArtifactPath,
    deploymentArtifactPath: fs.existsSync(deploymentArtifactPath) ? deploymentArtifactPath : null,
    transactionHashes: txHashes,
    envioUpdated,
  };
}

async function executeUpgradePlan(
  payload: Record<string, unknown>,
  logger: JobLogger
): Promise<Record<string, unknown>> {
  const request = parseUpgradeRequest(payload);
  const chainId = getChainId(request.network);

  const args = ["script/upgrade.ts", request.contract, "--network", request.network, "--tx-plan"];
  if (request.sender) args.push("--sender", request.sender);

  await runCommand({
    logger,
    command: "bun",
    args,
    cwd: CONTRACTS_DIR,
    extraEnv: {
      DEPLOYMENT_OUTPUT_DIR: ARTIFACT_OUTPUT_DIR,
    },
  });

  const planPath = readLatestPlan(chainId, request.contract);
  const planData = JSON.parse(fs.readFileSync(planPath, "utf8")) as Record<string, unknown>;

  return {
    chainId,
    network: request.network,
    contract: request.contract,
    txPlanPath: planPath,
    transactionCount: Number(planData.transactionCount ?? 0),
  };
}

async function executeFinalizeUpgrade(
  payload: Record<string, unknown>,
  logger: JobLogger
): Promise<Record<string, unknown>> {
  const request = parseUpgradeRequest(payload);
  const chainId = getChainId(request.network);

  const args = ["script/upgrade.ts", request.contract, "--network", request.network, "--broadcast"];
  if (request.sender) args.push("--sender", request.sender);

  await runCommand({
    logger,
    command: "bun",
    args,
    cwd: CONTRACTS_DIR,
    extraEnv: {
      DEPLOYMENT_OUTPUT_DIR: ARTIFACT_OUTPUT_DIR,
    },
  });

  const forgeArtifactPath = findForgeArtifact("Upgrade.s.sol", chainId, false);
  const artifact = readForgeArtifact(forgeArtifactPath);
  const txHashes = (artifact.transactions ?? [])
    .map((entry) => entry.hash)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  return {
    chainId,
    network: request.network,
    contract: request.contract,
    forgeArtifactPath,
    transactionHashes: txHashes,
  };
}

async function executeScript(payload: Record<string, unknown>, logger: JobLogger): Promise<Record<string, unknown>> {
  const request = parseRunScriptRequest(payload);
  const script = SCRIPT_DEFINITIONS[request.scriptId];

  const args = script.args.map((arg) => {
    if (arg === "{network}") {
      if (!request.network) {
        throw new Error(`Script ${request.scriptId} requires network`);
      }
      return request.network;
    }

    if (arg === "{chainId}") {
      if (!request.network) {
        throw new Error(`Script ${request.scriptId} requires network`);
      }
      return getChainId(request.network).toString();
    }

    return arg;
  });

  await runCommand({
    logger,
    command: script.command,
    args,
    cwd: script.cwd === "root" ? ROOT_DIR : CONTRACTS_DIR,
    extraEnv: {
      DEPLOYMENT_OUTPUT_DIR: ARTIFACT_OUTPUT_DIR,
    },
  });

  return {
    scriptId: request.scriptId,
    network: request.network ?? null,
    executedAt: new Date().toISOString(),
  };
}

function requireAuth(request: FastifyRequest, reply: FastifyReply): void {
  const authHeader = request.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const tokenFromQuery = (() => {
    const query = request.query as { token?: string } | undefined;
    return query?.token?.trim() || null;
  })();

  const token = tokenFromHeader || tokenFromQuery;
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token" });
    return;
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    reply.code(401).send({ error: "Session expired" });
    return;
  }

  request.sessionAddress = session.address;
}

function createChallenge(address: string): AuthChallenge {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  return {
    message: `Green Goods Ops Runner Authentication\nAddress: ${address}\nNonce: ${nonce}\nIssued At: ${issuedAt}`,
    expiresAt: Date.now() + NONCE_TTL_MS,
  };
}

function createSession(address: string): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { address, expiresAt });
  return { token, expiresAt };
}

function pruneExpiredAuthState(): void {
  const now = Date.now();
  for (const [address, challenge] of challenges.entries()) {
    if (challenge.expiresAt < now) {
      challenges.delete(address);
    }
  }

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(ARTIFACT_OUTPUT_DIR, { recursive: true });

  const queue = new JobQueue(executeJob);
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
  });

  app.get("/health", async () => ({
    ok: true,
    host: HOST,
    port: PORT,
    artifactOutputDir: ARTIFACT_OUTPUT_DIR,
    serverTime: new Date().toISOString(),
  }));

  app.post("/auth/challenge", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const inputAddress = body?.address;
      if (typeof inputAddress !== "string" || !isAddress(inputAddress)) {
        reply.code(400).send({ error: "address must be a valid 0x address" });
        return;
      }

      const normalizedAddress = getAddress(inputAddress);
      const challenge = createChallenge(normalizedAddress);
      challenges.set(normalizedAddress, challenge);

      reply.send({
        address: normalizedAddress,
        message: challenge.message,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(500).send({ error: message });
    }
  });

  app.post("/auth/verify", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined;
      const inputAddress = body?.address;
      const signature = body?.signature;

      if (typeof inputAddress !== "string" || !isAddress(inputAddress)) {
        reply.code(400).send({ error: "address must be a valid 0x address" });
        return;
      }

      if (typeof signature !== "string" || signature.length === 0) {
        reply.code(400).send({ error: "signature is required" });
        return;
      }

      const normalizedAddress = getAddress(inputAddress);
      const challenge = challenges.get(normalizedAddress);
      if (!challenge || challenge.expiresAt < Date.now()) {
        challenges.delete(normalizedAddress);
        reply.code(401).send({ error: "Challenge expired. Request a new challenge." });
        return;
      }

      const valid = await verifyMessage({
        address: normalizedAddress,
        message: challenge.message,
        signature: signature as `0x${string}`,
      });

      if (!valid) {
        reply.code(401).send({ error: "Invalid signature" });
        return;
      }

      challenges.delete(normalizedAddress);
      const session = createSession(normalizedAddress);

      reply.send({
        token: session.token,
        address: normalizedAddress,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(500).send({ error: message });
    }
  });

  app.get("/scripts", { preHandler: requireAuth }, async () => ({
    scripts: Object.values(SCRIPT_DEFINITIONS).map((script) => ({
      id: script.id,
      description: script.description,
    })),
  }));

  app.post("/deploy/plan", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseDeployRequest(request.body);
      const job = queue.create("deploy-plan", payload as unknown as Record<string, unknown>, request.sessionAddress || "unknown");
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/deploy/finalize", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseDeployRequest(request.body);
      const job = queue.create(
        "finalize-deploy",
        payload as unknown as Record<string, unknown>,
        request.sessionAddress || "unknown"
      );
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/upgrade/plan", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseUpgradeRequest(request.body);
      const job = queue.create("upgrade-plan", payload as unknown as Record<string, unknown>, request.sessionAddress || "unknown");
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/upgrade/finalize", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseUpgradeRequest(request.body);
      const job = queue.create(
        "finalize-upgrade",
        payload as unknown as Record<string, unknown>,
        request.sessionAddress || "unknown"
      );
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.post("/scripts/run", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const payload = parseRunScriptRequest(request.body);
      const job = queue.create("run-script", payload as unknown as Record<string, unknown>, request.sessionAddress || "unknown");
      reply.send({ job: toSerializableJob(job, false) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400).send({ error: message });
    }
  });

  app.get("/jobs", { preHandler: requireAuth }, async () => ({
    jobs: queue.list().map((job) => toSerializableJob(job, false)),
  }));

  app.get("/jobs/:jobId", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { jobId?: string };
    if (!params.jobId) {
      reply.code(400).send({ error: "jobId is required" });
      return;
    }

    const job = queue.get(params.jobId);
    if (!job) {
      reply.code(404).send({ error: "Job not found" });
      return;
    }

    reply.send({ job: toSerializableJob(job, true) });
  });

  app.get("/jobs/:jobId/logs", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { jobId?: string };
    if (!params.jobId) {
      reply.code(400).send({ error: "jobId is required" });
      return;
    }

    const job = queue.get(params.jobId);
    if (!job) {
      reply.code(404).send({ error: "Job not found" });
      return;
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.hijack();

    const sendEvent = (event: string, payload: unknown): void => {
      try {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Ignore write errors after disconnect
      }
    };

    job.logs.forEach((entry) => sendEvent("log", entry));
    sendEvent("status", toSerializableJob(job, false));

    const unsubscribeLog = queue.onLog(params.jobId, (entry) => sendEvent("log", entry));
    const unsubscribeStatus = queue.onStatus(params.jobId, (nextJob) => {
      sendEvent("status", toSerializableJob(nextJob, false));
      if (nextJob.status === "succeeded" || nextJob.status === "failed") {
        sendEvent("done", toSerializableJob(nextJob, false));
      }
    });

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": ping\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribeLog();
      unsubscribeStatus();
    });
  });

  setInterval(pruneExpiredAuthState, 60_000).unref();

  await app.listen({ host: HOST, port: PORT });

  console.log(`Green Goods Ops Runner listening on http://${HOST}:${PORT}`);
  console.log(`Artifact output dir: ${ARTIFACT_OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("Failed to start ops runner", error);
  process.exit(1);
});
