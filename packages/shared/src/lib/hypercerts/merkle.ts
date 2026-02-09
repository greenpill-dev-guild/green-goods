import { parseAllowListEntriesToMerkleTree, verifyMerkleProof } from "@hypercerts-org/sdk";
import { type Address, getAddress, type Hex, isAddress } from "viem";

import type { AllowlistEntry } from "../../types/hypercerts";
import { createLogger } from "../../modules/app/logger";

const logger = createLogger({ source: "lib/hypercerts/merkle" });

type SDKMerkleTree = ReturnType<typeof parseAllowListEntriesToMerkleTree>;

export interface MerkleLeaf {
  address: Address;
  units: bigint;
}

export interface MerkleTree {
  tree: SDKMerkleTree;
  root: Hex;
  leaves: MerkleLeaf[];
}

function normalizeEntry(entry: AllowlistEntry): AllowlistEntry {
  if (!isAddress(entry.address)) {
    throw new Error(`Invalid allowlist address: ${entry.address}`);
  }

  return {
    ...entry,
    address: getAddress(entry.address),
  };
}

/**
 * Generates a Merkle tree using @hypercerts-org/sdk utilities (OpenZeppelin StandardMerkleTree).
 */
export function generateMerkleTree(entries: AllowlistEntry[]): MerkleTree {
  if (!entries.length) {
    throw new Error("Allowlist cannot be empty");
  }

  const normalized = entries.map(normalizeEntry);
  const tree = parseAllowListEntriesToMerkleTree(normalized);

  return {
    tree,
    root: tree.root as Hex,
    leaves: normalized.map((entry) => ({ address: entry.address, units: entry.units })),
  };
}

/**
 * Generates a Merkle proof for a given entry in the tree.
 *
 * @param tree - The Merkle tree containing the allowlist entries
 * @param entry - The allowlist entry to generate a proof for
 * @returns Array of hex strings representing the Merkle proof
 * @throws Error if the entry address is invalid or if the entry is not found in the tree
 */
export function generateProof(tree: MerkleTree, entry: AllowlistEntry): Hex[] {
  const normalized = normalizeEntry(entry);
  try {
    return tree.tree.getProof([normalized.address, normalized.units]) as Hex[];
  } catch (error) {
    logger.error("Failed to generate Merkle proof", {
      address: normalized.address,
      units: normalized.units.toString(),
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    throw new Error(
      `Failed to generate proof for entry ${normalized.address}: Entry not found in tree or tree structure invalid`
    );
  }
}

export function verifyProof(options: {
  root: Hex;
  entry: AllowlistEntry;
  proof: Hex[];
}): boolean {
  const { root, entry, proof } = options;
  const normalized = normalizeEntry(entry);
  try {
    verifyMerkleProof(root, normalized.address, normalized.units, proof);
    return true;
  } catch {
    return false;
  }
}
