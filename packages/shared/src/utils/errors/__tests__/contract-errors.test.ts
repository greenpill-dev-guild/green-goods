/**
 * Contract Error Parsing Tests
 */

import { describe, expect, it } from "vitest";
import {
  formatErrorForToast,
  isAlreadyGardenerError,
  isNotGardenMemberError,
  parseAndFormatError,
  parseContractError,
} from "../contract-errors";

describe("parseContractError", () => {
  it("parses NotGardenMember error code (old selector for backward compatibility)", () => {
    const result = parseContractError("0x8cb4ae3b");

    expect(result).toEqual({
      raw: "0x8cb4ae3b",
      name: "NotGardenMember",
      message: "You are not a member of this garden",
      action: "Please join the garden before submitting work",
      isKnown: true,
      recoverable: false,
      suggestedAction: "join-garden",
    });
  });

  it("parses NotGardenMember error code (current selector)", () => {
    // 0xfdb31dd5 = keccak256("NotGardenMember()")[0:4]
    const result = parseContractError("0xfdb31dd5");

    expect(result).toEqual({
      raw: "0xfdb31dd5",
      name: "NotGardenMember",
      message: "You are not a member of this garden",
      action: "Please join the garden before submitting work",
      isKnown: true,
      recoverable: false,
      suggestedAction: "join-garden",
    });
  });

  it("parses AlreadyGardener error code", () => {
    const result = parseContractError("0x42375a1e");

    expect(result).toEqual({
      raw: "0x42375a1e",
      name: "AlreadyGardener",
      message: "You are already a member of this garden",
      action: undefined,
      isKnown: true,
      recoverable: false,
      suggestedAction: undefined,
    });
  });

  it("extracts error code from UserOperation revert message", () => {
    const errorMessage = "UserOperation reverted during simulation with reason: 0x8cb4ae3b";
    const result = parseContractError(errorMessage);

    expect(result.name).toBe("NotGardenMember");
    expect(result.isKnown).toBe(true);
  });

  it("handles unknown error codes", () => {
    const result = parseContractError("0xdeadbeef");

    expect(result).toEqual({
      raw: "0xdeadbeef",
      name: "UnknownError",
      message: "Transaction failed with error code: 0xdeadbeef",
      isKnown: false,
      recoverable: true,
      suggestedAction: "retry",
    });
  });

  it("handles error objects with message property", () => {
    const error = new Error("Transaction reverted with reason: 0x8cb4ae3b");
    const result = parseContractError(error);

    expect(result.name).toBe("NotGardenMember");
  });

  it("handles string errors without hex codes", () => {
    const result = parseContractError("Something went wrong");

    expect(result.isKnown).toBe(false);
    expect(result.name).toBe("UnknownError");
  });

  // ============================================================================
  // Consolidated post-signature pattern tests (folded in from formatWalletError
  // and formatUserError when user-messages.ts was deleted in 2026-05-11).
  // ============================================================================

  describe("user rejection patterns", () => {
    it("classifies 'user rejected the transaction'", () => {
      const result = parseContractError("user rejected the transaction");
      expect(result.name).toBe("UserRejected");
      expect(result.isKnown).toBe(true);
      expect(result.recoverable).toBe(true);
      expect(result.message).toBe("Transaction cancelled. Try again when you're ready.");
    });

    it("classifies 'user denied the signature'", () => {
      const result = parseContractError("user denied the signature");
      expect(result.name).toBe("UserRejected");
    });

    it("classifies 'rejected the request' (passkey/EIP-1193 phrasing)", () => {
      const result = parseContractError("MetaMask rejected the request");
      expect(result.name).toBe("UserRejected");
    });

    it("classifies regardless of case", () => {
      const result = parseContractError("USER REJECTED the request");
      expect(result.name).toBe("UserRejected");
    });
  });

  describe("wallet balance / gas patterns", () => {
    it("classifies insufficient funds", () => {
      const result = parseContractError("insufficient funds for gas");
      expect(result.name).toBe("InsufficientFunds");
      expect(result.message).toContain("Not enough funds");
      expect(result.recoverable).toBe(false);
    });

    it("classifies nonce conflict", () => {
      const result = parseContractError("nonce too low");
      expect(result.name).toBe("NonceConflict");
      expect(result.recoverable).toBe(true);
    });

    it("classifies gas estimation failure", () => {
      const result = parseContractError("gas estimation failed");
      expect(result.name).toBe("GasEstimationFailed");
    });
  });

  describe("upload patterns", () => {
    it("classifies 'media upload not initialized' as service-unavailable", () => {
      const result = parseContractError("media upload not initialized");
      expect(result.name).toBe("UploadServiceUnavailable");
      expect(result.message).toContain("unavailable");
    });

    it("classifies generic IPFS failures", () => {
      const result = parseContractError("ipfs gateway timeout");
      // 'timeout' would match the timeout pattern, but 'ipfs' is checked first.
      expect(result.name).toBe("UploadError");
      expect(result.recoverable).toBe(true);
    });

    it("classifies 'failed to upload'", () => {
      const result = parseContractError("failed to upload media");
      expect(result.name).toBe("UploadError");
    });
  });

  describe("storage patterns", () => {
    it("classifies storage quota exceeded", () => {
      const result = parseContractError("Quota exceeded on IndexedDB");
      // Note: signature loop matches 'StorageError' pattern indirectly; ensure quota wins.
      expect(result.name).toBe("StorageQuotaExceeded");
      expect(result.recoverable).toBe(false);
    });

    it("classifies generic storage error", () => {
      const result = parseContractError("indexeddb write failed");
      expect(result.name).toBe("StorageError");
    });
  });

  describe("network and connectivity patterns", () => {
    it.each([
      "request expired",
      "proposal expired",
      "out of time-range",
      "AA22 expired or not due",
      "AA32 paymaster expired or not due",
    ])("classifies wallet request expiry phrasing: %s", (message) => {
      const result = parseContractError(message);
      expect(result.name).toBe("WalletRequestExpired");
      expect(result.isKnown).toBe(true);
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      expect(result.message).toContain("Wallet request expired");
    });

    it("does not classify arbitrary AA22 bytes as wallet request expiry", () => {
      const result = parseContractError(
        "execution reverted while processing 0xaa22beef00000000000000000000000000000000"
      );

      expect(result.name).not.toBe("WalletRequestExpired");
    });

    it("classifies offline before generic network", () => {
      const result = parseContractError("Device is offline");
      expect(result.name).toBe("Offline");
    });

    it("classifies timeout", () => {
      const result = parseContractError("Request timed out");
      expect(result.name).toBe("TimeoutError");
    });

    it("classifies generic network", () => {
      const result = parseContractError("network error");
      expect(result.name).toBe("NetworkError");
    });

    it("classifies 'failed to fetch' as network", () => {
      const result = parseContractError("Failed to fetch");
      expect(result.name).toBe("NetworkError");
    });
  });

  describe("permission patterns", () => {
    it("classifies generic unauthorized", () => {
      const result = parseContractError("Unauthorized: missing credentials");
      expect(result.name).toBe("Unauthorized");
      expect(result.recoverable).toBe(false);
    });

    it("classifies permission denied", () => {
      const result = parseContractError("permission denied");
      expect(result.name).toBe("Unauthorized");
    });
  });

  describe("revert and validation patterns", () => {
    it("classifies execution reverted without reason", () => {
      const result = parseContractError("execution reverted");
      expect(result.name).toBe("ExecutionReverted");
      expect(result.message).toContain("Transaction would fail");
    });

    it("prefers known signature when error string contains a known contract error name", () => {
      // The signature/name loop runs before the post-signature patterns,
      // so a wrapped revert with a known name wins over the generic revert.
      const result = parseContractError("execution reverted with reason: NotGardenMember");
      expect(result.name).toBe("NotGardenMember");
      expect(result.action).toContain("Please join the garden");
    });

    it("classifies 'Validation failed' as ValidationError with original message", () => {
      const result = parseContractError("Validation failed: missing field");
      expect(result.name).toBe("ValidationError");
      expect(result.message).toContain("missing field");
    });

    it("classifies generic invalid input as ValidationError", () => {
      const result = parseContractError("Invalid input data");
      expect(result.name).toBe("ValidationError");
    });
  });

  describe("error wrapping", () => {
    it("classifies an Error instance with user rejection message", () => {
      const err = new Error("User rejected the request.");
      const result = parseContractError(err);
      expect(result.name).toBe("UserRejected");
    });

    it("classifies a plain object with user rejection message", () => {
      const result = parseContractError({ message: "user denied transaction signature" });
      expect(result.name).toBe("UserRejected");
    });
  });
});

describe("isNotGardenMemberError", () => {
  it("returns true for NotGardenMember error (old selector)", () => {
    expect(isNotGardenMemberError("0x8cb4ae3b")).toBe(true);
  });

  it("returns true for NotGardenMember error (current selector)", () => {
    // 0xfdb31dd5 = keccak256("NotGardenMember()")[0:4]
    expect(isNotGardenMemberError("0xfdb31dd5")).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isNotGardenMemberError("0x42375a1e")).toBe(false);
    expect(isNotGardenMemberError("some error")).toBe(false);
  });
});

describe("isAlreadyGardenerError", () => {
  it("returns true for AlreadyGardener error", () => {
    expect(isAlreadyGardenerError("0x42375a1e")).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isAlreadyGardenerError("0x8cb4ae3b")).toBe(false);
    expect(isAlreadyGardenerError("some error")).toBe(false);
  });
});

describe("formatErrorForToast", () => {
  it("formats known errors with action", () => {
    const parsed = parseContractError("0x8cb4ae3b");
    const result = formatErrorForToast(parsed);

    expect(result).toEqual({
      title: "Not Garden Member",
      message: "You are not a member of this garden. Please join the garden before submitting work",
    });
  });

  it("formats known errors without action", () => {
    const parsed = parseContractError("0x42375a1e");
    const result = formatErrorForToast(parsed);

    expect(result).toEqual({
      title: "Already Gardener",
      message: "You are already a member of this garden",
    });
  });

  it("formats unknown errors", () => {
    const parsed = parseContractError("some unknown error");
    const result = formatErrorForToast(parsed);

    expect(result).toEqual({
      title: "Transaction Failed",
      message: "Transaction failed. Please try again.",
    });
  });
});

describe("parseAndFormatError", () => {
  it("parses and formats in one call", () => {
    const result = parseAndFormatError("0x8cb4ae3b");

    expect(result.title).toBe("Not Garden Member");
    expect(result.message).toContain("You are not a member");
    expect(result.parsed.isKnown).toBe(true);
  });

  it("handles complex error objects", () => {
    // 0xf3aeae14 = keccak256("NotGardenOperator()")[0:4]
    const error = {
      message: "UserOperation failed with error: 0xf3aeae14",
      code: "CALL_EXCEPTION",
    };

    const result = parseAndFormatError(error);

    expect(result.parsed.name).toBe("NotGardenOperator");
    expect(result.title).toContain("Garden Operator");
  });

  it("formats wallet session errors with reconnect guidance", () => {
    const result = parseAndFormatError(new Error("Connector not connected"));

    expect(result.parsed.name).toBe("WalletSessionUnavailable");
    expect(result.title).toBe("Wallet Session Unavailable");
    expect(result.message).toBe(
      "Wallet session unavailable. Disconnect and reconnect your wallet, then try again."
    );
  });
});
