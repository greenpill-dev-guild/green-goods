/**
 * Tests for contract error recovery fields
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import { parseContractError } from "../../utils/errors/contract-errors";

describe("contract error recovery fields", () => {
  describe("recoverable field", () => {
    it("should mark NotGardenMember as not recoverable", () => {
      const result = parseContractError("0x8cb4ae3b");
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("join-garden");
    });

    it("should mark EmptyRevert as recoverable", () => {
      const result = parseContractError("0x");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("should mark unknown errors as recoverable (transient)", () => {
      const result = parseContractError("Some random error");
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });

    it("should mark network errors as recoverable", () => {
      const result = parseContractError(new Error("Network connection failed"));
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      expect(result.name).toBe("NetworkError");
    });

    it("should mark timeout errors as recoverable", () => {
      const result = parseContractError(new Error("Request timeout"));
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      expect(result.name).toBe("NetworkError");
    });

    it("should mark user rejection as recoverable", () => {
      const result = parseContractError(new Error("User rejected the request"));
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
      expect(result.name).toBe("UserRejected");
    });

    it("should mark permission errors as not recoverable", () => {
      // 0xd8cae624 = keccak256("NotGardenOwner()")[0:4]
      const result = parseContractError("0xd8cae624");
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("contact-support");
    });
  });

  describe("suggestedAction field", () => {
    it("should suggest join-garden for membership errors", () => {
      // Test both legacy and current selectors
      expect(parseContractError("0x8cb4ae3b").suggestedAction).toBe("join-garden"); // Legacy (NotGardenerAccount)
      expect(parseContractError("0xfdb31dd5").suggestedAction).toBe("join-garden"); // Current (NotGardenMember)
    });

    it("should suggest contact-support for permission errors", () => {
      expect(parseContractError("0xd8cae624").suggestedAction).toBe("contact-support"); // NotGardenOwner
      expect(parseContractError("0xf3aeae14").suggestedAction).toBe("contact-support"); // NotGardenOperator
      expect(parseContractError("0xdb926eba").suggestedAction).toBe("contact-support"); // InvalidInvite
    });

    it("should suggest retry for transient errors", () => {
      expect(parseContractError("Some unknown error").suggestedAction).toBe("retry");
      expect(parseContractError(new Error("Network error")).suggestedAction).toBe("retry");
    });
  });

  describe("known errors with recovery info", () => {
    const testCases: Array<{
      signature: string;
      expectedName: string;
      expectedRecoverable: boolean;
      expectedSuggestedAction?: string;
    }> = [
      {
        signature: "0x8cb4ae3b", // Legacy selector (NotGardenerAccount)
        expectedName: "NotGardenMember",
        expectedRecoverable: false,
        expectedSuggestedAction: "join-garden",
      },
      {
        signature: "0xd8cae624", // keccak256("NotGardenOwner()")[0:4]
        expectedName: "NotGardenOwner",
        expectedRecoverable: false,
        expectedSuggestedAction: "contact-support",
      },
      {
        signature: "0x42375a1e",
        expectedName: "AlreadyGardener",
        expectedRecoverable: false,
        // No suggested action - informational error
      },
      {
        signature: "0x2ff9aed3",
        expectedName: "NotActiveAction",
        expectedRecoverable: false,
        // No suggested action - need to select different action
      },
      {
        signature: "0xf3aeae14", // keccak256("NotGardenOperator()")[0:4]
        expectedName: "NotGardenOperator",
        expectedRecoverable: false,
        expectedSuggestedAction: "contact-support",
      },
    ];

    testCases.forEach(
      ({ signature, expectedName, expectedRecoverable, expectedSuggestedAction }) => {
        it(`should parse ${expectedName} correctly`, () => {
          const result = parseContractError(signature);
          expect(result.name).toBe(expectedName);
          expect(result.recoverable).toBe(expectedRecoverable);
          expect(result.isKnown).toBe(true);
          if (expectedSuggestedAction) {
            expect(result.suggestedAction).toBe(expectedSuggestedAction);
          }
        });
      }
    );
  });

  describe("error object handling", () => {
    it("should handle error objects with message property", () => {
      const errorObj = { message: "User rejected the request", code: 4001 };
      const result = parseContractError(errorObj);
      expect(result.name).toBe("UserRejected");
      expect(result.recoverable).toBe(true);
    });

    it("should handle nested error messages", () => {
      const error = new Error("Connection timeout occurred");
      const result = parseContractError(error);
      expect(result.recoverable).toBe(true);
      expect(result.suggestedAction).toBe("retry");
    });
  });

  describe("validation errors", () => {
    it("should handle validation failed errors", () => {
      const result = parseContractError("Validation failed: Invalid input");
      expect(result.name).toBe("Validation Error");
      expect(result.isKnown).toBe(true);
      expect(result.recoverable).toBe(false);
      expect(result.suggestedAction).toBe("contact-support");
    });
  });

  describe("ParsedContractError type completeness", () => {
    it("should always include recoverable field", () => {
      // Test various error types
      const errors = ["0x8cb4ae3b", "unknown error", new Error("test"), { message: "test" }];

      errors.forEach((error) => {
        const result = parseContractError(error);
        expect(typeof result.recoverable).toBe("boolean");
      });
    });
  });
});
