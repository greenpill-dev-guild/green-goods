/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TransactionReplacementError,
  TransactionRevertedError,
} from "../../../modules/transactions/types";
import { sendWithCheckpoint } from "../../../modules/work/send-with-checkpoint";
import {
  forgetWorkBroadcast,
  retainedWorkBroadcastReference,
} from "../../../modules/work/work-confirmation";
import type { SendCheckpoint } from "../../../types/job-queue";
import { createMockContractCall, createMockTransactionSender } from "../../test-utils";

const OPERATION = `0x${"cd".repeat(32)}` as const;
const TX = `0x${"ab".repeat(32)}` as const;
const AT = Date.parse("2026-09-18T10:00:00.000Z");
const JOBS = ["job-a", "job-b"];

/** One send record, as a job's storage would hold it, and every state it passed through. */
function recorder() {
  let current: SendCheckpoint | undefined;
  const history: Array<SendCheckpoint | undefined> = [];
  const record = vi.fn(async (next: (current: SendCheckpoint) => SendCheckpoint | undefined) => {
    current = next(current ?? {});
    history.push(current);
  });
  return { record, history, current: () => current };
}

const send = (sender: ReturnType<typeof createMockTransactionSender>, record: never) =>
  sendWithCheckpoint({
    sender,
    call: createMockContractCall(),
    jobIds: JOBS,
    record,
    now: () => AT,
  });

afterEach(() => {
  for (const id of JOBS) forgetWorkBroadcast(id);
});

describe("sending one call while recording how far it got", () => {
  it("records the intent, then the operation, then its transaction, and remembers it under every job", async () => {
    const { record, history } = recorder();
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      await options?.onBroadcastReference?.({ kind: "user-operation", hash: OPERATION });
      await options?.onBroadcast?.(TX);
      return { hash: TX, sponsored: true };
    });

    await expect(send(sender, record as never)).resolves.toEqual({
      status: "sent",
      hash: TX,
      confirmation: undefined,
    });

    const operation = { kind: "user-operation", hash: OPERATION };
    expect(history).toEqual([
      {
        broadcastPending: true,
        broadcastPendingAt: "2026-09-18T10:00:00.000Z",
        broadcast: operation,
      },
      expect.objectContaining({ broadcast: operation, broadcastPending: false }),
      expect.objectContaining({
        broadcast: operation,
        transactionHash: TX,
        broadcastPending: false,
      }),
    ]);
    for (const id of JOBS) expect(retainedWorkBroadcastReference(id)).toEqual(operation);
  });

  it("records a wallet's transaction as its reference, since a wallet has no operation", async () => {
    const { record, current } = recorder();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcast?.(TX);
      return { hash: TX, sponsored: false };
    });

    await send(sender, record as never);

    expect(current()).toMatchObject({
      broadcast: { kind: "transaction", hash: TX },
      transactionHash: TX,
      broadcastPending: false,
    });
  });

  it("clears a cancelled wallet transaction checkpoint so a deliberate retry is safe", async () => {
    const { record, current } = recorder();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcastReference?.({ kind: "transaction", hash: TX });
      throw new TransactionReplacementError("cancelled");
    });

    await expect(send(sender, record as never)).resolves.toMatchObject({
      status: "not-sent",
      cancelled: true,
    });
    expect(current()).toBeUndefined();
    for (const id of JOBS) expect(retainedWorkBroadcastReference(id)).toBeUndefined();
  });

  it("keeps a different replacement uncertain until its effect is inspected", async () => {
    const { record, current } = recorder();
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcastReference?.({ kind: "transaction", hash: TX });
      throw new TransactionReplacementError("replaced");
    });
    await expect(send(sender, record as never)).resolves.toMatchObject({ status: "may-have-sent" });
    expect(current()).toMatchObject({ broadcast: { kind: "transaction", hash: TX } });
  });

  it("records the hash a sender only returns", async () => {
    const { record, current } = recorder();
    const sender = createMockTransactionSender({ result: { hash: TX, sponsored: true } });

    await expect(send(sender, record as never)).resolves.toMatchObject({ status: "sent" });
    expect(current()).toMatchObject({ transactionHash: TX, broadcastPending: false });
  });

  it("passes a pending confirmation through for the caller to wait on", async () => {
    const { record } = recorder();
    const sender = createMockTransactionSender({
      result: { hash: TX, sponsored: false, confirmation: "pending" },
    });

    await expect(send(sender, record as never)).resolves.toMatchObject({
      status: "sent",
      confirmation: "pending",
    });
  });

  it("writes nothing when the prompt is declined before anything was signed", async () => {
    const { record } = recorder();
    const declined = new DOMException("Not allowed by the user.", "NotAllowedError");
    const sender = createMockTransactionSender({ fail: declined });

    await expect(send(sender, record as never)).resolves.toEqual({
      status: "not-sent",
      cancelled: true,
      error: declined,
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("clears the intent when the network refuses the call outright", async () => {
    const { record, current } = recorder();
    const refused = Object.assign(new Error("invalid params"), { code: -32602 });
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      throw refused;
    });

    await expect(send(sender, record as never)).resolves.toEqual({
      status: "not-sent",
      cancelled: false,
      error: refused,
    });
    expect(current()).toBeUndefined();
  });

  it("keeps the intent when the answer is lost, so the send is confirmed and never repeated", async () => {
    const { record, current } = recorder();
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      throw Object.assign(new Error("The request took too long"), { name: "TimeoutError" });
    });

    await expect(send(sender, record as never)).resolves.toMatchObject({ status: "may-have-sent" });
    expect(current()).toMatchObject({ broadcastPending: true });
  });

  it("leaves the record alone on a revert: what a revert means is the caller's call", async () => {
    const { record, current } = recorder();
    const reverted = new TransactionRevertedError(OPERATION);
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
      await options?.onBroadcastReference?.({ kind: "user-operation", hash: OPERATION });
      throw reverted;
    });

    await expect(send(sender, record as never)).resolves.toEqual({
      status: "reverted",
      error: reverted,
    });
    expect(current()).toMatchObject({ broadcast: { kind: "user-operation", hash: OPERATION } });
  });

  it("checks ownership before the intent, and stops the send when the intent cannot be written", async () => {
    const trace: string[] = [];
    let broadcast = false;
    const record = vi.fn(async (next: (current: SendCheckpoint) => SendCheckpoint | undefined) => {
      trace.push(next({})?.broadcastPending ? "intent" : "clear");
      if (trace.filter((step) => step === "intent").length === 1 && trace.length === 2)
        throw new Error("quota");
    });
    const sender = createMockTransactionSender();
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      broadcast = true;
      return { hash: TX, sponsored: true };
    });

    const result = await sendWithCheckpoint({
      sender,
      call: createMockContractCall(),
      jobIds: JOBS,
      record,
      assertOwnership: async () => {
        trace.push("ownership");
      },
    });

    expect(trace).toEqual(["ownership", "intent", "clear"]);
    expect(broadcast).toBe(false);
    expect(result).toMatchObject({ status: "not-sent", cancelled: false });
  });

  it("keeps a broadcast in memory even when writing it fails", async () => {
    const record = vi.fn(async () => {
      throw new Error("quota");
    });
    const sender = createMockTransactionSender({ authMode: "wallet" });
    vi.mocked(sender.sendContractCall).mockImplementation(async (_call, options) => {
      await options?.onBroadcast?.(TX);
      return { hash: TX, sponsored: false };
    });

    await expect(send(sender, record as never)).resolves.toMatchObject({ status: "may-have-sent" });
    for (const id of JOBS)
      expect(retainedWorkBroadcastReference(id)).toEqual({ kind: "transaction", hash: TX });
  });
});
