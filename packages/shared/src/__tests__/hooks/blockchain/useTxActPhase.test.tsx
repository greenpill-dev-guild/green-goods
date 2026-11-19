/** @vitest-environment happy-dom */

/**
 * useTxActPhase.trackReported: an act that says how it ended. A job-queue send
 * can land, or stay queued on this device without failing; the line says
 * which. A send that never said reads as queued, never as landed.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ActSendCallbacks, useTxActPhase } from "../../../hooks/blockchain/useTxActPhase";
import { toActPhaseReport } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import type { ActPhaseReport, TxActPhase } from "../../../modules/transactions/act-phase";
import {
  ReceiptWaitLimitError,
  WalletAnswerAbandonedError,
} from "../../../modules/transactions/types";

let mockAuthMode = "wallet";
vi.mock("../../../providers/Auth", () => ({
  useOptionalAuthContext: () => ({ authMode: mockAuthMode }),
}));

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
    [
      "kept after its broadcast, still confirming",
      (report) => {
        report({ type: "broadcast", hash: HASH });
        report({ type: "queued" });
      },
      { status: "still-confirming", key: "k" },
    ],
    ["queued when it never said how it ended", () => undefined, { status: "queued", key: "k" }],
    [
      // As the queue reports a Safe's proposal, then keeps the act on record (PRD-1564).
      "waiting for the Safe's signers, when a Safe only proposed it",
      (report) => {
        const fromQueue = toActPhaseReport(report);
        fromQueue({ stage: "confirming", txHash: HASH });
        fromQueue({ stage: "safe-signers" });
        fromQueue({ stage: "queued", reason: "awaiting-confirmation" });
      },
      { status: "safe-signers", key: "k" },
    ],
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
    mockAuthMode = "wallet";
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

    // The steward retries under the same key; the old prompt's late answer must not move it.
    let retry!: Promise<unknown>;
    act(() => {
      retry = result.current.track("k", () => new Promise(() => undefined));
    });
    await act(async () => {
      await send?.onBroadcast?.(HASH);
      send?.onAwaiting?.("safe-signers");
    });
    expect(result.current.phase).toMatchObject({ status: "signing", key: "k" });
    void retry;
  });

  it("ignores a Cancel that comes after the wallet answered", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTxActPhase());
    let send: ActSendCallbacks | undefined;
    let landed: (value: string) => void = () => undefined;
    let sent!: Promise<unknown>;
    act(() => {
      sent = result.current.track(
        "k",
        (callbacks) =>
          new Promise<string>((resolve) => {
            send = callbacks;
            landed = resolve;
          })
      );
    });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    // Cancel read off the slow line, pressed just after the wallet's answer moved it on.
    const { cancel } = result.current.phase as { cancel: () => void };
    await act(async () => {
      await send?.onBroadcast?.(HASH);
      cancel();
      landed(HASH);
      await sent;
    });
    expect(send?.signal?.aborted).toBe(false);
    expect(result.current.phase).toEqual({ status: "confirmed", key: "k", hash: HASH });
  });

  it("never turns a passkey act slow: it approves in the app, not a wallet", () => {
    mockAuthMode = "passkey";
    vi.useFakeTimers();
    const { result } = renderHook(() => useTxActPhase());
    act(() => {
      void result.current.track("k", () => new Promise(() => undefined));
    });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toEqual({ status: "signing", key: "k" });
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
