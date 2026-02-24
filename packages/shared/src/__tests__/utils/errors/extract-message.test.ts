/**
 * extractErrorMessage & extractErrorMessageOr Tests
 *
 * Tests message extraction from all supported input types:
 * string, Error, object with message, primitives, null/undefined.
 */

import { describe, expect, it } from "vitest";
import { extractErrorMessage, extractErrorMessageOr } from "../../../utils/errors/extract-message";

// ============================================
// extractErrorMessage
// ============================================

describe("extractErrorMessage", () => {
  // ------------------------------------------
  // String inputs
  // ------------------------------------------

  describe("string inputs", () => {
    it("returns string errors as-is", () => {
      expect(extractErrorMessage("Simple error")).toBe("Simple error");
    });

    it("returns empty string as-is", () => {
      expect(extractErrorMessage("")).toBe("");
    });

    it("preserves whitespace in strings", () => {
      expect(extractErrorMessage("  leading and trailing  ")).toBe("  leading and trailing  ");
    });
  });

  // ------------------------------------------
  // Error instances
  // ------------------------------------------

  describe("Error instances", () => {
    it("extracts message from Error objects", () => {
      expect(extractErrorMessage(new Error("Error instance"))).toBe("Error instance");
    });

    it("extracts message from TypeError", () => {
      expect(extractErrorMessage(new TypeError("type problem"))).toBe("type problem");
    });

    it("extracts message from RangeError", () => {
      expect(extractErrorMessage(new RangeError("out of range"))).toBe("out of range");
    });

    it("handles Error with empty message", () => {
      expect(extractErrorMessage(new Error(""))).toBe("");
    });
  });

  // ------------------------------------------
  // Object with message property
  // ------------------------------------------

  describe("object with message property", () => {
    it("extracts message from plain object", () => {
      expect(extractErrorMessage({ message: "Object error" })).toBe("Object error");
    });

    it("stringifies non-string message property", () => {
      expect(extractErrorMessage({ message: 42 })).toBe("42");
    });

    it("stringifies null message property", () => {
      expect(extractErrorMessage({ message: null })).toBe("null");
    });

    it("stringifies boolean message property", () => {
      expect(extractErrorMessage({ message: false })).toBe("false");
    });
  });

  // ------------------------------------------
  // Other values (String(value) fallback)
  // ------------------------------------------

  describe("other values", () => {
    it("stringifies numbers", () => {
      expect(extractErrorMessage(42)).toBe("42");
    });

    it("stringifies null", () => {
      expect(extractErrorMessage(null)).toBe("null");
    });

    it("stringifies undefined", () => {
      expect(extractErrorMessage(undefined)).toBe("undefined");
    });

    it("stringifies boolean", () => {
      expect(extractErrorMessage(true)).toBe("true");
    });

    it("stringifies object without message", () => {
      expect(extractErrorMessage({ code: 123 })).toBe("[object Object]");
    });

    it("stringifies array", () => {
      expect(extractErrorMessage(["a", "b"])).toBe("a,b");
    });

    it("stringifies bigint", () => {
      expect(extractErrorMessage(BigInt(999))).toBe("999");
    });
  });
});

// ============================================
// extractErrorMessageOr
// ============================================

describe("extractErrorMessageOr", () => {
  it("returns extracted message when non-empty", () => {
    expect(extractErrorMessageOr(new Error("Msg"), "Default")).toBe("Msg");
  });

  it("returns extracted string when non-empty", () => {
    expect(extractErrorMessageOr("Hello", "Default")).toBe("Hello");
  });

  it("does not use fallback for null (stringified to 'null' which is non-empty)", () => {
    // String(null) = "null" — a non-empty string, so fallback is not used
    expect(extractErrorMessageOr(null, "Unknown error")).toBe("null");
  });

  it("returns fallback for empty string", () => {
    expect(extractErrorMessageOr("", "Default message")).toBe("Default message");
  });

  it("returns fallback for whitespace-only string", () => {
    expect(extractErrorMessageOr("   ", "Fallback")).toBe("Fallback");
  });

  it("returns fallback for Error with empty message", () => {
    expect(extractErrorMessageOr(new Error(""), "Fallback")).toBe("Fallback");
  });

  it("does not use fallback when message has content", () => {
    expect(extractErrorMessageOr({ message: "content" }, "Fallback")).toBe("content");
  });
});
