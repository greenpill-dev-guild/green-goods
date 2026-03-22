#!/usr/bin/env bun

/**
 * Generates the production repair artifact for missing Gardens V2 signal pools.
 *
 * Behavior:
 * - If `GardensModule.createGardenPools()` simulates successfully, emit Safe
 *   Transaction Builder JSON for the module owner Safe plus YieldResolver syncs.
 * - If the live community path is blocked, emit a structured diagnostic report
 *   instead of silently producing an empty batch.
 */

import "varlock/auto-load";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  parseAbiItem,
} from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RANDOM_NON_MEMBER = getAddress(
  "0x000000000000000000000000000000000000dEaD"
) as `0x${string}`;
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT =
  "0x6551655165516551655165516551655165516551655165516551655165516551";

const ACTION_SIGNAL_POOL_METADATA = "Green Goods Action Focus Signaling Pool";

const GARDENS_MODULE_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getGardenCommunity",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getGardenSignalPools",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "createGardenPools",
    stateMutability: "nonpayable",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "pools", type: "address[]" }],
  },
] as const;

const YIELD_RESOLVER_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "gardenHypercertPools",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setGardenHypercertPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "pool", type: "address" },
    ],
    outputs: [],
  },
] as const;

const REGISTRY_COMMUNITY_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "proxyOwner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "councilSafe",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isMember",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "createPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_token", type: "address" },
      {
        name: "_params",
        type: "tuple",
        components: [
          {
            name: "cvParams",
            type: "tuple",
            components: [
              { name: "maxRatio", type: "uint256" },
              { name: "weight", type: "uint256" },
              { name: "decay", type: "uint256" },
              { name: "minThresholdPoints", type: "uint256" },
            ],
          },
          { name: "proposalType", type: "uint8" },
          { name: "pointSystem", type: "uint8" },
          {
            name: "pointConfig",
            type: "tuple",
            components: [{ name: "maxAmount", type: "uint256" }],
          },
          {
            name: "arbitrableConfig",
            type: "tuple",
            components: [
              { name: "arbitrator", type: "address" },
              { name: "tribunalSafe", type: "address" },
              { name: "submitterCollateralAmount", type: "uint256" },
              { name: "challengerCollateralAmount", type: "uint256" },
              { name: "defaultRuling", type: "uint256" },
              { name: "defaultRulingTimeout", type: "uint256" },
            ],
          },
          { name: "registryCommunity", type: "address" },
          { name: "votingPowerRegistry", type: "address" },
          { name: "sybilScorer", type: "address" },
          { name: "sybilScorerThreshold", type: "uint256" },
          { name: "initialAllowlist", type: "address[]" },
          { name: "superfluidToken", type: "address" },
          { name: "streamingRatePerSecond", type: "uint256" },
        ],
      },
      {
        name: "_metadata",
        type: "tuple",
        components: [
          { name: "protocol", type: "uint256" },
          { name: "pointer", type: "string" },
        ],
      },
    ],
    outputs: [
      { name: "poolId", type: "uint256" },
      { name: "strategy", type: "address" },
    ],
  },
] as const;

const OWNABLE_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const TOKENBOUND_REGISTRY_ABI = [
  {
    type: "function",
    name: "account",
    stateMutability: "view",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "accountAddress", type: "address" }],
  },
] as const;

const ERC721_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

const CHAIN_CONFIGS: Record<
  number,
  { label: string; envKey: string; defaultRpcUrl: string }
> = {
  11155111: {
    label: "sepolia",
    envKey: "SEPOLIA_RPC_URL",
    defaultRpcUrl: "https://ethereum-sepolia.publicnode.com",
  },
  42161: {
    label: "arbitrum",
    envKey: "ARBITRUM_RPC_URL",
    defaultRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  42220: {
    label: "celo",
    envKey: "CELO_RPC_URL",
    defaultRpcUrl: "https://forno.celo.org",
  },
};

type Source = "deploymentRoot" | "file" | "currentRootTba" | "currentTba";
type PointSystemMode = "custom" | "unlimited";
type CandidateCallerLabel =
  | "communityOwner"
  | "councilSafe"
  | "moduleOwnerSafe"
  | "garden"
  | "randomNonMember";

type GardenEntry = {
  tokenId: number;
  gardenAddress: `0x${string}`;
  source: Source;
};

type SafeTransaction = {
  to: `0x${string}`;
  value: "0";
  data: `0x${string}`;
  contractMethod: {
    name: string;
    payable: boolean;
    inputs: Array<{
      internalType: string;
      name: string;
      type: string;
      components?: Array<{
        internalType: string;
        name: string;
        type: string;
      }>;
    }>;
  };
  contractInputsValues: Record<string, string | boolean>;
};

type FixPlan = {
  tokenId: number;
  gardenAddress: `0x${string}`;
  source: Source;
  communityAddress: `0x${string}`;
  currentPools: readonly `0x${string}`[];
  currentHypercertPool: `0x${string}`;
  expectedPools: readonly `0x${string}`[];
  transactions: SafeTransaction[];
};

type SimulationStatus = {
  ok: boolean;
  error: string | null;
  result: string | string[] | null;
};

type DirectCreatePoolDiagnostics = Record<
  CandidateCallerLabel,
  Record<PointSystemMode, SimulationStatus>
>;

type CallerMembershipDiagnostics = Record<CandidateCallerLabel, boolean>;

type BlockedGarden = {
  tokenId: number;
  gardenAddress: `0x${string}`;
  source: Source;
  communityAddress: `0x${string}`;
  currentPools: readonly `0x${string}`[];
  currentHypercertPool: `0x${string}`;
  communityProxyOwner: `0x${string}`;
  communityOwner: `0x${string}`;
  proxyOwnerOwner: `0x${string}` | null;
  councilSafe: `0x${string}`;
  callerMembership: CallerMembershipDiagnostics;
  gardensModuleSimulation: SimulationStatus;
  directCreatePool: DirectCreatePoolDiagnostics;
  suspectedRootCause: string[];
  notes: string[];
};

type GardenPlanResult =
  | { kind: "repair"; plan: FixPlan }
  | { kind: "noop"; reason: string }
  | { kind: "blocked"; blocked: BlockedGarden };

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/generate-garden-signal-pool-safe-txs.ts [options]",
      "",
      "Options:",
      "  --chain <id>         Chain ID (default: 42161)",
      "  --garden <address>   Specific garden to inspect",
      "  --all                Inspect every discovered garden",
      "  --rpc-url <url>      Override RPC URL",
      "  --out <path>         Safe batch path when a module-owner repair is possible",
      "  --report-out <path>  Diagnostic report path",
      "  --batch-name <name>  Custom Safe batch name",
      "  --dry-run            Print findings without writing artifacts",
    ].join("\n")
  );
  process.exit(1);
}

function resolveRpcUrl(chainId: number, explicitRpcUrl?: string): string {
  if (explicitRpcUrl) return explicitRpcUrl;
  const config = CHAIN_CONFIGS[chainId];
  if (!config) throw new Error(`Unsupported chain id: ${chainId}`);
  const envValue = process.env[config.envKey]?.trim();
  return envValue || config.defaultRpcUrl;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function isZeroAddress(address: string | null | undefined): boolean {
  return !address || normalizeAddress(address) === normalizeAddress(ZERO_ADDRESS);
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    const anyError = error as Error & {
      shortMessage?: string;
      details?: string;
      cause?: { shortMessage?: string; message?: string };
    };
    return [
      anyError.shortMessage,
      anyError.details,
      anyError.cause?.shortMessage,
      anyError.cause?.message,
      anyError.message,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" | ");
  }

  return String(error);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readContractWithRetry<T>(
  client: ReturnType<typeof createPublicClient>,
  parameters: Parameters<typeof client.readContract>[0],
  attempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return (await client.readContract(parameters)) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(150 * attempt);
      }
    }
  }

  throw lastError;
}

async function loadDeployment(chainId: number) {
  const deploymentPath = path.resolve(
    `packages/contracts/deployments/${chainId}-latest.json`
  );
  const raw = await readFile(deploymentPath, "utf8");
  return JSON.parse(raw) as {
    gardensModule?: string;
    yieldSplitter?: string;
    gardenToken?: string;
    gardenAccountImpl?: string;
    unifiedPowerRegistry?: string;
    rootGarden?: { address: string; tokenId: number };
  };
}

async function loadGardenAddressesFromFile(
  chainId: number
): Promise<Array<{ tokenId: number; address: string; source: Source }>> {
  const gardensPath = path.resolve(
    `packages/contracts/deployments/${chainId}-gardens.json`
  );
  try {
    const raw = await readFile(gardensPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gardens: Array<{ tokenId: number; address: string }>;
    };
    return parsed.gardens.map((entry) => ({
      tokenId: entry.tokenId,
      address: entry.address,
      source: "file",
    }));
  } catch {
    return [];
  }
}

async function loadGardenAddressesFromChain(
  chainId: number,
  client: ReturnType<typeof createPublicClient>,
  deployment: Awaited<ReturnType<typeof loadDeployment>>
): Promise<Array<{ tokenId: number; address: string; source: Source }>> {
  if (!deployment.gardenToken || !deployment.gardenAccountImpl) {
    return [];
  }

  const gardenToken = getAddress(deployment.gardenToken) as `0x${string}`;
  const gardenAccountImpl = getAddress(
    deployment.gardenAccountImpl
  ) as `0x${string}`;
  const zeroAddress = getAddress(ZERO_ADDRESS) as `0x${string}`;

  const logs = await client.getLogs({
    address: gardenToken,
    event: ERC721_TRANSFER_EVENT,
    args: { from: zeroAddress },
    fromBlock: 0n,
    toBlock: "latest",
  });

  const rootTokenId = deployment.rootGarden?.tokenId;

  const entries = await Promise.all(
    logs.map(async (log) => {
      const tokenId = Number(log.args.tokenId ?? 0n);
      if (!Number.isSafeInteger(tokenId) || tokenId <= 0) {
        return null;
      }

      const address = await client.readContract({
        address: getAddress(TOKENBOUND_REGISTRY) as `0x${string}`,
        abi: TOKENBOUND_REGISTRY_ABI,
        functionName: "account",
        args: [
          gardenAccountImpl,
          TOKENBOUND_SALT,
          BigInt(chainId),
          gardenToken,
          BigInt(tokenId),
        ],
      });

      if (!address || isZeroAddress(address)) {
        return null;
      }

      return {
        tokenId,
        address,
        source:
          tokenId === rootTokenId ? ("currentRootTba" as const) : ("currentTba" as const),
      };
    })
  );

  return entries.filter(
    (entry): entry is { tokenId: number; address: string; source: Source } =>
      entry !== null
  );
}

async function discoverGardens(
  chainId: number,
  client: ReturnType<typeof createPublicClient>
): Promise<GardenEntry[]> {
  const deployment = await loadDeployment(chainId);
  const fileEntries = await loadGardenAddressesFromFile(chainId);
  const chainEntries = await loadGardenAddressesFromChain(
    chainId,
    client,
    deployment
  );

  const candidates: Array<{ tokenId: number; address: string; source: Source }> = [];

  if (deployment.rootGarden?.address) {
    candidates.push({
      tokenId: deployment.rootGarden.tokenId,
      address: deployment.rootGarden.address,
      source: "deploymentRoot",
    });
  }

  candidates.push(...fileEntries, ...chainEntries);

  const deduped = new Map<string, GardenEntry>();
  for (const candidate of candidates) {
    if (isZeroAddress(candidate.address)) continue;
    const normalized = normalizeAddress(candidate.address);
    if (deduped.has(normalized)) continue;
    deduped.set(normalized, {
      tokenId: candidate.tokenId,
      gardenAddress: getAddress(candidate.address),
      source: candidate.source,
    });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.tokenId !== b.tokenId) return a.tokenId - b.tokenId;
    return a.source.localeCompare(b.source);
  });
}

function buildCreatePoolsTransaction(
  gardensModuleAddress: `0x${string}`,
  gardenAddress: `0x${string}`
): SafeTransaction {
  return {
    to: gardensModuleAddress,
    value: "0",
    data: encodeFunctionData({
      abi: GARDENS_MODULE_ABI,
      functionName: "createGardenPools",
      args: [gardenAddress],
    }),
    contractMethod: {
      name: "createGardenPools",
      payable: false,
      inputs: [
        {
          internalType: "address",
          name: "garden",
          type: "address",
        },
      ],
    },
    contractInputsValues: {
      garden: gardenAddress,
    },
  };
}

function buildSetHypercertPoolTransaction(
  yieldResolverAddress: `0x${string}`,
  gardenAddress: `0x${string}`,
  poolAddress: `0x${string}`
): SafeTransaction {
  return {
    to: yieldResolverAddress,
    value: "0",
    data: encodeFunctionData({
      abi: YIELD_RESOLVER_ABI,
      functionName: "setGardenHypercertPool",
      args: [gardenAddress, poolAddress],
    }),
    contractMethod: {
      name: "setGardenHypercertPool",
      payable: false,
      inputs: [
        {
          internalType: "address",
          name: "garden",
          type: "address",
        },
        {
          internalType: "address",
          name: "pool",
          type: "address",
        },
      ],
    },
    contractInputsValues: {
      garden: gardenAddress,
      pool: poolAddress,
    },
  };
}

async function validateSafeTransaction(
  client: ReturnType<typeof createPublicClient>,
  safeAddress: `0x${string}`,
  tx: SafeTransaction
): Promise<void> {
  await client.call({
    account: safeAddress,
    to: tx.to,
    data: tx.data,
  });
}

function buildPoolArgs(
  communityAddress: `0x${string}`,
  registryAddress: `0x${string}`,
  pointSystem: PointSystemMode
) {
  return [
    getAddress(ZERO_ADDRESS) as `0x${string}`,
    {
      cvParams: {
        maxRatio: 2_000_000n,
        weight: 10_000n,
        decay: 9_999_799n,
        minThresholdPoints: 2_500_000n,
      },
      proposalType: 0,
      pointSystem: pointSystem === "custom" ? 4 : 2,
      pointConfig: { maxAmount: 0n },
      arbitrableConfig: {
        arbitrator: getAddress(ZERO_ADDRESS) as `0x${string}`,
        tribunalSafe: getAddress(ZERO_ADDRESS) as `0x${string}`,
        submitterCollateralAmount: 0n,
        challengerCollateralAmount: 0n,
        defaultRuling: 0n,
        defaultRulingTimeout: 0n,
      },
      registryCommunity: communityAddress,
      votingPowerRegistry:
        pointSystem === "custom"
          ? registryAddress
          : (getAddress(ZERO_ADDRESS) as `0x${string}`),
      sybilScorer: getAddress(ZERO_ADDRESS) as `0x${string}`,
      sybilScorerThreshold: 0n,
      initialAllowlist: [] as `0x${string}`[],
      superfluidToken: getAddress(ZERO_ADDRESS) as `0x${string}`,
      streamingRatePerSecond: 0n,
    },
    {
      protocol: 1n,
      pointer: ACTION_SIGNAL_POOL_METADATA,
    },
  ] as const;
}

async function simulateDirectCreatePool(
  client: ReturnType<typeof createPublicClient>,
  account: `0x${string}`,
  communityAddress: `0x${string}`,
  registryAddress: `0x${string}`,
  pointSystem: PointSystemMode
): Promise<SimulationStatus> {
  try {
    const result = await client.simulateContract({
      account,
      address: communityAddress,
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "createPool",
      args: buildPoolArgs(communityAddress, registryAddress, pointSystem),
    });

    const [poolId, strategy] = result.result;
    return {
      ok: true,
      error: null,
      result: [poolId.toString(), strategy],
    };
  } catch (error) {
    return {
      ok: false,
      error: stringifyError(error),
      result: null,
    };
  }
}

function inferBlockedRootCause(
  blocked: Omit<BlockedGarden, "suspectedRootCause" | "notes">,
  moduleOwnerSafe: `0x${string}`
): { suspectedRootCause: string[]; notes: string[] } {
  const suspectedRootCause: string[] = [];
  const notes: string[] = [];
  const addCause = (cause: string) => {
    if (!suspectedRootCause.includes(cause)) {
      suspectedRootCause.push(cause);
    }
  };

  if (
    normalizeAddress(blocked.communityOwner) !== normalizeAddress(moduleOwnerSafe)
  ) {
    addCause("wrong caller / ownership split");
    notes.push(
      `RegistryCommunity.owner() resolves to ${blocked.communityOwner}, not the GardensModule/YieldResolver Safe ${moduleOwnerSafe}.`
    );
  }

  if (
    normalizeAddress(blocked.communityProxyOwner) !==
    normalizeAddress(blocked.communityOwner)
  ) {
    addCause("proxy owner / resolved owner split");
    notes.push(
      `RegistryCommunity.proxyOwner() is ${blocked.communityProxyOwner} while owner() resolves to ${blocked.communityOwner}.`
    );
    if (
      blocked.proxyOwnerOwner &&
      normalizeAddress(blocked.proxyOwnerOwner) ===
        normalizeAddress(blocked.communityOwner)
    ) {
      notes.push(
        "The intermediate proxyOwner contract resolves to the same external Safe, confirming a multi-hop owner chain."
      );
    }
  }

  const directErrors = Object.values(blocked.directCreatePool).flatMap((candidate) =>
    Object.values(candidate)
      .map((simulation) => simulation.error)
      .filter((error): error is string => typeof error === "string")
  );

  if (
    directErrors.length > 0 &&
    directErrors.every((error) => error.includes("Ownable: caller is not the owner"))
  ) {
    addCause("wrong factory/community ownership model");
    notes.push(
      "Direct RegistryCommunity.createPool() simulations fail with Ownable ownership checks for every tested caller."
    );
  }

  const randomNonMemberErrors = Object.values(
    blocked.directCreatePool.randomNonMember
  )
    .map((simulation) => simulation.error)
    .filter((error): error is string => typeof error === "string");

  if (
    !blocked.callerMembership.randomNonMember &&
    randomNonMemberErrors.length > 0 &&
    randomNonMemberErrors.every((error) =>
      error.includes("Ownable: caller is not the owner")
    )
  ) {
    addCause("not explained by missing community membership");
    notes.push(
      "A random non-member caller hits the same Ownable revert, so live createPool() fails before community membership can be the gating condition."
    );
  }

  if (
    normalizeAddress(blocked.communityOwner) !==
      normalizeAddress(blocked.communityAddress) &&
    directErrors.length > 0 &&
    directErrors.every((error) => error.includes("Ownable: caller is not the owner"))
  ) {
    addCause("strategy ownership handoff mismatch");
    notes.push(
      "Fork testing plus upstream source comparison indicate the deployed Arbitrum strategy ownership path predates the newer direct-owner check. createPool() appears to fail during strategy ownership handoff before pool creation completes."
    );
  }

  const customErrors = Object.values(blocked.directCreatePool)
    .map((candidate) => candidate.custom.error)
    .filter((error): error is string => typeof error === "string");
  const unlimitedErrors = Object.values(blocked.directCreatePool)
    .map((candidate) => candidate.unlimited.error)
    .filter((error): error is string => typeof error === "string");

  if (
    customErrors.length > 0 &&
    unlimitedErrors.length > 0 &&
    customErrors.every((error) => error.includes("Ownable: caller is not the owner")) &&
    unlimitedErrors.every((error) => error.includes("Ownable: caller is not the owner"))
  ) {
    addCause("not explained by custom pool params");
    notes.push(
      "Both Custom and Unlimited direct createPool() simulations fail before strategy-specific params can explain the revert."
    );
  }

  if (blocked.gardensModuleSimulation.result === "[]") {
    notes.push(
      "GardensModule.createGardenPools() simulated successfully at the protocol owner Safe but returned an empty pool array because the inner community createPool() call path was swallowed by try/catch."
    );
  }

  if (suspectedRootCause.length === 0) {
    addCause("another production-state mismatch");
  }

  return { suspectedRootCause, notes };
}

async function diagnoseBlockedGarden(
  client: ReturnType<typeof createPublicClient>,
  garden: GardenEntry,
  communityAddress: `0x${string}`,
  currentPools: readonly `0x${string}`[],
  currentHypercertPool: `0x${string}`,
  moduleOwnerSafe: `0x${string}`,
  registryAddress: `0x${string}`
): Promise<BlockedGarden> {
  const [communityOwner, communityProxyOwner, councilSafe] = await Promise.all([
    readContractWithRetry<`0x${string}`>(client, {
      address: communityAddress,
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "owner",
    }),
    readContractWithRetry<`0x${string}`>(client, {
      address: communityAddress,
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "proxyOwner",
    }),
    readContractWithRetry<`0x${string}`>(client, {
      address: communityAddress,
      abi: REGISTRY_COMMUNITY_ABI,
      functionName: "councilSafe",
    }),
  ]);

  const gardensModuleSimulation = {
    ok: false,
    error: null,
    result: "[]",
  } as const;

  const callers: Record<CandidateCallerLabel, `0x${string}`> = {
    communityOwner,
    councilSafe,
    moduleOwnerSafe,
    garden: garden.gardenAddress,
    randomNonMember: RANDOM_NON_MEMBER,
  };

  const callerMembershipEntries = await Promise.all(
    (Object.entries(callers) as Array<[CandidateCallerLabel, `0x${string}`]>).map(
      async ([label, account]) => {
        const isMember = await readContractWithRetry<boolean>(client, {
          address: communityAddress,
          abi: REGISTRY_COMMUNITY_ABI,
          functionName: "isMember",
          args: [account],
        });
        return [label, isMember] as const;
      }
    )
  );

  const callerMembership = Object.fromEntries(
    callerMembershipEntries
  ) as CallerMembershipDiagnostics;

  let proxyOwnerOwner: `0x${string}` | null = null;
  if (
    !isZeroAddress(communityProxyOwner) &&
    normalizeAddress(communityProxyOwner) !== normalizeAddress(communityOwner)
  ) {
    try {
      proxyOwnerOwner = await readContractWithRetry<`0x${string}`>(client, {
        address: communityProxyOwner,
        abi: OWNABLE_ABI,
        functionName: "owner",
      });
    } catch {
      proxyOwnerOwner = null;
    }
  }

  const directCreatePoolEntries = await Promise.all(
    (Object.entries(callers) as Array<[CandidateCallerLabel, `0x${string}`]>).map(
      async ([label, account]) => {
        const [custom, unlimited] = await Promise.all([
          simulateDirectCreatePool(
            client,
            account,
            communityAddress,
            registryAddress,
            "custom"
          ),
          simulateDirectCreatePool(
            client,
            account,
            communityAddress,
            registryAddress,
            "unlimited"
          ),
        ]);

        return [label, { custom, unlimited }] as const;
      }
    )
  );

  const directCreatePool = Object.fromEntries(
    directCreatePoolEntries
  ) as DirectCreatePoolDiagnostics;

  const preliminary = {
    tokenId: garden.tokenId,
    gardenAddress: garden.gardenAddress,
    source: garden.source,
    communityAddress,
    currentPools,
    currentHypercertPool,
    communityProxyOwner,
    communityOwner,
    proxyOwnerOwner,
    councilSafe,
    callerMembership,
    gardensModuleSimulation,
    directCreatePool,
  };

  const { suspectedRootCause, notes } = inferBlockedRootCause(
    preliminary,
    moduleOwnerSafe
  );

  return {
    ...preliminary,
    suspectedRootCause,
    notes,
  };
}

async function planFixForGarden(
  client: ReturnType<typeof createPublicClient>,
  moduleOwnerSafe: `0x${string}`,
  gardensModuleAddress: `0x${string}`,
  yieldResolverAddress: `0x${string}`,
  registryAddress: `0x${string}`,
  garden: GardenEntry
): Promise<GardenPlanResult> {
  const communityAddress = await readContractWithRetry<`0x${string}`>(client, {
    address: gardensModuleAddress,
    abi: GARDENS_MODULE_ABI,
    functionName: "getGardenCommunity",
    args: [garden.gardenAddress],
  });

  if (isZeroAddress(communityAddress)) {
    return {
      kind: "noop",
      reason: "No RegistryCommunity exists for this garden.",
    };
  }

  const currentPools = await readContractWithRetry<readonly `0x${string}`[]>(
    client,
    {
      address: gardensModuleAddress,
      abi: GARDENS_MODULE_ABI,
      functionName: "getGardenSignalPools",
      args: [garden.gardenAddress],
    }
  );

  const currentHypercertPool = await readContractWithRetry<`0x${string}`>(client, {
    address: yieldResolverAddress,
    abi: YIELD_RESOLVER_ABI,
    functionName: "gardenHypercertPools",
    args: [garden.gardenAddress],
  });

  let expectedPools = currentPools;
  const transactions: SafeTransaction[] = [];

  if (currentPools.length === 0) {
    const simulation = await client.simulateContract({
      account: moduleOwnerSafe,
      address: gardensModuleAddress,
      abi: GARDENS_MODULE_ABI,
      functionName: "createGardenPools",
      args: [garden.gardenAddress],
    });

    expectedPools = simulation.result;
    if (expectedPools.length < 2 || isZeroAddress(expectedPools[1])) {
      return {
        kind: "blocked",
        blocked: await diagnoseBlockedGarden(
          client,
          garden,
          communityAddress,
          currentPools,
          currentHypercertPool,
          moduleOwnerSafe,
          registryAddress
        ),
      };
    }

    const tx = buildCreatePoolsTransaction(gardensModuleAddress, garden.gardenAddress);
    await validateSafeTransaction(client, moduleOwnerSafe, tx);
    transactions.push(tx);
  } else if (currentPools.length < 2 || isZeroAddress(currentPools[1])) {
    return {
      kind: "blocked",
      blocked: await diagnoseBlockedGarden(
        client,
        garden,
        communityAddress,
        currentPools,
        currentHypercertPool,
        moduleOwnerSafe,
        registryAddress
      ),
    };
  }

  const expectedHypercertPool = expectedPools[1];
  if (normalizeAddress(currentHypercertPool) !== normalizeAddress(expectedHypercertPool)) {
    const tx = buildSetHypercertPoolTransaction(
      yieldResolverAddress,
      garden.gardenAddress,
      expectedHypercertPool
    );
    await validateSafeTransaction(client, moduleOwnerSafe, tx);
    transactions.push(tx);
  }

  if (transactions.length === 0) {
    return {
      kind: "noop",
      reason: "Signal pools and YieldResolver hypercert pool are already aligned.",
    };
  }

  return {
    kind: "repair",
    plan: {
      tokenId: garden.tokenId,
      gardenAddress: garden.gardenAddress,
      source: garden.source,
      communityAddress,
      currentPools,
      currentHypercertPool,
      expectedPools,
      transactions,
    },
  };
}

function defaultSafeBatchPath(chainId: number): string {
  return path.resolve(`reports/garden-signal-pool-safe-batch-${chainId}-${Date.now()}.json`);
}

function defaultReportPath(chainId: number): string {
  return path.resolve(
    `reports/garden-signal-pool-repair-report-${chainId}-${Date.now()}.json`
  );
}

function deriveReportPath(safeBatchPath: string): string {
  if (safeBatchPath.endsWith(".json")) {
    return safeBatchPath.replace(/\.json$/, ".report.json");
  }
  return `${safeBatchPath}.report.json`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      chain: { type: "string", default: "42161" },
      garden: { type: "string" },
      all: { type: "boolean", default: false },
      "rpc-url": { type: "string" },
      out: { type: "string" },
      "report-out": { type: "string" },
      "batch-name": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  const chainId = Number(values.chain);
  if (!Number.isFinite(chainId) || !(chainId in CHAIN_CONFIGS)) {
    usage();
  }

  if (values.all && values.garden) {
    throw new Error("Use either --all or --garden, not both.");
  }

  const rpcUrl = resolveRpcUrl(chainId, values["rpc-url"]);
  const client = createPublicClient({ transport: http(rpcUrl) });
  const deployment = await loadDeployment(chainId);
  const network = CHAIN_CONFIGS[chainId];

  if (!deployment.gardensModule || isZeroAddress(deployment.gardensModule)) {
    throw new Error(`Missing gardensModule in deployment for chain ${chainId}.`);
  }
  if (!deployment.yieldSplitter || isZeroAddress(deployment.yieldSplitter)) {
    throw new Error(`Missing yieldSplitter in deployment for chain ${chainId}.`);
  }
  if (!deployment.unifiedPowerRegistry || isZeroAddress(deployment.unifiedPowerRegistry)) {
    throw new Error(`Missing unifiedPowerRegistry in deployment for chain ${chainId}.`);
  }

  const gardensModuleAddress = getAddress(deployment.gardensModule) as `0x${string}`;
  const yieldResolverAddress = getAddress(deployment.yieldSplitter) as `0x${string}`;
  const registryAddress = getAddress(deployment.unifiedPowerRegistry) as `0x${string}`;

  const [gardensModuleOwner, yieldResolverOwner] = await Promise.all([
    readContractWithRetry<`0x${string}`>(client, {
      address: gardensModuleAddress,
      abi: GARDENS_MODULE_ABI,
      functionName: "owner",
    }),
    readContractWithRetry<`0x${string}`>(client, {
      address: yieldResolverAddress,
      abi: YIELD_RESOLVER_ABI,
      functionName: "owner",
    }),
  ]);

  if (normalizeAddress(gardensModuleOwner) !== normalizeAddress(yieldResolverOwner)) {
    throw new Error(
      `Owner mismatch: GardensModule=${gardensModuleOwner}, YieldResolver=${yieldResolverOwner}`
    );
  }

  const moduleOwnerSafe = getAddress(gardensModuleOwner) as `0x${string}`;
  const discoveredGardens = await discoverGardens(chainId, client);
  if (discoveredGardens.length === 0) {
    throw new Error(`No gardens discovered on ${network.label} (${chainId}).`);
  }

  let selectedGardens: GardenEntry[];
  if (values.all) {
    selectedGardens = discoveredGardens;
  } else if (values.garden) {
    const requested = getAddress(values.garden) as `0x${string}`;
    const match = discoveredGardens.find(
      (entry) => normalizeAddress(entry.gardenAddress) === normalizeAddress(requested)
    );
    selectedGardens = match
      ? [match]
      : [{ tokenId: -1, gardenAddress: requested, source: "file" }];
  } else {
    if (!deployment.rootGarden?.address) {
      throw new Error("Deployment artifact has no rootGarden.address.");
    }
    const rootGarden = getAddress(deployment.rootGarden.address) as `0x${string}`;
    const match = discoveredGardens.find(
      (entry) => normalizeAddress(entry.gardenAddress) === normalizeAddress(rootGarden)
    );
    selectedGardens = [
      match ?? {
        tokenId: deployment.rootGarden.tokenId,
        gardenAddress: rootGarden,
        source: "deploymentRoot",
      },
    ];
  }

  console.log(
    `Auditing ${selectedGardens.length} garden(s) on ${network.label} (${chainId})\n` +
      `  GardensModule / YieldResolver owner Safe: ${moduleOwnerSafe}\n`
  );

  const preparedPlans: FixPlan[] = [];
  const blocked: BlockedGarden[] = [];
  const skipped: Array<{ gardenAddress: string; source: Source; reason: string }> = [];

  for (const garden of selectedGardens) {
    const result = await planFixForGarden(
      client,
      moduleOwnerSafe,
      gardensModuleAddress,
      yieldResolverAddress,
      registryAddress,
      garden
    );

    if (result.kind === "repair") {
      preparedPlans.push(result.plan);
      console.log(
        `Garden #${result.plan.tokenId} ${result.plan.gardenAddress} (${result.plan.source})\n` +
          `  Community:        ${result.plan.communityAddress}\n` +
          `  Current pools:    ${
            result.plan.currentPools.length > 0
              ? result.plan.currentPools.join(", ")
              : "(none)"
          }\n` +
          `  Expected pools:   ${result.plan.expectedPools.join(", ")}\n` +
          `  Hypercert pool:   ${result.plan.currentHypercertPool}\n` +
          `  Planned tx count: ${result.plan.transactions.length}\n`
      );
      continue;
    }

    if (result.kind === "blocked") {
      blocked.push(result.blocked);
      console.log(
        `Garden #${result.blocked.tokenId} ${result.blocked.gardenAddress} (${result.blocked.source})\n` +
          `  Community:        ${result.blocked.communityAddress}\n` +
          `  Proxy owner:      ${result.blocked.communityProxyOwner}\n` +
          `  Community owner:  ${result.blocked.communityOwner}\n` +
          `  Council Safe:     ${result.blocked.councilSafe}\n` +
          `  Module simulation: ${result.blocked.gardensModuleSimulation.result}\n` +
          `  Suspected cause:  ${result.blocked.suspectedRootCause.join("; ")}\n`
      );
      continue;
    }

    skipped.push({
      gardenAddress: garden.gardenAddress,
      source: garden.source,
      reason: result.reason,
    });
  }

  const summary = {
    gardensInspected: selectedGardens.length,
    repairableGardens: preparedPlans.length,
    blockedGardens: blocked.length,
    skippedGardens: skipped.length,
  };

  if (values["dry-run"]) {
    console.log(
      `Dry run complete.\n` +
        `  Repairable: ${summary.repairableGardens}\n` +
        `  Blocked:    ${summary.blockedGardens}\n` +
        `  Skipped:    ${summary.skippedGardens}`
    );

    if (blocked.length > 0) {
      console.log("\nBlocked:");
      for (const entry of blocked) {
        console.log(
          `  ${entry.gardenAddress}: ${entry.suspectedRootCause.join("; ")}`
        );
      }
    }

    if (skipped.length > 0) {
      console.log("\nSkipped:");
      for (const entry of skipped) {
        console.log(`  ${entry.gardenAddress} (${entry.source}): ${entry.reason}`);
      }
    }
    return;
  }

  let safeBatchPath: string | null = null;
  if (preparedPlans.length > 0) {
    const batchName =
      values["batch-name"] ??
      (values.all
        ? `Repair garden signal pools for ${preparedPlans.length} gardens (${network.label})`
        : `Repair garden signal pools (${network.label})`);

    const safeTransactionBuilder = {
      version: "1.0",
      chainId: String(chainId),
      createdAt: Date.now(),
      meta: {
        name: batchName,
        description:
          "Create missing Gardens V2 signal pools and sync YieldResolver.gardenHypercertPools " +
          "for the selected gardens. Generated by scripts/generate-garden-signal-pool-safe-txs.ts",
        txBuilderVersion: "1.17.0",
        createdFromSafeAddress: moduleOwnerSafe,
        createdFromOwnerAddress: "",
        checksum: "",
      },
      transactions: preparedPlans.flatMap((plan) => plan.transactions),
    };

    safeBatchPath = path.resolve(values.out ?? defaultSafeBatchPath(chainId));
    await mkdir(path.dirname(safeBatchPath), { recursive: true });
    await writeFile(safeBatchPath, JSON.stringify(safeTransactionBuilder, null, 2));
  }

  const reportPath = path.resolve(
    values["report-out"] ??
      (safeBatchPath ? deriveReportPath(safeBatchPath) : values.out ?? defaultReportPath(chainId))
  );

  const report = {
    kind: "garden-signal-pool-repair-report",
    chainId,
    network: network.label,
    createdAt: new Date().toISOString(),
    gardensModuleAddress,
    yieldResolverAddress,
    unifiedPowerRegistry: registryAddress,
    moduleOwnerSafe,
    safeBatchPath,
    summary,
    repairable: preparedPlans.map((plan) => ({
      tokenId: plan.tokenId,
      gardenAddress: plan.gardenAddress,
      source: plan.source,
      communityAddress: plan.communityAddress,
      currentPools: plan.currentPools,
      expectedPools: plan.expectedPools,
      currentHypercertPool: plan.currentHypercertPool,
      transactionCount: plan.transactions.length,
    })),
    blocked,
    skipped,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  if (safeBatchPath) {
    console.log("Safe Transaction Builder JSON generated.\n");
    console.log(`  File:         ${safeBatchPath}`);
    console.log(`  Chain:        ${network.label} (${chainId})`);
    console.log(`  Safe:         ${moduleOwnerSafe}`);
    console.log(
      `  Transactions: ${preparedPlans.reduce((sum, plan) => sum + plan.transactions.length, 0)}`
    );
    console.log(
      `\nImport ${safeBatchPath} into the Safe Transaction Builder at:\n` +
        `  https://app.safe.global/apps/open?safe=${network.label}:${moduleOwnerSafe}&appUrl=https://safe-transaction-builder.safe.global`
    );
  } else {
    console.log("No executable Safe batch could be generated for the selected gardens.");
  }

  console.log(`\nDiagnostic report: ${reportPath}`);

  if (blocked.length > 0) {
    console.log("\nBlocked:");
    for (const entry of blocked) {
      console.log(
        `  ${entry.gardenAddress}: ${entry.suspectedRootCause.join("; ")}`
      );
    }
  }

  if (skipped.length > 0) {
    console.log("\nSkipped:");
    for (const entry of skipped) {
      console.log(`  ${entry.gardenAddress} (${entry.source}): ${entry.reason}`);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
