/**
 * Contract Error Parsing Tests
 */

import { describe, it, expect } from "vitest";
import {
  parseContractError,
  isNotGardenMemberError,
  isNotGardenerError,
  isAlreadyGardenerError,
  formatErrorForToast,
  parseAndFormatError,
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
    });
  });

  it("parses NotGardenMember error code (new selector)", () => {
    const result = parseContractError("0x1648fd01");

    expect(result).toEqual({
      raw: "0x1648fd01",
      name: "NotGardenMember",
      message: "You are not a member of this garden",
      action: "Please join the garden before submitting work",
      isKnown: true,
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
});

describe("isNotGardenMemberError", () => {
  it("returns true for NotGardenMember error (old selector)", () => {
    expect(isNotGardenMemberError("0x8cb4ae3b")).toBe(true);
  });

  it("returns true for NotGardenMember error (new selector)", () => {
    expect(isNotGardenMemberError("0x1648fd01")).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isNotGardenMemberError("0x42375a1e")).toBe(false);
    expect(isNotGardenMemberError("some error")).toBe(false);
  });
});

describe("isNotGardenerError (deprecated)", () => {
  it("still works for backward compatibility", () => {
    expect(isNotGardenerError("0x8cb4ae3b")).toBe(true);
    expect(isNotGardenerError("0x42375a1e")).toBe(false);
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
    const error = {
      message: "UserOperation failed with error: 0x5d91fb09",
      code: "CALL_EXCEPTION",
    };

    const result = parseAndFormatError(error);

    expect(result.parsed.name).toBe("NotGardenOperator");
    expect(result.title).toContain("Garden Operator");
  });
});
