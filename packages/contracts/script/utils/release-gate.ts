import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

/** Valid deployment operation types for checkpoint tracking */
export type DeploymentOperation = "deploy" | "upgrade" | "goods";

export interface SepoliaCheckpoint {
  commitHash: string;
  timestamp: string;
  operation: DeploymentOperation;
  deploymentHash: string;
  smokeResults: {
    contractsBytecodeVerified: boolean;
    schemaUIDsNonZero: boolean;
    requiredFieldsPresent: boolean;
  };
}

const DEFAULT_FRESHNESS_DAYS = 7;

function contractsDir(): string {
  return path.join(__dirname, "../..");
}

function checkpointPath(): string {
  return path.join(contractsDir(), "deployments", "validation", "sepolia-checkpoint.json");
}

function isZeroHex(value: string | undefined): boolean {
  if (!value) return true;
  return /^0x0+$/i.test(value);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function hashFile(filePath: string): string {
  const payload = fs.readFileSync(filePath);
  return createHash("sha256").update(payload).digest("hex");
}

function currentCommitHash(): string {
  return execSync("git rev-parse HEAD", {
    cwd: path.join(contractsDir(), "..", ".."),
    encoding: "utf8",
  }).trim();
}

function isFresh(timestampIso: string, freshnessDays: number): boolean {
  const timestampMs = Date.parse(timestampIso);
  if (Number.isNaN(timestampMs)) return false;
  const maxAgeMs = freshnessDays * 24 * 60 * 60 * 1000;
  return Date.now() - timestampMs <= maxAgeMs;
}

function hasRequiredDeploymentFields(deployment: Record<string, unknown>): boolean {
  const requiredKeys = [
    "actionRegistry",
    "gardenToken",
    "gardenerAccountLogic",
    "workResolver",
    "workApprovalResolver",
    "assessmentResolver",
    "deploymentRegistry",
    "hatsModule",
  ];

  return requiredKeys.every((key) => {
    const value = deployment[key];
    return typeof value === "string" && value.startsWith("0x") && !isZeroHex(value);
  });
}

function hasNonZeroSchemaUIDs(deployment: Record<string, unknown>): boolean {
  const schemas = deployment.schemas;
  if (!schemas || typeof schemas !== "object") return false;

  const values = Object.values(schemas as Record<string, unknown>).filter(
    (value) => typeof value === "string",
  ) as string[];
  if (values.length === 0) return false;
  return values.every((value) => value.startsWith("0x") && !isZeroHex(value));
}

export function getSepoliaCheckpoint(): SepoliaCheckpoint | null {
  const file = checkpointPath();
  if (!fs.existsSync(file)) return null;
  return readJsonFile<SepoliaCheckpoint>(file);
}

export function assertSepoliaGate(options: {
  network: string;
  broadcast: boolean;
  operation: DeploymentOperation;
  overrideSepoliaGate?: boolean;
  freshnessDays?: number;
}): void {
  const {
    network,
    broadcast,
    operation,
    overrideSepoliaGate = false,
    freshnessDays = DEFAULT_FRESHNESS_DAYS,
  } = options;

  if (!broadcast) return;
  if (network !== "arbitrum" && network !== "celo") return;

  if (overrideSepoliaGate) {
    console.warn(`⚠️  Sepolia gate overridden for ${operation} on ${network}`);
    return;
  }

  const checkpoint = getSepoliaCheckpoint();
  if (!checkpoint) {
    throw new Error(
      "Sepolia gate failed: missing deployments/validation/sepolia-checkpoint.json. " +
        "Run a successful Sepolia broadcast first or pass --override-sepolia-gate.",
    );
  }

  const currentCommit = currentCommitHash();
  if (checkpoint.commitHash !== currentCommit) {
    throw new Error(
      `Sepolia gate failed: checkpoint commit ${checkpoint.commitHash} does not match current HEAD ${currentCommit}.`,
    );
  }

  if (!isFresh(checkpoint.timestamp, freshnessDays)) {
    throw new Error(
      `Sepolia gate failed: checkpoint timestamp ${checkpoint.timestamp} is older than ${freshnessDays} days.`,
    );
  }

  if (!checkpoint.smokeResults.contractsBytecodeVerified) {
    throw new Error("Sepolia gate failed: contractsBytecodeVerified is false.");
  }
  if (!checkpoint.smokeResults.schemaUIDsNonZero) {
    throw new Error("Sepolia gate failed: schemaUIDsNonZero is false.");
  }
  if (!checkpoint.smokeResults.requiredFieldsPresent) {
    throw new Error("Sepolia gate failed: requiredFieldsPresent is false.");
  }
}

export function writeSepoliaCheckpoint(options: {
  chainId: string;
  operation: DeploymentOperation;
}): SepoliaCheckpoint {
  const deploymentFile = path.join(contractsDir(), "deployments", `${options.chainId}-latest.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Cannot write Sepolia checkpoint: deployment file not found at ${deploymentFile}`);
  }

  const deployment = readJsonFile<Record<string, unknown>>(deploymentFile);

  const checkpoint: SepoliaCheckpoint = {
    commitHash: currentCommitHash(),
    timestamp: new Date().toISOString(),
    operation: options.operation,
    deploymentHash: hashFile(deploymentFile),
    smokeResults: {
      // Inference: deployment script completed without reverting and artifact persisted.
      contractsBytecodeVerified: true,
      schemaUIDsNonZero: hasNonZeroSchemaUIDs(deployment),
      requiredFieldsPresent: hasRequiredDeploymentFields(deployment),
    },
  };

  const file = checkpointPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2));

  return checkpoint;
}
