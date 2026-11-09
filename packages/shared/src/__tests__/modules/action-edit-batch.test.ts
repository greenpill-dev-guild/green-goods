import "fake-indexeddb/auto";
import { decodeFunctionData, type Hex, toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { ActionEditChain, ActionEditChange } from "../../modules/action/action-edit";
import {
  moveOnFromActionEditHold,
  prepareActionEditBatch,
  readActionEditHold,
  sendActionEditBatch,
} from "../../modules/action/action-edit-batch";
import type { BatchExecution } from "../../modules/transactions/batch-types";
import type { Address } from "../../types/domain";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;

interface Window {
  startTime: bigint;
  endTime: bigint;
}
const AUGUST: Window = { startTime: 1785542400n, endTime: 1788134400n };
const MID_AUGUST_TO_MID_SEPTEMBER: Window = { startTime: 1786752000n, endTime: 1789430400n };
const OCTOBER: Window = { startTime: 1790812800n, endTime: 1793404800n };

const windowChanges = (window: Window): ActionEditChange[] => [
  { field: "startTime", value: Number(window.startTime) },
  { field: "endTime", value: Number(window.endTime) },
];
const RENAMED_TO_OCTOBER: ActionEditChange[] = [
  { field: "title", value: "Plant the October beds" },
  ...windowChanges(OCTOBER),
];

/**
 * ActionRegistry's window checks as Action.sol writes them, run over the calldata a save sends:
 * `updateActionStartTime` reverts StartTimeAfterEndTime unless the start is before the stored end,
 * and `updateActionEndTime` reverts EndTimeBeforeStartTime unless the end is after the stored start.
 */
function runOnRegistry(stored: Window & { title?: string }, calls: readonly { data: Hex }[]) {
  const action = { ...stored };
  for (const { data } of calls) {
    const { functionName, args } = decodeFunctionData({ abi: ActionRegistryABI, data });
    const value = args?.[1];
    if (functionName === "updateActionStartTime") {
      if ((value as bigint) >= action.endTime) throw new Error("StartTimeAfterEndTime");
      action.startTime = value as bigint;
    } else if (functionName === "updateActionEndTime") {
      if ((value as bigint) <= action.startTime) throw new Error("EndTimeBeforeStartTime");
      action.endTime = value as bigint;
    } else if (functionName === "updateActionTitle") action.title = value as string;
  }
  return action;
}

function address(): Address {
  return toHex(crypto.getRandomValues(new Uint8Array(20)));
}

/** A registry holding one action; a confirmed batch runs on it, and `update` is a later block. */
function registryHolding(window: Window) {
  const held = { ...window, title: "Plant the August beds", instructions: "bafy-old" };
  const chain = {
    read: vi.fn(async (_call: Parameters<ActionEditChain["read"]>[0]) => ({ ...held })),
    simulate: vi.fn(async (_call: Parameters<ActionEditChain["simulate"]>[0]) => undefined),
  } satisfies ActionEditChain;
  return { chain, held, update: (next: Partial<typeof held>) => Object.assign(held, next) };
}

function setup(execution: Partial<BatchExecution> = {}, window: Window = AUGUST) {
  const account = address();
  // Every test gets its own action: the journal outlives each one.
  const actionUID = BigInt(crypto.getRandomValues(new Uint32Array(1))[0]);
  const sender = createFakeBatchingSender(account, execution);
  const registry = registryHolding(window);
  const input = {
    batches: sender.batches!,
    chain: registry.chain,
    actionUID,
    scope: { account, chainId },
    retryMs: 0,
  };
  return { ...registry, input, sender };
}

/** The batch runs on the registry model, so verification reads what it wrote. */
function landOnRegistry({ held, update, sender }: ReturnType<typeof setup>) {
  sender.submitAtomicBatch = vi.fn(async (calls, options) => {
    const reference = {
      kind: "user-operation",
      hash,
      account: calls[0].account!,
      chainId,
    } as const;
    await options?.onBeforeBroadcast?.({ kind: "user-operation", hash });
    await options?.onBatchReference?.(reference);
    update(runOnRegistry(held, calls as unknown as { data: Hex }[]));
    return {
      status: "confirmed",
      reference,
      receipts: [{ transactionHash: hash, status: "success" }],
      sponsored: true,
    } satisfies BatchExecution;
  });
}

const send = (input: ReturnType<typeof setup>["input"], changes = RENAMED_TO_OCTOBER) =>
  sendActionEditBatch({ ...input, rail: "passkey", changes });

describe("the order of an action edit", () => {
  const prepare = (window: Window, changes: ActionEditChange[]) =>
    prepareActionEditBatch({
      id: "attempt-1",
      account: address(),
      chainId,
      actionUID: 42n,
      rail: "passkey",
      changes,
      window,
    });

  it.each([
    ["moved past its own end", AUGUST, OCTOBER, ["title", "endTime", "startTime"]],
    ["moved before its own start", OCTOBER, AUGUST, ["title", "startTime", "endTime"]],
    [
      "shifted within itself",
      AUGUST,
      MID_AUGUST_TO_MID_SEPTEMBER,
      ["title", "startTime", "endTime"],
    ],
  ])("lands a window %s, every write accepted in turn", (_case, stored, next, order) => {
    const prepared = prepare(stored, [
      { field: "title", value: "Renamed" },
      ...windowChanges(next),
    ]);

    expect(prepared.items.map((item) => item.id)).toEqual(order);
    expect(
      runOnRegistry(
        stored,
        prepared.items.map((item) => item.call)
      )
    ).toMatchObject(next);
  });

  it("is not today's order, which the registry refuses for a window moved later", () => {
    const prepared = prepare(AUGUST, RENAMED_TO_OCTOBER);
    const todays = ["title", "startTime", "endTime"].map(
      (id) => prepared.items.find((item) => item.id === id)!.call
    );

    expect(() => runOnRegistry(AUGUST, todays)).toThrow("StartTimeAfterEndTime");
  });

  it("refuses a window no order fits with the registry's own reason", () => {
    expect(() =>
      prepare(AUGUST, [{ field: "startTime", value: Number(OCTOBER.startTime) }])
    ).toThrow("StartTimeAfterEndTime");
    // A start after its own end fits no order at all.
    expect(() =>
      prepare(AUGUST, [
        { field: "startTime", value: Number(OCTOBER.endTime) },
        { field: "endTime", value: Number(OCTOBER.startTime) },
      ])
    ).toThrow("StartTimeAfterEndTime");
  });

  it("calls only the registry, each with its own function, within its rail's ceilings", () => {
    const prepared = prepare(AUGUST, [
      { field: "title", value: "Renamed" },
      { field: "instructions", value: "bafy-new" },
    ]);

    expect(prepared.mode).toBe("atomic");
    expect(prepared.domain).toBe(
      `action-edit:${getNetworkContracts(chainId).actionRegistry.toLowerCase()}:42`
    );
    expect(
      prepared.items.map(({ call }) => [call.functionName, call.args, call.abi.length])
    ).toEqual([
      ["updateActionTitle", [42n, "Renamed"], 1],
      ["updateActionInstructions", [42n, "bafy-new"], 1],
    ]);
    expect(() => prepare(AUGUST, [{ field: "title", value: "x".repeat(9_000) }])).toThrow(
      "batch-budget-exceeded"
    );
  });
});

describe("sendActionEditBatch", () => {
  it("saves a window moved later under one signature, proven by reading the action", async () => {
    const registry = setup();
    const { input, sender, chain, held } = registry;
    landOnRegistry(registry);

    await expect(send(input)).resolves.toEqual({ status: "saved", transactionHash: hash });

    expect(sender.submitAtomicBatch).toHaveBeenCalledTimes(1);
    expect(held).toMatchObject({ ...OCTOBER, title: "Plant the October beds" });
    expect(chain.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "updateActionTitle", account: input.scope.account })
    );
  });

  it("stops before signing when the account does not own the action", async () => {
    const { input, sender, chain } = setup();
    chain.simulate.mockRejectedValueOnce(new Error("NotActionOwner"));

    await expect(send(input)).rejects.toThrow("NotActionOwner");

    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    await expect(readActionEditHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("stops before signing when the window moved after the order was chosen", async () => {
    const { input, sender, chain, held } = setup();
    // Read once to choose the order; by the last check someone has moved the end back.
    chain.read.mockResolvedValueOnce({ ...held }).mockResolvedValue({
      ...held,
      endTime: AUGUST.startTime + 1n,
    });

    await expect(send(input, windowChanges(MID_AUGUST_TO_MID_SEPTEMBER))).rejects.toThrow(
      "StartTimeAfterEndTime"
    );
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("says an edit past its ceilings can go one write at a time, with nothing sent", async () => {
    const { input, sender } = setup();

    await expect(send(input, [{ field: "title", value: "x".repeat(9_000) }])).resolves.toEqual({
      status: "not-batchable",
    });
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("reports a revert as not saved and holds nothing", async () => {
    const { input } = setup({ status: "reverted" });

    await expect(send(input)).resolves.toEqual({ status: "not-saved" });
    await expect(readActionEditHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });
});

describe("an action edit whose outcome is unknown", () => {
  it("is held, showing what the action holds now", async () => {
    const { input } = setup();

    await expect(send(input)).resolves.toEqual({ status: "unknown" });

    await expect(readActionEditHold(input)).resolves.toEqual({
      hold: {
        operationIds: [expect.any(String)],
        fields: ["title", "endTime", "startTime"],
        attempted: [
          { field: "title", value: "Plant the October beds" },
          { field: "endTime", value: Number(OCTOBER.endTime) },
          { field: "startTime", value: Number(OCTOBER.startTime) },
        ],
        onChain: [
          { field: "title", value: "Plant the August beds" },
          { field: "endTime", value: Number(AUGUST.endTime) },
          { field: "startTime", value: Number(AUGUST.startTime) },
        ],
      },
      saved: [],
    });
  });

  it("ends when a read proves it landed, and reports each field once", async () => {
    const { input, sender, update } = setup();
    await send(input);
    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    update({ ...OCTOBER, title: "Plant the October beds" });

    const { hold, saved } = await readActionEditHold(input);

    expect(hold).toBeNull();
    expect(saved.map((change) => change.field)).toEqual(["title", "endTime", "startTime"]);
    await expect(readActionEditHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("stays held when the chain holds only part of it, until the person moves on", async () => {
    const { input, sender, update } = setup();
    await send(input);
    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    // Another steward renamed it again right after, so only the window can be proven.
    update({ ...OCTOBER, title: "Someone else's title" });

    const partial = await readActionEditHold(input);
    expect(partial.saved).toEqual([]);
    expect(partial.hold?.onChain[0]).toEqual({ field: "title", value: "Someone else's title" });

    const ended = await moveOnFromActionEditHold(input, partial.hold!);
    expect(ended.hold).toBeNull();
    expect(ended.saved.map((change) => change.field)).toEqual(["endTime", "startTime"]);
  });

  it("will not move on while the action could not be read", async () => {
    const { input, chain } = setup();
    await send(input);
    chain.read.mockRejectedValueOnce(new Error("rpc down"));
    const { hold: unread } = await readActionEditHold(input);
    expect(unread?.onChain).toEqual([]);
    const release = vi.spyOn(input.batches, "release");

    const { hold } = await moveOnFromActionEditHold(input, unread!);

    expect(release).not.toHaveBeenCalled();
    expect(hold?.onChain).toHaveLength(3);
  });
});

describe("plain-wallet action edit recovery", () => {
  function wallet() {
    const state = setup();
    Object.assign(state.sender, { authMode: "wallet" });
    state.sender.preflightBatch = vi.fn(async () => ({
      gas: "100000",
      maxFeePerGas: "1000000000",
      maxFee: "100000000000000",
      sponsored: false,
      authority: "wallet" as const,
    }));
    const writes: string[] = [];
    state.sender.sendContractCall = vi.fn(async (call, options) => {
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcastReference?.({ kind: "transaction", hash });
      writes.push(call.functionName);
      state.update(runOnRegistry(state.held, [call as unknown as { data: Hex }]));
      return { hash, sponsored: false };
    });
    return { ...state, writes };
  }
  const changes: ActionEditChange[] = [
    { field: "title", value: "Renamed" },
    { field: "endTime", value: Number(OCTOBER.endTime) },
  ];

  it("journals each wallet signature and rechecks that exact field before sending", async () => {
    const state = wallet();
    const onSaved = vi.fn();
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes, onSaved })
    ).resolves.toEqual({ status: "saved", transactionHash: hash });
    expect(state.writes).toEqual(["updateActionTitle", "updateActionEndTime"]);
    expect(state.chain.simulate.mock.calls.map(([call]) => call.functionName)).toEqual(
      state.writes
    );
    expect(state.sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(state.sender.preflightBatch).toHaveBeenCalledTimes(2);
    expect(onSaved.mock.calls.flatMap(([saved]) => saved)).toEqual(changes);
  });

  it.each([
    "account",
    "chain",
  ])("stops before the next signature when the %s changes", async (changed) => {
    const state = wallet();
    let sameScope = true;
    state.sender.assertOwnership = vi.fn(async (account, chain) => {
      expect(account).toBe(state.input.scope.account);
      expect(chain).toBe(chainId);
      if (!sameScope) throw new Error(`${changed}-changed`);
    });
    const onSaved = vi.fn(() => {
      sameScope = false;
    });
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes, onSaved })
    ).rejects.toThrow(`${changed}-changed`);
    expect(onSaved).toHaveBeenCalledWith([changes[0]]);
    expect(state.writes).toEqual(["updateActionTitle"]);
  });

  it("keeps every field unsent after the first signature is declined", async () => {
    const state = wallet();
    state.sender.sendContractCall = vi
      .fn()
      .mockRejectedValue({ code: 4001, message: "User rejected request" });
    const onSaved = vi.fn();
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes, onSaved })
    ).resolves.toEqual({ status: "not-saved" });
    expect(onSaved).not.toHaveBeenCalled();
    expect(state.sender.sendContractCall).toHaveBeenCalledTimes(1);
    await expect(readActionEditHold(state.input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("keeps a wallet prompt with no returned reference held after a reload", async () => {
    const state = wallet();
    state.sender.sendContractCall = vi.fn(async () => {
      throw new Error("Page disconnected while the prompt was open");
    });
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes })
    ).resolves.toEqual({ status: "unknown" });
    const restored = await readActionEditHold(state.input);
    expect(restored.saved).toEqual([]);
    expect(restored.hold?.fields).toEqual(["title", "endTime"]);
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes })
    ).rejects.toThrow("batch-items-held");
    expect(state.sender.sendContractCall).toHaveBeenCalledTimes(1);
  });

  it("holds an interrupted second prompt across reload and never resends the confirmed first field", async () => {
    const state = wallet();
    const sendOne = state.sender.sendContractCall;
    state.sender.sendContractCall = vi.fn(async (call, options) => {
      if (call.functionName === "updateActionTitle") return sendOne(call, options);
      await options?.onBeforeBroadcast?.();
      await options?.onBroadcastReference?.({ kind: "transaction", hash });
      return { hash, sponsored: false, confirmation: "pending" as const };
    });
    const onSaved = vi.fn();
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes, onSaved })
    ).resolves.toEqual({ status: "unknown" });
    expect(onSaved).toHaveBeenCalledWith([changes[0]]);
    const { hold } = await readActionEditHold(state.input);
    expect(hold?.fields).toEqual(["title", "endTime"]);
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes })
    ).rejects.toThrow("batch-items-held");
    expect(state.sender.sendContractCall).toHaveBeenCalledTimes(2);
    state.update({ endTime: OCTOBER.endTime });
    state.sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: false,
    }));
    await expect(readActionEditHold(state.input, hold)).resolves.toEqual({
      hold: null,
      saved: changes,
    });
    expect(state.sender.sendContractCall).toHaveBeenCalledTimes(2);
  });

  it("keeps proven progress when the next prompt is declined, so a retry sends only the remaining field", async () => {
    const state = wallet();
    const sendOne = state.sender.sendContractCall;
    state.sender.sendContractCall = vi.fn(async (call, options) => {
      if (call.functionName === "updateActionEndTime")
        throw { code: 4001, message: "User rejected request" };
      return sendOne(call, options);
    });
    const saved: ActionEditChange[] = [];
    await expect(
      sendActionEditBatch({
        ...state.input,
        rail: "wallet",
        atomic: false,
        changes,
        onSaved: (fields) => saved.push(...fields),
      })
    ).resolves.toEqual({ status: "not-saved" });
    expect(saved).toEqual([changes[0]]);
    state.sender.sendContractCall = sendOne;
    const remaining = changes.filter(
      (change) => !saved.some((done) => done.field === change.field)
    );
    await expect(
      sendActionEditBatch({ ...state.input, rail: "wallet", atomic: false, changes: remaining })
    ).resolves.toEqual({ status: "saved", transactionHash: hash });
    expect(state.writes).toEqual(["updateActionTitle", "updateActionEndTime"]);
  });
});
