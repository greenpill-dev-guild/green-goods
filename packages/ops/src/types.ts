import * as path from "node:path";

declare module "fastify" {
  interface FastifyRequest {
    sessionAddress?: string;
  }
}

export const ROOT_DIR = path.join(__dirname, "../../..");
export const CONTRACTS_DIR = path.join(ROOT_DIR, "packages/contracts");
export const CONTRACT_ENV_OVERRIDE_KEYS = [
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

export const HOST = process.env.OPS_RUNNER_HOST || "127.0.0.1";
export const PORT = Number(process.env.OPS_RUNNER_PORT || "8787");
export const NONCE_TTL_MS = Number(process.env.OPS_RUNNER_NONCE_TTL_SEC || "300") * 1000;
export const SESSION_TTL_MS = Number(process.env.OPS_RUNNER_SESSION_TTL_SEC || "43200") * 1000;

export function resolveArtifactOutputDir(): string {
  const configured = process.env.OPS_RUNNER_ARTIFACT_DIR?.trim();
  const outputDir = configured && configured.length > 0 ? configured : ".ops/artifacts";
  return path.isAbsolute(outputDir) ? outputDir : path.join(ROOT_DIR, outputDir);
}

export const ARTIFACT_OUTPUT_DIR = resolveArtifactOutputDir();

export const allowedOrigins = new Set(
  (process.env.OPS_RUNNER_ALLOWED_ORIGINS || "http://localhost:3002,http://127.0.0.1:3002")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
);

export const NETWORK_CHAIN_IDS = {
  localhost: 31337,
  mainnet: 1,
  sepolia: 11155111,
  arbitrum: 42161,
  celo: 42220,
} as const;

export type NetworkName = keyof typeof NETWORK_CHAIN_IDS;

export type UpgradeContractName =
  | "action-registry"
  | "garden-token"
  | "gardener-account"
  | "octant-module"
  | "work-resolver"
  | "work-approval-resolver"
  | "assessment-resolver"
  | "deployment-registry"
  | "all";

export const UPGRADE_CONTRACTS = new Set<UpgradeContractName>([
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

export type JobType = "deploy-plan" | "finalize-deploy" | "upgrade-plan" | "finalize-upgrade" | "run-script";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type LogStream = "stdout" | "stderr" | "system";

export interface JobLogEntry {
  id: number;
  at: string;
  stream: LogStream;
  message: string;
}

export interface OpsJob {
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

export interface DeployRequest {
  network: NetworkName;
  sender?: string;
  updateSchemasOnly?: boolean;
  force?: boolean;
  deploymentSalt?: string;
  syncEnvio?: boolean;
}

export interface UpgradeRequest {
  network: NetworkName;
  contract: UpgradeContractName;
  sender?: string;
}

export interface RunScriptRequest {
  scriptId: string;
  network?: NetworkName;
}

export interface ForgeBroadcastArtifact {
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

export interface ScriptDefinition {
  id: string;
  description: string;
  cwd: "root" | "contracts";
  command: string;
  args: string[];
}

export const SCRIPT_DEFINITIONS: Record<string, ScriptDefinition> = {
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

export interface JobLogger {
  log: (stream: LogStream, message: string) => void;
}
