import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { getAddress } from "ethers";
import { CHAIN_ID_MAP } from "./network";
import { mergeReleaseArtifact } from "./release-artifacts";
import {
  STANDALONE_NETWORKS,
  capitalized,
  contractName,
  type StandaloneContract,
  type StandaloneDeploymentArtifact,
  type StandaloneDeploymentPlan,
} from "./standalone-deployment";

/** Shared machinery every standalone broadcast also requires committed. */
const MACHINERY = [
  "script/utils/standalone-deployment.ts",
  "script/utils/standalone-operation.ts",
  "script/utils/standalone-contract.ts",
  "script/utils/build-target.ts",
  "script/cli/operations.mjs",
  "foundry.toml",
];

export interface StandaloneOptions {
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
export function parseStandaloneOptions(contract: StandaloneContract, argv: string[]): StandaloneOptions {
  const noun = contract.noun;
  const Noun = capitalized(noun);
  const [command, ...args] = argv;
  if (command !== "deploy" && command !== "verify") throw new Error(`Expected ${noun} deploy or verify operation`);
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
    if (seen.has(token.name)) throw new Error(`Duplicate ${noun} option`);
    seen.add(token.name);
    if (token.value !== undefined && (!token.value.trim() || token.value.startsWith("-")))
      throw new Error(`Missing ${noun} option value`);
  }
  if (positionals.length || !STANDALONE_NETWORKS.includes(values.network ?? ""))
    throw new Error(`${Noun} operation requires an explicit supported network`);
  const modes = (["preflight", "plan-only", "simulate", "broadcast"] as const).filter((key) => values[key]);
  if (command === "deploy" ? modes.length !== 1 : modes.length !== 0)
    throw new Error(`${Noun} operation requires exactly one deployment mode, or read-only verification`);
  const mode = modes[0] === "plan-only" ? "plan" : modes[0];
  const nonce = values["expected-nonce"] === undefined ? undefined : Number(values["expected-nonce"]);
  if (nonce !== undefined && (!/^\d+$/u.test(values["expected-nonce"]!) || !Number.isSafeInteger(nonce)))
    throw new Error("Expected nonce must be a non-negative safe integer");
  const sender = values.sender === undefined ? undefined : getAddress(values.sender);
  if (mode === "plan" && (sender === undefined || nonce === undefined))
    throw new Error(`${Noun} planning requires --sender and --expected-nonce`);
  if (mode === "broadcast" && nonce === undefined) throw new Error(`${Noun} broadcast requires --expected-nonce`);
  if (values.receipt && !/^0x[0-9a-fA-F]{64}$/u.test(values.receipt))
    throw new Error(`${Noun} receipt must be a transaction hash`);
  if (
    (command === "verify" && (sender !== undefined || nonce !== undefined || values.plan)) ||
    (command === "deploy" && values.receipt) ||
    (mode === "preflight" && (sender || nonce !== undefined || values.plan)) ||
    (["simulate", "broadcast"].includes(mode ?? "") && sender !== undefined)
  )
    throw new Error(`Unexpected input for this ${noun} operation`);
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

export interface StandalonePaths {
  runtime: string;
  plan: string;
  journal: string;
  artifact: string;
  foundry: string;
  /** Present only for a contract whose verified address is promoted into the canonical artifact. */
  latest?: string;
  promotion?: string;
}

/** All operation-owned output stays in the package; refuse symlinks before any read/write. */
export function standalonePaths(
  contract: StandaloneContract,
  root: string,
  network: string,
  requestedPlan?: string,
): StandalonePaths {
  const Noun = capitalized(contract.noun);
  const chainId = CHAIN_ID_MAP[network];
  if (!chainId || !STANDALONE_NETWORKS.includes(network)) throw new Error(`Unsupported ${contract.noun} network`);
  const runtime = path.join(root, ".generated/runtime");
  const plan = requestedPlan
    ? path.resolve(root, requestedPlan)
    : path.join(runtime, `${chainId}-${contract.slug}.plan.json`);
  if (path.dirname(plan) !== runtime || !plan.endsWith(".json"))
    throw new Error(`${Noun} plan must be a JSON file directly inside .generated/runtime`);
  const paths: StandalonePaths = {
    runtime,
    plan,
    journal: path.join(runtime, `${chainId}-${contract.slug}.broadcast.json`),
    artifact: path.join(root, "deployments", `${chainId}-${contract.slug}.json`),
    foundry: path.join(root, `.generated/foundry/broadcast/${contract.script}.s.sol`, chainId, "run-latest.json"),
    ...(contract.latest
      ? {
          latest: path.join(root, "deployments", `${chainId}-latest.json`),
          promotion: path.join(runtime, `${chainId}-${contract.slug}.promotion.json`),
        }
      : {}),
  };
  for (const file of Object.values(paths)) if (file) assertPackagePath(root, file, contract.noun);
  return paths;
}

function assertPackagePath(root: string, file: string, noun: string): void {
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`${capitalized(noun)} output escapes the package`);
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error(`${capitalized(noun)} operation refuses symlinked paths`);
  }
}

export function readStandaloneJson<T>(root: string, file: string, noun: string): T {
  assertPackagePath(root, file, noun);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    return JSON.parse(fs.readFileSync(fd, "utf8")) as T;
  } finally {
    fs.closeSync(fd);
  }
}

/** Publish a complete JSON record atomically; exclusive records cannot silently replace evidence. */
export function writeStandaloneJson(root: string, file: string, value: unknown, noun: string, exclusive = false): void {
  assertPackagePath(root, file, noun);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertPackagePath(root, file, noun);
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

export interface StandaloneBroadcastJournal {
  schemaVersion: 1;
  kind: string;
  state: "pending" | "verified";
  plan: StandaloneDeploymentPlan;
  transactionHash?: string;
}

export function beginStandaloneBroadcast(
  contract: StandaloneContract,
  root: string,
  paths: StandalonePaths,
  plan: StandaloneDeploymentPlan,
): void {
  if (fs.existsSync(paths.artifact))
    throw new Error(`${capitalized(contract.noun)} deployment already recorded; verify it instead`);
  writeStandaloneJson(
    root,
    paths.journal,
    {
      schemaVersion: 1,
      kind: `${contract.id}_BROADCAST`,
      state: "pending",
      plan,
    } satisfies StandaloneBroadcastJournal,
    contract.noun,
    true,
  );
}

export interface LatestPromotion {
  file: string;
  promoted: Record<string, string | number>;
  changed: boolean;
}

/**
 * Write a verified deployment's address and CREATE block into the canonical
 * `<chainId>-latest.json` that apps resolve addresses from. Only the contract's own keys move; a
 * different value already recorded there is refused, never overwritten. Repeating it after a later
 * verification changes nothing.
 */
export function promoteStandaloneDeployment(
  contract: StandaloneContract,
  root: string,
  paths: StandalonePaths,
  artifact: Pick<StandaloneDeploymentArtifact, "address" | "blockNumber">,
): LatestPromotion | undefined {
  if (!contract.latest) return undefined;
  if (!paths.latest || !paths.promotion) throw new Error(`Missing ${contract.noun} promotion paths`);
  if (!Number.isSafeInteger(artifact.blockNumber) || artifact.blockNumber <= 0)
    throw new Error(`Verified ${contract.noun} deployment has no CREATE block to promote`);
  assertPackagePath(root, paths.latest, contract.noun);
  const promoted = {
    [contract.latest.address]: artifact.address,
    [contract.latest.deployBlock]: artifact.blockNumber,
  };
  writeStandaloneJson(root, paths.promotion, promoted, contract.noun);
  const { changed } = mergeReleaseArtifact({
    canonicalPath: paths.latest,
    sidePath: paths.promotion,
    ownedKeys: Object.keys(promoted),
  });
  return { file: path.relative(root, paths.latest), promoted, changed };
}

/** Persist verified evidence: the standalone artifact, the closed journal, then any canonical key. */
export function recordStandaloneDeployment(
  contract: StandaloneContract,
  root: string,
  paths: StandalonePaths,
  plan: StandaloneDeploymentPlan,
  artifact: StandaloneDeploymentArtifact,
): LatestPromotion | undefined {
  writeStandaloneJson(root, paths.artifact, artifact, contract.noun, true);
  writeStandaloneJson(
    root,
    paths.journal,
    {
      schemaVersion: 1,
      kind: `${contract.id}_BROADCAST`,
      state: "verified",
      plan,
      transactionHash: artifact.transactionHash,
    } satisfies StandaloneBroadcastJournal,
    contract.noun,
  );
  return promoteStandaloneDeployment(contract, root, paths, artifact);
}

/** Select exactly the reviewed CREATE, then independently inspect that transaction on the RPC. */
export function standaloneReceiptHash(
  contract: StandaloneContract,
  broadcast: unknown,
  plan: StandaloneDeploymentPlan,
): string {
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
  const name = contractName(contract);
  const matching = txs?.filter(
    (tx) =>
      tx.transactionType === "CREATE" &&
      tx.contractName === name &&
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
      `No unique reviewed ${contract.noun} CREATE receipt; verify with its explicit --receipt instead of retrying broadcast`,
    );
  return matching[0].hash!;
}

/** A Forge invocation, built here and run by the operation. */
export interface ForgeCommand {
  command: "forge";
  args: string[];
  env: NodeJS.ProcessEnv;
}

/**
 * Simulation carries no signer. A live broadcast signs only through the deployer keystore; a
 * contract may let a localhost broadcast sign through the local node's unlocked account instead,
 * so a rehearsal never needs key material in this process.
 */
export function standaloneForgeCommand(
  contract: StandaloneContract,
  plan: StandaloneDeploymentPlan,
  rpc: string,
  broadcast: boolean,
): ForgeCommand {
  const args = [
    "script",
    `script/${contract.script}.s.sol:${contract.script}`,
    "--rpc-url",
    rpc,
    "--sender",
    plan.deployer,
    "--gas-estimate-multiplier",
    "130",
  ];
  const unlocked = broadcast && plan.network === "localhost" && contract.localhostSigner === "unlocked";
  if (unlocked) args.push("--broadcast", "--unlocked");
  else if (broadcast) args.push("--broadcast", "--account", "green-goods-deployer");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FOUNDRY_PROFILE: "production",
    FORGE_BROADCAST: String(broadcast),
    [`${contract.id}_SENDER`]: plan.deployer,
    [`${contract.id}_CHAIN_ID`]: String(plan.chainId),
    [`${contract.id}_NONCE`]: String(plan.nonce),
    [`${contract.id}_ADDRESS`]: plan.address,
    [`${contract.id}_RUNTIME_HASH`]: plan.runtimeCodeHash,
    PINATA_JWT: "",
    PINATA_GATEWAY: "",
  };
  if (!broadcast || unlocked) delete env.ETH_PASSWORD;
  return { command: "forge", args, env };
}

/**
 * Explorer source submission for a deployment whose receipt and runtime are already verified. It
 * signs nothing and sends no transaction. The explorer is named explicitly, because Forge would
 * otherwise submit to its default verifier, and Forge reads the explorer key from
 * ETHERSCAN_API_KEY in the environment, so the key never appears in the arguments.
 */
export function standaloneSourceCommand(
  contract: StandaloneContract,
  deployment: Pick<StandaloneDeploymentArtifact, "address" | "chainId">,
  verifierUrl: string,
): ForgeCommand {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FOUNDRY_PROFILE: "production",
    PINATA_JWT: "",
    PINATA_GATEWAY: "",
  };
  delete env.ETH_PASSWORD;
  return {
    command: "forge",
    args: [
      "verify-contract",
      deployment.address,
      contract.target,
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

/** The source path of a Forge target, the part before the colon. */
function targetSource(contract: StandaloneContract): string {
  return contract.target.slice(0, contract.target.indexOf(":"));
}

export function standaloneSources(contract: StandaloneContract): string[] {
  return [targetSource(contract), `script/${contract.script}.s.sol`, ...contract.sources, ...MACHINERY];
}

export function assertStandaloneSourcesCommitted(contract: StandaloneContract, root: string): void {
  const paths = standaloneSources(contract);
  if (execFileSync("git", ["status", "--porcelain", "--", ...paths], { cwd: root, encoding: "utf8" }).trim())
    throw new Error(`${capitalized(contract.noun)} broadcast requires committed, unchanged deployment sources`);
}
