/**
 * useDepositForm Hook Tests
 * @vitest-environment jsdom
 *
 * Tests pure form validation logic for vault deposits.
 * Minimal mocking needed — only react-hook-form + viem parseUnits are real.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useDepositForm } = await import("../../../hooks/vault/useDepositForm");

describe("hooks/vault/useDepositForm", () => {
  it("initializes with empty amount, amountBigInt 0n", () => {
    const { result } = renderHook(() => useDepositForm({ decimals: 18 }));

    expect(result.current.amount).toBe("");
    expect(result.current.amountBigInt).toBe(0n);
    expect(result.current.hasBlockingError).toBe(false);
  });

  it("parses valid amount to bigint (1.5 with decimals=18)", async () => {
    const { result } = renderHook(
      () => useDepositForm({ decimals: 18, balance: 10000000000000000000n }) // 10e18 balance
    );

    act(() => {
      result.current.form.setValue("amount", "1.5", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.amountBigInt).toBe(1500000000000000000n); // 1.5e18
    });
  });

  it("returns 0n for empty input", () => {
    const { result } = renderHook(() => useDepositForm({ decimals: 18 }));

    act(() => {
      result.current.form.setValue("amount", "", { shouldValidate: true });
    });

    expect(result.current.amountBigInt).toBe(0n);
    expect(result.current.hasBlockingError).toBe(false);
  });

  it("validates amount exceeding balance -> hasBlockingError true", async () => {
    const balance = 1000000000000000000n; // 1e18 = 1 token

    const { result } = renderHook(() => useDepositForm({ decimals: 18, balance }));

    act(() => {
      result.current.form.setValue("amount", "2", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.hasBlockingError).toBe(true);
      expect(result.current.amountErrorKey).toBe("app.treasury.insufficientBalance");
    });
  });

  it("validates non-positive amount (0) -> error key", async () => {
    const { result } = renderHook(() =>
      useDepositForm({ decimals: 18, balance: 10000000000000000000n })
    );

    act(() => {
      result.current.form.setValue("amount", "0", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.hasBlockingError).toBe(true);
      expect(result.current.amountErrorKey).toBe("app.treasury.amountMustBeGreaterThanZero");
    });
  });

  it("validates too many decimal places", async () => {
    const { result } = renderHook(
      () => useDepositForm({ decimals: 6, balance: 10000000n }) // 10 tokens with 6 decimals
    );

    act(() => {
      // 7 decimal places for a token with 6 decimals
      result.current.form.setValue("amount", "1.1234567", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.hasBlockingError).toBe(true);
      expect(result.current.amountErrorKey).toBe("app.treasury.tooManyDecimals");
    });
  });

  it("accepts valid amount within balance -> no error", async () => {
    const balance = 5000000000000000000n; // 5e18 = 5 tokens

    const { result } = renderHook(() => useDepositForm({ decimals: 18, balance }));

    act(() => {
      result.current.form.setValue("amount", "3.5", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.amountBigInt).toBe(3500000000000000000n);
    });
    expect(result.current.hasBlockingError).toBe(false);
    expect(result.current.amountErrorKey).toBeNull();
  });

  it("resetAmount clears the form", async () => {
    const { result } = renderHook(() =>
      useDepositForm({ decimals: 18, balance: 10000000000000000000n })
    );

    act(() => {
      result.current.form.setValue("amount", "5", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.amountBigInt).toBe(5000000000000000000n);
    });

    act(() => {
      result.current.resetAmount();
    });

    await waitFor(() => {
      expect(result.current.amount).toBe("");
      expect(result.current.amountBigInt).toBe(0n);
    });
  });

  it("schema updates when decimals/balance props change", async () => {
    const { result, rerender } = renderHook(
      (props: { decimals: number; balance: bigint }) => useDepositForm(props),
      {
        initialProps: { decimals: 18, balance: 10000000000000000000n },
      }
    );

    // Valid with 18 decimals
    act(() => {
      result.current.form.setValue("amount", "1.123456789012345678", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.hasBlockingError).toBe(false);
    });

    // Rerender with 6 decimals — same input now has too many decimals
    rerender({ decimals: 6, balance: 10000000n });

    act(() => {
      result.current.form.setValue("amount", "1.1234567", { shouldValidate: true });
    });

    await waitFor(() => {
      expect(result.current.hasBlockingError).toBe(true);
      expect(result.current.amountErrorKey).toBe("app.treasury.tooManyDecimals");
    });
  });
});
