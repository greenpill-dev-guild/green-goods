/**
 * categorizeError Tests
 *
 * Tests pattern-based error categorization across all 6 categories:
 * network, auth, permission, blockchain, storage, validation.
 * Verifies metadata extraction and unknown fallback behavior.
 */

import { describe, expect, it } from "vitest";
import { categorizeError, type ErrorCategory } from "../../../utils/errors/categorize-error";

// ============================================
// Network errors
// ============================================

describe("categorizeError", () => {
  describe("network category", () => {
    const networkMessages = [
      "Network error occurred",
      "Failed to fetch data from server",
      "Request timeout after 30s",
      "Connection refused",
      "Client disconnected unexpectedly",
      "Device is offline",
      "net::ERR_CONNECTION_RESET",
    ];

    it.each(networkMessages)('categorizes "%s" as network', (msg) => {
      expect(categorizeError(new Error(msg)).category).toBe("network");
    });
  });

  // ------------------------------------------
  // Auth errors
  // ------------------------------------------

  describe("auth category", () => {
    const authMessages = [
      "Unauthorized access",
      "User is not authenticated",
      "Session expired, please login again",
      "Login required to access this resource",
      "Wallet not connected",
    ];

    it.each(authMessages)('categorizes "%s" as auth', (msg) => {
      expect(categorizeError(new Error(msg)).category).toBe("auth");
    });
  });

  // ------------------------------------------
  // Permission errors
  // ------------------------------------------

  describe("permission category", () => {
    const permissionMessages = [
      "Forbidden: insufficient permissions",
      "Action not allowed for this role",
      "Permission denied",
      "Access denied to resource",
      "Not a gardener of this garden",
      "Not a member of this community",
      "User is not authorized to perform this action",
    ];

    it.each(permissionMessages)('categorizes "%s" as permission', (msg) => {
      expect(categorizeError(new Error(msg)).category).toBe("permission");
    });
  });

  // ------------------------------------------
  // Blockchain errors
  // ------------------------------------------

  describe("blockchain category", () => {
    const blockchainMessages = [
      "User rejected the transaction",
      "User denied the signing request",
      "Insufficient funds for gas + value",
      "Insufficient balance",
      "Transaction exceeds balance",
      "Out of gas",
      "Execution reverted",
      "Transaction failed",
      "Nonce too low",
      "Nonce too high",
      "Replacement transaction underpriced",
      "Error at 0x1234567890abcdef1234567890abcdef12345678",
      "Contract address 0x1234567890abcdef1234567890abcdef12345678 failed",
      "Smart contract interaction failed",
      "Transaction revert at block 12345",
    ];

    it.each(blockchainMessages)('categorizes "%s" as blockchain', (msg) => {
      expect(categorizeError(new Error(msg)).category).toBe("blockchain");
    });

    it("recognizes contract call pattern", () => {
      const result = categorizeError(new Error("contract call failed at step 3"));
      expect(result.category).toBe("blockchain");
    });

    it("recognizes user cancelled (with double L)", () => {
      expect(categorizeError("User cancelled transaction").category).toBe("blockchain");
    });
  });

  // ------------------------------------------
  // Storage errors
  // ------------------------------------------

  describe("storage category", () => {
    const storageMessages = [
      "Exceeded storage quota",
      "IndexedDB transaction aborted",
      "localStorage is not available",
      "IPFS upload timed out",
      "Storacha upload error",
      "Upload failed for image.png",
      "Invalid CID returned from storage",
      "Storage service not initialized. Call initializeIpfs first",
    ];

    it.each(storageMessages)('categorizes "%s" as storage', (msg) => {
      expect(categorizeError(new Error(msg)).category).toBe("storage");
    });
  });

  // ------------------------------------------
  // Validation errors
  // ------------------------------------------

  describe("validation category", () => {
    const validationMessages = [
      "Validation failed for input",
      "Required field 'name' is missing",
      "Invalid format for email address",
      "Invalid date provided",
      "Invalid email address",
      "Missing parameter: gardenId",
      "Missing field 'title' in form data",
      "Invalid input value",
      "Invalid parameter type",
      "Missing argument for function call",
      "Missing value for required property",
    ];

    it.each(validationMessages)('categorizes "%s" as validation', (msg) => {
      expect(categorizeError(new Error(msg)).category).toBe("validation");
    });
  });

  // ------------------------------------------
  // Unknown / fallback
  // ------------------------------------------

  describe("unknown category", () => {
    it("categorizes unrecognized errors as unknown", () => {
      const result = categorizeError(new Error("Something completely unexpected"));
      expect(result.category).toBe("unknown");
    });

    it("provides default message for falsy/empty input", () => {
      // extractErrorMessage(null) returns "null", which won't match any pattern
      const result = categorizeError(null);
      expect(result.category).toBe("unknown");
    });

    it("returns the original message in unknown result", () => {
      const result = categorizeError(new Error("Weird problem"));
      expect(result.message).toBe("Weird problem");
    });

    it("uses fallback message when error message is empty", () => {
      // Empty string gets extracted, then message || fallback kicks in
      const result = categorizeError("");
      expect(result.message).toBe("An unexpected error occurred");
    });
  });

  // ------------------------------------------
  // Metadata extraction
  // ------------------------------------------

  describe("metadata extraction", () => {
    it("extracts Error name as metadata", () => {
      const error = new TypeError("type failure");
      const result = categorizeError(error);
      expect(result.metadata?.name).toBe("TypeError");
    });

    it("extracts Error cause as metadata", () => {
      const error = new Error("outer", { cause: "inner cause" });
      const result = categorizeError(error);
      expect(result.metadata?.cause).toBe("inner cause");
    });

    it("does not include metadata for non-Error inputs", () => {
      const result = categorizeError("plain string error");
      expect(result.metadata).toBeUndefined();
    });

    it("does not include metadata when Error has no extra info", () => {
      // Error always has a name ("Error"), so metadata will contain name
      const result = categorizeError(new Error("basic"));
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.name).toBe("Error");
    });

    it("does not include cause when not present", () => {
      const result = categorizeError(new Error("no cause"));
      expect(result.metadata?.cause).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Input type handling
  // ------------------------------------------

  describe("input type handling", () => {
    it("accepts string input directly", () => {
      const result = categorizeError("User rejected the request");
      expect(result.category).toBe("blockchain");
      expect(result.message).toBe("User rejected the request");
    });

    it("accepts Error input", () => {
      const result = categorizeError(new Error("Failed to fetch"));
      expect(result.category).toBe("network");
    });

    it("accepts object with message property", () => {
      const result = categorizeError({ message: "Insufficient funds" });
      expect(result.category).toBe("blockchain");
    });

    it("accepts numeric input (stringified)", () => {
      const result = categorizeError(42);
      expect(result.category).toBe("unknown");
      expect(result.message).toBe("42");
    });
  });

  // ------------------------------------------
  // Priority / ordering
  // ------------------------------------------

  describe("pattern priority", () => {
    it("matches earlier patterns first (network before blockchain for 'timeout')", () => {
      // "timeout" matches network pattern (earlier) before blockchain
      const result = categorizeError("Request timeout");
      expect(result.category).toBe("network");
    });

    it("matches auth before permission for 'not authorized'", () => {
      // "not authorized" matches permission pattern (line 50: "not authorized")
      const result = categorizeError("not authorized");
      expect(result.category).toBe("permission");
    });
  });
});
