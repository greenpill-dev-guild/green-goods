/**
 * Mock Factories for Test Data
 *
 * Provides factory functions to create mock data for tests.
 * All factories support partial overrides for flexibility.
 */

import { vi } from "vitest";

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
