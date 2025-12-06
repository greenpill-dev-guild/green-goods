/**
 * Viem Blockchain Adapter
 *
 * Implements BlockchainPort using viem for blockchain interactions.
 * Uses getDefaultChain from shared package for chain configuration.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type Address,
  type Hex,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { submitWorkBot } from "@green-goods/shared";
import type {
  BlockchainPort,
  GardenInfo,
  SubmitWorkParams,
  SubmitApprovalParams,
  VerificationResult,
} from "../../ports/blockchain";

// Garden contract ABI (minimal interface for verification)
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

// Cache TTL in milliseconds
const CACHE_TTL = 60_000; // 1 minute

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Viem implementation of BlockchainPort
 */
export class ViemBlockchain implements BlockchainPort {
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

  // ============================================================================
  // SUBMISSIONS
  // ============================================================================

  async submitWork(params: SubmitWorkParams): Promise<Hex> {
    const account = privateKeyToAccount(params.privateKey);

    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(),
    });

    // Use shared package submission logic
    // Cast to WalletClient to match expected signature
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

  async submitApproval(_params: SubmitApprovalParams): Promise<Hex> {
    // TODO: Implement approval submission using submitApprovalBot
    // For now, throw not implemented
    throw new Error("Approval submission not yet implemented");
  }

  // ============================================================================
  // VERIFICATION
  // ============================================================================

  async isOperator(gardenAddress: string, userAddress: string): Promise<VerificationResult> {
    const cacheKey = `${gardenAddress}:${userAddress}:operator`;

    // Check cache
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

      // Get the operator role bytes32 and check if user has it
      const operatorRole = await contract.read.OPERATOR_ROLE();
      const hasRole = await contract.read.hasRole([operatorRole, userAddress as Address]);

      // Cache result
      this.operatorCache.set(cacheKey, {
        data: hasRole,
        timestamp: Date.now(),
      });

      return {
        verified: hasRole,
        reason: hasRole ? undefined : "Address is not an operator for this garden",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("could not be found") || message.includes("not a contract")) {
        return {
          verified: false,
          reason: "Garden contract not found at this address",
        };
      }

      console.error(`Operator verification failed for ${gardenAddress}:`, message);
      return {
        verified: false,
        reason: `Verification failed: ${message}`,
      };
    }
  }

  async isGardener(gardenAddress: string, userAddress: string): Promise<VerificationResult> {
    const cacheKey = `${gardenAddress}:${userAddress}:gardener`;

    // Check cache
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

      // Get the gardener role bytes32 and check if user has it
      const gardenerRole = await contract.read.GARDENER_ROLE();
      const hasRole = await contract.read.hasRole([gardenerRole, userAddress as Address]);

      // Cache result
      this.gardenerCache.set(cacheKey, {
        data: hasRole,
        timestamp: Date.now(),
      });

      return {
        verified: hasRole,
        reason: hasRole ? undefined : "Address is not a gardener in this garden",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Gardener verification failed for ${gardenAddress}:`, message);
      return {
        verified: false,
        reason: `Verification failed: ${message}`,
      };
    }
  }

  async getGardenInfo(gardenAddress: string): Promise<GardenInfo | undefined> {
    // Check cache
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

      const info: GardenInfo = {
        exists: true,
        name,
        address: gardenAddress,
      };

      // Cache result
      this.gardenCache.set(gardenAddress, {
        data: info,
        timestamp: Date.now(),
      });

      return info;
    } catch {
      const info: GardenInfo = {
        exists: false,
        address: gardenAddress,
      };

      // Cache negative result
      this.gardenCache.set(gardenAddress, {
        data: info,
        timestamp: Date.now(),
      });

      return info;
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  getChainId(): number {
    return this.chainId;
  }

  clearCache(): void {
    this.operatorCache.clear();
    this.gardenerCache.clear();
    this.gardenCache.clear();
  }
}
