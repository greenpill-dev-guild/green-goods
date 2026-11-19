/** @vitest-environment happy-dom */

/**
 * useTxActPhase.trackReported: an act that says how it ended. A job-queue send
 * can land, or stay queued on this device without failing; the line says
 * which. A send that never said reads as queued, never as landed.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ActSendCallbacks, useTxActPhase } from "../../../hooks/blockchain/useTxActPhase";
import type { ActPhaseReport, TxActPhase } from "../../../modules/transactions/act-phase";
import {
  ReceiptWaitLimitError,
  WalletAnswerAbandonedError,
} from "../../../modules/transactions/types";

const HASH = `0x${"b".repeat(64)}` as const;

describe("useTxActPhase.trackReported", () => {
  it.each<[string, (report: ActPhaseReport) => void, TxActPhase]>([
    [
      "landed, keeping its hash",
      (report) => {
        report({ type: "broadcast", hash: HASH });
        report({ type: "confirmed" });
      },
      { status: "confirmed", key: "k", hash: HASH },
    ],
    [
      "kept queued on this device",
      (report) => report({ type: "queued" }),
      { status: "queued", key: "k" },
    ],
    ["queued when it never said how it ended", () => undefined, { status: "queued", key: "k" }],
  ])("ends %s", async (_case, reports, expected) => {
    const { result } = renderHook(() => useTxActPhase());

    await act(async () => {
      await result.current.trackReported("k", async (report) => {
        reports(report);
        return "job-1";
      });
    });

    expect(result.current.phase).toEqual(expected);
  });

  it("fails a send that rejects, and passes the rejection on", async () => {
    const { result } = renderHook(() => useTxActPhase());

    await act(async () => {
      await expect(
        result.current.trackReported("k", async () => {
          throw new Error("User rejected the request");
        })
      ).rejects.toThrow(/user rejected/i);
    });

    expect(result.current.phase).toEqual({ status: "failed", key: "k" });
  });
});

/**
 * useTxActPhase.track (PRD-1551): past 20 seconds on the wallet the act turns slow and offers
 * Cancel, and the endings that may still land never read as failed.
 */
describe("useTxActPhase.track", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns slow after 20 seconds on the wallet, and Cancel stops the wait", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTxActPhase());
    let send: ActSendCallbacks | undefined;
    let sent!: Promise<unknown>;
    act(() => {
      sent = result.current.track("k", (callbacks) => {
        send = callbacks;
        return new Promise(() => undefined);
      });
    });
    expect(result.current.phase).not.toHaveProperty("slow");

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current.phase).toMatchObject({ status: "signing", key: "k", slow: true });

    const { cancel } = result.current.phase as { cancel: () => void };
    await act(async () => {
      cancel();
      await expect(sent).rejects.toBeInstanceOf(WalletAnswerAbandonedError);
    });
    // The sender hears it too, so a wallet sender stops waiting for the wallet's answer.
    expect(send?.signal?.aborted).toBe(true);
    expect(result.current.phase).toEqual({ status: "stopped", key: "k" });
  });

  it.each<[string, (send: ActSendCallbacks) => Promise<unknown>, TxActPhase]>([
    [
      "still confirming when the receipt outlasts its limit",
      async (send) => {
        await send.onBroadcast?.(HASH);
        throw new ReceiptWaitLimitError(120_000, { hash: HASH });
      },
      { status: "still-confirming", key: "k" },
    ],
    [
      "waiting on the Safe's signers when the wallet answers with a proposal",
      async (send) => {
        await send.onBroadcast?.(HASH);
        send.onAwaiting?.("safe-signers");
        return HASH;
      },
      { status: "safe-signers", key: "k" },
    ],
  ])("ends %s, never failed", async (_case, run, expected) => {
    const { result } = renderHook(() => useTxActPhase());

    await act(async () => {
      await result.current.track("k", run).catch(() => undefined);
    });

    expect(result.current.phase).toEqual(expected);
  });
});
