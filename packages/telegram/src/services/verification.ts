/**
 * On-Chain Verification Service
 *
 * Provides verification of operator permissions and garden membership
 * by querying the blockchain.
 *
 * Features:
 * - Operator role verification
 * - Garden existence check
 * - Gardener membership verification
 * - Caching to reduce RPC calls
 */

import { createPublicClient, http, type Address, getContract } from "viem";
import { baseSepolia } from "viem/chains";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Cache TTL in milliseconds
const CACHE_TTL = 60_000; // 1 minute

// Get chain from environment or default to baseSepolia
const DEFAULT_CHAIN = baseSepolia;

// Garden contract ABI (minimal interface for verification)
const GARDEN_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
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

// ============================================================================
// TYPES
// ============================================================================

export interface VerificationResult {
  verified: boolean;
  reason?: string;
  cachedAt?: number;
}

export interface GardenInfo {
  exists: boolean;
  name?: string;
  address: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// VERIFICATION SERVICE
// ============================================================================

/**
 * Service for verifying on-chain permissions and roles.
 *
 * @example
 * const verifier = new VerificationService();
 *
 * // Check if user is an operator
 * const result = await verifier.isOperator(gardenAddress, userAddress);
 * if (!result.verified) {
 *   return ctx.reply("You are not an operator for this garden.");
 * }
 */
export class VerificationService {
  private client: ReturnType<typeof createPublicClient>;
  private operatorCache: Map<string, CacheEntry<boolean>> = new Map();
  private gardenerCache: Map<string, CacheEntry<boolean>> = new Map();
  private gardenCache: Map<string, CacheEntry<GardenInfo>> = new Map();

  constructor(rpcUrl?: string) {
    this.client = createPublicClient({
      chain: DEFAULT_CHAIN,
      transport: http(rpcUrl || process.env.RPC_URL),
    });
  }

  /**
   * Verifies if an address is an operator for a garden.
   *
   * @param gardenAddress - The garden contract address
   * @param operatorAddress - The address to check
   * @param skipCache - Force fresh check, ignoring cache
   */
  async isOperator(
    gardenAddress: string,
    operatorAddress: string,
    skipCache = false
  ): Promise<VerificationResult> {
    const cacheKey = `${gardenAddress}:${operatorAddress}:operator`;

    // Check cache first
    if (!skipCache) {
      const cached = this.operatorCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          verified: cached.data,
          cachedAt: cached.timestamp,
          reason: cached.data ? undefined : "Address is not an operator for this garden",
        };
      }
    }

    try {
      const contract = getContract({
        address: gardenAddress as Address,
        abi: GARDEN_ABI,
        client: this.client,
      });

      // Check if the address has the operator role
      const hasRole = await contract.read.hasRole([operatorAddress as Address]);

      // Cache the result
      this.operatorCache.set(cacheKey, {
        data: hasRole,
        timestamp: Date.now(),
      });

      return {
        verified: hasRole,
        reason: hasRole ? undefined : "Address is not an operator for this garden",
      };
    } catch (error) {
      // If the contract call fails, the garden might not exist or have a different interface
      const message = error instanceof Error ? error.message : "Unknown error";

      // Check if it's a "contract not found" type error
      if (message.includes("could not be found") || message.includes("not a contract")) {
        return {
          verified: false,
          reason: "Garden contract not found at this address",
        };
      }

      // For other errors, log and return unverified
      console.error(`Operator verification failed for ${gardenAddress}:`, message);
      return {
        verified: false,
        reason: `Verification failed: ${message}`,
      };
    }
  }

  /**
   * Verifies if an address is a gardener for a garden.
   *
   * @param gardenAddress - The garden contract address
   * @param gardenerAddress - The address to check
   * @param skipCache - Force fresh check, ignoring cache
   */
  async isGardener(
    gardenAddress: string,
    gardenerAddress: string,
    skipCache = false
  ): Promise<VerificationResult> {
    const cacheKey = `${gardenAddress}:${gardenerAddress}:gardener`;

    // Check cache first
    if (!skipCache) {
      const cached = this.gardenerCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          verified: cached.data,
          cachedAt: cached.timestamp,
          reason: cached.data ? undefined : "Address is not a gardener in this garden",
        };
      }
    }

    try {
      const contract = getContract({
        address: gardenAddress as Address,
        abi: GARDEN_ABI,
        client: this.client,
      });

      // Check if the address has the gardener role
      const hasRole = await contract.read.hasRole([gardenerAddress as Address]);

      // Cache the result
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

  /**
   * Checks if a garden exists and retrieves basic info.
   *
   * @param gardenAddress - The garden contract address
   * @param skipCache - Force fresh check, ignoring cache
   */
  async getGardenInfo(gardenAddress: string, skipCache = false): Promise<GardenInfo> {
    // Check cache first
    if (!skipCache) {
      const cached = this.gardenCache.get(gardenAddress);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const contract = getContract({
        address: gardenAddress as Address,
        abi: GARDEN_ABI,
        client: this.client,
      });

      // Try to get the garden name - if this works, the contract exists
      const name = await contract.read.name();

      const info: GardenInfo = {
        exists: true,
        name,
        address: gardenAddress,
      };

      // Cache the result
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

      // Cache negative result for shorter time
      this.gardenCache.set(gardenAddress, {
        data: info,
        timestamp: Date.now(),
      });

      return info;
    }
  }

  /**
   * Verifies a user can perform an action on a garden.
   * Combines garden existence check with role verification.
   *
   * @param gardenAddress - The garden contract address
   * @param userAddress - The user's wallet address
   * @param requiredRole - The role required ('operator' or 'gardener')
   */
  async canPerformAction(
    gardenAddress: string,
    userAddress: string,
    requiredRole: "operator" | "gardener"
  ): Promise<VerificationResult> {
    // First check if garden exists
    const gardenInfo = await this.getGardenInfo(gardenAddress);
    if (!gardenInfo.exists) {
      return {
        verified: false,
        reason: "Garden not found. Please verify the garden address.",
      };
    }

    // Then check role
    if (requiredRole === "operator") {
      return this.isOperator(gardenAddress, userAddress);
    } else {
      return this.isGardener(gardenAddress, userAddress);
    }
  }

  /**
   * Clears all caches. Useful after role changes.
   */
  clearCache(): void {
    this.operatorCache.clear();
    this.gardenerCache.clear();
    this.gardenCache.clear();
  }

  /**
   * Clears cache for a specific garden.
   */
  clearGardenCache(gardenAddress: string): void {
    this.gardenCache.delete(gardenAddress);

    // Clear all role entries for this garden
    for (const key of this.operatorCache.keys()) {
      if (key.startsWith(gardenAddress)) {
        this.operatorCache.delete(key);
      }
    }
    for (const key of this.gardenerCache.keys()) {
      if (key.startsWith(gardenAddress)) {
        this.gardenerCache.delete(key);
      }
    }
  }

  /**
   * Gets cache statistics for monitoring.
   */
  getCacheStats(): {
    operators: number;
    gardeners: number;
    gardens: number;
  } {
    return {
      operators: this.operatorCache.size,
      gardeners: this.gardenerCache.size,
      gardens: this.gardenCache.size,
    };
  }
}

/** Singleton verification service instance */
export const verificationService = new VerificationService();
