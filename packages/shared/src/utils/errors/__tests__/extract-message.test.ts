/**
 * Error Message Extraction Tests
 */

import { describe, it, expect } from "vitest";
import { extractErrorMessage, extractErrorMessageOr } from "../extract-message";

describe("extractErrorMessage", () => {
  it("returns string errors as-is", () => {
    expect(extractErrorMessage("Simple error")).toBe("Simple error");
  });

  it("returns empty string for empty string input", () => {
    expect(extractErrorMessage("")).toBe("");
  });

  it("extracts message from Error instances", () => {
    expect(extractErrorMessage(new Error("Error instance"))).toBe("Error instance");
  });

  it("extracts message from TypeError instances", () => {
    expect(extractErrorMessage(new TypeError("type error"))).toBe("type error");
  });

  it("extracts message from objects with message property", () => {
    expect(extractErrorMessage({ message: "Object error" })).toBe("Object error");
  });

  it("handles objects with non-string message property", () => {
    expect(extractErrorMessage({ message: 42 })).toBe("42");
  });

  it("stringifies objects without message property", () => {
    expect(extractErrorMessage({ code: 123 })).toBe("[object Object]");
  });

  it("stringifies null", () => {
    expect(extractErrorMessage(null)).toBe("null");
  });

  it("stringifies undefined", () => {
    expect(extractErrorMessage(undefined)).toBe("undefined");
  });

  it("stringifies numbers", () => {
    expect(extractErrorMessage(42)).toBe("42");
    expect(extractErrorMessage(0)).toBe("0");
  });

  it("stringifies booleans", () => {
    expect(extractErrorMessage(true)).toBe("true");
    expect(extractErrorMessage(false)).toBe("false");
  });

  it("handles Error with empty message", () => {
    expect(extractErrorMessage(new Error(""))).toBe("");
  });

  it("handles nested error objects (prefers top-level message)", () => {
    const error = { message: "top level", error: { message: "nested" } };
    expect(extractErrorMessage(error)).toBe("top level");
  });
});

describe("extractErrorMessageOr", () => {
  it("returns extracted message when non-empty", () => {
    expect(extractErrorMessageOr(new Error("Msg"), "Default")).toBe("Msg");
  });

  it("returns stringified value for null (non-empty after String())", () => {
    // String(null) = "null" which is non-empty, so no fallback
    expect(extractErrorMessageOr(null, "Unknown error")).toBe("null");
  });

  it("returns fallback for empty string", () => {
    expect(extractErrorMessageOr("", "Default message")).toBe("Default message");
  });

  it("returns fallback for whitespace-only string", () => {
    expect(extractErrorMessageOr("   ", "Default")).toBe("Default");
  });

  it("returns fallback for Error with empty message", () => {
    expect(extractErrorMessageOr(new Error(""), "Fallback")).toBe("Fallback");
  });

  it("returns extracted message for string errors", () => {
    expect(extractErrorMessageOr("Actual error", "Default")).toBe("Actual error");
  });

  it("returns extracted message for objects with message", () => {
    expect(extractErrorMessageOr({ message: "obj error" }, "Default")).toBe("obj error");
  });
});
