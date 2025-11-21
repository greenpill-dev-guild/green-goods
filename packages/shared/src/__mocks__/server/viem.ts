import { vi } from "vitest";

// Mock successful transaction hash
export const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

// Mock Viem wallet client
export const mockWalletClient = {
  writeContract: vi.fn(() => Promise.resolve(MOCK_TX_HASH)),
  readContract: vi.fn(() => Promise.resolve("0x1234")),
  account: {
    address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  },
  chain: {
    id: 84532,
    name: "Base Sepolia",
  },
};

// Mock createWalletClient function
export const mockCreateWalletClient = vi.fn(() => mockWalletClient);

// Mock contract interactions
export const mockContractInteractions = {
  addGardener: vi.fn(() => Promise.resolve(MOCK_TX_HASH)),
  removeGardener: vi.fn(() => Promise.resolve(MOCK_TX_HASH)),
  createGarden: vi.fn(() => Promise.resolve(MOCK_TX_HASH)),
  deployGarden: vi.fn(() => Promise.resolve(MOCK_TX_HASH)),
};

// Mock Viem utilities
export const mockViemUtils = {
  parseUnits: vi.fn((value: string) => BigInt(value)),
  formatUnits: vi.fn((value: bigint) => value.toString()),
  isAddress: vi.fn((address: string) => address.startsWith("0x") && address.length === 42),
  getAddress: vi.fn((address: string) => address),
};

// Setup Viem mocks
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createWalletClient: mockCreateWalletClient,
    custom: vi.fn(() => ({})),
    parseUnits: mockViemUtils.parseUnits,
    formatUnits: mockViemUtils.formatUnits,
    isAddress: mockViemUtils.isAddress,
    getAddress: mockViemUtils.getAddress,
  };
});
