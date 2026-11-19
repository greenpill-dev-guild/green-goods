/**
 * The one line a single-signature act shows while it runs. Each act carries
 * the key of the row it started from, so a late event from an act that was
 * replaced, or one that arrives after the line settled, changes nothing.
 */
import { describe, expect, it } from "vitest";
import {
  actPhaseFor,
  actPhaseReducer,
  claimActKey,
  IDLE_ACT_PHASE,
  type TxActPhase,
  type TxActPhaseEvent,
} from "../act-phase";

const HASH = `0x${"a".repeat(64)}` as const;
const signing: TxActPhase = { status: "signing", key: "a" };
const confirming: TxActPhase = { status: "confirming", key: "a", hash: HASH };
const confirmed: TxActPhase = { status: "confirmed", key: "a", hash: HASH };
const failed: TxActPhase = { status: "failed", key: "a" };

describe("actPhaseReducer", () => {
  it.each<{ from: TxActPhase; event: TxActPhaseEvent; to: TxActPhase; case: string }>([
    {
      case: "an act starts in the wallet",
      from: IDLE_ACT_PHASE,
      event: { type: "start", key: "a" },
      to: signing,
    },
    {
      case: "the broadcast moves it to the chain",
      from: signing,
      event: { type: "broadcast", key: "a", hash: HASH },
      to: confirming,
    },
    {
      case: "the receipt settles it, keeping the hash",
      from: confirming,
      event: { type: "confirmed", key: "a" },
      to: confirmed,
    },
    {
      case: "a sender that never reported a hash still settles",
      from: signing,
      event: { type: "confirmed", key: "a" },
      to: { status: "confirmed", key: "a", hash: null },
    },
    {
      case: "a refusal in the wallet fails it",
      from: signing,
      event: { type: "failed", key: "a" },
      to: failed,
    },
    {
      case: "a revert on the chain fails it",
      from: confirming,
      event: { type: "failed", key: "a" },
      to: failed,
    },
    {
      case: "a job-queue send kept on this device ends queued, not failed",
      from: signing,
      event: { type: "queued", key: "a" },
      to: { status: "queued", key: "a" },
    },
    {
      // Broadcast, then kept: it went out, so it is still confirming (PRD-1552).
      case: "a send the queue kept after its broadcast is still confirming",
      from: confirming,
      event: { type: "queued", key: "a" },
      to: { status: "still-confirming", key: "a" },
    },
    {
      case: "a queued line stays queued",
      from: { status: "queued", key: "a" },
      event: { type: "confirmed", key: "a" },
      to: { status: "queued", key: "a" },
    },
    {
      case: "a newer act replaces a running one",
      from: confirming,
      event: { type: "start", key: "b" },
      to: { status: "signing", key: "b" },
    },
    {
      case: "a replaced act's late event is ignored",
      from: { status: "signing", key: "b" },
      event: { type: "confirmed", key: "a" },
      to: { status: "signing", key: "b" },
    },
    {
      case: "nothing moves a line that never started",
      from: IDLE_ACT_PHASE,
      event: { type: "broadcast", key: "a", hash: HASH },
      to: IDLE_ACT_PHASE,
    },
    {
      case: "a settled line stays settled",
      from: confirmed,
      event: { type: "failed", key: "a" },
      to: confirmed,
    },
    {
      case: "a failed line does not come back",
      from: failed,
      event: { type: "confirmed", key: "a" },
      to: failed,
    },
    // PRD-1551: a slow wallet, Cancel, and the endings that may still land.
    {
      case: "a wallet that has not answered for a while turns the act slow",
      from: signing,
      event: { type: "wallet-slow", key: "a" },
      to: { status: "signing", key: "a", slow: true },
    },
    {
      case: "only an act still in the wallet turns slow",
      from: confirming,
      event: { type: "wallet-slow", key: "a" },
      to: confirming,
    },
    {
      case: "stopping the wait for the wallet ends it stopped",
      from: { status: "signing", key: "a", slow: true },
      event: { type: "stopped", key: "a" },
      to: { status: "stopped", key: "a" },
    },
    {
      case: "a send on the chain cannot be stopped",
      from: confirming,
      event: { type: "stopped", key: "a" },
      to: confirming,
    },
    {
      case: "a receipt past its limit leaves it still confirming, not failed",
      from: confirming,
      event: { type: "still-confirming", key: "a" },
      to: { status: "still-confirming", key: "a" },
    },
    {
      case: "a Safe proposal waits for its signers",
      from: confirming,
      event: { type: "safe-signers", key: "a" },
      to: { status: "safe-signers", key: "a" },
    },
    {
      case: "a Safe proposal never reads as landed",
      from: { status: "safe-signers", key: "a" },
      event: { type: "confirmed", key: "a" },
      to: { status: "safe-signers", key: "a" },
    },
  ])("$case", ({ from, event, to }) => {
    expect(actPhaseReducer(from, event)).toEqual(to);
  });
});

describe("actPhaseFor", () => {
  it("gives a row its own act's line and every other row none", () => {
    const key = claimActKey(9n, "0xABCDEF0000000000000000000000000000000001");
    const phase: TxActPhase = { status: "confirming", key, hash: HASH };
    expect(actPhaseFor(phase, claimActKey(9n, "0xabcdef0000000000000000000000000000000001"))).toBe(
      phase
    );
    expect(
      actPhaseFor(phase, claimActKey(9n, "0x2222222222222222222222222222222222222222"))
    ).toEqual(IDLE_ACT_PHASE);
    expect(
      actPhaseFor(phase, claimActKey(10n, "0xabcdef0000000000000000000000000000000001"))
    ).toEqual(IDLE_ACT_PHASE);
  });
});
