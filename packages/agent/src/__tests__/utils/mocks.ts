import type { Address } from "@green-goods/shared";
import { afterEach, beforeEach, vi } from "vitest";

// Logger mock that tracks calls for assertions
export const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
};

// Telegram bot mock

// Blockchain mocks
export const mockPublicClient = {
  readContract: vi
    .fn()
    .mockRejectedValue(new Error("mockPublicClient.readContract not stubbed for this test")),
  simulateContract: vi
    .fn()
    .mockRejectedValue(new Error("mockPublicClient.simulateContract not stubbed for this test")),
  getBlockNumber: vi.fn().mockResolvedValue(1000n),
  getGasPrice: vi.fn().mockResolvedValue(20000000000n), // 20 gwei
};

// Use a realistic non-zero test address (well-known Vitalik address)
const TEST_WALLET_ADDRESS: Address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export const mockWalletClient = {
  account: {
    address: TEST_WALLET_ADDRESS,
  },
  writeContract: vi.fn().mockResolvedValue("0x" + "a".repeat(64)),
  signMessage: vi.fn().mockResolvedValue("0x" + "b".repeat(130)),
};

// AI service mock response types
export interface AIMockResponses {
  parseWork?: {
    actions: { actionUID: string; quantity: number }[];
    description: string;
    confidence: number;
  };
  generateResponse?: string;
}

// AI service mock with configurable responses

// Storage mock with in-memory implementation

// Mock timers utilities
