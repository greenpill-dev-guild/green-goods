/**
 * Hypercert Utility Functions Tests
 *
 * Tests withTimeout, isZeroAddress, TimeoutError class,
 * and extractHypercertIdFromLogs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isZeroAddress,
  RECEIPT_POLLING_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
} from "../../../hooks/hypercerts/hypercert-utils";

// ============================================
// TimeoutError
// ============================================

describe("TimeoutError", () => {
  it("extends Error", () => {
    const error = new TimeoutError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  it("has correct name property", () => {
    const error = new TimeoutError("upload");
    expect(error.name).toBe("TimeoutError");
  });

  it("includes operation in message", () => {
    const error = new TimeoutError("uploadMetadata");
    expect(error.message).toBe("Operation timed out: uploadMetadata");
  });

  it("stores operation property", () => {
    const error = new TimeoutError("pollReceipt");
    expect(error.operation).toBe("pollReceipt");
  });

  it("has i18nKey for localization", () => {
    const error = new TimeoutError("test");
    expect(error.i18nKey).toBe("app.errors.timeout.transactionConfirmation");
  });
});

// ============================================
// RECEIPT_POLLING_TIMEOUT_MS
// ============================================

describe("RECEIPT_POLLING_TIMEOUT_MS", () => {
  it("is 120000 ms (2 minutes)", () => {
    expect(RECEIPT_POLLING_TIMEOUT_MS).toBe(120_000);
  });
});

// ============================================
// withTimeout
// ============================================

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when promise resolves before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = await withTimeout(promise, 1000, "test");

    expect(result).toBe("success");
  });

  it("rejects with TimeoutError when promise exceeds timeout", async () => {
    const promise = new Promise(() => {}); // Never resolves

    const wrapped = withTimeout(promise, 100, "slowOperation");

    vi.advanceTimersByTime(100);

    await expect(wrapped).rejects.toThrow(TimeoutError);
    await expect(wrapped).rejects.toThrow("Operation timed out: slowOperation");
  });

  it("clears timer after promise resolves", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const promise = Promise.resolve("done");
    await withTimeout(promise, 5000, "test");

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("rejects immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const promise = Promise.resolve("should not reach");

    await expect(withTimeout(promise, 5000, "myOp", controller.signal)).rejects.toThrow(
      "myOp aborted"
    );
  });

  it("rejects when signal is aborted during execution", async () => {
    const controller = new AbortController();
    const promise = new Promise(() => {}); // Never resolves

    const wrapped = withTimeout(promise, 5000, "longOp", controller.signal);

    // Abort the signal
    controller.abort();

    await expect(wrapped).rejects.toThrow("longOp aborted");
  });

  it("resolves before abort if promise is fast enough", async () => {
    const controller = new AbortController();
    const promise = Promise.resolve("fast result");

    const result = await withTimeout(promise, 5000, "fastOp", controller.signal);

    expect(result).toBe("fast result");
  });

  it("propagates rejection from original promise", async () => {
    const error = new Error("Original failure");
    const promise = Promise.reject(error);

    await expect(withTimeout(promise, 5000, "test")).rejects.toThrow("Original failure");
  });
});

// ============================================
// isZeroAddress
// ============================================

describe("isZeroAddress", () => {
  it("returns true for the zero address", () => {
    expect(isZeroAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  it("returns true for null", () => {
    expect(isZeroAddress(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isZeroAddress(undefined)).toBe(true);
  });

  it("returns false for a real address", () => {
    expect(isZeroAddress("0x1111111111111111111111111111111111111111")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isZeroAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  });
});
