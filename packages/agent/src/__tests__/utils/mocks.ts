import { vi, beforeEach, afterEach } from "vitest";
import type { Address } from "@green-goods/shared";

// Logger mock that tracks calls for assertions
export const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
};

// Telegram bot mock
export const mockTelegramBot = {
  launch: vi.fn(),
  stop: vi.fn(),
  telegram: {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    sendPhoto: vi.fn().mockResolvedValue({ message_id: 124 }),
    editMessageText: vi.fn().mockResolvedValue(true),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
  },
  on: vi.fn(),
  command: vi.fn(),
  action: vi.fn(),
};

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
export function createAIMock(responses: AIMockResponses = {}) {
  return {
    parseWork: vi.fn().mockImplementation((text: string) => {
      if (responses.parseWork) return responses.parseWork;

      // Default parsing logic
      const actions = [];
      if (text.includes("water")) {
        actions.push({ actionUID: "water", quantity: 10 });
      }
      if (text.includes("plant")) {
        actions.push({ actionUID: "plant", quantity: 5 });
      }

      return {
        actions,
        description: text.slice(0, 100),
        confidence: 0.85,
      };
    }),

    generateResponse: vi.fn().mockImplementation((prompt: string) => {
      if (responses.generateResponse) return responses.generateResponse;
      return "Generated response for: " + prompt;
    }),
  };
}

// Storage mock with in-memory implementation
export function createStorageMock() {
  const storage = new Map();

  return {
    get: vi.fn().mockImplementation((key: string) => storage.get(key)),
    set: vi.fn().mockImplementation((key: string, value: any) => {
      storage.set(key, value);
      return true;
    }),
    delete: vi.fn().mockImplementation((key: string) => storage.delete(key)),
    clear: vi.fn().mockImplementation(() => storage.clear()),
    has: vi.fn().mockImplementation((key: string) => storage.has(key)),
  };
}

// Mock timers utilities
export function useMockTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers(),
    runPending: () => vi.runOnlyPendingTimers(),
  };
}
