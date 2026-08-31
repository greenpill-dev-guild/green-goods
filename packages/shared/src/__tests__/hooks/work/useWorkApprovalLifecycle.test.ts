/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_WORK_APPROVAL_STORAGE_KEY,
  useWorkApprovalLifecycle,
} from "../../../hooks/work/useWorkApprovalLifecycle";
import { TransactionReceiptTimeoutError } from "../../../modules/work/wallet-submission/receipt";

const TX_HASH = `0x${"1".repeat(64)}` as `0x${string}`;

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("hooks/work/useWorkApprovalLifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists only the non-sensitive state needed to resume a wallet approval", () => {
    const { result } = renderHook(() =>
      useWorkApprovalLifecycle({
        onConfirmed: vi.fn(),
        onComplete: vi.fn(),
        waitForReceipt: vi.fn(),
      })
    );

    act(() => {
      result.current.begin({
        approved: false,
        chainId: 11155111,
        gardenId: "garden-1",
        workUID: "work-1",
      });
      result.current.recordWalletStage({ stage: "broadcast", txHash: TX_HASH });
    });

    const persisted = localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted!)).toEqual(
      expect.objectContaining({
        approved: false,
        chainId: 11155111,
        gardenId: "garden-1",
        stage: "broadcast",
        txHash: TX_HASH,
        workUID: "work-1",
      })
    );
    expect(persisted).not.toContain("gardenerAddress");
    expect(persisted).not.toContain("walletAddress");
    expect(persisted).not.toContain("feedback");
  });

  it("waits while hidden and reconciles a broadcast transaction when the PWA returns", async () => {
    const waitForReceipt = vi.fn().mockResolvedValue({ status: "success" });
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const onStage = vi.fn();
    const { result } = renderHook(() =>
      useWorkApprovalLifecycle({ onConfirmed, onComplete, onStage, waitForReceipt })
    );

    act(() => {
      result.current.begin({
        approved: true,
        chainId: 11155111,
        gardenId: "garden-1",
        workUID: "work-1",
      });
      result.current.recordWalletStage({ stage: "broadcast", txHash: TX_HASH });
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(waitForReceipt).not.toHaveBeenCalled();

    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(waitForReceipt).toHaveBeenCalledWith(TX_HASH, 11155111);
    expect(onConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "indexing", txHash: TX_HASH })
    );
    expect(onStage.mock.calls.map(([event]) => event.stage)).toEqual([
      "handoff",
      "broadcast",
      "confirmed",
      "indexing",
      "completed",
    ]);
    expect(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)).toBeNull();
    expect(result.current.stage).toBe("completed");
  });

  it("resumes after remount when the app was closed during confirmation", async () => {
    const first = renderHook(() =>
      useWorkApprovalLifecycle({
        onConfirmed: vi.fn(),
        onComplete: vi.fn(),
        waitForReceipt: vi.fn(),
      })
    );

    act(() => {
      first.result.current.begin({
        approved: true,
        chainId: 11155111,
        gardenId: "garden-1",
        workUID: "work-1",
      });
      first.result.current.recordWalletStage({ stage: "broadcast", txHash: TX_HASH });
    });
    first.unmount();

    const onComplete = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useWorkApprovalLifecycle({
        onConfirmed: vi.fn().mockResolvedValue(undefined),
        onComplete,
        waitForReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      })
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)).toBeNull();
  });

  it("keeps confirmed state durable while indexer reconciliation is delayed", async () => {
    const reconciliation = createDeferred();
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWorkApprovalLifecycle({
        onConfirmed: vi.fn(() => reconciliation.promise),
        onComplete,
        waitForReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      })
    );

    act(() => {
      result.current.begin({
        approved: true,
        chainId: 11155111,
        gardenId: "garden-1",
        workUID: "work-1",
      });
      result.current.recordWalletStage({ stage: "broadcast", txHash: TX_HASH });
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(result.current.stage).toBe("indexing"));
    expect(onComplete).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)!)).toEqual(
      expect.objectContaining({ stage: "indexing", txHash: TX_HASH })
    );

    act(() => reconciliation.resolve());

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)).toBeNull();
  });

  it("keeps receipt timeouts retryable and reconciles on the next focus", async () => {
    const waitForReceipt = vi
      .fn()
      .mockRejectedValueOnce(new TransactionReceiptTimeoutError(0))
      .mockResolvedValueOnce({ status: "success" });
    const onRetryable = vi.fn();
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWorkApprovalLifecycle({
        onConfirmed: vi.fn().mockResolvedValue(undefined),
        onComplete,
        onRetryable,
        waitForReceipt,
      })
    );

    act(() => {
      result.current.begin({
        approved: true,
        chainId: 11155111,
        gardenId: "garden-1",
        workUID: "work-1",
      });
      result.current.recordWalletStage({ stage: "broadcast", txHash: TX_HASH });
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(onRetryable).toHaveBeenCalledWith("receipt-timeout"));
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.stage).toBe("broadcast");
    expect(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)).not.toBeNull();

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(waitForReceipt).toHaveBeenCalledTimes(2);
  });

  it("keeps presentation failures retryable without repeating receipt or indexer work", async () => {
    const waitForReceipt = vi.fn().mockResolvedValue({ status: "success" });
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error("navigation interrupted"))
      .mockResolvedValueOnce(undefined);
    const onRetryable = vi.fn();
    const { result } = renderHook(() =>
      useWorkApprovalLifecycle({
        onConfirmed,
        onComplete,
        onRetryable,
        waitForReceipt,
      })
    );

    act(() => {
      result.current.begin({
        approved: true,
        chainId: 11155111,
        gardenId: "garden-1",
        workUID: "work-1",
      });
      result.current.recordWalletStage({ stage: "broadcast", txHash: TX_HASH });
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(onRetryable).toHaveBeenCalledWith("presentation-failed"));
    expect(JSON.parse(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)!)).toEqual(
      expect.objectContaining({
        retryableReason: "presentation-failed",
        stage: "completed",
      })
    );

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2));
    expect(waitForReceipt).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY)).toBeNull();
  });
});
