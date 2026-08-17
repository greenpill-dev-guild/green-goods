import assert from "node:assert/strict";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type Abi,
  type Address,
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  parseEther,
  toBytes,
  zeroAddress,
  zeroHash,
} from "viem";
import { arbitrum } from "viem/chains";

export const LOCAL_ARBITRUM_RPC_URL = "http://127.0.0.1:3009";

const CHAIN_ID = 42161;
const COMMITMENT_POOLING_ADDRESS: Address = "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a";
const COMMITMENT_REGISTRY_ADDRESS: Address = "0x66300dA4d3749bFc9F7326DB94e0DEb47A7a3959";
const MODULE_OWNER: Address = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const TEST_GARDEN: Address = "0x0000000000000000000000000000000000000720";
const EXPECTED_AUDIT_TYPES = new Set([
  "POOL_REGISTERED",
  "PROVIDER_OPEN_COMMITMENT_CAP_UPDATED",
  "POOL_CHARTER_UPDATED",
  "POOL_READY",
  "POOL_OPENED",
  "CYCLE_SEEDED",
  "CYCLE_OPENED",
  "CLASS_REGISTERED",
  "CREATED",
  "CONFIRMER_RULE_SET",
  "CANCELLED",
  "CYCLE_CLOSED",
  "CYCLE_COMPOSTED",
  "POOL_CLOSED",
  "POOL_COMPOSTED",
  "POOL_REOPENED",
]);

const counterAbi = parseAbi([
  "function owner() view returns (address)",
  "function nextPoolId() view returns (uint256)",
  "function nextCycleId() view returns (uint256)",
  "function nextCommitmentId() view returns (uint256)",
]);

const indexerRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const repoRoot = dirname(dirname(indexerRoot));
const envioBin = join(indexerRoot, "node_modules/envio/bin.mjs");

interface LocalConfigInput {
  baseConfig: string;
  startBlock: bigint;
  endBlock: bigint;
  runId: string;
}

interface LifecycleProof {
  startBlock: bigint;
  endBlock: bigint;
  poolId: bigint;
  cycleId: bigint;
  commitmentId: bigint;
  transactionHashes: `0x${string}`[];
}

interface GraphqlProof {
  CommitmentPool: Array<{
    registrationSeen: boolean;
    garden: string | null;
    state: string | null;
    providerOpenCommitmentCap: string;
    liveCommitmentCount: string;
    nonTerminalCycleCount: string;
    commitmentsRequested: string;
    commitmentsCancelled: string;
  }>;
  CommitmentCycle: Array<{
    seedSeen: boolean;
    state: string | null;
    liveCommitmentCount: string;
    commitmentsCancelled: string;
  }>;
  Commitment: Array<{
    creationSeen: boolean;
    state: string | null;
    direction: string | null;
    commitmentType: string | null;
    unitLabel: string | null;
    targetUnits: string | null;
    cancelReasonCID: string | null;
  }>;
  CommitmentClass: Array<{
    poolId: string;
    cycleId: string | null;
    unitLabel: string;
    quota: string;
  }>;
  CommitmentEvent: Array<{ eventType: string; txHash: string }>;
}

interface ManagedProcess {
  child: ChildProcessWithoutNullStreams;
  output: string[];
}

export function buildLocalContractEventConfig(input: LocalConfigInput): string {
  if (input.endBlock < input.startBlock) {
    throw new Error(`end block ${input.endBlock} is before start block ${input.startBlock}`);
  }
  const chainsMarker = "\nchains:";
  const chainsOffset = input.baseConfig.indexOf(chainsMarker);
  if (chainsOffset === -1) throw new Error("base Envio config has no chains section");

  const header = input.baseConfig
    .slice(0, chainsOffset)
    .replace(/^name:.*$/m, `name: Green Goods Contract Event Integration ${input.runId}`);

  return `${header}
chains:
  - id: ${CHAIN_ID}
    start_block: ${input.startBlock}
    end_block: ${input.endBlock}
    max_reorg_depth: 0
    block_lag: 0
    rpc:
      url: "${LOCAL_ARBITRUM_RPC_URL}"
      for: sync
      polling_interval: 100
    contracts:
      - name: CommitmentPoolingModule
        address: "${COMMITMENT_POOLING_ADDRESS}"
      - name: CommitmentRegistry
        address: "${COMMITMENT_REGISTRY_ADDRESS}"
`;
}

export async function runLocalContractEventIntegration(): Promise<void> {
  const runId = `${process.pid}-${Date.now()}`;
  const configName = `.contract-events.${runId}.yaml`;
  const configPath = join(indexerRoot, configName);
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(LOCAL_ARBITRUM_RPC_URL),
  });
  const testClient = createTestClient({
    chain: arbitrum,
    mode: "anvil",
    transport: http(LOCAL_ARBITRUM_RPC_URL),
  });
  let anvil: ManagedProcess | undefined;
  let envio: ManagedProcess | undefined;
  let snapshotId: `0x${string}` | undefined;
  let composeStarted = false;
  const postgresPort = 35_433;
  const hasuraPort = 38_080;
  const indexerPort = 39_898;
  const composeProject = `green_goods_contract_events_${process.pid}`;
  const docker = await dockerRuntimeEnvironment();
  const composeEnv: NodeJS.ProcessEnv = {
    ...docker.env,
    ENVIO_PG_PORT: String(postgresPort),
    HASURA_EXTERNAL_PORT: String(hasuraPort),
    ENVIO_PG_DATABASE: "envio-contract-events",
    INDEXER_NETWORK_NAME: `${composeProject}_network`,
  };

  try {
    anvil = await ensureAnvil(publicClient);
    await assertForkBoundary(publicClient);
    snapshotId = await testClient.snapshot();

    const proof = await mineLifecycle(publicClient, testClient);
    const baseConfig = await readFile(join(indexerRoot, "config.yaml"), "utf8");
    const config = buildLocalContractEventConfig({
      baseConfig,
      startBlock: proof.startBlock,
      endBlock: proof.endBlock,
      runId,
    });
    await writeFile(configPath, config, { encoding: "utf8", flag: "wx" });

    await assertPortFree(postgresPort, "contract-event Postgres");
    await assertPortFree(hasuraPort, "contract-event Hasura");
    await assertPortFree(indexerPort, "contract-event Envio service");
    composeStarted = true;
    await runCommand(
      docker.command,
      [
        "compose",
        "-p",
        composeProject,
        "-f",
        join(indexerRoot, "docker-compose.indexer.yaml"),
        "up",
        "-d",
        "--wait",
        "envio-postgres",
        "graphql-engine",
      ],
      indexerRoot,
      90_000,
      composeEnv
    );
    const envioEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ENVIO_PG_HOST: "127.0.0.1",
      ENVIO_PG_PORT: String(postgresPort),
      ENVIO_PG_USER: "postgres",
      ENVIO_PG_PASSWORD: "testing",
      ENVIO_PG_DATABASE: "envio-contract-events",
      HASURA_GRAPHQL_ENDPOINT: `http://127.0.0.1:${hasuraPort}/v1/metadata`,
      HASURA_GRAPHQL_ADMIN_SECRET: "testing",
      ENVIO_INDEXER_PORT: String(indexerPort),
      ENVIO_PG_PUBLIC_SCHEMA: `contract_events_${process.pid}_${Date.now()}`,
    };
    envio = spawnManaged(process.execPath, [envioBin, "start", "--config", configName], {
      cwd: indexerRoot,
      env: envioEnv,
    });

    const indexed = await pollForIndexedProof(
      proof,
      envio,
      `http://127.0.0.1:${hasuraPort}/v1/graphql`
    );
    assertIndexedProof(indexed, proof);
  } finally {
    if (envio) await stopProcess(envio.child);
    if (composeStarted) {
      await runCommand(
        docker.command,
        [
          "compose",
          "-p",
          composeProject,
          "-f",
          join(indexerRoot, "docker-compose.indexer.yaml"),
          "down",
          "-v",
        ],
        indexerRoot,
        60_000,
        composeEnv
      ).catch(() => undefined);
    }
    await unlink(configPath).catch(() => undefined);
    if (snapshotId) await testClient.revert({ id: snapshotId }).catch(() => undefined);
    await testClient.stopImpersonatingAccount({ address: MODULE_OWNER }).catch(() => undefined);
    if (anvil) await stopProcess(anvil.child);
  }
}

async function ensureAnvil(
  publicClient: ReturnType<typeof createPublicClient>
): Promise<ManagedProcess | undefined> {
  if (await rpcResponds()) return undefined;

  const child = spawnManaged(
    "bun",
    ["run", "--cwd", join(repoRoot, "packages/contracts"), "dev:arbitrum-fork"],
    { cwd: repoRoot, env: process.env }
  );
  await waitFor(
    async () => (await rpcResponds()) || undefined,
    60_000,
    () => `Anvil did not start.\n${tail(child.output)}`,
    child.child
  );
  await publicClient.getChainId();
  return child;
}

async function assertForkBoundary(
  publicClient: ReturnType<typeof createPublicClient>
): Promise<void> {
  assert.equal(await publicClient.getChainId(), CHAIN_ID, "local RPC must be the Arbitrum fork");
  const code = await publicClient.getBytecode({ address: COMMITMENT_POOLING_ADDRESS });
  assert.ok(
    code && code !== "0x",
    "production CommitmentPoolingModule bytecode is absent on the fork"
  );
  const owner = await publicClient.readContract({
    address: COMMITMENT_POOLING_ADDRESS,
    abi: counterAbi,
    functionName: "owner",
  });
  assert.equal(owner.toLowerCase(), MODULE_OWNER.toLowerCase(), "unexpected pooling module owner");
}

async function mineLifecycle(
  publicClient: ReturnType<typeof createPublicClient>,
  testClient: ReturnType<typeof createTestClient>
): Promise<LifecycleProof> {
  const commitmentPoolingAbi = JSON.parse(
    await readFile(join(repoRoot, "packages/contracts/abis/ICommitmentPoolingModule.json"), "utf8")
  ) as Abi;
  const existing = (await publicClient.readContract({
    address: COMMITMENT_POOLING_ADDRESS,
    abi: commitmentPoolingAbi,
    functionName: "getPoolByGarden",
    args: [TEST_GARDEN],
  })) as readonly [bigint, unknown];
  assert.equal(existing[0], 0n, "test Garden already has a pool; use a fresh Anvil snapshot");

  await testClient.impersonateAccount({ address: MODULE_OWNER });
  await testClient.setBalance({ address: MODULE_OWNER, value: parseEther("100") });
  const walletClient = createWalletClient({
    account: MODULE_OWNER,
    chain: arbitrum,
    transport: http(LOCAL_ARBITRUM_RPC_URL),
  });
  const startBlock = (await publicClient.getBlockNumber()) + 1n;
  const poolId = await readCounter(publicClient, "nextPoolId");
  const cycleId = await readCounter(publicClient, "nextCycleId");
  const commitmentId = await readCounter(publicClient, "nextCommitmentId");
  const transactionHashes: `0x${string}`[] = [];

  const write = async (functionName: string, args: readonly unknown[]) => {
    const hash = await walletClient.writeContract({
      address: COMMITMENT_POOLING_ADDRESS,
      abi: commitmentPoolingAbi,
      functionName,
      args,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success", `${functionName} transaction reverted`);
    transactionHashes.push(hash);
    return receipt.blockNumber;
  };

  await write("registerPool", [TEST_GARDEN, 0]);
  await write("setProviderOpenCommitmentCap", [poolId, 4n]);
  await write("setPoolCharter", [poolId, "ipfs://local-contract-events/charter"]);
  await write("markPoolReady", [poolId]);
  await write("openPool", [poolId]);

  const block = await publicClient.getBlock();
  const cycleStart = block.timestamp;
  const cycleEnd = cycleStart + 30n * 24n * 60n * 60n;
  await write("seedCycle", [poolId, 1, cycleStart, cycleEnd, "ipfs://local-contract-events/cycle"]);
  await write("openCycle", [
    cycleId,
    {
      gardeners: 5_000,
      treasury: 1_000,
      operator: 1_000,
      evaluator: 1_000,
      community: 1_000,
      funder: 1_000,
    },
    { equalParticipationBps: 2_000, verifiedContributionBps: 8_000 },
  ]);
  await write("createCommitment", [
    {
      poolId,
      cycleId,
      creationRequestKey: keccak256(toBytes(`local-contract-events-${startBlock}`)),
      commitmentSeriesId: 0n,
      direction: 1,
      commitmentType: 2,
      claimType: 1,
      claimMode: 0,
      contributorPolicy: 1,
      onBehalfOf: zeroAddress,
      domainTags: [],
      requirements: [],
      unitLabel: "hours",
      targetUnits: 3n,
      requiresAssessment: false,
      dueDate: 0n,
      metadataCID: "ipfs://local-contract-events/commitment",
      needUID: zeroHash,
      counterCommitmentId: 0n,
      confirmers: [],
      confirmationThreshold: 0,
      protocolFallbackEnabled: false,
      consideration: { rail: 0, source: zeroAddress, token: zeroAddress, amount: 0n },
      declaredUnitValue: 0n,
      declaredValueBasis: "",
    },
  ]);
  await write("cancelCommitment", [commitmentId, ""]);
  await write("closeCycle", [cycleId]);
  await write("compostCycle", [cycleId]);
  await write("closePool", [poolId]);
  await write("compostPool", [poolId]);
  const endBlock = await write("reopenPool", [poolId, false]);
  const rawLogs = await publicClient.getLogs({
    address: [COMMITMENT_POOLING_ADDRESS, COMMITMENT_REGISTRY_ADDRESS],
    fromBlock: startBlock,
    toBlock: endBlock,
  });
  assert.ok(
    rawLogs.length >= EXPECTED_AUDIT_TYPES.size,
    `expected at least ${EXPECTED_AUDIT_TYPES.size} raw contract logs, received ${rawLogs.length}`
  );

  return { startBlock, endBlock, poolId, cycleId, commitmentId, transactionHashes };
}

async function readCounter(
  publicClient: ReturnType<typeof createPublicClient>,
  functionName: "nextPoolId" | "nextCycleId" | "nextCommitmentId"
): Promise<bigint> {
  return publicClient.readContract({
    address: COMMITMENT_POOLING_ADDRESS,
    abi: counterAbi,
    functionName,
  });
}

async function pollForIndexedProof(
  proof: LifecycleProof,
  envio: ManagedProcess,
  graphqlUrl: string
): Promise<GraphqlProof> {
  let lastObservation = "Hasura did not return an HTTP response";
  const query = `query LocalContractEvents {
    CommitmentPool(where: { id: { _eq: "${CHAIN_ID}-${proof.poolId}" } }) {
      registrationSeen garden state providerOpenCommitmentCap liveCommitmentCount
      nonTerminalCycleCount commitmentsRequested commitmentsCancelled
    }
    CommitmentCycle(where: { id: { _eq: "${CHAIN_ID}-${proof.cycleId}" } }) {
      seedSeen state liveCommitmentCount commitmentsCancelled
    }
    Commitment(where: { id: { _eq: "${CHAIN_ID}-${proof.commitmentId}" } }) {
      creationSeen state direction commitmentType unitLabel targetUnits cancelReasonCID
    }
    CommitmentClass(where: { id: { _eq: "${CHAIN_ID}-${proof.commitmentId}" } }) {
      poolId cycleId unitLabel quota
    }
    CommitmentEvent(where: { chainId: { _eq: ${CHAIN_ID} } }) { eventType txHash }
  }`;

  return waitFor(
    async () => {
      if (envio.child.exitCode !== null && envio.child.exitCode !== 0) {
        throw new Error(`Envio exited before indexing completed.\n${tail(envio.output)}`);
      }
      const response = await fetch(graphqlUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": "testing" },
        body: JSON.stringify({ query }),
      }).catch(() => undefined);
      if (!response) return undefined;
      if (!response.ok) {
        lastObservation = `Hasura HTTP ${response.status}`;
        return undefined;
      }
      const body = (await response.json()) as {
        data?: GraphqlProof;
        errors?: Array<{ message: string }>;
      };
      lastObservation = JSON.stringify(body);
      if (body.errors?.length || !body.data) return undefined;
      const types = new Set(body.data.CommitmentEvent.map((event) => event.eventType));
      if (
        body.data.CommitmentPool.length === 1 &&
        body.data.CommitmentCycle.length === 1 &&
        body.data.Commitment.length === 1 &&
        body.data.CommitmentClass.length === 1 &&
        [...EXPECTED_AUDIT_TYPES].every((eventType) => types.has(eventType))
      ) {
        return body.data;
      }
      if (envio.child.exitCode === 0) {
        throw new Error(
          `Envio completed the block range without the expected projection.\nLast GraphQL observation: ${lastObservation}\n${tail(envio.output)}`
        );
      }
      return undefined;
    },
    150_000,
    () =>
      `Envio did not index the mined lifecycle.\nLast GraphQL observation: ${lastObservation}\n${tail(envio.output)}`
  );
}

function assertIndexedProof(indexed: GraphqlProof, proof: LifecycleProof): void {
  const pool = indexed.CommitmentPool[0];
  const cycle = indexed.CommitmentCycle[0];
  const commitment = indexed.Commitment[0];
  const class_ = indexed.CommitmentClass[0];
  assert.ok(pool && cycle && commitment && class_);

  assert.deepEqual(pool, {
    registrationSeen: true,
    garden: TEST_GARDEN.toLowerCase(),
    state: "READY",
    providerOpenCommitmentCap: "4",
    liveCommitmentCount: "0",
    nonTerminalCycleCount: "0",
    commitmentsRequested: "1",
    commitmentsCancelled: "1",
  });
  assert.deepEqual(cycle, {
    seedSeen: true,
    state: "COMPOSTED",
    liveCommitmentCount: "0",
    commitmentsCancelled: "1",
  });
  assert.deepEqual(commitment, {
    creationSeen: true,
    state: "CANCELLED",
    direction: "REQUEST",
    commitmentType: "SEASON_CAMPAIGN",
    unitLabel: "hours",
    targetUnits: "3",
    cancelReasonCID: "",
  });
  assert.deepEqual(class_, {
    poolId: proof.poolId.toString(),
    cycleId: proof.cycleId.toString(),
    unitLabel: "hours",
    quota: "3",
  });

  const indexedHashes = new Set(indexed.CommitmentEvent.map((event) => event.txHash.toLowerCase()));
  for (const hash of proof.transactionHashes) {
    assert.ok(indexedHashes.has(hash.toLowerCase()), `missing audit row for transaction ${hash}`);
  }
}

function spawnManaged(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
): ManagedProcess {
  const child = spawn(command, args, { ...options, stdio: "pipe" });
  const output: string[] = [];
  const capture = (chunk: Buffer) => {
    output.push(chunk.toString());
    if (output.length > 200) output.splice(0, output.length - 200);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return { child, output };
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = globalThis.process.env
): Promise<void> {
  const process = spawnManaged(command, args, { cwd, env });
  const timeout = setTimeout(() => process.child.kill("SIGTERM"), timeoutMs);
  const code = await new Promise<number | null>((resolve, reject) => {
    process.child.once("error", reject);
    process.child.once("exit", resolve);
  });
  clearTimeout(timeout);
  if (code !== 0) throw new Error(tail(process.output));
}

async function stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGINT");
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGTERM");
}

async function waitFor<T>(
  check: () => Promise<T | undefined>,
  timeoutMs: number,
  timeoutMessage: () => string,
  child?: ChildProcessWithoutNullStreams
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(timeoutMessage());
    const value = await check();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(timeoutMessage());
}

async function rpcResponds(): Promise<boolean> {
  const response = await fetch(LOCAL_ARBITRUM_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).catch(() => undefined);
  return response?.ok === true;
}

async function assertPortFree(port: number, label: string): Promise<void> {
  const occupied = await new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
  if (occupied) throw new Error(`${label} port ${port} is already in use`);
}

async function dockerRuntimeEnvironment(): Promise<{
  command: string;
  env: NodeJS.ProcessEnv;
}> {
  const env = { ...process.env };
  const pathEntries = [env.PATH ?? ""];
  const orbDocker = join(homedir(), ".orbstack/bin/docker");
  const localDocker = "/usr/local/bin/docker";
  const command = (await isAccessible(orbDocker))
    ? orbDocker
    : (await isAccessible(localDocker))
      ? localDocker
      : "docker";

  pathEntries.push(dirname(command));
  env.PATH = [...new Set(pathEntries.filter(Boolean))].join(":");
  const orbSocket = join(homedir(), ".orbstack/run/docker.sock");
  if (await isAccessible(orbSocket)) {
    env.DOCKER_HOST = `unix://${orbSocket}`;
    delete env.DOCKER_CONTEXT;
  }
  return { command, env };
}

async function isAccessible(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

function tail(output: string[]): string {
  return output.join("").split("\n").slice(-80).join("\n");
}
