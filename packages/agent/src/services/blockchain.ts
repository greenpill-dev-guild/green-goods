/**
 * Blockchain Service (Viem)
 *
 * Direct blockchain operations. No interface abstraction.
 */

import { submitApprovalBot, submitWorkBot } from "@green-goods/shared";

/**
 * Minimal GardenAccount ABI for agent verification functions.
 *
 * This subset matches the actual GardenAccount.sol contract interface
 * (implements IGardenAccessControl). We define it locally to avoid
 * importing browser-dependent shared package utilities.
 *
 * Functions included:
 * - isGardener(address) -> bool: Check if address is a gardener
 * - isOperator(address) -> bool: Check if address is an operator
 * - name() -> string: Get garden name
 */
const GardenAccountABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isGardener",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isOperator",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  getContract,
  type Hex,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  GardenInfo,
  SubmitApprovalParams,
  SubmitWorkParams,
  VerificationResult,
} from "../types";
import { loggers } from "./logger";

const log = loggers.blockchain;

const CACHE_TTL = 60_000; // 1 minute

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// BLOCKCHAIN CLASS
// ============================================================================

class Blockchain {
  private chain: Chain;
  private chainId: number;
  private publicClient: ReturnType<typeof createPublicClient>;
  private operatorCache: Map<string, CacheEntry<boolean>> = new Map();
  private gardenerCache: Map<string, CacheEntry<boolean>> = new Map();
  private gardenCache: Map<string, CacheEntry<GardenInfo>> = new Map();

  constructor(chain: Chain, rpcUrl?: string) {
    this.chain = chain;
    this.chainId = chain.id;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  // ==========================================================================
  // SUBMISSIONS
  // ==========================================================================

  async submitWork(params: SubmitWorkParams): Promise<Hex> {
    const account = privateKeyToAccount(params.privateKey);

    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(),
    });

    const tx = await submitWorkBot(
      walletClient as Parameters<typeof submitWorkBot>[0],
      this.publicClient as Parameters<typeof submitWorkBot>[1],
      {
        actionUID: params.actionUID,
        title: params.workData.title,
        plantSelection: params.workData.plantSelection,
        plantCount: params.workData.plantCount,
        feedback: params.workData.feedback,
        media: [],
      },
      params.gardenAddress,
      params.actionUID,
      params.actionTitle,
      this.chainId,
      params.media || []
    );

    return tx;
  }

  async submitApproval(params: SubmitApprovalParams): Promise<Hex> {
    const account = privateKeyToAccount(params.privateKey);

    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(),
    });

    const tx = await submitApprovalBot(
      walletClient as Parameters<typeof submitApprovalBot>[0],
      {
        actionUID: params.actionUID,
        workUID: params.workUID,
        approved: params.approved,
        feedback: params.feedback,
      },
      params.gardenerAddress,
      this.chainId
    );

    return tx;
  }

  // ==========================================================================
  // VERIFICATION
  // ==========================================================================

  async isOperator(gardenAddress: string, userAddress: string): Promise<VerificationResult> {
    const cacheKey = `${gardenAddress}:${userAddress}:operator`;

    const cached = this.operatorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        verified: cached.data,
        cachedAt: cached.timestamp,
        reason: cached.data ? undefined : "Address is not an operator for this garden",
      };
    }

    try {
      const contract = getContract({
        address: gardenAddress as Address,
        abi: GardenAccountABI,
        client: this.publicClient,
      });

      const isOp = await contract.read.isOperator([userAddress as Address]);

      this.operatorCache.set(cacheKey, { data: isOp as boolean, timestamp: Date.now() });

      return {
        verified: isOp as boolean,
        reason: isOp ? undefined : "Address is not an operator for this garden",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes("could not be found") || message.includes("not a contract")) {
        return { verified: false, reason: "Garden contract not found at this address" };
      }
      log.error({ gardenAddress, error: message }, "Operator verification failed");
      return { verified: false, reason: `Verification failed: ${message}` };
    }
  }

  async isGardener(gardenAddress: string, userAddress: string): Promise<VerificationResult> {
    const cacheKey = `${gardenAddress}:${userAddress}:gardener`;

    const cached = this.gardenerCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        verified: cached.data,
        cachedAt: cached.timestamp,
        reason: cached.data ? undefined : "Address is not a gardener in this garden",
      };
    }

    try {
      const contract = getContract({
        address: gardenAddress as Address,
        abi: GardenAccountABI,
        client: this.publicClient,
      });

      const isGard = await contract.read.isGardener([userAddress as Address]);

      this.gardenerCache.set(cacheKey, { data: isGard as boolean, timestamp: Date.now() });

      return {
        verified: isGard as boolean,
        reason: isGard ? undefined : "Address is not a gardener in this garden",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error({ gardenAddress, error: message }, "Gardener verification failed");
      return { verified: false, reason: `Verification failed: ${message}` };
    }
  }

  async getGardenInfo(gardenAddress: string): Promise<GardenInfo | undefined> {
    const cached = this.gardenCache.get(gardenAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const contract = getContract({
        address: gardenAddress as Address,
        abi: GardenAccountABI,
        client: this.publicClient,
      });

      const name = await contract.read.name();
      const info: GardenInfo = { exists: true, name: name as string, address: gardenAddress };

      this.gardenCache.set(gardenAddress, { data: info, timestamp: Date.now() });
      return info;
    } catch {
      const info: GardenInfo = { exists: false, address: gardenAddress };
      this.gardenCache.set(gardenAddress, { data: info, timestamp: Date.now() });
      return info;
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  getChainId(): number {
    return this.chainId;
  }

  clearCache(): void {
    this.operatorCache.clear();
    this.gardenerCache.clear();
    this.gardenCache.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let _blockchain: Blockchain | null = null;

export function initBlockchain(chain: Chain, rpcUrl?: string): Blockchain {
  if (!_blockchain) {
    _blockchain = new Blockchain(chain, rpcUrl);
  }
  return _blockchain;
}

export function getBlockchain(): Blockchain {
  if (!_blockchain) {
    throw new Error("Blockchain not initialized. Call initBlockchain() first.");
  }
  return _blockchain;
}

// Re-export convenience functions
export const submitWork = (params: SubmitWorkParams) => getBlockchain().submitWork(params);
export const submitApproval = (params: SubmitApprovalParams) =>
  getBlockchain().submitApproval(params);
export const isOperator = (gardenAddress: string, userAddress: string) =>
  getBlockchain().isOperator(gardenAddress, userAddress);
export const isGardener = (gardenAddress: string, userAddress: string) =>
  getBlockchain().isGardener(gardenAddress, userAddress);
export const getGardenInfo = (gardenAddress: string) =>
  getBlockchain().getGardenInfo(gardenAddress);
export const getChainId = () => getBlockchain().getChainId();
export const clearBlockchainCache = () => _blockchain?.clearCache();
