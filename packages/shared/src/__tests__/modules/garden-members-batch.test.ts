import "fake-indexeddb/auto";
import { toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  addGardenMembersBatch,
  type GardenMemberRow,
  type GardenMembersChain,
  gardenMembersBudget,
  moveOnFromAddMembersHold,
  prepareAddMembersBatch,
  readAddMembersHold,
} from "../../modules/garden/members-batch";
import {
  type BatchExecution,
  BatchNotSubmittedError,
} from "../../modules/transactions/batch-types";
import type { Address } from "../../types/domain";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;
const MODULE: Address = "0x5b943088ecdDBF8E4ae387348A88A654aC5F7266";
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};

/** Every test gets its own account and garden: the journal outlives each one. */
function address(): Address {
  return toHex(crypto.getRandomValues(new Uint8Array(20)));
}

const row = (role: GardenMemberRow["role"] = "gardener"): GardenMemberRow => ({
  address: address(),
  role,
});

/** A chain where `wearing` holds who wears what; a call is refused when `refuse` says why. */
function chainWith(refuse: (args: readonly unknown[], fn: string) => string | null = () => null) {
  const wearing = new Set<string>();
  const key = (member: GardenMemberRow) => `${member.address.toLowerCase()}:${member.role}`;
  const chain = {
    hatsModule: vi.fn(async () => MODULE as Address | undefined),
    wearsRole: vi.fn(async (member: GardenMemberRow) => wearing.has(key(member))),
    refusal: vi.fn(async (call: Parameters<GardenMembersChain["refusal"]>[0]) =>
      refuse(call.args, call.functionName)
    ),
  } satisfies GardenMembersChain;
  return {
    chain,
    wear: (...members: GardenMemberRow[]) => {
      for (const member of members) wearing.add(key(member));
    },
  };
}

function setup(
  execution: Partial<BatchExecution> = {},
  refuse?: (args: readonly unknown[], fn: string) => string | null
) {
  const account = address();
  const gardenAddress = address();
  const sender = createFakeBatchingSender(account, execution);
  const batches = sender.batches!;
  const { chain, wear } = chainWith(refuse);
  const input = { batches, chain, gardenAddress, scope: { account, chainId }, retryMs: 0 };
  return { input, sender, batches, chain, wear };
}

const add = (input: ReturnType<typeof setup>["input"], rows: GardenMemberRow[]) =>
  addGardenMembersBatch({ ...input, rail: "passkey", rows });

describe("prepareAddMembersBatch", () => {
  it("sends every row in one call that every item shares", () => {
    const gardenAddress = address();
    const rows = [row("gardener"), row("steward")];

    const prepared = prepareAddMembersBatch({
      id: "attempt-1",
      account: address(),
      chainId,
      gardenAddress,
      moduleAddress: MODULE,
      rail: "wallet",
      rows,
    });

    expect(prepared.mode).toBe("single-call");
    expect(prepared.domain).toBe(`add-members:${gardenAddress.toLowerCase()}`);
    expect(prepared.items.map((item) => item.id)).toEqual(
      rows.map(({ address: member, role }) => `${member.toLowerCase()}:${role}`)
    );
    const [first, second] = prepared.items;
    expect(first.call.functionName).toBe("grantRoles");
    expect(first.call.abi).toHaveLength(1);
    expect(first.call.address).toBe(MODULE);
    expect(first.call.args).toEqual([gardenAddress, rows.map((r) => r.address), [0, 2]]);
    expect(second.call.data).toBe(first.call.data);
    expect(prepared.budget?.sponsorship).toBe("wallet");
  });

  it("has no ceilings on a chain nobody has measured", () => {
    expect(gardenMembersBudget("passkey", chainId)?.sponsorship).toBe("required");
    expect(gardenMembersBudget("passkey", 42220)).toBeNull();
  });
});

describe("addGardenMembersBatch", () => {
  it("adds every row under one signature, and proves each by its hat", async () => {
    const { input, sender, chain, wear } = setup(CONFIRMED);
    const rows = [row(), row("evaluator")];
    chain.refusal.mockImplementation(async () => {
      wear(...rows);
      return null;
    });

    const outcome = await add(input, rows);

    expect(sender.sendContractCall).toHaveBeenCalledTimes(1);
    expect(outcome.added.map(({ address: member }) => member)).toEqual(rows.map((r) => r.address));
    expect(outcome.added[0].transactionHash).toBe(hash);
    expect(outcome.notSent).toEqual([]);
    await expect(readAddMembersHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("takes eleven people in two signatures, and ten at most in each", async () => {
    const { input, sender, chain, wear } = setup(CONFIRMED);
    const rows = Array.from({ length: 11 }, () => row());
    chain.refusal.mockImplementation(async () => {
      wear(...rows);
      return null;
    });

    const onLanded = vi.fn();
    const outcome = await addGardenMembersBatch({ ...input, rail: "passkey", rows, onLanded });

    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
    expect(onLanded.mock.calls.map(([landed]) => landed.length)).toEqual([10, 1]);
    const sent = vi.mocked(sender.sendContractCall).mock.calls.map(([call]) => call.args[1]);
    expect((sent[0] as Address[]).length).toBe(10);
    expect((sent[1] as Address[]).length).toBe(1);
    expect(outcome.added).toHaveLength(11);
  });

  it("collapses a repeated row, and asks nobody to sign for a role already held", async () => {
    const { input, sender, wear } = setup(CONFIRMED);
    const holder = row();
    wear(holder);

    const outcome = await add(input, [holder, { ...holder }]);

    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(outcome.alreadyHeld).toEqual([holder]);
    expect(outcome.added).toEqual([]);
  });

  it("names the rows the chain refuses, and sends nothing until the list changes", async () => {
    const bad = row();
    const good = row();
    const { input, sender } = setup(CONFIRMED, (args, fn) => {
      if (fn === "grantRoles") return "The whole call reverts";
      return args[1] === bad.address ? "All hats worn" : null;
    });

    const outcome = await add(input, [good, bad]);

    expect(outcome.refused).toEqual([{ ...bad, reason: "All hats worn" }]);
    expect(outcome.notSent).toEqual([good]);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    await expect(readAddMembersHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("sends nothing blind when the call is refused but no single row is", async () => {
    const rows = [row(), row()];
    const { input, sender } = setup(CONFIRMED, (_args, fn) =>
      fn === "grantRoles" ? "The whole call reverts" : null
    );

    const outcome = await add(input, rows);

    expect(outcome.refused).toEqual([]);
    expect(outcome.notSent).toEqual(rows);
    expect(outcome.failure).toEqual(new Error("The whole call reverts"));
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("keeps earlier signatures when a later one is declined", async () => {
    const { input, sender, chain, wear } = setup(CONFIRMED);
    const rows = Array.from({ length: 11 }, () => row());
    chain.refusal.mockImplementation(async () => {
      wear(...rows);
      return null;
    });
    const send = vi.mocked(sender.sendContractCall);
    send.mockImplementationOnce(async (_call, options) => {
      await options?.onBeforeBroadcast?.({ kind: "user-operation", hash });
      await options?.onBroadcastReference?.({ kind: "user-operation", hash });
      return { hash, sponsored: true, broadcastReference: { kind: "user-operation", hash } };
    });
    send.mockImplementationOnce(async () => {
      throw new BatchNotSubmittedError(new Error("User rejected the request"));
    });

    const outcome = await add(input, rows);

    expect(outcome.added.map(({ address: member }) => member)).toEqual(
      rows.slice(0, 10).map((r) => r.address)
    );
    expect(outcome.notSent).toEqual(rows.slice(10));
    expect(outcome.failure).toBeUndefined();
  });

  it("goes one at a time when the last check before signing refuses the group", async () => {
    const { input, sender } = setup(CONFIRMED);
    const rows = [row(), row()];
    vi.mocked(sender.sendContractCall).mockImplementationOnce(async () => {
      throw new BatchNotSubmittedError(new Error("batch-budget-exceeded"));
    });

    const outcome = await add(input, rows);

    expect(outcome.notBatchable).toEqual(rows);
    expect(outcome.notSent).toEqual([]);
  });

  it("stops before signing when the sender has lost the role, with the reason", async () => {
    const rows = [row(), row()];
    let reads = 0;
    const { input, sender } = setup(CONFIRMED, () => {
      reads += 1;
      // The first check passes; the recheck just before signing does not.
      return reads > 1 ? "Not a garden admin" : null;
    });

    const outcome = await add(input, rows);

    expect(outcome.notSent).toEqual(rows);
    expect(outcome.failure).toEqual(new Error("Not a garden admin"));
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
});

describe("holding an add whose outcome is unknown", () => {
  it("holds its rows, leaves the rest for later, and shows what the chain says", async () => {
    const { input, wear } = setup();
    const rows = [row(), row("steward")];

    const outcome = await add(input, rows);
    expect(outcome.unknown).toEqual(rows.map(lowercased));
    wear(rows[0]);

    await expect(readAddMembersHold(input)).resolves.toEqual({
      hold: {
        operationIds: [expect.any(String)],
        rows: rows.map(lowercased),
        onChain: [
          { ...lowercased(rows[0]), wearsRole: true },
          { ...lowercased(rows[1]), wearsRole: false },
        ],
      },
      saved: [],
    });
  });

  it("will not move on from a row the person could not see", async () => {
    const { input, chain, batches } = setup();
    await add(input, [row(), row()]);
    chain.wearsRole.mockRejectedValueOnce(new Error("rpc down"));
    const { hold: unread } = await readAddMembersHold(input);
    expect(unread?.onChain).toHaveLength(1);
    const release = vi.spyOn(batches, "release");

    const { hold } = await moveOnFromAddMembersHold(input, unread!);

    expect(release).not.toHaveBeenCalled();
    expect(hold?.onChain).toHaveLength(2);
  });

  it("frees its rows when the person moves on, and ends only what they saw", async () => {
    const { input } = setup();
    await add(input, [row(), row()]);
    const { hold: shown } = await readAddMembersHold(input);
    const later = [row(), row()];
    await add(input, later);

    const { hold } = await moveOnFromAddMembersHold(input, shown!);

    expect(hold?.rows).toEqual(later.map(lowercased));
  });

  it("ends when a read proves the add landed, and reports it once", async () => {
    const { input, sender, wear } = setup();
    const rows = [row(), row()];
    await add(input, rows);
    sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    wear(...rows);

    await expect(readAddMembersHold(input)).resolves.toEqual({
      hold: null,
      saved: rows.map(lowercased),
    });
    await expect(readAddMembersHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });
});

/** The journal's item IDs carry lowercase addresses, so a row read back from one does too. */
function lowercased(member: GardenMemberRow): GardenMemberRow {
  return { ...member, address: member.address.toLowerCase() as Address };
}
