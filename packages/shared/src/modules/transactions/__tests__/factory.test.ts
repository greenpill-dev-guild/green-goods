/**
 * createTransactionSender Factory Tests
 * @vitest-environment jsdom
 *
 * Tests the factory function that creates the correct TransactionSender
 * implementation based on authMode and available clients.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../../__tests__/test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

vi.mock("@wagmi/core", () => ({
  writeContract: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
}));

// ============================================
// Import after mocks
// ============================================

import { createTransactionSender } from "../factory";
import { PasskeySender } from "../passkey-sender";
import { EmbeddedSender } from "../embedded-sender";
import { WalletSender } from "../wallet-sender";

// ============================================
// Test fixtures
// ============================================

const mockSmartAccountClient = {
  account: { address: MOCK_ADDRESSES.smartAccount },
  chain: { id: 11155111, name: "Sepolia" },
  sendTransaction: vi.fn().mockResolvedValue(MOCK_TX_HASH),
} as any;

const mockWagmiConfig = {} as any;
const mockWriteContractAsync = vi.fn().mockResolvedValue(MOCK_TX_HASH);
const mockErc7677Url = "https://paymaster.example.com/rpc";

// ============================================
// Tests
// ============================================

describe("createTransactionSender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("passkey authMode", () => {
    it("returns PasskeySender when smartAccountClient is provided", () => {
      const sender = createTransactionSender({
        authMode: "passkey",
        smartAccountClient: mockSmartAccountClient,
      });

      expect(sender).toBeInstanceOf(PasskeySender);
      expect(sender.authMode).toBe("passkey");
      expect(sender.supportsSponsorship).toBe(true);
    });

    it("falls back to WalletSender when smartAccountClient is missing but wagmi deps available", () => {
      const sender = createTransactionSender({
        authMode: "passkey",
        wagmiConfig: mockWagmiConfig,
        writeContractAsync: mockWriteContractAsync,
      });

      expect(sender).toBeInstanceOf(WalletSender);
      expect(sender.authMode).toBe("wallet");
    });

    it("falls back to WalletSender when smartAccountClient has no account", () => {
      const sender = createTransactionSender({
        authMode: "passkey",
        smartAccountClient: { ...mockSmartAccountClient, account: undefined } as any,
        wagmiConfig: mockWagmiConfig,
        writeContractAsync: mockWriteContractAsync,
      });

      expect(sender).toBeInstanceOf(WalletSender);
    });

    it("throws when smartAccountClient is missing and no wagmi deps available", () => {
      expect(() =>
        createTransactionSender({
          authMode: "passkey",
        })
      ).toThrow("smartAccountClient is required for passkey auth mode");
    });
  });

  describe("embedded authMode", () => {
    it("returns EmbeddedSender when wagmiConfig and erc7677ProxyUrl are provided", () => {
      const sender = createTransactionSender({
        authMode: "embedded",
        wagmiConfig: mockWagmiConfig,
        erc7677ProxyUrl: mockErc7677Url,
      });

      expect(sender).toBeInstanceOf(EmbeddedSender);
      expect(sender.authMode).toBe("embedded");
      expect(sender.supportsSponsorship).toBe(false);
    });

    it("throws when wagmiConfig is missing for embedded mode", () => {
      expect(() =>
        createTransactionSender({
          authMode: "embedded",
          erc7677ProxyUrl: mockErc7677Url,
        })
      ).toThrow("wagmiConfig is required for embedded auth mode");
    });

    it("creates EmbeddedSender without erc7677ProxyUrl", () => {
      const sender = createTransactionSender({
        authMode: "embedded",
        wagmiConfig: mockWagmiConfig,
      });

      expect(sender).toBeInstanceOf(EmbeddedSender);
      expect(sender.authMode).toBe("embedded");
    });
  });

  describe("wallet authMode", () => {
    it("returns WalletSender when wagmiConfig and writeContractAsync are provided", () => {
      const sender = createTransactionSender({
        authMode: "wallet",
        wagmiConfig: mockWagmiConfig,
        writeContractAsync: mockWriteContractAsync,
      });

      expect(sender).toBeInstanceOf(WalletSender);
      expect(sender.authMode).toBe("wallet");
    });

    it("throws when wagmiConfig is missing for wallet mode", () => {
      expect(() =>
        createTransactionSender({
          authMode: "wallet",
          writeContractAsync: mockWriteContractAsync,
        })
      ).toThrow("wagmiConfig is required for wallet auth mode");
    });

    it("throws when writeContractAsync is missing for wallet mode", () => {
      expect(() =>
        createTransactionSender({
          authMode: "wallet",
          wagmiConfig: mockWagmiConfig,
        })
      ).toThrow("writeContractAsync is required for wallet auth mode");
    });

    it("passes erc7677ProxyUrl to WalletSender when provided", () => {
      const sender = createTransactionSender({
        authMode: "wallet",
        wagmiConfig: mockWagmiConfig,
        writeContractAsync: mockWriteContractAsync,
        erc7677ProxyUrl: mockErc7677Url,
      });

      expect(sender).toBeInstanceOf(WalletSender);
    });
  });
});
