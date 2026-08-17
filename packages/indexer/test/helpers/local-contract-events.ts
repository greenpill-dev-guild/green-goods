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
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  toBytes,
  zeroAddress,
  zeroHash,
} from "viem";
import { arbitrum } from "viem/chains";
import * as yaml from "js-yaml";

export const LOCAL_ARBITRUM_RPC_URL = "http://127.0.0.1:3009";
export const LOCAL_CONTRACT_EVENT_OPERATION_TIMEOUT_MS = 300_000;
export const LOCAL_CONTRACT_EVENT_CLEANUP_BUDGET_MS = 120_000;
export const LOCAL_CONTRACT_EVENT_MOCHA_TIMEOUT_MS = 480_000;

const CHAIN_ID = 42161;
const MODULE_OWNER: Address = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const TEST_GARDEN = getAddress("0x0000000000000000000000000000000000000abc");
const ACTIVE_TEST_GARDEN = getAddress("0x0000000000000000000000000000000000000def");
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
  "function paused() view returns (bool)",
  "function nextPoolId() view returns (uint256)",
  "function nextCycleId() view returns (uint256)",
  "function nextCommitmentId() view returns (uint256)",
  "function setPaused(bool paused_)",
]);

const indexerRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const repoRoot = dirname(dirname(indexerRoot));
const envioBin = join(indexerRoot, "node_modules/envio/bin.mjs");
const ANVIL_START_TIMEOUT_MS = 60_000;
const COMPOSE_START_TIMEOUT_MS = 90_000;
const INDEXER_POLL_TIMEOUT_MS = 150_000;
const TRANSACTION_RECEIPT_TIMEOUT_MS = 30_000;

interface LocalConfigInput {
  baseConfig: string;
  contracts: PoolingContracts;
  startBlock: bigint;
  endBlock: bigint;
  runId: string;
}

export interface PoolingContracts {
  commitmentPoolingModule: Address;
  commitmentRegistry: Address;
  creditRegistry: Address;
}

interface LifecycleProof {
  startBlock: bigint;
  endBlock: bigint;
  poolId: bigint;
  cycleId: bigint;
  commitmentId: bigint;
  activePoolId: bigint;
  activeCycleId: bigint;
  activeCommitmentId: bigint;
  rawLogCount: number;
  transactionHashes: `0x${string}`[];
  creditPaused: boolean;
  creditRegistry: Address;
  creditTransactionHash: `0x${string}`;
}

interface PoolProof {
  registrationSeen: boolean;
  garden: string | null;
  state: string | null;
  providerOpenCommitmentCap: string;
  liveCommitmentCount: string;
  nonTerminalCycleCount: string;
  commitmentsRequested: string;
  commitmentsCancelled: string;
}

interface CycleProof {
  seedSeen: boolean;
  state: string | null;
  liveCommitmentCount: string;
  commitmentsCancelled: string;
}

interface CommitmentProof {
  creationSeen: boolean;
  state: string | null;
  direction: string | null;
  commitmentType: string | null;
  unitLabel: string | null;
  targetUnits: string | null;
  cancelReasonCID: string | null;
}

interface GraphqlProof {
  TerminalPool: PoolProof[];
  ActivePool: Array<{
    registrationSeen: boolean;
    garden: string | null;
    state: string | null;
    liveCommitmentCount: string;
    nonTerminalCycleCount: string;
  }>;
  TerminalCycle: CycleProof[];
  ActiveCycle: Array<{ seedSeen: boolean; state: string | null; liveCommitmentCount: string }>;
  TerminalCommitment: CommitmentProof[];
  ActiveCommitment: Array<{
    creationSeen: boolean;
    state: string | null;
    direction: string | null;
  }>;
  CommitmentClass: Array<{
    poolId: string;
    cycleId: string | null;
    unitLabel: string;
    quota: string;
  }>;
  CommitmentEvent: Array<{
    eventType: string;
    txHash: string;
    poolId: string | null;
    commitmentId: string | null;
  }>;
  CreditRegistryConfiguration: Array<{ registry: string; paused: boolean }>;
  LoanEvent: Array<{ eventType: string; txHash: string }>;
}

interface ManagedProcess {
  child: ChildProcessWithoutNullStreams;
  output: string[];
}

interface AbortableOperationOptions {
  timeoutMs: number;
  run: (signal: AbortSignal) => Promise<void>;
  cleanup: () => Promise<void>;
}

export async function runAbortableOperationWithCleanup(
  options: AbortableOperationOptions
): Promise<void> {
  const controller = new AbortController();
  const timeoutError = new Error(`operation exceeded its ${options.timeoutMs}ms deadline`);
  const timeout = setTimeout(() => controller.abort(timeoutError), options.timeoutMs);
  let removeAbortListener = () => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    const onAbort = () => reject(abortReason(controller.signal));
    controller.signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => controller.signal.removeEventListener("abort", onAbort);
  });

  let primaryError: unknown;
  try {
    await Promise.race([options.run(controller.signal), deadline]);
  } catch (error) {
    primaryError = error;
  } finally {
    clearTimeout(timeout);
    removeAbortListener();
  }

  let cleanupError: unknown;
  try {
    await options.cleanup();
  } catch (error) {
    cleanupError = error;
  }

  if (primaryError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `operation failed and cleanup was incomplete:\n${[primaryError, cleanupError]
        .map(errorMessage)
        .join("\n")}`
    );
  }
  if (primaryError !== undefined) throw primaryError;
  if (cleanupError !== undefined) throw cleanupError;
}

function requiredAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${field} is not a valid deployment address`);
  }
  return getAddress(value);
}

function configuredPoolingContracts(
  baseConfig: string
): Pick<PoolingContracts, "commitmentPoolingModule" | "commitmentRegistry"> {
  const document = yaml.load(baseConfig) as {
    chains?: Array<{
      id?: unknown;
      contracts?: Array<{ name?: unknown; address?: unknown }>;
    }>;
  };
  const arbitrumConfig = document.chains?.find((chain) => Number(chain.id) === CHAIN_ID);
  const configuredAddress = (contractName: string): unknown =>
    arbitrumConfig?.contracts?.find((contract) => contract.name === contractName)?.address;

  return {
    commitmentPoolingModule: requiredAddress(
      configuredAddress("CommitmentPoolingModule"),
      "config CommitmentPoolingModule"
    ),
    commitmentRegistry: requiredAddress(
      configuredAddress("CommitmentRegistry"),
      "config CommitmentRegistry"
    ),
  };
}

export function resolvePoolingContracts(
  baseConfig: string,
  deploymentJson: string
): PoolingContracts {
  const deployment = JSON.parse(deploymentJson) as Record<string, unknown>;
  const deployed = {
    commitmentPoolingModule: requiredAddress(
      deployment.commitmentPoolingModule,
      "deployment commitmentPoolingModule"
    ),
    commitmentRegistry: requiredAddress(
      deployment.commitmentRegistry,
      "deployment commitmentRegistry"
    ),
    creditRegistry: requiredAddress(deployment.creditRegistry, "deployment creditRegistry"),
  };
  const configured = configuredPoolingContracts(baseConfig);
  assert.deepEqual(
    {
      commitmentPoolingModule: configured.commitmentPoolingModule.toLowerCase(),
      commitmentRegistry: configured.commitmentRegistry.toLowerCase(),
    },
    {
      commitmentPoolingModule: deployed.commitmentPoolingModule.toLowerCase(),
      commitmentRegistry: deployed.commitmentRegistry.toLowerCase(),
    },
    "Arbitrum pooling addresses drifted between config.yaml and the deployment artifact"
  );
  return deployed;
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
        address: "${input.contracts.commitmentPoolingModule}"
      - name: CommitmentRegistry
        address: "${input.contracts.commitmentRegistry}"
      - name: CreditRegistry
        address: "${input.contracts.creditRegistry}"
`;
}

export async function runLocalContractEventIntegration(): Promise<void> {
  const runId = `${process.pid}-${Date.now()}`;
  const configName = `.contract-events.${runId}.yaml`;
  const configPath = join(indexerRoot, configName);
  const [baseConfig, deploymentJson] = await Promise.all([
    readFile(join(indexerRoot, "config.yaml"), "utf8"),
    readFile(join(repoRoot, "packages/contracts/deployments/42161-latest.json"), "utf8"),
  ]);
  const contracts = resolvePoolingContracts(baseConfig, deploymentJson);
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
  let impersonating = false;
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

  await runAbortableOperationWithCleanup({
    timeoutMs: LOCAL_CONTRACT_EVENT_OPERATION_TIMEOUT_MS,
    run: async (signal) => {
      anvil = await ensureAnvil(publicClient, signal);
      await assertForkBoundary(publicClient, contracts, signal);
      throwIfAborted(signal);
      snapshotId = await testClient.snapshot();
      throwIfAborted(signal);
      await testClient.impersonateAccount({ address: MODULE_OWNER });
      impersonating = true;
      // Arbitrum's forked fee model can quote very large L1-inclusive costs. This
      // balance exists only inside the disposable snapshot and is always reverted.
      await testClient.setBalance({ address: MODULE_OWNER, value: 1n << 255n });

      const proof = await mineLifecycle(publicClient, contracts, signal);
      const config = buildLocalContractEventConfig({
        baseConfig,
        contracts,
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
        COMPOSE_START_TIMEOUT_MS,
        composeEnv,
        signal
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
        `http://127.0.0.1:${hasuraPort}/v1/graphql`,
        signal
      );
      assertIndexedProof(indexed, proof);
    },
    cleanup: async () => {
      const cleanupErrors: Error[] = [];
      if (envio) {
        const envioChild = envio.child;
        await collectCleanupError("stop Envio", () => stopProcess(envioChild), cleanupErrors);
      }
      if (composeStarted) {
        await collectCleanupError(
          "remove integration Docker resources",
          () =>
            runCommand(
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
            ),
          cleanupErrors
        );
      }
      await collectCleanupError(
        "remove temporary Envio config",
        () => removeFileIfPresent(configPath),
        cleanupErrors
      );
      if (impersonating) {
        await collectCleanupError(
          "stop module-owner impersonation",
          () => testClient.stopImpersonatingAccount({ address: MODULE_OWNER }),
          cleanupErrors
        );
      }
      if (snapshotId) {
        const snapshot = snapshotId;
        await collectCleanupError(
          "restore the Anvil snapshot",
          async () => {
            const restored = await testClient.request({
              method: "evm_revert",
              params: [snapshot],
            });
            assert.equal(restored, true, "Anvil rejected the snapshot revert");
          },
          cleanupErrors
        );
      }
      if (anvil) {
        const anvilChild = anvil.child;
        await collectCleanupError("stop owned Anvil", () => stopProcess(anvilChild), cleanupErrors);
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          `contract-event integration cleanup failed:\n${cleanupErrors.map(errorMessage).join("\n")}`
        );
      }
    },
  });
}

async function ensureAnvil(
  publicClient: ReturnType<typeof createPublicClient>,
  signal: AbortSignal
): Promise<ManagedProcess | undefined> {
  if (await rpcResponds(signal)) return undefined;

  const child = spawnManaged(
    "bun",
    ["run", "--cwd", join(repoRoot, "packages/contracts"), "dev:arbitrum-fork"],
    { cwd: repoRoot, env: { ...process.env, ANVIL_PORT: "3009" } }
  );
  try {
    await waitFor(
      async () => (await rpcResponds(signal)) || undefined,
      ANVIL_START_TIMEOUT_MS,
      () => `Anvil did not start.\n${tail(child.output)}`,
      child.child,
      signal
    );
  } catch (error) {
    try {
      await stopProcess(child.child);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Anvil failed to start and its process could not be stopped:\n${[error, cleanupError]
          .map(errorMessage)
          .join("\n")}`
      );
    }
    throw error;
  }
  await publicClient.getChainId();
  return child;
}

async function assertForkBoundary(
  publicClient: ReturnType<typeof createPublicClient>,
  contracts: PoolingContracts,
  signal: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  assert.equal(await publicClient.getChainId(), CHAIN_ID, "local RPC must be the Arbitrum fork");
  throwIfAborted(signal);
  const [moduleCode, registryCode, creditCode] = await Promise.all([
    publicClient.getBytecode({ address: contracts.commitmentPoolingModule }),
    publicClient.getBytecode({ address: contracts.commitmentRegistry }),
    publicClient.getBytecode({ address: contracts.creditRegistry }),
  ]);
  assert.ok(
    moduleCode && moduleCode !== "0x",
    "production CommitmentPoolingModule bytecode is absent on the fork"
  );
  assert.ok(
    registryCode && registryCode !== "0x",
    "production CommitmentRegistry bytecode is absent on the fork"
  );
  assert.ok(
    creditCode && creditCode !== "0x",
    "production CreditRegistry bytecode is absent on the fork"
  );
  throwIfAborted(signal);
  const owner = await publicClient.readContract({
    address: contracts.commitmentPoolingModule,
    abi: counterAbi,
    functionName: "owner",
  });
  assert.equal(owner.toLowerCase(), MODULE_OWNER.toLowerCase(), "unexpected pooling module owner");
  const creditOwner = await publicClient.readContract({
    address: contracts.creditRegistry,
    abi: counterAbi,
    functionName: "owner",
  });
  assert.equal(
    creditOwner.toLowerCase(),
    MODULE_OWNER.toLowerCase(),
    "unexpected credit registry owner"
  );
  assert.equal(
    await publicClient.readContract({
      address: contracts.commitmentPoolingModule,
      abi: counterAbi,
      functionName: "paused",
    }),
    false,
    "CommitmentPoolingModule is paused on the fork"
  );
}

function requestCommitmentParams(
  poolId: bigint,
  cycleId: bigint,
  requestKey: string,
  targetUnits: bigint
) {
  return {
    poolId,
    cycleId,
    creationRequestKey: keccak256(toBytes(requestKey)),
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
    targetUnits,
    requiresAssessment: false,
    dueDate: 0n,
    metadataCID: `ipfs://${requestKey}`,
    needUID: zeroHash,
    counterCommitmentId: 0n,
    confirmers: [],
    confirmationThreshold: 0,
    protocolFallbackEnabled: false,
    consideration: { rail: 0, source: zeroAddress, token: zeroAddress, amount: 0n },
    declaredUnitValue: 0n,
    declaredValueBasis: "",
  };
}

async function mineLifecycle(
  publicClient: ReturnType<typeof createPublicClient>,
  contracts: PoolingContracts,
  signal: AbortSignal
): Promise<LifecycleProof> {
  throwIfAborted(signal);
  const commitmentPoolingAbi = JSON.parse(
    await readFile(join(repoRoot, "packages/contracts/abis/ICommitmentPoolingModule.json"), "utf8")
  ) as Abi;
  const existing = (await publicClient.readContract({
    address: contracts.commitmentPoolingModule,
    abi: commitmentPoolingAbi,
    functionName: "getPoolByGarden",
    args: [TEST_GARDEN],
  })) as readonly [bigint, unknown];
  assert.equal(existing[0], 0n, "test Garden already has a pool; use a fresh Anvil snapshot");
  const activeExisting = (await publicClient.readContract({
    address: contracts.commitmentPoolingModule,
    abi: commitmentPoolingAbi,
    functionName: "getPoolByGarden",
    args: [ACTIVE_TEST_GARDEN],
  })) as readonly [bigint, unknown];
  assert.equal(
    activeExisting[0],
    0n,
    "active test Garden already has a pool; use a fresh Anvil snapshot"
  );

  const walletClient = createWalletClient({
    account: MODULE_OWNER,
    chain: arbitrum,
    transport: http(LOCAL_ARBITRUM_RPC_URL),
  });
  const startBlock = (await publicClient.getBlockNumber()) + 1n;
  const poolId = await readCounter(publicClient, contracts, "nextPoolId");
  const cycleId = await readCounter(publicClient, contracts, "nextCycleId");
  const commitmentId = await readCounter(publicClient, contracts, "nextCommitmentId");
  const transactionHashes: `0x${string}`[] = [];

  const write = async (functionName: string, args: readonly unknown[]) => {
    throwIfAborted(signal);
    const hash = await walletClient.writeContract({
      address: contracts.commitmentPoolingModule,
      abi: commitmentPoolingAbi,
      functionName,
      args,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: TRANSACTION_RECEIPT_TIMEOUT_MS,
    });
    throwIfAborted(signal);
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
    requestCommitmentParams(poolId, cycleId, `local-contract-events/terminal-${startBlock}`, 3n),
  ]);
  await write("cancelCommitment", [commitmentId, ""]);
  await write("closeCycle", [cycleId]);
  await write("compostCycle", [cycleId]);
  await write("closePool", [poolId]);
  await write("compostPool", [poolId]);
  await write("reopenPool", [poolId, false]);

  const activePoolId = await readCounter(publicClient, contracts, "nextPoolId");
  const activeCycleId = await readCounter(publicClient, contracts, "nextCycleId");
  const activeCommitmentId = await readCounter(publicClient, contracts, "nextCommitmentId");
  await write("registerPool", [ACTIVE_TEST_GARDEN, 0]);
  await write("setProviderOpenCommitmentCap", [activePoolId, 4n]);
  await write("setPoolCharter", [activePoolId, "ipfs://local-contract-events/active-charter"]);
  await write("markPoolReady", [activePoolId]);
  await write("openPool", [activePoolId]);
  await write("seedCycle", [
    activePoolId,
    1,
    cycleStart,
    cycleEnd,
    "ipfs://local-contract-events/active-cycle",
  ]);
  await write("openCycle", [
    activeCycleId,
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
    requestCommitmentParams(
      activePoolId,
      activeCycleId,
      `local-contract-events/active-${startBlock}`,
      5n
    ),
  ]);
  const creditPaused = (await publicClient.readContract({
    address: contracts.creditRegistry,
    abi: counterAbi,
    functionName: "paused",
  })) as boolean;
  throwIfAborted(signal);
  const creditTransactionHash = await walletClient.writeContract({
    address: contracts.creditRegistry,
    abi: counterAbi,
    functionName: "setPaused",
    args: [creditPaused],
  });
  const creditReceipt = await publicClient.waitForTransactionReceipt({
    hash: creditTransactionHash,
    timeout: TRANSACTION_RECEIPT_TIMEOUT_MS,
  });
  assert.equal(creditReceipt.status, "success", "CreditRegistry setPaused transaction reverted");
  const endBlock = creditReceipt.blockNumber;
  const rawLogs = await publicClient.getLogs({
    address: [contracts.commitmentPoolingModule, contracts.commitmentRegistry],
    fromBlock: startBlock,
    toBlock: endBlock,
  });
  const creditLogs = await publicClient.getLogs({
    address: contracts.creditRegistry,
    fromBlock: creditReceipt.blockNumber,
    toBlock: creditReceipt.blockNumber,
  });
  assert.equal(creditLogs.length, 1, "expected exactly one CreditRegistry PausedSet log");
  assert.ok(
    rawLogs.length >= transactionHashes.length,
    `expected at least one raw contract log per transaction, received ${rawLogs.length} logs for ${transactionHashes.length} transactions`
  );

  return {
    startBlock,
    endBlock,
    poolId,
    cycleId,
    commitmentId,
    activePoolId,
    activeCycleId,
    activeCommitmentId,
    rawLogCount: rawLogs.length,
    transactionHashes,
    creditPaused,
    creditRegistry: contracts.creditRegistry,
    creditTransactionHash,
  };
}

async function readCounter(
  publicClient: ReturnType<typeof createPublicClient>,
  contracts: PoolingContracts,
  functionName: "nextPoolId" | "nextCycleId" | "nextCommitmentId"
): Promise<bigint> {
  return publicClient.readContract({
    address: contracts.commitmentPoolingModule,
    abi: counterAbi,
    functionName,
  });
}

async function pollForIndexedProof(
  proof: LifecycleProof,
  envio: ManagedProcess,
  graphqlUrl: string,
  signal: AbortSignal
): Promise<GraphqlProof> {
  let lastObservation = "Hasura did not return an HTTP response";
  const query = `query LocalContractEvents {
    TerminalPool: CommitmentPool(where: { id: { _eq: "${CHAIN_ID}-${proof.poolId}" } }) {
      registrationSeen garden state providerOpenCommitmentCap liveCommitmentCount
      nonTerminalCycleCount commitmentsRequested commitmentsCancelled
    }
    ActivePool: CommitmentPool(where: { id: { _eq: "${CHAIN_ID}-${proof.activePoolId}" } }) {
      registrationSeen garden state liveCommitmentCount nonTerminalCycleCount
    }
    TerminalCycle: CommitmentCycle(where: { id: { _eq: "${CHAIN_ID}-${proof.cycleId}" } }) {
      seedSeen state liveCommitmentCount commitmentsCancelled
    }
    ActiveCycle: CommitmentCycle(where: { id: { _eq: "${CHAIN_ID}-${proof.activeCycleId}" } }) {
      seedSeen state liveCommitmentCount
    }
    TerminalCommitment: Commitment(where: { id: { _eq: "${CHAIN_ID}-${proof.commitmentId}" } }) {
      creationSeen state direction commitmentType unitLabel targetUnits cancelReasonCID
    }
    ActiveCommitment: Commitment(where: { id: { _eq: "${CHAIN_ID}-${proof.activeCommitmentId}" } }) {
      creationSeen state direction
    }
    # The initial deployment guarantees classId == commitmentId (contract-spec.md section 8.3).
    CommitmentClass(where: { id: { _eq: "${CHAIN_ID}-${proof.commitmentId}" } }) {
      poolId cycleId unitLabel quota
    }
    CommitmentEvent(where: { chainId: { _eq: ${CHAIN_ID} } }) {
      eventType txHash poolId commitmentId
    }
    CreditRegistryConfiguration(
      where: { id: { _eq: "${CHAIN_ID}-${proof.creditRegistry.toLowerCase()}" } }
    ) { registry paused }
    LoanEvent(where: { txHash: { _eq: "${proof.creditTransactionHash}" } }) { eventType txHash }
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
        signal,
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
        body.data.TerminalPool.length === 1 &&
        body.data.ActivePool.length === 1 &&
        body.data.TerminalCycle.length === 1 &&
        body.data.ActiveCycle.length === 1 &&
        body.data.TerminalCommitment.length === 1 &&
        body.data.ActiveCommitment.length === 1 &&
        body.data.CommitmentClass.length === 1 &&
        body.data.CommitmentEvent.length === proof.rawLogCount &&
        body.data.CreditRegistryConfiguration.length === 1 &&
        body.data.LoanEvent.length === 1 &&
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
    INDEXER_POLL_TIMEOUT_MS,
    () =>
      `Envio did not index the mined lifecycle.\nLast GraphQL observation: ${lastObservation}\n${tail(envio.output)}`,
    undefined,
    signal
  );
}

function assertIndexedProof(indexed: GraphqlProof, proof: LifecycleProof): void {
  const pool = indexed.TerminalPool[0];
  const activePool = indexed.ActivePool[0];
  const cycle = indexed.TerminalCycle[0];
  const activeCycle = indexed.ActiveCycle[0];
  const commitment = indexed.TerminalCommitment[0];
  const activeCommitment = indexed.ActiveCommitment[0];
  const class_ = indexed.CommitmentClass[0];
  const creditConfiguration = indexed.CreditRegistryConfiguration[0];
  const creditEvent = indexed.LoanEvent[0];
  assert.ok(
    pool &&
      activePool &&
      cycle &&
      activeCycle &&
      commitment &&
      activeCommitment &&
      class_ &&
      creditConfiguration &&
      creditEvent
  );

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

  assert.deepEqual(activePool, {
    registrationSeen: true,
    garden: ACTIVE_TEST_GARDEN.toLowerCase(),
    state: "OPEN",
    liveCommitmentCount: "1",
    nonTerminalCycleCount: "1",
  });
  assert.deepEqual(activeCycle, {
    seedSeen: true,
    state: "OPEN",
    liveCommitmentCount: "1",
  });
  assert.deepEqual(activeCommitment, {
    creationSeen: true,
    state: "REQUESTED",
    direction: "REQUEST",
  });
  assert.deepEqual(creditConfiguration, {
    registry: proof.creditRegistry.toLowerCase(),
    paused: proof.creditPaused,
  });
  assert.deepEqual(creditEvent, {
    eventType: "PAUSED_SET",
    txHash: proof.creditTransactionHash.toLowerCase(),
  });

  assert.equal(indexed.CommitmentEvent.length, proof.rawLogCount);
  const indexedHashes = new Set(indexed.CommitmentEvent.map((event) => event.txHash.toLowerCase()));
  const expectedHashes = new Set(proof.transactionHashes.map((hash) => hash.toLowerCase()));
  for (const hash of proof.transactionHashes) {
    assert.ok(indexedHashes.has(hash.toLowerCase()), `missing audit row for transaction ${hash}`);
  }
  for (const event of indexed.CommitmentEvent) {
    assert.ok(
      expectedHashes.has(event.txHash.toLowerCase()),
      `unexpected audit tx ${event.txHash}`
    );
  }
  const createdAudit = indexed.CommitmentEvent.find(
    (event) => event.eventType === "CREATED" && event.commitmentId === proof.commitmentId.toString()
  );
  assert.equal(createdAudit?.poolId, proof.poolId.toString(), "CREATED audit has the wrong pool");
  const cancelledAudit = indexed.CommitmentEvent.find(
    (event) =>
      event.eventType === "CANCELLED" && event.commitmentId === proof.commitmentId.toString()
  );
  assert.ok(cancelledAudit, "missing commitment-linked CANCELLED audit");
  assert.equal(
    cancelledAudit.poolId,
    null,
    "CommitmentCancelled carries no poolId and must not infer one"
  );
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

async function collectCleanupError(
  label: string,
  action: () => Promise<unknown>,
  errors: Error[]
): Promise<void> {
  try {
    await action();
  } catch (cause) {
    errors.push(new Error(`Failed to ${label}`, { cause }));
  }
}

async function removeFileIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = globalThis.process.env,
  signal?: AbortSignal
): Promise<void> {
  const process = spawnManaged(command, args, { cwd, env });
  let removeAbortListener = () => {};
  const deadline = new Promise<never>((_resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${command} exceeded its ${timeoutMs}ms timeout`)),
      timeoutMs
    );
    const onAbort = () => reject(abortReason(signal));
    signal?.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };
  });
  let code: number | null;
  try {
    code = await Promise.race([
      new Promise<number | null>((resolve, reject) => {
        process.child.once("error", reject);
        process.child.once("exit", resolve);
      }),
      deadline,
    ]);
  } catch (error) {
    await stopProcess(process.child);
    throw error;
  } finally {
    removeAbortListener();
  }
  if (code !== 0) throw new Error(tail(process.output));
}

async function stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGINT");
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && child.exitCode === null) {
    child.kill("SIGTERM");
    const terminated = await Promise.race([
      new Promise<boolean>((resolve) => child.once("exit", () => resolve(true))),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!terminated && child.exitCode === null) {
      throw new Error(`process ${child.pid ?? "unknown"} did not stop after SIGTERM`);
    }
  }
}

async function waitFor<T>(
  check: () => Promise<T | undefined>,
  timeoutMs: number,
  timeoutMessage: () => string,
  child?: ChildProcessWithoutNullStreams,
  signal?: AbortSignal
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    if (child && child.exitCode !== null) throw new Error(timeoutMessage());
    const value = await check();
    if (value !== undefined) return value;
    await abortableDelay(500, signal);
  }
  throw new Error(timeoutMessage());
}

async function rpcResponds(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(LOCAL_ARBITRUM_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    signal,
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

function abortReason(signal?: AbortSignal): Error {
  return signal?.reason instanceof Error ? signal.reason : new Error("operation aborted");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

async function abortableDelay(timeoutMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(abortReason(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function tail(output: string[]): string {
  return output.join("").split("\n").slice(-80).join("\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
