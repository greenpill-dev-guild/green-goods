export type OpsJobType =
  | "deploy-plan"
  | "finalize-deploy"
  | "upgrade-plan"
  | "finalize-upgrade"
  | "run-script";

export type OpsJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface OpsJobLogEntry {
  id: number;
  at: string;
  stream: "stdout" | "stderr" | "system";
  message: string;
}

export interface OpsJob {
  id: string;
  type: OpsJobType;
  status: OpsJobStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  logs?: OpsJobLogEntry[];
}

export interface OpsRunnerHealth {
  ok: boolean;
  host: string;
  port: number;
  artifactOutputDir: string;
  serverTime: string;
}

export interface OpsRunnerScriptDefinition {
  id: string;
  description: string;
}

export interface OpsRunnerScriptsResponse {
  scripts: OpsRunnerScriptDefinition[];
}

export interface OpsRunnerJobsResponse {
  jobs: OpsJob[];
}

export interface OpsRunnerJobResponse {
  job: OpsJob;
}

export interface OpsRunnerChallengeResponse {
  address: string;
  message: string;
  expiresAt: string;
}

export interface OpsRunnerVerifyResponse {
  token: string;
  address: string;
  expiresAt: string;
}

export interface OpsRunnerSession {
  token: string;
  address: string;
  expiresAt: string;
}

export interface OpsDeployRequest {
  network: "localhost" | "mainnet" | "sepolia" | "arbitrum" | "celo";
  sender?: string;
  updateSchemasOnly?: boolean;
  force?: boolean;
  deploymentSalt?: string;
  syncEnvio?: boolean;
}

export interface OpsUpgradeRequest {
  network: "localhost" | "mainnet" | "sepolia" | "arbitrum" | "celo";
  contract:
    | "action-registry"
    | "garden-token"
    | "gardener-account"
    | "octant-module"
    | "work-resolver"
    | "work-approval-resolver"
    | "assessment-resolver"
    | "deployment-registry"
    | "all";
  sender?: string;
}

export interface OpsRunScriptRequest {
  scriptId: string;
  network?: "localhost" | "mainnet" | "sepolia" | "arbitrum" | "celo";
}

export interface OpsJobLogsState {
  logs: OpsJobLogEntry[];
  status: OpsJob | null;
  connected: boolean;
  error: string | null;
}
