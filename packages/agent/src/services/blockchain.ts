/**
 * Blockchain Service (Viem)
 *
 * Direct blockchain operations. No interface abstraction.
 */

import { submitApprovalBot, submitWorkBot } from "@green-goods/shared";
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

// ============================================================================
// CONTRACT ABI
// ============================================================================

const GARDEN_ABI = [
  {
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    name: "hasRole",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "OPERATOR_ROLE",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "GARDENER_ROLE",
    outputs: [{ name: "", type: "bytes32" }],
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
        abi: GARDEN_ABI,
        client: this.publicClient,
      });

      const operatorRole = await contract.read.OPERATOR_ROLE();
      const hasRole = await contract.read.hasRole([operatorRole, userAddress as Address]);

      this.operatorCache.set(cacheKey, { data: hasRole, timestamp: Date.now() });

      return {
        verified: hasRole,
        reason: hasRole ? undefined : "Address is not an operator for this garden",
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
        abi: GARDEN_ABI,
        client: this.publicClient,
      });

      const gardenerRole = await contract.read.GARDENER_ROLE();
      const hasRole = await contract.read.hasRole([gardenerRole, userAddress as Address]);

      this.gardenerCache.set(cacheKey, { data: hasRole, timestamp: Date.now() });

      return {
        verified: hasRole,
        reason: hasRole ? undefined : "Address is not a gardener in this garden",
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
        abi: GARDEN_ABI,
        client: this.publicClient,
      });

      const name = await contract.read.name();
      const info: GardenInfo = { exists: true, name, address: gardenAddress };

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
