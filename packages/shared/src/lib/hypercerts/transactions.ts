import { HypercertMinterAbi } from "@hypercerts-org/contracts";
import { type Address, encodeFunctionData, type Hex } from "viem";

/**
 * Transfer restriction modes for Hypercert fractions.
 */
export enum TransferRestrictions {
  /** Anyone can transfer hypercert fractions freely */
  AllowAll = 0,
  /** No transfers allowed - fractions are locked to initial recipients */
  DisallowAll = 1,
  /** Only the hypercert creator can transfer fractions */
  FromCreatorOnly = 2,
}

const HYPERCERT_MINTER_ABI = HypercertMinterAbi;

/**
 * Encodes the `createAllowlist` function call for the Hypercert minter contract.
 *
 * This creates a new hypercert with an allowlist for claiming fractions.
 *
 * @param account - Address that will own the hypercert (receives unclaimed units)
 * @param totalUnits - Total supply of fraction units (typically 100_000_000n)
 * @param merkleRoot - Root hash of the allowlist Merkle tree
 * @param metadataUri - IPFS URI pointing to hypercert metadata JSON
 * @param transferRestrictions - Optional transfer restriction mode (defaults to AllowAll)
 * @returns Hex-encoded function calldata
 */
export function encodeCreateAllowlist(params: {
  account: Address;
  totalUnits: bigint;
  merkleRoot: Hex;
  metadataUri: string;
  transferRestrictions?: TransferRestrictions;
}): Hex {
  return encodeFunctionData({
    abi: HYPERCERT_MINTER_ABI,
    functionName: "createAllowlist",
    args: [
      params.account,
      params.totalUnits,
      params.merkleRoot,
      params.metadataUri,
      params.transferRestrictions ?? TransferRestrictions.AllowAll,
    ],
  });
}

export const HYPERCERT_MINTER_ABI_FULL = HYPERCERT_MINTER_ABI;
