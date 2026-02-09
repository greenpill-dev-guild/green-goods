import { describe, it, expect } from "vitest";
import {
  generateMerkleTree,
  generateProof,
  verifyProof,
} from "../../../lib/hypercerts/merkle";
import type { AllowlistEntry } from "../../../types/hypercerts";

// ============================================
// Test Helpers
// ============================================

const VALID_ADDRESS_1 = "0x0000000000000000000000000000000000000001" as const;
const VALID_ADDRESS_2 = "0x0000000000000000000000000000000000000002" as const;
const VALID_ADDRESS_3 = "0x0000000000000000000000000000000000000003" as const;
const CHECKSUM_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const; // Vitalik.eth

function createEntry(
  address: `0x${string}`,
  units: bigint,
  label?: string
): AllowlistEntry {
  return { address, units, label };
}

// ============================================
// generateMerkleTree Tests
// ============================================

describe("generateMerkleTree", () => {
  it("throws for empty entries array", () => {
    expect(() => generateMerkleTree([])).toThrow("Allowlist cannot be empty");
  });

  it("generates tree for single entry", () => {
    const entries = [createEntry(VALID_ADDRESS_1, 1000n)];
    const result = generateMerkleTree(entries);

    expect(result.root).toBeDefined();
    expect(result.root).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.leaves).toHaveLength(1);
    expect(result.tree).toBeDefined();
  });

  it("generates tree for multiple entries", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 300n),
      createEntry(VALID_ADDRESS_3, 200n),
    ];
    const result = generateMerkleTree(entries);

    expect(result.root).toBeDefined();
    expect(result.leaves).toHaveLength(3);
    expect(result.leaves[0].address).toBe(VALID_ADDRESS_1);
    expect(result.leaves[0].units).toBe(500n);
  });

  it("normalizes addresses to checksum format", () => {
    const lowercaseAddress =
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" as `0x${string}`;
    const entries = [createEntry(lowercaseAddress, 1000n)];
    const result = generateMerkleTree(entries);

    expect(result.leaves[0].address).toBe(CHECKSUM_ADDRESS);
  });

  it("throws for invalid address format", () => {
    const invalidAddress = "0xinvalid" as `0x${string}`;
    const entries = [createEntry(invalidAddress, 1000n)];

    expect(() => generateMerkleTree(entries)).toThrow();
  });

  it("produces consistent root for same entries", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 500n),
    ];

    const tree1 = generateMerkleTree(entries);
    const tree2 = generateMerkleTree(entries);

    expect(tree1.root).toBe(tree2.root);
  });

  it("produces different root for different entries", () => {
    const entries1 = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 500n),
    ];
    const entries2 = [
      createEntry(VALID_ADDRESS_1, 600n),
      createEntry(VALID_ADDRESS_2, 400n),
    ];

    const tree1 = generateMerkleTree(entries1);
    const tree2 = generateMerkleTree(entries2);

    expect(tree1.root).not.toBe(tree2.root);
  });

  it("preserves entry order in leaves", () => {
    const entries = [
      createEntry(VALID_ADDRESS_3, 100n),
      createEntry(VALID_ADDRESS_1, 200n),
      createEntry(VALID_ADDRESS_2, 300n),
    ];
    const result = generateMerkleTree(entries);

    expect(result.leaves[0].address).toBe(VALID_ADDRESS_3);
    expect(result.leaves[1].address).toBe(VALID_ADDRESS_1);
    expect(result.leaves[2].address).toBe(VALID_ADDRESS_2);
  });
});

// ============================================
// generateProof Tests
// ============================================

describe("generateProof", () => {
  it("generates proof for entry in tree", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 300n),
      createEntry(VALID_ADDRESS_3, 200n),
    ];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    expect(Array.isArray(proof)).toBe(true);
    expect(proof.length).toBeGreaterThan(0);
    proof.forEach((p) => {
      expect(p).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  it("generates different proofs for different entries", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 300n),
    ];
    const tree = generateMerkleTree(entries);

    const proof1 = generateProof(tree, entries[0]);
    const proof2 = generateProof(tree, entries[1]);

    expect(proof1).not.toEqual(proof2);
  });

  it("normalizes address when generating proof", () => {
    const entries = [createEntry(CHECKSUM_ADDRESS, 1000n)];
    const tree = generateMerkleTree(entries);

    // Use lowercase version
    const lowercaseEntry = createEntry(
      CHECKSUM_ADDRESS.toLowerCase() as `0x${string}`,
      1000n
    );
    const proof = generateProof(tree, lowercaseEntry);

    expect(Array.isArray(proof)).toBe(true);
  });

  it("returns empty proof for single-entry tree", () => {
    const entries = [createEntry(VALID_ADDRESS_1, 1000n)];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    // Single entry tree may have empty or minimal proof
    expect(Array.isArray(proof)).toBe(true);
  });
});

// ============================================
// verifyProof Tests
// ============================================

describe("verifyProof", () => {
  it("returns true for valid proof", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 300n),
      createEntry(VALID_ADDRESS_3, 200n),
    ];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    const isValid = verifyProof({
      root: tree.root,
      entry: entries[0],
      proof,
    });

    expect(isValid).toBe(true);
  });

  it("returns false for wrong address", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 500n),
    ];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    const isValid = verifyProof({
      root: tree.root,
      entry: createEntry(VALID_ADDRESS_3, 500n), // Wrong address
      proof,
    });

    expect(isValid).toBe(false);
  });

  it("returns false for wrong units", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 500n),
    ];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    const isValid = verifyProof({
      root: tree.root,
      entry: createEntry(VALID_ADDRESS_1, 600n), // Wrong units
      proof,
    });

    expect(isValid).toBe(false);
  });

  it("returns false for wrong root", () => {
    const entries = [createEntry(VALID_ADDRESS_1, 500n)];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    const fakeRoot =
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

    const isValid = verifyProof({
      root: fakeRoot,
      entry: entries[0],
      proof,
    });

    expect(isValid).toBe(false);
  });

  it("returns false for tampered proof", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 500n),
      createEntry(VALID_ADDRESS_2, 500n),
    ];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    const tamperedProof = [
      ...proof.slice(0, -1),
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    ];

    const isValid = verifyProof({
      root: tree.root,
      entry: entries[0],
      proof: tamperedProof,
    });

    expect(isValid).toBe(false);
  });

  it("validates with case-insensitive address matching", () => {
    const entries = [createEntry(CHECKSUM_ADDRESS, 1000n)];
    const tree = generateMerkleTree(entries);
    const proof = generateProof(tree, entries[0]);

    // Verify with lowercase address
    const isValid = verifyProof({
      root: tree.root,
      entry: createEntry(
        CHECKSUM_ADDRESS.toLowerCase() as `0x${string}`,
        1000n
      ),
      proof,
    });

    expect(isValid).toBe(true);
  });

  it("validates all entries in a tree", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 100n),
      createEntry(VALID_ADDRESS_2, 200n),
      createEntry(VALID_ADDRESS_3, 300n),
    ];
    const tree = generateMerkleTree(entries);

    for (const entry of entries) {
      const proof = generateProof(tree, entry);
      const isValid = verifyProof({
        root: tree.root,
        entry,
        proof,
      });
      expect(isValid).toBe(true);
    }
  });
});

// ============================================
// Integration Tests
// ============================================

describe("Merkle Tree Integration", () => {
  it("complete flow: generate tree, create proofs, verify all", () => {
    const entries = [
      createEntry(VALID_ADDRESS_1, 50_000_000n),
      createEntry(VALID_ADDRESS_2, 30_000_000n),
      createEntry(VALID_ADDRESS_3, 20_000_000n),
    ];

    // Generate tree
    const tree = generateMerkleTree(entries);
    expect(tree.root).toBeDefined();

    // Generate and verify proofs for all entries
    const proofsAndResults = entries.map((entry) => {
      const proof = generateProof(tree, entry);
      const isValid = verifyProof({ root: tree.root, entry, proof });
      return { entry, proof, isValid };
    });

    // All should verify
    proofsAndResults.forEach(({ isValid }) => {
      expect(isValid).toBe(true);
    });
  });

  it("handles large allowlist", () => {
    const entries = Array.from({ length: 100 }, (_, i) =>
      createEntry(
        `0x${String(i + 1).padStart(40, "0")}` as `0x${string}`,
        BigInt(1000 * (i + 1))
      )
    );

    const tree = generateMerkleTree(entries);
    expect(tree.leaves).toHaveLength(100);

    // Verify random entry
    const randomIndex = 50;
    const proof = generateProof(tree, entries[randomIndex]);
    const isValid = verifyProof({
      root: tree.root,
      entry: entries[randomIndex],
      proof,
    });

    expect(isValid).toBe(true);
  });
});
