import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { keccak256, toUtf8Bytes } from "ethers";
import {
  commandMessage,
  DUAL_CHAIN,
  DualProcessCourier,
  encodeTuple,
  isOwnedAnvilCommand,
  type CourierMessage,
  type SettlementCommandTuple,
  startDualChains,
  stopDualChains,
} from "./dual-chain-courier";

const couriers: DualProcessCourier[] = [];
let chains: Awaited<ReturnType<typeof startDualChains>> = [];
let sequence = 1;

function tuple(label: string, overrides: Partial<SettlementCommandTuple> = {}): SettlementCommandTuple {
  return {
    version: 1,
    executionKey: keccak256(toUtf8Bytes(label)),
    attempt: 1,
    isBatch: false,
    subjectId: String(sequence),
    kind: "GardenBeneficiary",
    batchKinds: [],
    recipients: ["0x000000000000000000000000000000000000b001"],
    amounts: ["10"],
    acknowledgmentReceiver: "0x000000000000000000000000000000000000a001",
    ...overrides,
  };
}

function message(label: string, overrides: Partial<SettlementCommandTuple> = {}): CourierMessage {
  return commandMessage(tuple(label, overrides), sequence++);
}

function courier() {
  const value = new DualProcessCourier();
  couriers.push(value);
  return value;
}

beforeAll(async () => {
  chains = await startDualChains();
}, 30_000);

afterEach(() => {
  for (const value of couriers.splice(0)) value.stop();
});

afterAll(async () => {
  await stopDualChains(chains);
}, 30_000);

describe("two-process settlement courier", () => {
  it("binds distinct processes, RPCs, and local chain identities", async () => {
    const value = courier();
    const state = await value.state();
    expect(state.source?.chainId).toBe(DUAL_CHAIN.source.chainId);
    expect(state.executor?.chainId).toBe(DUAL_CHAIN.executor.chainId);
    expect(state.source?.pid).not.toBe(state.executor?.pid);
    expect(state.source?.rpcUrl).not.toBe(state.executor?.rpcUrl);
  });

  it("refuses a stale PID record that resolves to an unrelated process command", () => {
    expect(
      isOwnedAnvilCommand("source", "anvil --silent --chain-id 421614 --port 3012 --config-out /tmp/unrelated.json"),
    ).toBe(false);
    expect(isOwnedAnvilCommand("source", "node unrelated-server.js --port 3012")).toBe(false);
  });

  it("holds, reorders, drops, and replays only serialized message records", async () => {
    const value = courier();
    const first = message("held-first");
    const second = message("held-second");
    value.hold(first);
    value.hold(second);
    const held = value.heldMessages();
    expect(held.map((item) => item.messageId)).toEqual([first.messageId, second.messageId]);

    const secondResult = await value.deliver(held[1]);
    const firstResult = await value.deliver(held[0]);
    expect(secondResult.receipt?.blockNumber).toBeLessThan(firstResult.receipt?.blockNumber ?? 0);

    const dropped = message("drop-replay");
    value.hold(dropped);
    value.drop(dropped.messageId);
    expect(value.heldMessages()).toHaveLength(2);
    expect((await value.deliver(JSON.parse(JSON.stringify(dropped)) as CourierMessage)).receipt?.status).toBe(
      "SUCCESS",
    );
  });

  it("makes duplicate command delivery and same-key command retry value-idempotent", async () => {
    const value = courier();
    const original = message("idempotent", { amounts: ["25"] });
    expect((await value.deliver(original)).receipt?.status).toBe("SUCCESS");
    expect((await value.deliver(original)).receipt?.status).toBe("DUPLICATE");

    const retry = { ...original, messageId: keccak256(toUtf8Bytes("same-key-new-command-message")) };
    expect((await value.deliver(retry)).receipt?.status).toBe("DUPLICATE");
    expect((await value.state()).executor?.totalValueExecuted).toBe("25");
  });

  it("executes a homogeneous batch atomically and rejects batch-kind mixing", async () => {
    const value = courier();
    const batch = message("batch", {
      isBatch: true,
      kind: "ContributorConsideration",
      batchKinds: ["ContributorConsideration", "ContributorConsideration"],
      recipients: ["0x000000000000000000000000000000000000b001", "0x000000000000000000000000000000000000b002"],
      amounts: ["7", "11"],
    });
    expect((await value.deliver(batch)).receipt?.status).toBe("SUCCESS");
    expect((await value.state()).executor?.totalValueExecuted).toBe("18");

    const mixed = message("mixed-batch", {
      isBatch: true,
      kind: "ContributorConsideration",
      batchKinds: ["ContributorConsideration", "LoanPrincipal"],
      recipients: ["0x000000000000000000000000000000000000b001", "0x000000000000000000000000000000000000b002"],
      amounts: ["1", "1"],
    });
    await expect(value.deliver(mixed)).rejects.toThrow(/batch kind mixing/);
    expect((await value.state()).executor?.totalValueExecuted).toBe("18");
  });

  it("keeps cancellation distinct from authenticated execution", async () => {
    const value = courier();
    const pending = message("cancel-before-execution");
    await value.cancel(tuple("cancel-before-execution").executionKey);
    const executed = await value.deliver(pending);
    expect(executed.outbound).toBeDefined();
    await expect(value.deliver(executed.outbound as CourierMessage)).rejects.toThrow(/after cancellation/);

    const confirmed = message("cannot-cancel-confirmed");
    const result = await value.deliver(confirmed);
    await value.deliver(result.outbound as CourierMessage);
    await expect(value.cancel(tuple("cannot-cancel-confirmed").executionKey)).rejects.toThrow(/cannot cancel/);
  });

  it("bounds previous-peer grace and rejects old-peer delivery after expiry", async () => {
    const value = courier();
    const oldPeer = "0x000000000000000000000000000000000000a001";
    const newPeer = "0x000000000000000000000000000000000000a002";
    await value.rotatePeer(newPeer, 2);
    const duringGrace = message("old-peer-during-grace");
    duringGrace.sender = oldPeer;
    expect((await value.deliver(duringGrace)).receipt?.status).toBe("SUCCESS");
    await value.state();
    const expired = message("old-peer-expired");
    expired.sender = oldPeer;
    await expect(value.deliver(expired)).rejects.toThrow(/invalid source peer/);

    const current = message("new-peer-current");
    current.sender = newPeer;
    expect((await value.deliver(current)).receipt?.status).toBe("SUCCESS");
  });

  it("records authenticated failure without value and supports a new logical attempt", async () => {
    const value = courier();
    const failed = message("failure-attempt-1", { fail: true });
    const failedExecution = await value.deliver(failed);
    expect(failedExecution.receipt?.status).toBe("FAILED");
    expect((await value.deliver(failedExecution.outbound as CourierMessage)).receipt?.status).toBe("FAILED");
    expect((await value.state()).executor?.totalValueExecuted).toBe("0");

    const retried = message("failure-attempt-2", { attempt: 2, amounts: ["9"] });
    const successfulExecution = await value.deliver(retried);
    expect(successfulExecution.receipt?.status).toBe("SUCCESS");
    expect((await value.deliver(successfulExecution.outbound as CourierMessage)).receipt?.status).toBe("SUCCESS");
    expect((await value.state()).executor?.totalValueExecuted).toBe("9");
  });

  it("retries acknowledgment to the receiver stored at execution time", async () => {
    const value = courier();
    const oldReceiver = "0x000000000000000000000000000000000000a001";
    const command = message("ack-retry", { acknowledgmentReceiver: oldReceiver });
    const execution = await value.deliver(command);
    expect(execution.outbound?.receiver).toBe(oldReceiver);
    await value.rotatePeer("0x000000000000000000000000000000000000a099", 0);
    const retried = await value.retryAcknowledgment(tuple("ack-retry").executionKey);
    expect(retried.outbound?.receiver).toBe(oldReceiver);
    expect(retried.outbound?.messageId).toBe(execution.outbound?.messageId);
    expect((await value.deliver(retried.outbound as CourierMessage)).receipt?.status).toBe("SUCCESS");
  });

  it("rejects an authenticated acknowledgment that is not bound to the recorded command message", async () => {
    const value = courier();
    const command = message("forged-ack-origin");
    const execution = await value.deliver(command);
    const forged = structuredClone(execution.outbound as CourierMessage);
    const acknowledgment = {
      ...JSON.parse(Buffer.from(forged.data.slice(2), "hex").toString("utf8")),
      originatingCommandMessageId: keccak256(toUtf8Bytes("different-command")),
    };
    forged.data = encodeTuple(acknowledgment);
    await expect(value.deliver(forged)).rejects.toThrow(/does not match the recorded source command/);
  });

  it("rejects malformed payloads and token-bearing CCIP envelopes", async () => {
    const value = courier();
    const malformed = message("malformed");
    malformed.data = "0x01";
    await expect(value.deliver(malformed)).rejects.toThrow();

    const tokenBearing = {
      ...message("token-bearing"),
      destTokenAmounts: [{ token: "0x00", amount: "1" }],
    } as unknown as CourierMessage;
    await expect(value.deliver(tokenBearing)).rejects.toThrow(/token amounts are forbidden/);
  });
});
