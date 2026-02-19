/**
 * Blockchain Error Detection Tests
 *
 * Tests detectBlockchainError, getBlockchainErrorI18nKey,
 * isRecoverableBlockchainError, and getBlockchainErrorAction
 * across all 6 error types + unknown fallback.
 */

import { describe, expect, it } from "vitest";
import {
  detectBlockchainError,
  getBlockchainErrorI18nKey,
  isRecoverableBlockchainError,
  getBlockchainErrorAction,
  type BlockchainErrorType,
} from "../../../utils/errors/blockchain-errors";

// ============================================
// detectBlockchainError
// ============================================

describe("detectBlockchainError", () => {
  // ------------------------------------------
  // userRejected
  // ------------------------------------------

  describe("userRejected", () => {
    const userRejectedMessages = [
      "User rejected the transaction",
      "user denied signing",
      "Rejected by user",
      "User cancelled the request",
      "User canceled the request",
      "User rejected the request",
      "User declined to sign",
    ];

    it.each(userRejectedMessages)('detects "%s" as userRejected', (msg) => {
      const result = detectBlockchainError(msg);
      expect(result.type).toBe("userRejected");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("detects userRejected from Error object", () => {
      const result = detectBlockchainError(new Error("User rejected"));
      expect(result.type).toBe("userRejected");
    });
  });

  // ------------------------------------------
  // insufficientFunds
  // ------------------------------------------

  describe("insufficientFunds", () => {
    const insufficientMessages = [
      "Insufficient funds for gas",
      "insufficient balance",
      "Not enough ETH",
      "Exceeds balance",
      "Insufficient ETH for transaction",
      "Balance too low to cover gas",
    ];

    it.each(insufficientMessages)('detects "%s" as insufficientFunds', (msg) => {
      const result = detectBlockchainError(msg);
      expect(result.type).toBe("insufficientFunds");
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("addFunds");
    });
  });

  // ------------------------------------------
  // network
  // ------------------------------------------

  describe("network", () => {
    const networkMessages = [
      "Network error occurred",
      "Connection refused",
      "Failed to fetch from RPC",
      "Client disconnected",
      "RPC endpoint unavailable",
      "Could not connect to provider",
      "ECONNREFUSED 127.0.0.1:8545",
    ];

    it.each(networkMessages)('detects "%s" as network', (msg) => {
      const result = detectBlockchainError(msg);
      expect(result.type).toBe("network");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("waitAndRetry");
    });
  });

  // ------------------------------------------
  // timeout
  // ------------------------------------------

  describe("timeout", () => {
    const timeoutMessages = [
      "Request timeout after 30000ms",
      "Transaction timed out",
      "Request timeout exceeded",
    ];

    it.each(timeoutMessages)('detects "%s" as timeout', (msg) => {
      const result = detectBlockchainError(msg);
      expect(result.type).toBe("timeout");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  // ------------------------------------------
  // gasEstimation
  // ------------------------------------------

  describe("gasEstimation", () => {
    const gasMessages = [
      "Out of gas",
      "Gas required exceeds allowance",
      "Intrinsic gas too low",
      "Execution reverted",
      "Gas estimation failed",
      "Exceeds block gas limit",
    ];

    it.each(gasMessages)('detects "%s" as gasEstimation', (msg) => {
      const result = detectBlockchainError(msg);
      expect(result.type).toBe("gasEstimation");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  // ------------------------------------------
  // nonce
  // ------------------------------------------

  describe("nonce", () => {
    const nonceMessages = [
      "Nonce too low",
      "Nonce too high",
      "Replacement transaction underpriced",
      "Transaction with the same nonce already exists",
      "Nonce already used",
      "Nonce has already been used",
    ];

    it.each(nonceMessages)('detects "%s" as nonce', (msg) => {
      const result = detectBlockchainError(msg);
      expect(result.type).toBe("nonce");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("waitAndRetry");
    });
  });

  // ------------------------------------------
  // unknown
  // ------------------------------------------

  describe("unknown", () => {
    it("returns unknown for unrecognized errors", () => {
      const result = detectBlockchainError("Something completely unexpected");
      expect(result.type).toBe("unknown");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("returns unknown for null input", () => {
      const result = detectBlockchainError(null);
      expect(result.type).toBe("unknown");
    });

    it("returns unknown for undefined input", () => {
      const result = detectBlockchainError(undefined);
      expect(result.type).toBe("unknown");
    });

    it("returns unknown for empty string", () => {
      const result = detectBlockchainError("");
      expect(result.type).toBe("unknown");
    });
  });

  // ------------------------------------------
  // Case insensitivity
  // ------------------------------------------

  describe("case insensitivity", () => {
    it("matches regardless of case", () => {
      expect(detectBlockchainError("USER REJECTED").type).toBe("userRejected");
      expect(detectBlockchainError("INSUFFICIENT FUNDS").type).toBe("insufficientFunds");
      expect(detectBlockchainError("NONCE TOO LOW").type).toBe("nonce");
    });
  });

  // ------------------------------------------
  // i18n key prefix
  // ------------------------------------------

  describe("i18n key prefixes", () => {
    const expectedPrefixes: Record<BlockchainErrorType, string> = {
      userRejected: "app.errors.blockchain.userRejected",
      insufficientFunds: "app.errors.blockchain.insufficientFunds",
      network: "app.errors.blockchain.network",
      timeout: "app.errors.blockchain.timeout",
      gasEstimation: "app.errors.blockchain.gasEstimation",
      nonce: "app.errors.blockchain.nonce",
      unknown: "app.errors.blockchain.unknown",
    };

    it.each(Object.entries(expectedPrefixes))("type %s has prefix %s", (type, prefix) => {
      // Find a sample message for each type
      const samples: Record<string, string> = {
        userRejected: "user rejected",
        insufficientFunds: "insufficient funds",
        network: "connection error",
        timeout: "timeout",
        gasEstimation: "out of gas",
        nonce: "nonce too low",
        unknown: "xyz",
      };
      const result = detectBlockchainError(samples[type]);
      expect(result.i18nKeyPrefix).toBe(prefix);
    });
  });
});

// ============================================
// getBlockchainErrorI18nKey
// ============================================

describe("getBlockchainErrorI18nKey", () => {
  it("appends suffix to detected error prefix", () => {
    const key = getBlockchainErrorI18nKey("user rejected", "title");
    expect(key).toBe("app.errors.blockchain.userRejected.title");
  });

  it("uses default suffix 'message' when not specified", () => {
    const key = getBlockchainErrorI18nKey("insufficient funds");
    expect(key).toBe("app.errors.blockchain.insufficientFunds.message");
  });

  it("uses custom suffix", () => {
    const key = getBlockchainErrorI18nKey("out of gas", "action");
    expect(key).toBe("app.errors.blockchain.gasEstimation.action");
  });

  it("returns unknown key for unrecognized error", () => {
    const key = getBlockchainErrorI18nKey("???", "title");
    expect(key).toBe("app.errors.blockchain.unknown.title");
  });

  it("accepts Error objects", () => {
    const key = getBlockchainErrorI18nKey(new Error("Nonce too high"), "title");
    expect(key).toBe("app.errors.blockchain.nonce.title");
  });

  it("handles null input", () => {
    const key = getBlockchainErrorI18nKey(null, "message");
    expect(key).toBe("app.errors.blockchain.unknown.message");
  });
});

// ============================================
// isRecoverableBlockchainError
// ============================================

describe("isRecoverableBlockchainError", () => {
  it("returns true for user rejection (recoverable)", () => {
    expect(isRecoverableBlockchainError("user rejected")).toBe(true);
  });

  it("returns false for insufficient funds (not recoverable)", () => {
    expect(isRecoverableBlockchainError("insufficient funds")).toBe(false);
  });

  it("returns true for network errors (recoverable)", () => {
    expect(isRecoverableBlockchainError("connection failed")).toBe(true);
  });

  it("returns true for timeout errors (recoverable)", () => {
    expect(isRecoverableBlockchainError("timed out")).toBe(true);
  });

  it("returns true for gas errors (recoverable)", () => {
    expect(isRecoverableBlockchainError("execution reverted")).toBe(true);
  });

  it("returns true for nonce errors (recoverable)", () => {
    expect(isRecoverableBlockchainError("nonce too low")).toBe(true);
  });

  it("returns true for unknown errors (default recoverable)", () => {
    expect(isRecoverableBlockchainError("???")).toBe(true);
  });

  it("returns true for null input (unknown = recoverable)", () => {
    expect(isRecoverableBlockchainError(null)).toBe(true);
  });
});

// ============================================
// getBlockchainErrorAction
// ============================================

describe("getBlockchainErrorAction", () => {
  it("returns retry for user rejection", () => {
    expect(getBlockchainErrorAction("user rejected")).toBe("retry");
  });

  it("returns addFunds for insufficient funds", () => {
    expect(getBlockchainErrorAction("insufficient funds")).toBe("addFunds");
  });

  it("returns waitAndRetry for network error", () => {
    expect(getBlockchainErrorAction("failed to fetch")).toBe("waitAndRetry");
  });

  it("returns retry for timeout", () => {
    expect(getBlockchainErrorAction("timed out")).toBe("retry");
  });

  it("returns retry for gas estimation error", () => {
    expect(getBlockchainErrorAction("out of gas")).toBe("retry");
  });

  it("returns waitAndRetry for nonce error", () => {
    expect(getBlockchainErrorAction("nonce too low")).toBe("waitAndRetry");
  });

  it("returns retry for unknown error", () => {
    expect(getBlockchainErrorAction("???")).toBe("retry");
  });
});
