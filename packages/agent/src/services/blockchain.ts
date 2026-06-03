/**
 * Blockchain Service (Viem)
 *
 * Direct blockchain operations. No interface abstraction.
 */

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
  decodeEventLog,
  getContract,
  type Hex,
  http,
  parseAbiItem,
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

export interface TransactionConfirmation {
  status: "confirmed" | "failed" | "pending";
  txHash: Hex;
  blockNumber?: string;
  confirmedAt?: string;
}

export interface FundingTupleExpectation {
  /** Lowercased token contract address. */
  token: string;
  /** Lowercased destination (Cookie Jar or Vault) address. */
  destinationAddress: string;
  /** Minimum asset amount that must be transferred to the destination, as a base-units decimal string. */
  minAssetAmount?: string;
  /** Chain id the funding must land on. */
  chainId: number;
}

export interface FundingConfirmationResult {
  status: "confirmed" | "failed" | "pending" | "tuple_mismatch";
  txHash: Hex;
  blockNumber?: string;
  confirmedAt?: string;
  /** Sum of matched ERC-20 Transfer values to `destinationAddress`, as a base-units decimal string. */
  matchedAssetAmount?: string;
  /** Failure detail when status is `tuple_mismatch`. */
  mismatchReason?:
    | "chain_mismatch"
    | "no_matching_transfer"
    | "amount_below_min"
    | "destination_mismatch"
    | "token_mismatch";
}

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// ============================================================================
// BLOCKCHAIN CLASS
// ============================================================================

class Blockchain {
  private chain: Chain;
  private chainId: number;
  private rpcUrl: string | undefined;
  private publicClient: ReturnType<typeof createPublicClient>;
  private operatorCache: Map<string, CacheEntry<boolean>> = new Map();
  private gardenerCache: Map<string, CacheEntry<boolean>> = new Map();
  private gardenCache: Map<string, CacheEntry<GardenInfo>> = new Map();

  constructor(chain: Chain, rpcUrl?: string) {
    this.chain = chain;
    this.chainId = chain.id;
    this.rpcUrl = rpcUrl;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  // ==========================================================================
  // SUBMISSIONS
  // ==========================================================================

  async submitWork(params: SubmitWorkParams): Promise<Hex> {
    const { submitWorkBot } = await import("@green-goods/shared/modules/work/bot-submission");
    const account = privateKeyToAccount(params.privateKey);

    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });

    const tx = await submitWorkBot(
      walletClient as Parameters<typeof submitWorkBot>[0],
      this.publicClient as Parameters<typeof submitWorkBot>[1],
      {
        actionUID: params.actionUID,
        title: params.workData.title,
        timeSpentMinutes: params.workData.timeSpentMinutes ?? 0,
        feedback: params.workData.feedback,
        media: [],
        details: {
          plantSelection: params.workData.plantSelection,
          plantCount: params.workData.plantCount,
        },
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
    const { submitApprovalBot } = await import("@green-goods/shared/modules/work/bot-submission");
    const account = privateKeyToAccount(params.privateKey);

    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });

    const tx = await submitApprovalBot(
      walletClient as Parameters<typeof submitApprovalBot>[0],
      {
        actionUID: params.actionUID,
        workUID: params.workUID,
        approved: params.approved,
        feedback: params.feedback,
        // Bot approvals: LOW confidence via automated review
        confidence: params.approved ? 1 : 0, // LOW for approvals, NONE for rejections
        verificationMethod: 1, // Bitmask: 0x01 = bot-verified
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

  async getTransactionConfirmation(txHash: Hex): Promise<TransactionConfirmation> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
      return {
        status: receipt.status === "success" ? "confirmed" : "failed",
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        confirmedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|not be found|could not find/i.test(message)) {
        return { status: "pending", txHash };
      }
      log.warn({ txHash, error: message }, "Funding transaction receipt lookup failed");
      return { status: "pending", txHash };
    }
  }

  /**
   * Confirm a funding transaction matches the locked Garden/destination/token
   * tuple before declaring it `funded`.
   *
   * Provider success alone is never enough — per the public-read-side-journal
   * plan, `funded` and `funded_late` require a confirmed onchain transaction
   * that:
   *   - lands on the expected chain,
   *   - includes an ERC-20 Transfer (or compound-Transfer) on the expected
   *     token,
   *   - lands `to == destinationAddress` (Cookie Jar for Donate; Vault for
   *     Endow), and
   *   - moves at least `minAssetAmount` to that destination.
   *
   * The helper rejects mismatches with a public-safe `tuple_mismatch` status
   * and a structured `mismatchReason` so callers can surface
   * `failureCode: "reconciliation_failed"` in the public receipt without
   * leaking provider internals.
   */
  async confirmFundingTransaction(
    txHash: Hex,
    expected: FundingTupleExpectation
  ): Promise<FundingConfirmationResult> {
    if (expected.chainId !== this.chainId) {
      return {
        status: "tuple_mismatch",
        txHash,
        mismatchReason: "chain_mismatch",
      };
    }

    let receipt: Awaited<ReturnType<typeof this.publicClient.getTransactionReceipt>>;
    try {
      receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|not be found|could not find/i.test(message)) {
        return { status: "pending", txHash };
      }
      log.warn({ txHash, error: message }, "Funding tuple confirmation receipt lookup failed");
      return { status: "pending", txHash };
    }

    if (receipt.status !== "success") {
      return {
        status: "failed",
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        confirmedAt: new Date().toISOString(),
      };
    }

    const expectedToken = expected.token.toLowerCase();
    const expectedDestination = expected.destinationAddress.toLowerCase();
    const minAmount = expected.minAssetAmount ? safeParseBigInt(expected.minAssetAmount) : 0n;

    let totalMatched = 0n;
    let sawTokenLog = false;
    let sawDestinationLog = false;

    for (const rawLog of receipt.logs ?? []) {
      if (rawLog.address.toLowerCase() !== expectedToken) continue;
      sawTokenLog = true;
      try {
        const decoded = decodeEventLog({
          abi: [ERC20_TRANSFER_EVENT],
          data: rawLog.data,
          topics: rawLog.topics,
        });
        if (decoded.eventName !== "Transfer") continue;
        const args = decoded.args as { from: string; to: string; value: bigint };
        if (args.to.toLowerCase() !== expectedDestination) continue;
        sawDestinationLog = true;
        totalMatched += args.value;
      } catch {
        // Ignore non-Transfer logs that happen to share the token address.
      }
    }

    if (!sawTokenLog) {
      return {
        status: "tuple_mismatch",
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        confirmedAt: new Date().toISOString(),
        mismatchReason: "token_mismatch",
      };
    }
    if (!sawDestinationLog) {
      return {
        status: "tuple_mismatch",
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        confirmedAt: new Date().toISOString(),
        mismatchReason: "destination_mismatch",
      };
    }
    if (totalMatched === 0n) {
      return {
        status: "tuple_mismatch",
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        confirmedAt: new Date().toISOString(),
        mismatchReason: "no_matching_transfer",
      };
    }
    if (minAmount > 0n && totalMatched < minAmount) {
      return {
        status: "tuple_mismatch",
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        confirmedAt: new Date().toISOString(),
        matchedAssetAmount: totalMatched.toString(),
        mismatchReason: "amount_below_min",
      };
    }

    return {
      status: "confirmed",
      txHash,
      blockNumber: receipt.blockNumber?.toString(),
      confirmedAt: new Date().toISOString(),
      matchedAssetAmount: totalMatched.toString(),
    };
  }

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

/**
 * Initialize the blockchain singleton.
 *
 * If already initialized with a different chain, logs a warning and returns
 * the existing instance. Call `resetBlockchain()` first to switch chains.
 */
export function initBlockchain(chain: Chain, rpcUrl?: string): Blockchain {
  if (_blockchain) {
    if (_blockchain.getChainId() !== chain.id) {
      log.warn(
        { existing: _blockchain.getChainId(), requested: chain.id },
        "Blockchain already initialized with a different chain. Call resetBlockchain() to switch."
      );
    }
    return _blockchain;
  }
  _blockchain = new Blockchain(chain, rpcUrl);
  return _blockchain;
}

export function getBlockchain(): Blockchain {
  if (!_blockchain) {
    throw new Error("Blockchain not initialized. Call initBlockchain() first.");
  }
  return _blockchain;
}

/** Reset the singleton to allow re-initialization with a different chain. */
export function resetBlockchain(): void {
  _blockchain?.clearCache();
  _blockchain = null;
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
export const getTransactionConfirmation = (txHash: Hex) =>
  getBlockchain().getTransactionConfirmation(txHash);

export const confirmFundingTransaction = (txHash: Hex, expected: FundingTupleExpectation) =>
  getBlockchain().confirmFundingTransaction(txHash, expected);

function safeParseBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}
export const getChainId = () => getBlockchain().getChainId();
export const clearBlockchainCache = () => _blockchain?.clearCache();
