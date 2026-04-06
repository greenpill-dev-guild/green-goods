import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

import {
  ARTIFACT_OUTPUT_DIR,
  CONTRACTS_DIR,
  CONTRACT_ENV_OVERRIDE_KEYS,
  NETWORK_CHAIN_IDS,
  SCRIPT_DEFINITIONS,
  UPGRADE_CONTRACTS,
  type DeployRequest,
  type ForgeBroadcastArtifact,
  type JobLogger,
  type LogStream,
  type NetworkName,
  type OpsJob,
  type RunScriptRequest,
  type UpgradeContractName,
  type UpgradeRequest,
} from "./types";
import { isAddress, getAddress } from "viem";

export function normalizeNetwork(value: unknown): NetworkName {
  if (typeof value !== "string") {
    throw new Error("network is required");
  }

  if (!(value in NETWORK_CHAIN_IDS)) {
    throw new Error(`Unsupported network: ${value}`);
  }

  return value as NetworkName;
}

export function normalizeSender(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error("sender must be a valid 0x address");
  }
  return getAddress(value);
}

export function getChainId(network: NetworkName): number {
  return NETWORK_CHAIN_IDS[network];
}

export function parseDeployRequest(body: unknown): DeployRequest {
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

export function parseUpgradeRequest(body: unknown): UpgradeRequest {
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

export function parseRunScriptRequest(body: unknown): RunScriptRequest {
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

export function findForgeArtifact(scriptName: string, chainId: number, preferDryRun: boolean): string {
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

export function readForgeArtifact(artifactPath: string): ForgeBroadcastArtifact {
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ForgeBroadcastArtifact;
}

export function persistTxPlan(params: {
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

export function readLatestPlan(chainId: number, contract: UpgradeContractName): string {
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

export function redactArg(arg: string): string {
  if (arg.startsWith("0x") && arg.length > 42) return "[REDACTED]";
  return arg;
}

export async function runCommand(params: {
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

export function getDeploymentArtifactPath(chainId: number): string {
  return path.join(ARTIFACT_OUTPUT_DIR, `${chainId}-latest.json`);
}

export function toSerializableJob(job: OpsJob, includeLogs: boolean): Record<string, unknown> {
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
