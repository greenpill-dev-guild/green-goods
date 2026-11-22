import { POLICY, type PolicyDeploymentArtifact, type PolicyDeploymentPlan } from "./single-attestation-deployment";
import {
  assertStandaloneSourcesCommitted,
  beginStandaloneBroadcast,
  parseStandaloneOptions,
  readStandaloneJson,
  recordStandaloneDeployment,
  standaloneForgeCommand,
  standalonePaths,
  standaloneReceiptHash,
  standaloneSourceCommand,
  writeStandaloneJson,
  type StandaloneOptions,
} from "./standalone-operation";

export { redactExplorerKey } from "./standalone-operation";

export type PolicyOptions = StandaloneOptions;

/** The inner handler remains strict even when called without the outer CLI. */
export function parsePolicyOptions(argv: string[]): PolicyOptions {
  return parseStandaloneOptions(POLICY, argv);
}

export interface PolicyPaths {
  runtime: string;
  plan: string;
  journal: string;
  artifact: string;
  foundry: string;
}

/** All operation-owned output stays in the package; refuse symlinks before any read/write. */
export function policyPaths(root: string, network: string, requestedPlan?: string): PolicyPaths {
  return standalonePaths(POLICY, root, network, requestedPlan);
}

export function readPolicyJson<T>(root: string, file: string): T {
  return readStandaloneJson<T>(root, file, POLICY.noun);
}

/** Publish a complete JSON record atomically; exclusive records cannot silently replace evidence. */
export function writePolicyJson(root: string, file: string, value: unknown, exclusive = false): void {
  writeStandaloneJson(root, file, value, POLICY.noun, exclusive);
}

export interface PolicyBroadcastJournal {
  schemaVersion: 1;
  kind: "SINGLE_ATTESTATION_POLICY_BROADCAST";
  state: "pending" | "verified";
  plan: PolicyDeploymentPlan;
  transactionHash?: string;
}

export function beginPolicyBroadcast(root: string, paths: PolicyPaths, plan: PolicyDeploymentPlan): void {
  beginStandaloneBroadcast(POLICY, root, paths, plan);
}

export function recordPolicyDeployment(
  root: string,
  paths: PolicyPaths,
  plan: PolicyDeploymentPlan,
  artifact: PolicyDeploymentArtifact,
): void {
  // The policy promotes nothing into <chainId>-latest.json, so there is no promotion to report.
  recordStandaloneDeployment(POLICY, root, paths, plan, artifact);
}

/** Select exactly the reviewed CREATE, then independently inspect that transaction on the RPC. */
export function policyReceiptHash(broadcast: unknown, plan: PolicyDeploymentPlan): string {
  return standaloneReceiptHash(POLICY, broadcast, plan);
}

export function policyForgeCommand(
  plan: PolicyDeploymentPlan,
  rpc: string,
  broadcast: boolean,
): { args: string[]; env: NodeJS.ProcessEnv } {
  const { args, env } = standaloneForgeCommand(POLICY, plan, rpc, broadcast);
  return { args, env };
}

/**
 * Explorer source submission for a deployment whose receipt and runtime are already verified. It
 * signs nothing and sends no transaction. The explorer is named explicitly, because Forge would
 * otherwise submit to its default verifier, and Forge reads the explorer key from
 * ETHERSCAN_API_KEY in the environment, so the key never appears in the arguments.
 */
export function policySourceCommand(
  deployment: Pick<PolicyDeploymentArtifact, "address" | "chainId">,
  verifierUrl: string,
): {
  args: string[];
  env: NodeJS.ProcessEnv;
} {
  const { args, env } = standaloneSourceCommand(POLICY, deployment, verifierUrl);
  return { args, env };
}

export function assertPolicySourcesCommitted(root: string): void {
  assertStandaloneSourcesCommitted(POLICY, root);
}
