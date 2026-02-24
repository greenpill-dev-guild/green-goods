/**
 * ValidationError Tests
 */

import { describe, it, expect } from "vitest";
import { ValidationError } from "../validation-error";

describe("ValidationError", () => {
  it("creates an error with the correct message", () => {
    const error = new ValidationError("gardenId is required");
    expect(error.message).toBe("gardenId is required");
  });

  it("has the name 'ValidationError'", () => {
    const error = new ValidationError("test");
    expect(error.name).toBe("ValidationError");
  });

  it("is an instance of Error", () => {
    const error = new ValidationError("test");
    expect(error).toBeInstanceOf(Error);
  });

  it("is an instance of ValidationError", () => {
    const error = new ValidationError("test");
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("has a stack trace", () => {
    const error = new ValidationError("test");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ValidationError");
  });

  it("can be caught as Error", () => {
    let caught: Error | null = null;
    try {
      throw new ValidationError("precondition failed");
    } catch (e) {
      if (e instanceof Error) caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught?.message).toBe("precondition failed");
  });

  it("can be distinguished from regular Error", () => {
    const validationErr = new ValidationError("bad input");
    const regularErr = new Error("bad input");

    expect(validationErr instanceof ValidationError).toBe(true);
    expect(regularErr instanceof ValidationError).toBe(false);
  });
});
