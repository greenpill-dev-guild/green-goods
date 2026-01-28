/**
 * Mock Factories for Test Data
 *
 * Provides factory functions to create mock data for tests.
 * All factories support partial overrides for flexibility.
 */

import { vi } from "vitest";

import type { Action, Garden, Work, WorkApprovalDraft, WorkDraft } from "../../types";
import type {
  AllowlistEntry,
  HypercertAttestation,
  HypercertDraft,
  HypercertRecord,
  OutcomeMetrics,
} from "../../types/hypercerts";
import { TOTAL_UNITS } from "../../lib/hypercerts/constants";

// ============================================
// Address Constants
// ============================================

export const MOCK_ADDRESSES = {
  deployer: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  operator: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  gardener: "0x1234567890123456789012345678901234567890",
  smartAccount: "0xSmartAccount1234567890123456789012345678",
  garden: "0xGarden12345678901234567890123456789012345",
  user: "0xUser12345678901234567890123456789012345678",
} as const;

export const MOCK_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

// ============================================
// Work Draft Factory
// ============================================

export function createMockWorkDraft(overrides?: Partial<WorkDraft>): WorkDraft {
  return {
    actionUID: 1,
    title: "Test Work Submission",
    feedback: "Test feedback for the work",
    plantSelection: ["Rose", "Tulip"],
    plantCount: 5,
    media: [],
    ...overrides,
  };
}

// ============================================
// Work Factory
// ============================================

export function createMockWork(overrides?: Partial<Work>): Work {
  return {
    id: `work-${Date.now()}`,
    title: "Test Work",
    actionUID: 1,
    gardenerAddress: MOCK_ADDRESSES.gardener,
    gardenAddress: MOCK_ADDRESSES.garden,
    feedback: "Test feedback",
    metadata: JSON.stringify({ plantCount: 5, plantSelection: ["Rose"] }),
    media: ["ipfs://QmTest123"],
    createdAt: Date.now(),
    status: "pending",
    ...overrides,
  };
}

// ============================================
// Work Approval Draft Factory
// ============================================

export function createMockWorkApprovalDraft(
  overrides?: Partial<WorkApprovalDraft>
): WorkApprovalDraft {
  return {
    actionUID: 1,
    workUID: "0xWorkUID123",
    approved: true,
    feedback: "",
    ...overrides,
  };
}

// ============================================
// Garden Factory
// ============================================

export function createMockGarden(overrides?: Partial<Garden>): Garden {
  return {
    id: `garden-${Date.now()}`,
    chainId: 84532,
    tokenAddress: MOCK_ADDRESSES.garden,
    tokenID: BigInt(1),
    name: "Test Garden",
    description: "A test garden for unit testing",
    location: "Test Location",
    bannerImage: "ipfs://QmBanner123",
    createdAt: Date.now(),
    gardeners: [MOCK_ADDRESSES.gardener],
    operators: [MOCK_ADDRESSES.operator],
    assessments: [],
    works: [],
    ...overrides,
  };
}

// ============================================
// Action Factory
// ============================================

export function createMockAction(overrides?: Partial<Action>): Action {
  return {
    id: `action-${Date.now()}`,
    startTime: Date.now() - 86400000, // 1 day ago
    endTime: Date.now() + 86400000, // 1 day from now
    title: "Test Action",
    description: "A test action for unit testing",
    instructions: "Follow these test instructions",
    capitals: [],
    media: [],
    createdAt: Date.now(),
    inputs: [],
    ...overrides,
  };
}

// ============================================
// Smart Account Client Factory
// ============================================

export function createMockSmartAccountClient() {
  return {
    account: {
      address: MOCK_ADDRESSES.smartAccount,
    },
    sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
    chain: { id: 84532, name: "Base Sepolia" },
  };
}

// ============================================
// Auth Context Factory
// ============================================

export interface MockAuthContextOptions {
  authMode?: "wallet" | "passkey" | null;
  isAuthenticated?: boolean;
  isReady?: boolean;
  smartAccountAddress?: string | null;
  walletAddress?: string | null;
}

export function createMockAuthContext(options: MockAuthContextOptions = {}) {
  const {
    authMode = "passkey",
    isAuthenticated = true,
    isReady = true,
    smartAccountAddress = MOCK_ADDRESSES.smartAccount,
    walletAddress = null,
  } = options;

  return {
    authMode,
    isAuthenticated,
    isReady,
    smartAccountAddress,
    walletAddress,
    smartAccountClient: authMode === "passkey" ? createMockSmartAccountClient() : null,
    eoa: walletAddress ? { address: walletAddress } : null,
    createPasskey: vi.fn(),
    clearPasskey: vi.fn(),
    signOut: vi.fn(),
    error: null,
    isAuthenticating: false,
  };
}

// ============================================
// User Context Factory
// ============================================

export function createMockUserContext(options: MockAuthContextOptions = {}) {
  const authContext = createMockAuthContext(options);

  // primaryAddress is derived based on auth mode (matches useUser hook logic)
  const primaryAddress =
    authContext.authMode === "wallet"
      ? authContext.walletAddress
      : authContext.authMode === "passkey"
        ? authContext.smartAccountAddress
        : authContext.smartAccountAddress || authContext.walletAddress || null;

  return {
    user: authContext.isAuthenticated ? { id: "test-user", address: primaryAddress } : null,
    ready: authContext.isReady,
    eoa: authContext.eoa,
    smartAccountAddress: authContext.smartAccountAddress,
    smartAccountClient: authContext.smartAccountClient,
    authMode: authContext.authMode,
    ensName: null,
    // New properties for unified auth
    primaryAddress,
    externalWalletConnected: Boolean(authContext.walletAddress),
    externalWalletAddress: authContext.walletAddress,
  };
}

// ============================================
// Credential Factory (for Passkey tests)
// ============================================

export function createMockP256Credential() {
  return {
    id: "test-credential-id-base64url",
    publicKey: "0xTestPublicKey1234567890",
    raw: {
      id: "test-credential-id-base64url",
      type: "public-key",
      rawId: new Uint8Array([1, 2, 3, 4]),
    },
  };
}

// ============================================
// File Factory (for Media tests)
// ============================================

export function createMockFile(name = "test-image.jpg", type = "image/jpeg", size = 1024): File {
  const content = new Array(size).fill("x").join("");
  return new File([content], name, { type });
}

export function createMockFiles(count = 2): File[] {
  return Array.from({ length: count }, (_, i) => createMockFile(`test-image-${i + 1}.jpg`));
}

// ============================================
// Hypercert Factories
// ============================================

export function createMockHypercertAttestation(
  overrides: Partial<HypercertAttestation> = {}
): HypercertAttestation {
  return {
    id: `0x${Date.now().toString(16).padStart(64, "0")}`,
    workUid: `0x${Date.now().toString(16).padStart(64, "0")}`,
    gardenId: MOCK_ADDRESSES.garden,
    title: "Test Work Submission",
    actionType: "planting",
    domain: "agroforestry",
    workScope: ["gardening", "planting"],
    gardenerAddress: MOCK_ADDRESSES.gardener as `0x${string}`,
    gardenerName: "Test Gardener",
    mediaUrls: ["ipfs://QmMedia123"],
    metrics: {
      trees_planted: { value: 10, unit: "trees" },
      area_covered: { value: 50, unit: "sqm" },
    },
    createdAt: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    approvedAt: Math.floor(Date.now() / 1000),
    approvedBy: MOCK_ADDRESSES.operator as `0x${string}`,
    feedback: "Good work!",
    ...overrides,
  };
}

export function createMockHypercertDraft(overrides: Partial<HypercertDraft> = {}): HypercertDraft {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `draft-${Date.now()}`,
    gardenId: MOCK_ADDRESSES.garden,
    operatorAddress: MOCK_ADDRESSES.operator as `0x${string}`,
    stepNumber: 1,
    attestationIds: [],
    title: "Test Hypercert",
    description: "A test hypercert for conservation work",
    workScopes: ["gardening", "planting"],
    impactScopes: ["environment"],
    workTimeframeStart: now - 86400 * 30, // 30 days ago
    workTimeframeEnd: now,
    impactTimeframeStart: now - 86400 * 30,
    impactTimeframeEnd: null, // Indefinite
    sdgs: [13, 15], // Climate Action, Life on Land
    capitals: ["living", "social"],
    outcomes: {
      predefined: {
        trees_planted: {
          value: 100,
          unit: "trees",
          aggregation: "sum",
          label: "Trees Planted",
        },
      },
      custom: {},
    },
    allowlist: [],
    externalUrl: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function createMockAllowlistEntry(overrides: Partial<AllowlistEntry> = {}): AllowlistEntry {
  return {
    address: MOCK_ADDRESSES.gardener as `0x${string}`,
    units: TOTAL_UNITS / 2n,
    label: "Test Contributor",
    ...overrides,
  };
}

export function createMockAllowlist(count = 2): AllowlistEntry[] {
  const baseUnits = TOTAL_UNITS / BigInt(count);
  const remainder = TOTAL_UNITS - baseUnits * BigInt(count);

  return Array.from({ length: count }, (_, i) => ({
    address: `0x${String(i + 1).padStart(40, "0")}` as `0x${string}`,
    units: i === 0 ? baseUnits + remainder : baseUnits,
    label: `Contributor ${i + 1}`,
  }));
}

export function createMockHypercertRecord(
  overrides: Partial<HypercertRecord> = {}
): HypercertRecord {
  return {
    id: `hypercert-${Date.now()}`,
    tokenId: BigInt(1),
    gardenId: MOCK_ADDRESSES.garden,
    metadataUri: "ipfs://QmMetadata123",
    imageUri: "ipfs://QmImage123",
    mintedAt: Math.floor(Date.now() / 1000),
    mintedBy: MOCK_ADDRESSES.operator as `0x${string}`,
    txHash: MOCK_TX_HASH as `0x${string}`,
    totalUnits: TOTAL_UNITS,
    claimedUnits: 0n,
    attestationCount: 3,
    title: "Test Hypercert",
    description: "A test hypercert record",
    workScopes: ["gardening", "planting"],
    status: "active",
    ...overrides,
  };
}

export function createMockOutcomeMetrics(overrides: Partial<OutcomeMetrics> = {}): OutcomeMetrics {
  return {
    predefined: {
      trees_planted: {
        value: 100,
        unit: "trees",
        aggregation: "sum",
        label: "Trees Planted",
      },
      area_covered: {
        value: 500,
        unit: "sqm",
        aggregation: "sum",
        label: "Area Covered",
      },
    },
    custom: {},
    ...overrides,
  };
}
