import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { getAddress } from "ethers";
import { CHAIN_ID_MAP } from "./network";
import {
  POLICY_TARGET,
  type PolicyDeploymentArtifact,
  type PolicyDeploymentPlan,
} from "./single-attestation-deployment";

export interface PolicyOptions {
  command: "deploy" | "verify";
  network: string;
  mode?: "preflight" | "plan" | "simulate" | "broadcast";
  sender?: string;
  nonce?: number;
  planPath?: string;
  receipt?: string;
  /** After verification, submit the source to the network's explorer. */
  publishSource: boolean;
}

/** The inner handler remains strict even when called without the outer CLI. */
export function parsePolicyOptions(argv: string[]): PolicyOptions {
  const [command, ...args] = argv;
  if (command !== "deploy" && command !== "verify") throw new Error("Expected policy deploy or verify operation");
  const { values, positionals, tokens } = parseArgs({
    args,
    strict: true,
    tokens: true,
    options: {
      network: { type: "string" },
      sender: { type: "string" },
      "expected-nonce": { type: "string" },
      plan: { type: "string" },
      receipt: { type: "string" },
      preflight: { type: "boolean" },
      "plan-only": { type: "boolean" },
      simulate: { type: "boolean" },
      broadcast: { type: "boolean" },
      "publish-source": { type: "boolean" },
    },
  });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name)) throw new Error("Duplicate policy option");
    seen.add(token.name);
    if (token.value !== undefined && (!token.value.trim() || token.value.startsWith("-")))
      throw new Error("Missing policy option value");
  }
  if (positionals.length || !["arbitrum", "sepolia", "localhost"].includes(values.network ?? ""))
    throw new Error("Policy operation requires an explicit supported network");
  const modes = (["preflight", "plan-only", "simulate", "broadcast"] as const).filter((key) => values[key]);
  if (command === "deploy" ? modes.length !== 1 : modes.length !== 0)
    throw new Error("Policy operation requires exactly one deployment mode, or read-only verification");
  const mode = modes[0] === "plan-only" ? "plan" : modes[0];
  const nonce = values["expected-nonce"] === undefined ? undefined : Number(values["expected-nonce"]);
  if (nonce !== undefined && (!/^\d+$/u.test(values["expected-nonce"]!) || !Number.isSafeInteger(nonce)))
    throw new Error("Expected nonce must be a non-negative safe integer");
  const sender = values.sender === undefined ? undefined : getAddress(values.sender);
  if (mode === "plan" && (sender === undefined || nonce === undefined))
    throw new Error("Policy planning requires --sender and --expected-nonce");
  if (mode === "broadcast" && nonce === undefined) throw new Error("Policy broadcast requires --expected-nonce");
  if (values.receipt && !/^0x[0-9a-fA-F]{64}$/u.test(values.receipt))
    throw new Error("Policy receipt must be a transaction hash");
  if (
    (command === "verify" && (sender !== undefined || nonce !== undefined || values.plan)) ||
    (command === "deploy" && values.receipt) ||
    (mode === "preflight" && (sender || nonce !== undefined || values.plan)) ||
    (["simulate", "broadcast"].includes(mode ?? "") && sender !== undefined)
  )
    throw new Error("Unexpected input for this policy operation");
  const publishSource = values["publish-source"] === true;
  if (publishSource && (command !== "verify" || values.network === "localhost"))
    throw new Error("Source publication belongs to verification on a network with an explorer");
  return {
    command,
    network: values.network!,
    mode,
    sender,
    nonce,
    planPath: values.plan,
    receipt: values.receipt,
    publishSource,
  };
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
  const chainId = CHAIN_ID_MAP[network];
  if (!chainId || !["arbitrum", "sepolia", "localhost"].includes(network))
    throw new Error("Unsupported policy network");
  const runtime = path.join(root, ".generated/runtime");
  const plan = requestedPlan
    ? path.resolve(root, requestedPlan)
    : path.join(runtime, `${chainId}-single-attestation-policy.plan.json`);
  if (path.dirname(plan) !== runtime || !plan.endsWith(".json"))
    throw new Error("Policy plan must be a JSON file directly inside .generated/runtime");
  const paths = {
    runtime,
    plan,
    journal: path.join(runtime, `${chainId}-single-attestation-policy.broadcast.json`),
    artifact: path.join(root, "deployments", `${chainId}-single-attestation-policy.json`),
    foundry: path.join(
      root,
      ".generated/foundry/broadcast/DeploySingleAttestationPolicy.s.sol",
      chainId,
      "run-latest.json",
    ),
  };
  for (const file of Object.values(paths)) assertPackagePath(root, file);
  return paths;
}

function assertPackagePath(root: string, file: string): void {
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Policy output escapes the package");
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error("Policy operation refuses symlinked paths");
  }
}

export function readPolicyJson<T>(root: string, file: string): T {
  assertPackagePath(root, file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    return JSON.parse(fs.readFileSync(fd, "utf8")) as T;
  } finally {
    fs.closeSync(fd);
  }
}

/** Publish a complete JSON record atomically; exclusive records cannot silently replace evidence. */
export function writePolicyJson(root: string, file: string, value: unknown, exclusive = false): void {
  assertPackagePath(root, file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertPackagePath(root, file);
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(
    temporary,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    if (exclusive) fs.linkSync(temporary, file);
    else fs.renameSync(temporary, file);
    const directory = fs.openSync(
      path.dirname(file),
      fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW,
    );
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export interface PolicyBroadcastJournal {
  schemaVersion: 1;
  kind: "SINGLE_ATTESTATION_POLICY_BROADCAST";
  state: "pending" | "verified";
  plan: PolicyDeploymentPlan;
  transactionHash?: string;
}

export function beginPolicyBroadcast(root: string, paths: PolicyPaths, plan: PolicyDeploymentPlan): void {
  if (fs.existsSync(paths.artifact)) throw new Error("Policy deployment already recorded; verify it instead");
  writePolicyJson(
    root,
    paths.journal,
    {
      schemaVersion: 1,
      kind: "SINGLE_ATTESTATION_POLICY_BROADCAST",
      state: "pending",
      plan,
    } satisfies PolicyBroadcastJournal,
    true,
  );
}

export function recordPolicyDeployment(
  root: string,
  paths: PolicyPaths,
  plan: PolicyDeploymentPlan,
  artifact: PolicyDeploymentArtifact,
): void {
  writePolicyJson(root, paths.artifact, artifact, true);
  writePolicyJson(root, paths.journal, {
    schemaVersion: 1,
    kind: "SINGLE_ATTESTATION_POLICY_BROADCAST",
    state: "verified",
    plan,
    transactionHash: artifact.transactionHash,
  } satisfies PolicyBroadcastJournal);
}

/** Select exactly the reviewed CREATE, then independently inspect that transaction on the RPC. */
export function policyReceiptHash(broadcast: unknown, plan: PolicyDeploymentPlan): string {
  const txs = (
    broadcast as {
      transactions?: Array<{
        hash?: string;
        transactionType?: string;
        contractName?: string;
        contractAddress?: string;
        transaction?: { from?: string; nonce?: string; input?: string; value?: string; to?: string | null };
      }>;
    }
  )?.transactions;
  const matching = txs?.filter(
    (tx) =>
      tx.transactionType === "CREATE" &&
      tx.contractName === "SingleAttestationPolicy" &&
      tx.contractAddress?.toLowerCase() === plan.address.toLowerCase() &&
      tx.transaction?.from?.toLowerCase() === plan.deployer.toLowerCase() &&
      tx.transaction.nonce &&
      BigInt(tx.transaction.nonce) === BigInt(plan.nonce) &&
      tx.transaction.input?.toLowerCase() === plan.creationCode.toLowerCase() &&
      !tx.transaction.to &&
      BigInt(tx.transaction.value ?? "0") === 0n,
  );
  if (matching?.length !== 1 || !/^0x[0-9a-fA-F]{64}$/u.test(matching[0].hash ?? ""))
    throw new Error(
      "No unique reviewed policy CREATE receipt; verify with its explicit --receipt instead of retrying broadcast",
    );
  return matching[0].hash!;
}

export function policyForgeCommand(
  plan: PolicyDeploymentPlan,
  rpc: string,
  broadcast: boolean,
): { args: string[]; env: NodeJS.ProcessEnv } {
  const args = [
    "script",
    "script/DeploySingleAttestationPolicy.s.sol:DeploySingleAttestationPolicy",
    "--rpc-url",
    rpc,
    "--sender",
    plan.deployer,
    "--gas-estimate-multiplier",
    "130",
  ];
  if (broadcast) args.push("--broadcast", "--account", "green-goods-deployer");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FOUNDRY_PROFILE: "production",
    FORGE_BROADCAST: String(broadcast),
    SINGLE_ATTESTATION_POLICY_SENDER: plan.deployer,
    SINGLE_ATTESTATION_POLICY_CHAIN_ID: String(plan.chainId),
    SINGLE_ATTESTATION_POLICY_NONCE: String(plan.nonce),
    SINGLE_ATTESTATION_POLICY_ADDRESS: plan.address,
    SINGLE_ATTESTATION_POLICY_RUNTIME_HASH: plan.runtimeCodeHash,
    PINATA_JWT: "",
    PINATA_GATEWAY: "",
    PINATA_JWT_OP_REF: "",
  };
  if (!broadcast) delete env.ETH_PASSWORD;
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
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FOUNDRY_PROFILE: "production",
    PINATA_JWT: "",
    PINATA_GATEWAY: "",
    PINATA_JWT_OP_REF: "",
  };
  delete env.ETH_PASSWORD;
  return {
    args: [
      "verify-contract",
      deployment.address,
      POLICY_TARGET,
      "--chain",
      String(deployment.chainId),
      "--verifier",
      "etherscan",
      "--verifier-url",
      verifierUrl,
      "--watch",
    ],
    env,
  };
}

/** Forge and the explorer may echo a request; the explorer key must not reach a log. */
export function redactExplorerKey(text: string, key: string | undefined): string {
  const withoutKey = key ? text.split(key).join("[REDACTED]") : text;
  return withoutKey.replace(/(api-?key[=:]\s*)[^\s&"']+/giu, "$1[REDACTED]");
}

export function assertPolicySourcesCommitted(root: string): void {
  const paths = [
    "src/modules/SingleAttestationPolicy.sol",
    "script/DeploySingleAttestationPolicy.s.sol",
    "script/deploy/single-attestation-policy.ts",
    "script/utils/single-attestation-deployment.ts",
    "script/utils/single-attestation-operation.ts",
    "script/utils/build-target.ts",
    "script/cli/operations.mjs",
    "foundry.toml",
  ];
  if (execFileSync("git", ["status", "--porcelain", "--", ...paths], { cwd: root, encoding: "utf8" }).trim())
    throw new Error("Policy broadcast requires committed, unchanged deployment sources");
}
