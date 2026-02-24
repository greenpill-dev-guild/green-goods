/**
 * Error Categorization Tests
 */

import { describe, it, expect } from "vitest";
import { categorizeError, type ErrorCategory } from "../categorize-error";

describe("categorizeError", () => {
  describe("network errors", () => {
    it.each([
      "Network error occurred",
      "fetch failed",
      "Connection timeout",
      "Request timeout exceeded",
      "Client disconnected",
      "Device is offline",
      "failed to fetch",
      "net::ERR_CONNECTION_REFUSED",
    ])('categorizes "%s" as network', (message) => {
      const result = categorizeError(message);
      expect(result.category).toBe("network");
      expect(result.message).toBe(message);
    });
  });

  describe("auth errors", () => {
    it.each([
      "Unauthorized access",
      "User is unauthenticated",
      "Not authenticated",
      "Session expired, please login again",
      "Login required to continue",
      "Wallet not connected",
    ])('categorizes "%s" as auth', (message) => {
      expect(categorizeError(message).category).toBe("auth");
    });
  });

  describe("permission errors", () => {
    it.each([
      "Forbidden: insufficient privileges",
      "Action not allowed",
      "Permission denied",
      "Access denied for this resource",
      "User is not a gardener",
      "Not a member of this garden",
      "Not authorized to perform this action",
    ])('categorizes "%s" as permission', (message) => {
      expect(categorizeError(message).category).toBe("permission");
    });
  });

  describe("blockchain errors", () => {
    it.each([
      "User rejected the transaction",
      "User denied transaction signature",
      "User cancelled the request",
      "Insufficient funds for gas",
      "Insufficient balance",
      "Amount exceeds balance",
      "Out of gas during execution",
      "Execution reverted",
      "Transaction failed",
      "Nonce too low",
      "Nonce too high",
      "Replacement transaction underpriced",
    ])('categorizes "%s" as blockchain', (message) => {
      expect(categorizeError(message).category).toBe("blockchain");
    });

    it("categorizes messages containing Ethereum addresses as blockchain", () => {
      const result = categorizeError("Error at 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e");
      expect(result.category).toBe("blockchain");
    });

    it("categorizes messages containing transaction hashes as blockchain", () => {
      const result = categorizeError(
        "Tx 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890 failed"
      );
      expect(result.category).toBe("blockchain");
    });

    it("categorizes 'revert' keyword as blockchain", () => {
      expect(categorizeError("Call revert exception").category).toBe("blockchain");
    });

    it("categorizes 'smart contract' keyword as blockchain", () => {
      expect(categorizeError("smart contract interaction failed").category).toBe("blockchain");
    });

    it("categorizes 'contract call' as blockchain", () => {
      expect(categorizeError("contract call failed").category).toBe("blockchain");
    });
  });

  describe("storage errors", () => {
    it.each([
      "Storage quota exceeded",
      "IndexedDB error",
      "localStorage is not available",
      "IPFS upload failed",
      "Storacha client error",
      "Upload failed: file too large",
      "Invalid CID format",
      "IPFS not initialized. Call initializeIpfs first.",
    ])('categorizes "%s" as storage', (message) => {
      expect(categorizeError(message).category).toBe("storage");
    });
  });

  describe("validation errors", () => {
    it.each([
      "Validation failed for field 'name'",
      "Required field is missing",
      "Invalid format for email",
      "Invalid date provided",
      "Missing parameter: gardenId",
      "Missing field: actionUID",
    ])('categorizes "%s" as validation', (message) => {
      expect(categorizeError(message).category).toBe("validation");
    });
  });

  describe("unknown errors", () => {
    it("defaults to unknown for unrecognized messages", () => {
      const result = categorizeError("Something completely unexpected happened");
      expect(result.category).toBe("unknown");
    });

    it("stringifies null as message (extractErrorMessage returns 'null')", () => {
      const result = categorizeError(null);
      expect(result.category).toBe("unknown");
      expect(result.message).toBe("null");
    });

    it("stringifies undefined as message (extractErrorMessage returns 'undefined')", () => {
      const result = categorizeError(undefined);
      expect(result.category).toBe("unknown");
      expect(result.message).toBe("undefined");
    });

    it("uses fallback message for empty string", () => {
      // Empty string from extractErrorMessage triggers the fallback
      const result = categorizeError("");
      expect(result.category).toBe("unknown");
      expect(result.message).toBe("An unexpected error occurred");
    });
  });

  describe("metadata extraction", () => {
    it("extracts name from Error instances", () => {
      const error = new TypeError("cannot read properties");
      const result = categorizeError(error);
      expect(result.metadata?.name).toBe("TypeError");
    });

    it("extracts cause from Error instances", () => {
      const cause = new Error("root cause");
      const error = new Error("wrapper", { cause });
      const result = categorizeError(error);
      expect(result.metadata?.cause).toContain("root cause");
    });

    it("does not include metadata for plain string errors", () => {
      const result = categorizeError("simple error");
      expect(result.metadata).toBeUndefined();
    });

    it("does not include metadata for non-Error objects", () => {
      const result = categorizeError({ message: "object error" });
      expect(result.metadata).toBeUndefined();
    });
  });

  describe("return shape", () => {
    it("always returns message, category, and optional metadata", () => {
      const result = categorizeError("test error");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("category");
      expect(["message", "category", "metadata"]).toEqual(
        expect.arrayContaining(Object.keys(result))
      );
    });

    it("preserves the original message in the result", () => {
      const result = categorizeError("User rejected the transaction");
      expect(result.message).toBe("User rejected the transaction");
    });
  });
});
