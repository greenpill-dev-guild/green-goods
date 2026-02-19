/**
 * Blockchain Error Detection Tests
 */

import { describe, it, expect } from "vitest";
import {
  detectBlockchainError,
  getBlockchainErrorI18nKey,
  isRecoverableBlockchainError,
  getBlockchainErrorAction,
} from "../blockchain-errors";

describe("detectBlockchainError", () => {
  describe("user rejection", () => {
    it.each([
      "user rejected",
      "User denied transaction signature",
      "rejected by user",
      "user cancelled",
      "user canceled",
      "rejected the request",
      "user declined",
    ])('detects "%s" as userRejected', (message) => {
      const result = detectBlockchainError(message);
      expect(result.type).toBe("userRejected");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  describe("insufficient funds", () => {
    it.each([
      "insufficient funds for gas",
      "insufficient balance",
      "not enough ETH",
      "exceeds balance",
      "insufficient eth",
      "balance too low",
    ])('detects "%s" as insufficientFunds', (message) => {
      const result = detectBlockchainError(message);
      expect(result.type).toBe("insufficientFunds");
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("addFunds");
    });
  });

  describe("network errors", () => {
    it.each([
      "network error",
      "connection refused",
      "failed to fetch",
      "client disconnected",
      "RPC error: method not found",
      "could not connect to node",
      "ECONNREFUSED",
    ])('detects "%s" as network', (message) => {
      const result = detectBlockchainError(message);
      expect(result.type).toBe("network");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("waitAndRetry");
    });
  });

  describe("timeout errors", () => {
    it.each([
      "timeout",
      "request timed out",
      "Request timeout",
    ])('detects "%s" as timeout', (message) => {
      const result = detectBlockchainError(message);
      expect(result.type).toBe("timeout");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  describe("gas estimation errors", () => {
    it.each([
      "out of gas",
      "gas required exceeds allowance",
      "intrinsic gas too low",
      "execution reverted",
      "gas estimation failed",
      "exceeds block gas limit",
    ])('detects "%s" as gasEstimation', (message) => {
      const result = detectBlockchainError(message);
      expect(result.type).toBe("gasEstimation");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  describe("nonce errors", () => {
    it.each([
      "nonce too low",
      "nonce too high",
      "replacement transaction underpriced",
      "transaction with the same nonce",
      "nonce already used",
      "nonce has already been used",
    ])('detects "%s" as nonce', (message) => {
      const result = detectBlockchainError(message);
      expect(result.type).toBe("nonce");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("waitAndRetry");
    });
  });

  describe("unknown errors", () => {
    it("returns unknown for unrecognized messages", () => {
      const result = detectBlockchainError("something completely unexpected");
      expect(result.type).toBe("unknown");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("returns unknown for null", () => {
      expect(detectBlockchainError(null).type).toBe("unknown");
    });

    it("returns unknown for undefined", () => {
      expect(detectBlockchainError(undefined).type).toBe("unknown");
    });

    it("returns unknown for empty string", () => {
      expect(detectBlockchainError("").type).toBe("unknown");
    });
  });

  describe("Error object input", () => {
    it("extracts message from Error objects", () => {
      const error = new Error("User rejected the transaction");
      const result = detectBlockchainError(error);
      expect(result.type).toBe("userRejected");
    });

    it("handles Error with empty message", () => {
      const error = new Error("");
      expect(detectBlockchainError(error).type).toBe("unknown");
    });
  });

  describe("i18n key prefixes", () => {
    it("returns correct prefix for userRejected", () => {
      const result = detectBlockchainError("user rejected");
      expect(result.i18nKeyPrefix).toBe("app.errors.blockchain.userRejected");
    });

    it("returns correct prefix for insufficientFunds", () => {
      const result = detectBlockchainError("insufficient funds");
      expect(result.i18nKeyPrefix).toBe("app.errors.blockchain.insufficientFunds");
    });

    it("returns correct prefix for unknown", () => {
      const result = detectBlockchainError("xyz");
      expect(result.i18nKeyPrefix).toBe("app.errors.blockchain.unknown");
    });
  });
});

describe("getBlockchainErrorI18nKey", () => {
  it("appends suffix to detected error prefix", () => {
    expect(getBlockchainErrorI18nKey("user rejected", "title")).toBe(
      "app.errors.blockchain.userRejected.title"
    );
  });

  it("defaults to 'message' suffix", () => {
    expect(getBlockchainErrorI18nKey("user rejected")).toBe(
      "app.errors.blockchain.userRejected.message"
    );
  });

  it("returns unknown prefix for unrecognized errors", () => {
    expect(getBlockchainErrorI18nKey("xyz", "action")).toBe("app.errors.blockchain.unknown.action");
  });

  it("handles null input", () => {
    expect(getBlockchainErrorI18nKey(null, "title")).toBe("app.errors.blockchain.unknown.title");
  });

  it("handles Error objects", () => {
    expect(getBlockchainErrorI18nKey(new Error("insufficient funds"), "title")).toBe(
      "app.errors.blockchain.insufficientFunds.title"
    );
  });
});

describe("isRecoverableBlockchainError", () => {
  it("returns true for recoverable errors", () => {
    expect(isRecoverableBlockchainError("user rejected")).toBe(true);
    expect(isRecoverableBlockchainError("timeout")).toBe(true);
    expect(isRecoverableBlockchainError("nonce too low")).toBe(true);
    expect(isRecoverableBlockchainError("network error")).toBe(true);
  });

  it("returns false for non-recoverable errors", () => {
    expect(isRecoverableBlockchainError("insufficient funds")).toBe(false);
  });

  it("returns true for unknown errors (assumed potentially transient)", () => {
    expect(isRecoverableBlockchainError("xyz")).toBe(true);
  });

  it("returns true for null/undefined", () => {
    expect(isRecoverableBlockchainError(null)).toBe(true);
    expect(isRecoverableBlockchainError(undefined)).toBe(true);
  });
});

describe("getBlockchainErrorAction", () => {
  it("returns retry for user rejection", () => {
    expect(getBlockchainErrorAction("user rejected")).toBe("retry");
  });

  it("returns addFunds for insufficient funds", () => {
    expect(getBlockchainErrorAction("insufficient funds")).toBe("addFunds");
  });

  it("returns waitAndRetry for network errors", () => {
    expect(getBlockchainErrorAction("network error")).toBe("waitAndRetry");
  });

  it("returns waitAndRetry for nonce errors", () => {
    expect(getBlockchainErrorAction("nonce too low")).toBe("waitAndRetry");
  });

  it("returns retry for timeout", () => {
    expect(getBlockchainErrorAction("timeout")).toBe("retry");
  });

  it("returns retry for unknown errors", () => {
    expect(getBlockchainErrorAction("xyz")).toBe("retry");
  });

  it("returns retry for null", () => {
    expect(getBlockchainErrorAction(null)).toBe("retry");
  });
});
