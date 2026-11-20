import { describe, expect, it, vi } from "vitest";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { serviceLiveCall } from "../modules/commitment-pooling/service-access-live-commands";
import type { ServiceLiveRoute } from "../modules/commitment-pooling/service-access-live-config";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import {
  runVoucherStart,
  selectVoucherStart,
  VOUCHER_START_FALLBACK_SECONDS,
  type VoucherStartEvent,
  type VoucherStartState,
  voucherStartFallbackDue,
} from "../modules/commitment-pooling/voucher-start";
import type { ContractCall, TxResult } from "../modules/transactions/types";

const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200",
};
const STEWARD = "0x0000000000000000000000000000000000000777";
const route = {
  sourceChainId: 42161,
  core: { address: key.coreModule },
  source: { address: "0x0000000000000000000000000000000000000300" },
  destination: { address: "0x0000000000000000000000000000000000000400" },
} as unknown as ServiceLiveRoute;
const DECISION = `0x${"d".repeat(64)}` as const;

/** The seeded booking, accepted on the source and not yet started. */
function accepted() {
  const s = createServiceRehearsalSnapshot(key);
  const row = s.voucherSetups[0]!;
  row.source.decision = "none";
  row.source.decisionId = null;
  row.source.decisionDispatched = false;
  return { s, row };
}

/** The seeded booking with its start recorded on the source and not yet sent to the escrow. */
function recorded(fee = 7n) {
  const { s, row } = accepted();
  row.source.decision = "activate";
  row.source.decisionId = DECISION;
  row.fees.decision = fee;
  s.pause.sourceVoucher = false;
  return { s, row };
}

describe("selectVoucherStart", () => {
  it("records the start of a booking the source accepted exactly", () => {
    const { s, row } = accepted();
    expect(selectVoucherStart(s, row)).toEqual({
      kind: "send",
      act: {
        action: "finalizeVoucherActivation",
        sourceChainId: row.authorization.sourceChainId,
        sourceModule: row.authorization.sourceModule,
        setupId: row.setupId,
        expectedAuthorizationHash: row.authorizationHash,
        expectedAcceptedReceiptHash: row.source.acceptedReceiptHash,
      },
    });
  });

  it("then sends the recorded start to the escrow for its quoted fee", () => {
    const { s, row } = recorded(7n);
    expect(selectVoucherStart(s, row)).toMatchObject({
      kind: "send",
      act: {
        action: "dispatchVoucherSetupCommand",
        kind: "decision",
        expectedDecisionId: DECISION,
        reviewedNativeFee: 7n,
      },
    });
  });

  it("is done once the start is on its way, whoever sent it", () => {
    const { s, row } = recorded();
    row.source.decisionDispatched = true;
    expect(selectVoucherStart(s, row)).toEqual({ kind: "started" });
  });

  it("waits while the source has not accepted the booking", () => {
    const { s, row } = accepted();
    row.source.acceptedEver = null;
    row.source.acceptedReceiptHash = null;
    expect(selectVoucherStart(s, row)).toEqual({ kind: "notAccepted" });
  });

  it("never records an acceptance of another setup as this one's", () => {
    const { s, row } = accepted();
    row.source.acceptedEver = { ...row.source.acceptedEver!, setupId: `0x${"9".repeat(64)}` };
    expect(selectVoucherStart(s, row)).toEqual({ kind: "notAccepted" });
  });

  it.each<[string, (s: ReturnType<typeof recorded>["s"]) => void, VoucherStartState["kind"]]>([
    ["a paused source", (s) => (s.pause.sourceVoucher = true), "unavailable"],
    ["an unread pause", (s) => (s.pause.sourceVoucher = null), "unavailable"],
    ["no fee quote", (s) => (s.voucherSetups[0]!.fees.decision = null), "unavailable"],
    [
      "an offline read",
      (s) => (s.capabilities.reasons = [...s.capabilities.reasons, "offline"]),
      "unavailable",
    ],
    ["a cancelled booking", (s) => (s.voucherSetups[0]!.source.decision = "abort"), "unavailable"],
  ])("sends nothing with %s", (_, change, kind) => {
    const { s, row } = recorded();
    change(s);
    expect(selectVoucherStart(s, row).kind).toBe(kind);
  });

  it("refuses a setup that belongs to another booking", () => {
    const { s, row } = accepted();
    row.authorization.buyer = STEWARD;
    expect(selectVoucherStart(s, row)).toEqual({ kind: "unavailable" });
  });
});

describe("serviceLiveCall from someone other than the member", () => {
  it("builds the start's two sends from the named sender, on the source chain", () => {
    const record = accepted();
    const first = selectVoucherStart(record.s, record.row);
    const second = recorded(7n);
    const next = selectVoucherStart(second.s, second.row);
    if (first.kind !== "send" || next.kind !== "send") throw new Error("expected sends");
    expect(serviceLiveCall(record.s, first.act, route, STEWARD)).toMatchObject({
      account: STEWARD,
      chainId: 42161,
      address: route.source.address,
      functionName: "finalizeActivation",
      args: [record.row.setupId, record.row.authorizationHash],
      value: 0n,
    });
    expect(serviceLiveCall(second.s, next.act, route, STEWARD)).toMatchObject({
      account: STEWARD,
      functionName: "dispatchSetupCommand",
      args: [second.row.setupId, 1],
      value: 7n,
    });
  });

  it("refuses every other act for anyone but the member", () => {
    const { s, row } = accepted();
    const bound = {
      sourceChainId: row.authorization.sourceChainId,
      sourceModule: row.authorization.sourceModule,
      setupId: row.setupId,
      expectedAuthorizationHash: row.authorizationHash,
    };
    expect(() =>
      serviceLiveCall(s, { ...bound, action: "abortVoucherSetup" }, route, STEWARD)
    ).toThrow(/member/);
    expect(() =>
      serviceLiveCall(
        s,
        {
          ...bound,
          action: "dispatchVoucherSetupCommand",
          kind: "authorization",
          expectedDecisionId: null,
          reviewedNativeFee: 1n,
        },
        route,
        STEWARD
      )
    ).toThrow(/member/);
  });

  it("still sends a member's own act from the member", () => {
    const { s, row } = accepted();
    const call = serviceLiveCall(
      s,
      {
        sourceChainId: row.authorization.sourceChainId,
        sourceModule: row.authorization.sourceModule,
        setupId: row.setupId,
        expectedAuthorizationHash: row.authorizationHash,
        action: "abortVoucherSetup",
      },
      route
    );
    expect(call.account).toBe(key.buyer);
  });
});

describe("runVoucherStart", () => {
  const sendOf = (step: "record" | "send"): VoucherStartState => {
    const { s, row } = step === "record" ? accepted() : recorded(7n);
    return selectVoucherStart(s, row);
  };
  const call = (functionName: string) => ({ functionName }) as unknown as ContractCall;
  const landed = (hash: `0x${string}`): TxResult => ({ hash, sponsored: false });
  const harness = (reads: VoucherStartState[], results: (TxResult | Error)[]) => {
    const events: VoucherStartEvent[] = [];
    const sent: string[] = [];
    let read = 0;
    let send = 0;
    const deps = {
      prepare: vi.fn(async () => {
        const state = reads[Math.min(read, reads.length - 1)]!;
        read += 1;
        return state.kind === "send"
          ? {
              state,
              call: call(state.act.action === "finalizeVoucherActivation" ? "record" : "dispatch"),
            }
          : { state, call: null };
      }),
      send: vi.fn(async (c: ContractCall) => {
        sent.push(c.functionName);
        const result = results[send]!;
        send += 1;
        if (result instanceof Error) throw result;
        return result;
      }),
      report: (event: VoucherStartEvent) => events.push(event),
      wait: vi.fn(async () => {}),
    };
    return { deps, events, sent };
  };

  it("records the start, then sends it, and says each send as it lands", async () => {
    const { deps, events, sent } = harness(
      [sendOf("record"), sendOf("send"), { kind: "started" }],
      [landed("0x01"), landed("0x02")]
    );
    await expect(runVoucherStart(deps)).resolves.toBe("started");
    expect(sent).toEqual(["record", "dispatch"]);
    expect(events).toEqual([
      { step: "record", status: "signing", fee: null },
      { step: "record", status: "done", hash: "0x01" },
      { step: "send", status: "signing", fee: 7n },
      { step: "send", status: "done", hash: "0x02" },
    ]);
  });

  it("reads again rather than recording twice when a read has not caught up", async () => {
    const { deps, sent } = harness(
      [sendOf("record"), sendOf("record"), sendOf("send")],
      [landed("0x01"), landed("0x02")]
    );
    await expect(runVoucherStart(deps)).resolves.toBe("started");
    expect(sent).toEqual(["record", "dispatch"]);
    expect(deps.wait).toHaveBeenCalledTimes(1);
  });

  it("gives up reading after a few tries and leaves the start to the fallback", async () => {
    const { deps, sent } = harness([sendOf("record")], [landed("0x01")]);
    await expect(runVoucherStart(deps)).resolves.toBe("notSent");
    expect(sent).toEqual(["record"]);
  });

  it("stops at a send with no receipt yet: it may still land", async () => {
    const { deps, events, sent } = harness(
      [sendOf("record")],
      [{ ...landed("0x01"), confirmation: "pending" }]
    );
    await expect(runVoucherStart(deps)).resolves.toBe("unconfirmed");
    expect(sent).toEqual(["record"]);
    expect(events.at(-1)).toEqual({ step: "record", status: "confirming" });
  });

  it("says a send failed and leaves the start to the fallback", async () => {
    const { deps, events } = harness([sendOf("record")], [new Error("User rejected")]);
    await expect(runVoucherStart(deps)).resolves.toBe("notSent");
    expect(events.at(-1)).toEqual({ step: "record", status: "failed" });
  });

  it("sends nothing while the acceptance hasn't landed on the source", async () => {
    const { deps, sent } = harness([{ kind: "notAccepted" }], []);
    await expect(runVoucherStart(deps)).resolves.toBe("notSent");
    expect(sent).toEqual([]);
  });

  it("is done at once when someone else already started it", async () => {
    const { deps, sent } = harness([{ kind: "started" }], []);
    await expect(runVoucherStart(deps)).resolves.toBe("started");
    expect(sent).toEqual([]);
  });

  it("leaves the start to the fallback when the booking can't be read", async () => {
    const { deps } = harness([], []);
    deps.prepare.mockRejectedValueOnce(new Error("read failed"));
    await expect(runVoucherStart(deps)).resolves.toBe("notSent");
  });
});

describe("voucherStartFallbackDue", () => {
  const acceptedAt = 1_000_000;
  it("waits for the steward's start until the fallback's time has passed", () => {
    expect(voucherStartFallbackDue(acceptedAt, BigInt(acceptedAt + 60))).toBe(false);
    expect(
      voucherStartFallbackDue(acceptedAt, BigInt(acceptedAt + VOUCHER_START_FALLBACK_SECONDS - 1))
    ).toBe(false);
    expect(
      voucherStartFallbackDue(acceptedAt, BigInt(acceptedAt + VOUCHER_START_FALLBACK_SECONDS))
    ).toBe(true);
  });

  it("offers the fallback when the acceptance's time or the chain's time is unknown", () => {
    expect(voucherStartFallbackDue(null, 5n)).toBe(true);
    expect(voucherStartFallbackDue(acceptedAt, null)).toBe(true);
  });

  it("holds the fallback for fifteen minutes", () => {
    expect(VOUCHER_START_FALLBACK_SECONDS).toBe(15 * 60);
  });
});
