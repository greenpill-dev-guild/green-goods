import * as fs from "node:fs";

import {
  ARTIFACT_OUTPUT_DIR,
  CONTRACTS_DIR,
  ROOT_DIR,
  SCRIPT_DEFINITIONS,
  type JobLogger,
  type OpsJob,
} from "./types";
import {
  findForgeArtifact,
  getChainId,
  getDeploymentArtifactPath,
  parseDeployRequest,
  parseRunScriptRequest,
  parseUpgradeRequest,
  persistTxPlan,
  readForgeArtifact,
  readLatestPlan,
  runCommand,
} from "./forge";

export async function executeJob(job: OpsJob, logger: JobLogger): Promise<Record<string, unknown>> {
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

export async function executeDeployPlan(
  payload: Record<string, unknown>,
  logger: JobLogger
): Promise<Record<string, unknown>> {
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

export async function executeFinalizeDeploy(
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

export async function executeUpgradePlan(
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

export async function executeFinalizeUpgrade(
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

export async function executeScript(
  payload: Record<string, unknown>,
  logger: JobLogger
): Promise<Record<string, unknown>> {
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
