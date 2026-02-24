/**
 * User-Friendly Error Message Tests
 */

import { describe, it, expect } from "vitest";
import {
  formatUserError,
  formatJobError,
  formatWalletError,
  USER_FRIENDLY_ERRORS,
} from "../user-messages";

describe("USER_FRIENDLY_ERRORS", () => {
  it("has entries for access control errors", () => {
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("gardener");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("permission");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("unauthorized");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("not a gardener");
  });

  it("has entries for network errors", () => {
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("network");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("offline");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("timeout");
  });

  it("has entries for transaction errors", () => {
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("user rejected");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("insufficient funds");
    expect(USER_FRIENDLY_ERRORS).toHaveProperty("nonce");
  });
});

describe("formatUserError", () => {
  describe("access control patterns", () => {
    it("formats gardener permission errors (matches 'gardener' pattern first)", () => {
      // "Not a gardener in this garden" contains "gardener" which matches before "not a gardener"
      // because USER_FRIENDLY_ERRORS is iterated in insertion order
      expect(formatUserError("Not a gardener in this garden")).toBe(
        "You don't have permission to submit work to this garden"
      );
    });

    it("formats 'not a gardener' exact pattern", () => {
      // When the message is exactly "not a gardener", the "gardener" pattern still matches first
      expect(formatUserError("not a gardener")).toBe(
        "You don't have permission to submit work to this garden"
      );
    });

    it("formats unauthorized errors", () => {
      expect(formatUserError("Unauthorized: missing credentials")).toContain("not authorized");
    });

    it("formats permission errors", () => {
      expect(formatUserError("Permission check failed")).toContain("Permission denied");
    });
  });

  describe("network patterns", () => {
    it("formats network errors", () => {
      const result = formatUserError("Network error while fetching");
      expect(result).toContain("Network");
    });

    it("formats offline errors", () => {
      expect(formatUserError("Device is offline")).toContain("offline");
    });

    it("formats timeout errors", () => {
      expect(formatUserError("Request timeout exceeded")).toContain("timed out");
    });
  });

  describe("transaction patterns", () => {
    it("formats user rejection", () => {
      expect(formatUserError("User rejected the transaction")).toBe(
        "Transaction cancelled by user"
      );
    });

    it("formats insufficient funds", () => {
      expect(formatUserError("Insufficient funds for gas")).toBe("Insufficient funds for gas");
    });

    it("formats nonce errors", () => {
      expect(formatUserError("Nonce too low")).toContain("Transaction conflict");
    });

    it("formats revert errors", () => {
      expect(formatUserError("Execution reverted")).toContain("fail");
    });
  });

  describe("storage patterns", () => {
    it("formats quota errors", () => {
      expect(formatUserError("Quota exceeded")).toContain("quota");
    });

    it("formats storage errors", () => {
      expect(formatUserError("Storage write failed")).toContain("Storage");
    });
  });

  describe("validation patterns", () => {
    it("formats validation errors", () => {
      expect(formatUserError("Validation failed: missing field")).toContain(
        "check your submission"
      );
    });

    it("formats invalid data errors", () => {
      expect(formatUserError("Invalid input data")).toContain("Invalid data");
    });
  });

  describe("fallback behavior", () => {
    it("returns the original message for unrecognized errors", () => {
      const originalMessage = "Something completely unique happened XYZ123";
      expect(formatUserError(originalMessage)).toBe(originalMessage);
    });

    it("handles Error objects", () => {
      const error = new Error("User rejected the transaction");
      expect(formatUserError(error)).toBe("Transaction cancelled by user");
    });

    it("handles plain objects with message", () => {
      expect(formatUserError({ message: "insufficient funds" })).toBe("Insufficient funds for gas");
    });

    it("handles null", () => {
      const result = formatUserError(null);
      expect(typeof result).toBe("string");
    });

    it("handles undefined", () => {
      const result = formatUserError(undefined);
      expect(typeof result).toBe("string");
    });
  });

  describe("case insensitivity", () => {
    it("matches patterns regardless of case", () => {
      expect(formatUserError("USER REJECTED the request")).toBe("Transaction cancelled by user");
    });

    it("matches mixed case patterns", () => {
      expect(formatUserError("Insufficient Funds")).toBe("Insufficient funds for gas");
    });
  });
});

describe("formatJobError", () => {
  it("delegates to formatUserError", () => {
    expect(formatJobError("User rejected the transaction")).toBe("Transaction cancelled by user");
  });

  it("returns original message for unrecognized errors", () => {
    expect(formatJobError("Custom job error ABC")).toBe("Custom job error ABC");
  });
});

describe("formatWalletError", () => {
  it("formats user rejection", () => {
    expect(formatWalletError("user rejected the transaction")).toBe(
      "Transaction cancelled by user"
    );
    expect(formatWalletError("user denied the signature")).toBe("Transaction cancelled by user");
  });

  it("formats insufficient funds", () => {
    expect(formatWalletError("insufficient funds for gas")).toBe("Insufficient funds for gas");
  });

  it("formats nonce errors", () => {
    expect(formatWalletError("nonce too low")).toBe("Transaction conflict - please try again");
  });

  it("formats network errors", () => {
    expect(formatWalletError("network error")).toBe("Network error - please check your connection");
  });

  it("formats timeout errors", () => {
    expect(formatWalletError("transaction timeout")).toBe(
      "Transaction timed out - please try again"
    );
  });

  it("formats reverted errors without reason", () => {
    expect(formatWalletError("execution reverted")).toBe(
      "Transaction would fail. Make sure you're a member of the selected garden."
    );
  });

  it("skips wallet revert handler when reason is present, falls to formatUserError", () => {
    // formatWalletError checks: lowerMessage.includes("reverted") && !message.includes("reason")
    // Since "reason" is present, the wallet-specific revert path is skipped.
    // formatUserError then scans USER_FRIENDLY_ERRORS in insertion order.
    // Lowered: "execution reverted with reason: notgardenmember"
    // "gardener" is NOT a substring of "notgardenmember" (garden+member, not garden+er)
    // "notgardenmember" IS an exact key match -> maps to the membership message
    const msg = "execution reverted with reason: NotGardenMember";
    const result = formatWalletError(msg);
    expect(result).toBe("You're not a member of this garden. Please join from your profile.");
  });

  it("handles Error objects", () => {
    const error = new Error("User rejected the transaction");
    expect(formatWalletError(error)).toBe("Transaction cancelled by user");
  });

  it("falls back to formatUserError for other patterns", () => {
    const error = "Storage quota exceeded";
    expect(formatWalletError(error)).toContain("quota");
  });

  it("returns original message for unrecognized wallet errors", () => {
    const msg = "Something completely unknown XYZ";
    expect(formatWalletError(msg)).toBe(msg);
  });
});
