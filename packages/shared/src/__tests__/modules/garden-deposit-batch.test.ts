import "fake-indexeddb/auto";
import { encodeAbiParameters, encodeEventTopics, type Log, parseAbi, toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  type DepositChain,
  type DepositTarget,
  moveOnFromDepositHold,
  prepareDepositBatch,
  readDepositHold,
  sendDepositBatch,
} from "../../modules/garden/deposit-batch";
import { depositBudget, depositRoute, walletRouteListed } from "../../modules/garden/deposit-route";
import {
  type BatchExecution,
  BatchNotSubmittedError,
} from "../../modules/transactions/batch-types";
import type { Address } from "../../types/domain";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};
const EVENTS = parseAbi([
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);
const JAR_EVENTS = parseAbi([
  "event Deposit(address indexed depositor, uint256 amount, address indexed token)",
]);

/** Every test gets its own addresses: the journal outlives each one. */
function address(): Address {
  return toHex(crypto.getRandomValues(new Uint8Array(20)));
}

function vaultDepositLog(
  vault: Address,
  sender: Address,
  owner: Address,
  assets: bigint
): Partial<Log> {
  return {
    address: vault,
    topics: encodeEventTopics({
      abi: EVENTS,
      eventName: "Deposit",
      args: { sender, owner },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [assets, assets]),
  };
}

function jarDepositLog(jar: Address, depositor: Address, token: Address, amount: bigint) {
  return {
    address: jar,
    topics: encodeEventTopics({
      abi: JAR_EVENTS,
      eventName: "Deposit",
      args: { depositor, token },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
  } as Partial<Log>;
}

function approvalLog(asset: Address, owner: Address, spender: Address, value: bigint) {
  return {
    address: asset,
    topics: encodeEventTopics({
      abi: EVENTS,
      eventName: "Approval",
      args: { owner, spender },
    }) as Log["topics"],
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  } as Partial<Log>;
}

function setup(execution: Partial<BatchExecution> = {}, allowance = 0n) {
  const account = address();
  const vault = address();
  const asset = address();
  const target: DepositTarget = { kind: "vault", address: vault, asset, receiver: account };
  const sender = createFakeBatchingSender(account, execution);
  const logs: Partial<Log>[] = [];
  const chain = {
    allowance: vi.fn(async () => allowance),
    logsOf: vi.fn(async () => logs as Log[]),
    held: vi.fn(async () => 250n as bigint),
  } satisfies DepositChain;
  const input = {
    batches: sender.batches!,
    chain,
    target,
    scope: { account, chainId },
    retryMs: 0,
  };
  const send = (amount: bigint, atomic = true) =>
    sendDepositBatch({ ...input, rail: "passkey", atomic, amount });
  return { input, send, sender, chain, logs, account, vault, asset, target };
}

const withBudget = { id: "attempt", account: address(), chainId, rail: "passkey" as const };

describe("prepareDepositBatch", () => {
  const vault = address();
  const asset = address();
  const target: DepositTarget = { kind: "vault", address: vault, asset, receiver: address() };
  const prepare = (allowance: bigint, amount = 100n) =>
    prepareDepositBatch({ ...withBudget, atomic: true, target, amount, allowance });
  const itemIds = (prepared: ReturnType<typeof prepare>) => prepared.items.map(({ id }) => id);

  it("approves the exact amount, with nothing else in the way", () => {
    const prepared = prepare(0n);

    expect(itemIds(prepared)).toEqual(["approve", "deposit"]);
    expect(prepared.items[0].call.args).toEqual([vault, 100n]);
    expect(prepared.items[1].call.args[0]).toBe(100n);
  });

  it("resets only a nonzero allowance that is too low", () => {
    expect(itemIds(prepare(40n))).toEqual(["reset", "approve", "deposit"]);
    expect(prepare(40n).items[0].call.args).toEqual([vault, 0n]);
  });

  it("goes straight to the deposit when the allowance already covers it", () => {
    expect(itemIds(prepare(100n))).toEqual(["deposit"]);
    expect(itemIds(prepare(500n))).toEqual(["deposit"]);
  });

  it("never resets a jar, which has only ever taken one approval", () => {
    const jar: DepositTarget = { kind: "jar", address: address(), asset };
    const prepared = prepareDepositBatch({
      ...withBudget,
      atomic: true,
      target: jar,
      amount: 100n,
      allowance: 40n,
    });

    expect(itemIds(prepared)).toEqual(["approve", "deposit"]);
    expect(prepared.items[1].call.args).toEqual([100n]);
  });

  it("has no ceilings on a chain nobody has measured", () => {
    expect(depositBudget("passkey", 1)).toBeNull();
    expect(depositBudget("wallet", 42161)).not.toBeNull();
  });
});

describe("depositRoute", () => {
  const asset = address();
  const route = (input: Partial<Parameters<typeof depositRoute>[0]>) =>
    depositRoute({
      action: "vault-deposit",
      rail: "passkey",
      passkeyProfile: "kernel-0.3.1-legacy",
      walletAtomic: undefined,
      chainId,
      asset,
      ...input,
    });

  it("keeps today's flow while nothing is listed", () => {
    expect(route({})).toBeNull();
    expect(route({ rail: "wallet", walletAtomic: true })).toBeNull();
    expect(walletRouteListed({ action: "vault-deposit", chainId, asset })).toBe(false);
  });
});

describe("sendDepositBatch", () => {
  it("sends one request where the rail can, and proves it by the Deposit event", async () => {
    const { send, sender, logs, account, vault, asset } = setup(CONFIRMED, 40n);
    logs.push(
      approvalLog(asset, account, vault, 0n),
      approvalLog(asset, account, vault, 100n),
      vaultDepositLog(vault, account, account, 100n)
    );

    await expect(send(100n)).resolves.toEqual({ status: "deposited", transactionHash: hash });

    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(
      vi.mocked(sender.submitAtomicBatch!).mock.calls[0][0].map((c) => c.functionName)
    ).toEqual(["approve", "approve", "deposit"]);
  });

  it("sends one request per step on a plain wallet", async () => {
    const { send, sender, logs, account, vault, asset } = setup(CONFIRMED);
    logs.push(
      approvalLog(asset, account, vault, 100n),
      vaultDepositLog(vault, account, account, 100n)
    );

    await expect(send(100n, false)).resolves.toMatchObject({ status: "deposited" });

    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["no Deposit event", () => []],
    ["one for another amount", (a: Address, v: Address) => [vaultDepositLog(v, a, a, 99n)]],
    ["one for another receiver", (a: Address, v: Address) => [vaultDepositLog(v, a, v, 100n)]],
    ["one from another sender", (a: Address, v: Address) => [vaultDepositLog(v, v, a, 100n)]],
    ["one from another vault", (a: Address) => [vaultDepositLog(a, a, a, 100n)]],
  ])("is not done with %s in the receipt, and holds the next deposit", async (_case, logsFor) => {
    const { send, logs, account, vault, chain } = setup(CONFIRMED, 100n);
    logs.push(...logsFor(account, vault));

    await expect(send(100n)).resolves.toEqual({ status: "unknown" });

    expect(chain.logsOf).toHaveBeenCalled();
    await expect(send(50n)).rejects.toThrow("batch-items-held");
  });

  it("confirms a jar by its own Deposit event", async () => {
    const { input, logs, account, asset } = setup(CONFIRMED, 100n);
    const jar = address();
    logs.push(jarDepositLog(jar, account, asset, 100n));

    await expect(
      sendDepositBatch({
        ...input,
        target: { kind: "jar", address: jar, asset },
        rail: "passkey",
        atomic: true,
        amount: 100n,
      })
    ).resolves.toMatchObject({ status: "deposited" });
  });

  it.each([
    ["another amount", (a: Address, j: Address, t: Address) => [jarDepositLog(j, a, t, 99n)]],
    ["another depositor", (_a: Address, j: Address, t: Address) => [jarDepositLog(j, j, t, 100n)]],
  ])("is not done with a jar's event for %s", async (_case, logsFor) => {
    const { input, logs, account, asset } = setup(CONFIRMED, 100n);
    const jar = address();
    logs.push(...logsFor(account, jar, asset));

    await expect(
      sendDepositBatch({
        ...input,
        target: { kind: "jar", address: jar, asset },
        rail: "passkey",
        atomic: true,
        amount: 100n,
      })
    ).resolves.toEqual({ status: "unknown" });
  });

  it("reports a declined signature as not sent, and holds nothing", async () => {
    const { send, sender, logs, account, vault } = setup(CONFIRMED, 100n);
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(new Error("User rejected"));

    await expect(send(100n)).resolves.toEqual({ status: "declined" });

    logs.push(vaultDepositLog(vault, account, account, 100n));
    await expect(send(100n)).resolves.toMatchObject({ status: "deposited" });
  });

  it("reports a revert as not sent, and holds nothing", async () => {
    const { send } = setup({ status: "reverted", receipts: [] }, 100n);

    await expect(send(100n)).resolves.toEqual({ status: "reverted" });
    await expect(send(100n)).resolves.toEqual({ status: "reverted" });
  });

  it("holds a confirmed deposit against nothing", async () => {
    const { send, input, logs, account, vault } = setup(CONFIRMED, 100n);
    logs.push(vaultDepositLog(vault, account, account, 100n));

    await send(100n);

    await expect(readDepositHold(input)).resolves.toEqual({ hold: null, saved: [] });
    await expect(send(100n)).resolves.toMatchObject({ status: "deposited" });
  });

  it("runs the last check right before the deposit is signed, after any approval", async () => {
    const { input, sender, logs, account, vault, asset } = setup(CONFIRMED);
    logs.push(
      approvalLog(asset, account, vault, 100n),
      vaultDepositLog(vault, account, account, 100n)
    );
    const sentBeforeCheck: number[] = [];

    await sendDepositBatch({
      ...input,
      rail: "passkey",
      atomic: false,
      amount: 100n,
      checkBeforeDeposit: async () => {
        sentBeforeCheck.push(vi.mocked(sender.sendContractCall).mock.calls.length);
      },
    });

    expect(sentBeforeCheck).toEqual([1]);
  });

  it("runs that check before signing an atomic group, with nothing able to land between", async () => {
    const { input, sender, logs, account, vault, asset } = setup(CONFIRMED);
    logs.push(
      approvalLog(asset, account, vault, 100n),
      vaultDepositLog(vault, account, account, 100n)
    );
    const submittedBeforeCheck: number[] = [];

    await sendDepositBatch({
      ...input,
      rail: "passkey",
      atomic: true,
      amount: 100n,
      checkBeforeDeposit: async () => {
        submittedBeforeCheck.push(vi.mocked(sender.submitAtomicBatch!).mock.calls.length);
      },
    });

    expect(submittedBeforeCheck).toEqual([0]);
  });

  it("sends nothing when that check refuses, and says why", async () => {
    const { input, sender } = setup(CONFIRMED, 100n);
    const refused = new Error("Exchange rate moved");

    await expect(
      sendDepositBatch({
        ...input,
        rail: "passkey",
        atomic: true,
        amount: 100n,
        checkBeforeDeposit: async () => {
          throw refused;
        },
      })
    ).rejects.toBe(refused);

    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("passes on a group past its ceilings, for the caller to ask before going step by step", async () => {
    const { send, sender } = setup(CONFIRMED, 100n);
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(
      new BatchNotSubmittedError(new Error("batch-budget-exceeded"))
    );

    await expect(send(100n)).rejects.toThrow("batch-budget-exceeded");
  });
});

describe("holding a deposit whose outcome is unknown", () => {
  it("survives a reload, and shows what was tried and what the chain holds", async () => {
    const { send, input, chain } = setup({}, 100n);

    await expect(send(100n)).resolves.toEqual({ status: "unknown" });

    // A new read, as after a reload: only the journal carries it.
    await expect(readDepositHold(input)).resolves.toEqual({
      hold: { operationIds: [expect.any(String)], amount: 100n, held: 250n },
      saved: [],
    });
    expect(chain.held).toHaveBeenCalledWith(input.scope.account, input.target);
  });

  it("holds the next deposit into that vault from that account, and no other", async () => {
    const first = setup({}, 100n);
    await first.send(100n);

    await expect(first.send(100n)).rejects.toThrow("batch-items-held");
    await expect(
      sendDepositBatch({
        ...first.input,
        target: {
          ...first.target,
          address: first.vault.toUpperCase().replace("0X", "0x") as Address,
        },
        rail: "passkey",
        atomic: true,
        amount: 100n,
      })
    ).rejects.toThrow("batch-items-held");

    const elsewhere = { ...first.input.target, address: address() };
    await expect(
      sendDepositBatch({
        ...first.input,
        target: elsewhere,
        rail: "passkey",
        atomic: true,
        amount: 100n,
      })
    ).resolves.toEqual({ status: "unknown" });
  });

  it("ends when a read proves the deposit landed, and reports it once", async () => {
    const { send, input, sender, logs, account, vault } = setup({}, 100n);
    await send(100n);
    sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    logs.push(vaultDepositLog(vault, account, account, 100n));

    await expect(readDepositHold(input)).resolves.toEqual({
      hold: null,
      saved: [{ amount: 100n, transactionHash: hash }],
    });
    await expect(readDepositHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("ends with no deposit reported when only the approval landed", async () => {
    const { send, input, sender, logs, account, vault, asset } = setup();
    await expect(send(100n, false)).resolves.toEqual({ status: "unknown" });
    sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    logs.push(approvalLog(asset, account, vault, 100n));

    await expect(readDepositHold(input)).resolves.toEqual({ hold: null, saved: [] });

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("frees the vault when the person moves on from what they saw", async () => {
    const { send, input } = setup({}, 100n);
    await send(100n);
    const { hold } = await readDepositHold(input);

    await expect(moveOnFromDepositHold(input, hold!)).resolves.toEqual({ hold: null, saved: [] });

    await expect(send(100n)).resolves.toEqual({ status: "unknown" });
  });

  it("will not move on from a value the person could not see", async () => {
    const { send, input, chain } = setup({}, 100n);
    await send(100n);
    chain.held.mockRejectedValueOnce(new Error("rpc down"));
    const { hold: unread } = await readDepositHold(input);
    expect(unread?.held).toBeNull();
    const release = vi.spyOn(input.batches, "release");

    const { hold } = await moveOnFromDepositHold(input, unread!);

    expect(release).not.toHaveBeenCalled();
    expect(hold?.held).toBe(250n);
  });
});
