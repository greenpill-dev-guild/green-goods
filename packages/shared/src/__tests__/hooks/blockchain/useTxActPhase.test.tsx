/** @vitest-environment jsdom */

/**
 * useTxActPhase.trackReported: an act that says how it ended. A job-queue send
 * can land, or stay queued on this device without failing; the line says
 * which. A send that never said reads as queued, never as landed.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTxActPhase } from "../../../hooks/blockchain/useTxActPhase";
import type { ActPhaseReport, TxActPhase } from "../../../modules/transactions/act-phase";

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
