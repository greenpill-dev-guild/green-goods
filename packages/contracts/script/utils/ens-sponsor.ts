import { execFileSync } from "node:child_process";
import {
  type Address,
  createPublicClient,
  formatEther,
  http,
  isAddress,
  parseEther,
  parseGwei,
  zeroAddress,
} from "viem";
import { DeploymentAddresses } from "./deployment-addresses";
import { NetworkManager } from "./network";

export const DEFAULT_ENS_SPONSOR_SAMPLE_SLUG = "green-goods-user";
export const DEFAULT_ENS_SPONSOR_SAMPLE_OWNER = "0x0000000000000000000000000000000000000001" as const;
export const DEFAULT_ENS_SPONSOR_MIN_CLAIMS = 25;
export const DEFAULT_ENS_SPONSOR_TOP_UP = "0.05ether";
export const DEFAULT_FOUNDRY_KEYSTORE = "green-goods-deployer";

const ENS_SPONSOR_RPC_FALLBACKS: Record<string, string[]> = {
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
  mainnet: ["https://ethereum-rpc.publicnode.com"],
  sepolia: ["https://ethereum-sepolia.publicnode.com"],
};

const GREEN_GOODS_ENS_SPONSOR_ABI = [
  {
    type: "function",
    name: "getRegistrationFee",
    stateMutability: "view",
    inputs: [
      { name: "slug", type: "string" },
      { name: "owner", type: "address" },
      { name: "nameType", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReleaseFee",
    stateMutability: "view",
    inputs: [{ name: "slug", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalPendingRefunds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "l1Receiver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export interface ENSSponsorStatusOptions {
  network: string;
  minSponsoredClaims?: number;
  sampleSlug?: string;
  sampleOwner?: Address;
}

export interface ENSSponsorStatus {
  network: string;
  chainId: number;
  rpcHost: string;
  rpcFallbackUsed: boolean;
  ensAddress: Address;
  l1Receiver: Address;
  balance: bigint;
  registrationFee: bigint;
  releaseFee: bigint;
  sponsorFee: bigint;
  totalPendingRefunds: bigint;
  minSponsoredClaims: number;
  targetReserve: bigint;
  spendableBalance: bigint;
  claimsCovered: bigint;
  hasReceiver: boolean;
  healthy: boolean;
}

export interface ENSSponsorTopUpOptions {
  network: string;
  amount?: string;
  account?: string;
}

export function isGreenGoodsENSConfigured(address: unknown): address is Address {
  return typeof address === "string" && isAddress(address) && address.toLowerCase() !== zeroAddress;
}

export function parseFundingAmount(value: string): bigint {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Funding amount cannot be empty");
  }

  if (normalized.endsWith("gwei")) {
    return parseGwei(normalized.slice(0, -"gwei".length).trim());
  }

  if (normalized.endsWith("wei")) {
    const wei = normalized.slice(0, -"wei".length).trim();
    if (!/^\d+$/.test(wei)) {
      throw new Error(`Invalid wei amount: ${value}`);
    }
    return BigInt(wei);
  }

  if (normalized.endsWith("ether")) {
    return parseEther(normalized.slice(0, -"ether".length).trim());
  }

  if (normalized.endsWith("eth")) {
    return parseEther(normalized.slice(0, -"eth".length).trim());
  }

  return parseEther(normalized);
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function getDeploymentForNetwork(network: string) {
  const deploymentAddresses = new DeploymentAddresses();
  const networkManager = new NetworkManager();
  const addresses = deploymentAddresses.loadForChain(network);
  const ensAddress = addresses.greenGoodsENS;

  if (!isGreenGoodsENSConfigured(ensAddress)) {
    throw new Error(`GreenGoodsENS is not configured in deployments for ${network}`);
  }

  return {
    ensAddress,
    networkManager,
    rpcUrl: networkManager.getRpcUrl(network),
    chainId: networkManager.getChainId(network),
  };
}

function getSponsorRpcCandidates(network: string, configuredRpcUrl: string): string[] {
  const fallbacks = ENS_SPONSOR_RPC_FALLBACKS[network] ?? [];
  return [configuredRpcUrl, ...fallbacks].filter((rpcUrl, index, list) => list.indexOf(rpcUrl) === index);
}

async function readENSSponsorStatus(
  options: ENSSponsorStatusOptions,
  ensAddress: Address,
  rpcUrl: string,
  chainId: number,
  rpcFallbackUsed: boolean,
): Promise<ENSSponsorStatus> {
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const sampleSlug = options.sampleSlug ?? DEFAULT_ENS_SPONSOR_SAMPLE_SLUG;
  const sampleOwner = options.sampleOwner ?? DEFAULT_ENS_SPONSOR_SAMPLE_OWNER;
  const minSponsoredClaims = options.minSponsoredClaims ?? DEFAULT_ENS_SPONSOR_MIN_CLAIMS;

  const reads = await Promise.allSettled([
    publicClient.getBalance({ address: ensAddress }),
    publicClient.readContract({
      address: ensAddress,
      abi: GREEN_GOODS_ENS_SPONSOR_ABI,
      functionName: "getRegistrationFee",
      args: [sampleSlug, sampleOwner, 0],
    }),
    publicClient.readContract({
      address: ensAddress,
      abi: GREEN_GOODS_ENS_SPONSOR_ABI,
      functionName: "getReleaseFee",
      args: [sampleSlug],
    }),
    publicClient.readContract({
      address: ensAddress,
      abi: GREEN_GOODS_ENS_SPONSOR_ABI,
      functionName: "totalPendingRefunds",
    }),
    publicClient.readContract({
      address: ensAddress,
      abi: GREEN_GOODS_ENS_SPONSOR_ABI,
      functionName: "l1Receiver",
    }),
  ]);

  const failedRead = reads.find((read) => read.status === "rejected");
  if (failedRead?.status === "rejected") {
    throw failedRead.reason;
  }

  const [balance, registrationFee, releaseFee, totalPendingRefunds, l1Receiver] = reads.map((read) => read.value) as [
    bigint,
    bigint,
    bigint,
    bigint,
    Address,
  ];

  const sponsorFee = maxBigInt(registrationFee, releaseFee);
  const targetReserve = totalPendingRefunds + sponsorFee * BigInt(minSponsoredClaims);
  const spendableBalance = balance > totalPendingRefunds ? balance - totalPendingRefunds : 0n;
  const claimsCovered = sponsorFee > 0n ? spendableBalance / sponsorFee : 0n;
  const hasReceiver = l1Receiver.toLowerCase() !== zeroAddress;

  return {
    network: options.network,
    chainId,
    rpcHost: new URL(rpcUrl).host,
    rpcFallbackUsed,
    ensAddress,
    l1Receiver,
    balance,
    registrationFee,
    releaseFee,
    sponsorFee,
    totalPendingRefunds,
    minSponsoredClaims,
    targetReserve,
    spendableBalance,
    claimsCovered,
    hasReceiver,
    healthy: hasReceiver && balance >= targetReserve,
  };
}

export async function getENSSponsorStatus(options: ENSSponsorStatusOptions): Promise<ENSSponsorStatus> {
  const { ensAddress, rpcUrl, chainId } = getDeploymentForNetwork(options.network);
  const rpcCandidates = getSponsorRpcCandidates(options.network, rpcUrl);
  let lastError: unknown;
  const failures: string[] = [];

  for (const candidateRpcUrl of rpcCandidates) {
    try {
      return await readENSSponsorStatus(options, ensAddress, candidateRpcUrl, chainId, candidateRpcUrl !== rpcUrl);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${new URL(candidateRpcUrl).host}: ${message}`);
      const isLastCandidate = candidateRpcUrl === rpcCandidates[rpcCandidates.length - 1];
      if (isLastCandidate) {
        throw new Error(`ENS sponsor status failed for all RPC providers. ${failures.join(" | ")}`);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function formatENSSponsorStatus(status: ENSSponsorStatus, indent = ""): string {
  const state = status.healthy ? "healthy" : "needs attention";
  const lines = [
    `${indent}ENS Sponsor: ${state}`,
    `${indent}  Network: ${status.network} (${status.chainId})`,
    `${indent}  RPC: ${status.rpcHost}${status.rpcFallbackUsed ? " (fallback)" : ""}`,
    `${indent}  GreenGoodsENS: ${status.ensAddress}`,
    `${indent}  L1 Receiver: ${status.hasReceiver ? status.l1Receiver : "not configured"}`,
    `${indent}  Balance: ${formatEther(status.balance)} ETH`,
    `${indent}  Pending refunds reserve: ${formatEther(status.totalPendingRefunds)} ETH`,
    `${indent}  Registration CCIP fee estimate: ${formatEther(status.registrationFee)} ETH`,
    `${indent}  Release CCIP fee estimate: ${formatEther(status.releaseFee)} ETH`,
    `${indent}  Sponsored actions covered: ${status.claimsCovered.toString()} / ${status.minSponsoredClaims}`,
    `${indent}  Target reserve: ${formatEther(status.targetReserve)} ETH`,
  ];

  return lines.join("\n");
}

export function sendENSSponsorTopUp(options: ENSSponsorTopUpOptions): void {
  const { ensAddress, rpcUrl, chainId } = getDeploymentForNetwork(options.network);
  const amount = options.amount ?? process.env.ENS_SPONSOR_TOP_UP_AMOUNT ?? DEFAULT_ENS_SPONSOR_TOP_UP;
  const amountWei = parseFundingAmount(amount);
  const account = options.account ?? process.env.FOUNDRY_KEYSTORE_ACCOUNT ?? DEFAULT_FOUNDRY_KEYSTORE;

  console.log(`Funding GreenGoodsENS sponsor balance on ${options.network}`);
  console.log(`  GreenGoodsENS: ${ensAddress}`);
  console.log(`  Amount: ${formatEther(amountWei)} ETH`);
  console.log(`  Foundry keystore: ${account}`);
  console.log("  Password will be prompted by Foundry if needed.\n");

  execFileSync(
    "cast",
    [
      "send",
      ensAddress,
      "--value",
      amountWei.toString(),
      "--rpc-url",
      rpcUrl,
      "--chain-id",
      chainId.toString(),
      "--account",
      account,
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
}
