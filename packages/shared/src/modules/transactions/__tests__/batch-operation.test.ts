import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BatchJournal } from "../batch-journal";
import { prepareBatch } from "../prepared-batch";
import {
  executeBatchOperation,
  reconcileBatchOperation,
  releaseBatchOperation,
} from "../batch-operation";
import {
  createMockContractCall,
  createMockBatchBudget,
} from "../../../__tests__/test-utils/transaction-fakes";
import { BatchNotSubmittedError, type BatchQuote } from "../batch-types";
import type { TransactionSender } from "../types";

const account = "0x1111111111111111111111111111111111111111" as const;
const hash = `0x${"a".repeat(64)}` as const;
const reference = { kind: "wallet-calls", id: "proposal:123", account, chainId: 42161 } as const;
const databases: BatchJournal[] = [];
function setup(
  mode: "atomic" | "sequential" | "single-call" = "atomic",
  reviewed = true,
  now?: () => number
) {
  const journal = new BatchJournal(`test-operation-${crypto.randomUUID()}`, now);
  databases.push(journal);
  const prepared = prepareBatch({
    id: "operation",
    account,
    chainId: 42161,
    domain: "settings",
    ...(reviewed ? { budget: createMockBatchBudget() } : {}),
    mode,
    items: ["name", "description"].map((id) => ({ id, call: createMockContractCall({ account }) })),
  });
  const sender = {
    authMode: "wallet",
    supportsBatching: false,
    supportsSponsorship: false,
    assertOwnership: vi.fn(async () => undefined),
    sendContractCall: vi.fn(async () => ({ hash, sponsored: false })),
    getBatchCapability: vi.fn(async () => ({ account, chainId: 42161, atomic: "supported" })),
    preflightBatch: vi.fn(async () => ({
      gas: "300000",
      maxFeePerGas: "2000000",
      maxFee: "600000000000",
      sponsored: false,
      authority: "wallet",
    })),
    submitAtomicBatch: vi.fn<NonNullable<TransactionSender["submitAtomicBatch"]>>(
      async (_calls, options = {}) => {
        await options.onBeforeBroadcast?.();
        await options.onBatchReference?.(reference);
        return {
          status: "confirmed",
          reference,
          receipts: [{ transactionHash: hash, status: "success" }],
          sponsored: false,
        };
      }
    ),
    reconcileBatch: vi.fn(async () => ({
      status: "confirmed",
      reference,
      receipts: [{ transactionHash: hash, status: "success" }],
      sponsored: false,
    })),
  } as unknown as TransactionSender;
  return { journal, prepared, sender };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
const preflight = async () => undefined;
const verify = async () => ["name", "description"];

describe("batch operation recovery", () => {
  it("persists intent before the sender and receipts before domain verification", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.submitAtomicBatch!).mockImplementation(async (_calls, options) => {
      expect(await journal.get(prepared.id)).toMatchObject({ status: "awaiting-approval" });
      await options!.onBatchReference?.(reference);
      expect(await journal.get(prepared.id)).toMatchObject({ reference });
      return {
        status: "confirmed",
        reference,
        receipts: [{ transactionHash: hash, status: "success" }],
        sponsored: false,
      };
    });
    const result = await executeBatchOperation({
      journal,
      prepared,
      sender,
      preflight,
      verify: async (record) => {
        expect((await journal.get(prepared.id))?.receipts).toHaveLength(1);
        expect(record.receipts[0].transactionHash).toBe(hash);
        return verify();
      },
    });
    expect(result.status).toBe("confirmed");
    expect(result.itemStates).toEqual({ name: "confirmed", description: "confirmed" });
  });
  it("recovers a timed-out accepted request after reopen without another send", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.submitAtomicBatch!).mockImplementation(async (_calls, options) => {
      await options!.onBatchReference?.(reference);
      throw new Error("lost receipt response");
    });
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("unresolved");
    journal.close();
    expect(
      (
        await reconcileBatchOperation({
          journal,
          operationId: prepared.id,
          account,
          chainId: 42161,
          sender,
          verify,
        })
      ).status
    ).toBe("confirmed");
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("confirmed");
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
  });
  it("holds an ambiguous send with no ID and never falls back automatically", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValue(new Error("connection lost"));
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("unresolved");
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("unresolved");
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("preserves sequential successes and stops at an uncertain item", async () => {
    const { journal, prepared, sender } = setup("sequential");
    vi.mocked(sender.sendContractCall)
      .mockResolvedValueOnce({ hash, sponsored: false })
      .mockRejectedValueOnce(new Error("lost response"));
    const result = await executeBatchOperation({
      journal,
      prepared,
      sender,
      preflight,
      verify: async (r) => r.itemIds,
    });
    expect(result.status).toBe("unresolved");
    expect(result.itemStates).toEqual({ name: "confirmed", description: "unresolved" });
    await executeBatchOperation({ journal, prepared, sender, preflight, verify });
    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
  });
  it("does not invoke the sender when storage cannot keep the intent", async () => {
    const { journal, prepared, sender } = setup();
    vi.spyOn(journal, "checkpoint").mockRejectedValue(new Error("quota"));
    await expect(
      executeBatchOperation({ journal, prepared, sender, preflight, verify })
    ).rejects.toThrow("quota");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });
  it("keeps successful receipts unresolved until the domain verifies every item", async () => {
    const { journal, prepared, sender } = setup();
    const result = await executeBatchOperation({
      journal,
      prepared,
      sender,
      preflight,
      verify: async () => ["name"],
    });
    expect(result.status).toBe("unresolved");
    expect(result.receipts).toHaveLength(1);
    expect(result.itemStates).toEqual({ name: "confirmed", description: "unresolved" });
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("confirmed");
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
  });
  it("rechecks session ownership after preflight without opening a signer", async () => {
    const { journal, prepared, sender } = setup();
    await expect(
      executeBatchOperation({
        journal,
        prepared,
        sender,
        verify,
        preflight: async () => {
          vi.mocked(sender.assertOwnership!).mockRejectedValue(
            new Error("submission-ownership-changed")
          );
        },
      })
    ).rejects.toThrow("submission-ownership-changed");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });
  it("rejects an upgrade-required atomic path before sending", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.getBatchCapability!).mockResolvedValue({
      account,
      chainId: 42161,
      atomic: "ready",
    });
    await expect(
      executeBatchOperation({ journal, prepared, sender, preflight, verify })
    ).rejects.toThrow("batch-atomic-unavailable");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });
});

it("records several native attestation items with one ordinary wallet contract call", async () => {
  const { journal, prepared, sender } = setup("single-call");
  const result = await executeBatchOperation({ journal, prepared, sender, preflight, verify });
  expect(result.status).toBe("confirmed");
  expect(result.itemStates).toEqual({ name: "confirmed", description: "confirmed" });
  expect(sender.sendContractCall).toHaveBeenCalledOnce();
  expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  expect(sender.getBatchCapability).not.toHaveBeenCalled();
});

it("keeps an adapter-proven pre-broadcast failure editable without an unresolved hold", async () => {
  const { journal, prepared, sender } = setup();
  vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(
    new BatchNotSubmittedError(new Error("session ended before broadcast"))
  );
  expect(
    (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
  ).toBe("prepared");
  expect(
    (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
  ).toBe("confirmed");
  expect(sender.submitAtomicBatch).toHaveBeenCalledTimes(2);
});

it("persists an opaque Safe proposal separately from transaction hashes", async () => {
  const { journal, prepared, sender } = setup("single-call");
  vi.mocked(sender.sendContractCall).mockResolvedValueOnce({
    hash: "safe:proposal" as `0x${string}`,
    confirmation: "pending",
    sponsored: false,
  });
  const first = await executeBatchOperation({ journal, prepared, sender, preflight, verify });
  expect(first.reference).toMatchObject({ kind: "wallet-transaction", id: "safe:proposal" });
  journal.close();
  expect((await journal.get(prepared.id))?.reference).toMatchObject({ id: "safe:proposal" });
  vi.mocked(sender.reconcileBatch!).mockResolvedValueOnce({
    status: "confirmed",
    reference: first.reference,
    receipts: [{ transactionHash: hash, status: "success" }],
    sponsored: false,
  });
  expect(
    (
      await reconcileBatchOperation({
        journal,
        operationId: prepared.id,
        account,
        chainId: 42161,
        sender,
        verify,
      })
    ).status
  ).toBe("confirmed");
  expect(sender.sendContractCall).toHaveBeenCalledOnce();
});

it("holds the accepted identity when a response names another submission", async () => {
  const { journal, prepared, sender } = setup();
  vi.mocked(sender.submitAtomicBatch!).mockImplementation(async (_calls, options) => {
    await options?.onBatchReference?.(reference);
    return {
      status: "confirmed",
      reference: { ...reference, id: "another:batch" },
      receipts: [{ transactionHash: hash, status: "success" }],
      sponsored: false,
    };
  });
  const result = await executeBatchOperation({ journal, prepared, sender, preflight, verify });
  expect(result.status).toBe("unresolved");
  expect((await journal.get(prepared.id))?.reference).toEqual(reference);
});

it("sends the reviewed snapshot when the caller changes its draft during preflight", async () => {
  const { journal, prepared, sender } = setup();
  await executeBatchOperation({
    journal,
    prepared,
    sender,
    verify,
    preflight: async () => {
      prepared.items[0].call.args = [account, 9999n];
    },
  });
  expect(vi.mocked(sender.submitAtomicBatch!).mock.calls[0][0][0].args[1]).toBe(1000n);
});

it("refuses to open a signer without reviewed gas and sponsorship ceilings", async () => {
  const { journal, prepared, sender } = setup("atomic", false);
  await expect(
    executeBatchOperation({ journal, prepared, sender, preflight, verify })
  ).rejects.toThrow("batch-budget-required");
  expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
});

it("requires a transport quote before recording a signing intent", async () => {
  const { journal, prepared, sender } = setup();
  delete sender.preflightBatch;
  const reviewed = prepareBatch({
    ...prepared,
    budget: createMockBatchBudget(),
    items: prepared.items.map((item) => ({
      ...item,
      call: { ...item.call, value: BigInt(item.call.value) },
    })),
  });
  await expect(
    executeBatchOperation({ journal, prepared: reviewed, sender, preflight, verify })
  ).rejects.toThrow("batch-preflight-unavailable");
  expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
});

describe("ending a hold", () => {
  const scope = { account, chainId: 42161 };
  const walletQuote: BatchQuote = {
    gas: "300000",
    maxFeePerGas: "2000000",
    maxFee: "600000000000",
    sponsored: false,
    authority: "wallet",
  };
  const passkeyQuote: BatchQuote = { ...walletQuote, sponsored: true, authority: "user-operation" };
  const userOperation = { kind: "user-operation", hash, chainId: 42161 } as const;

  function passkeySetup() {
    const { journal, sender } = setup();
    const prepared = prepareBatch({
      id: "operation",
      ...scope,
      domain: "settings",
      budget: createMockBatchBudget({ sponsorship: "required" }),
      mode: "atomic",
      items: ["name", "description"].map((id) => ({
        id,
        call: createMockContractCall({ account }),
      })),
    });
    vi.mocked(sender.preflightBatch!).mockResolvedValue(passkeyQuote);
    return { journal, prepared, sender };
  }

  /** What a closed tab leaves behind: the prompt opened and nothing came back. */
  async function closeTabDuringPrompt(
    journal: BatchJournal,
    prepared: ReturnType<typeof prepareBatch>,
    quote: BatchQuote
  ) {
    const record = await journal.prepare(prepared);
    const token = await journal.claim(prepared.id);
    await journal.checkpoint(prepared.id, token, {
      status: "awaiting-approval",
      groups: record.groups.map((group) => ({ ...group, quote, status: "awaiting-approval" })),
    });
    await journal.release(prepared.id, token);
  }

  const conflicting = (id = "retry") =>
    prepareBatch({
      id,
      ...scope,
      domain: "settings",
      budget: createMockBatchBudget(),
      mode: "atomic",
      items: ["name", "description"].map((item) => ({
        id: item,
        call: createMockContractCall({ account }),
      })),
    });

  it("reopens a passkey operation that never saved a reference, without sending", async () => {
    const { journal, prepared, sender } = passkeySetup();
    await closeTabDuringPrompt(journal, prepared, passkeyQuote);
    expect(
      (
        await reconcileBatchOperation({
          journal,
          operationId: prepared.id,
          ...scope,
          sender,
          verify,
        })
      ).status
    ).toBe("prepared");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();

    vi.mocked(sender.submitAtomicBatch!).mockImplementation(async (_calls, options = {}) => {
      await options.onBeforeBroadcast?.(userOperation);
      return {
        status: "confirmed",
        reference: { ...userOperation, account },
        receipts: [{ transactionHash: hash, status: "success" }],
        sponsored: true,
      };
    });
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("confirmed");
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
  });

  it("refuses a passkey broadcast whose reference was not saved first", async () => {
    const { journal, prepared, sender } = passkeySetup();
    vi.mocked(sender.submitAtomicBatch!).mockImplementation(async (_calls, options = {}) => {
      try {
        await options.onBeforeBroadcast?.();
      } catch (error) {
        throw new BatchNotSubmittedError(error);
      }
      throw new Error("the send must stop before this line");
    });
    const result = await executeBatchOperation({ journal, prepared, sender, preflight, verify });
    expect(result.status).toBe("prepared");
  });

  it("keeps holding a wallet operation, whose open prompt could still be approved", async () => {
    const { journal, prepared, sender } = setup();
    await closeTabDuringPrompt(journal, prepared, walletQuote);
    expect(
      (
        await reconcileBatchOperation({
          journal,
          operationId: prepared.id,
          ...scope,
          sender,
          verify,
        })
      ).status
    ).toBe("unresolved");
    await expect(
      executeBatchOperation({ journal, prepared: conflicting(), sender, preflight, verify })
    ).rejects.toThrow("batch-items-held");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("ends a hold only on request, frees its items, and keeps its evidence", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.reconcileBatch!).mockResolvedValue({
      status: "unresolved",
      reference,
      receipts: [],
      sponsored: false,
    });
    vi.mocked(sender.submitAtomicBatch!).mockImplementationOnce(async (_calls, options = {}) => {
      await options.onBatchReference?.(reference);
      throw new Error("lost receipt response");
    });
    await executeBatchOperation({ journal, prepared, sender, preflight, verify });

    const released = await releaseBatchOperation({
      journal,
      operationId: prepared.id,
      ...scope,
      sender,
      verify,
    });
    expect(released).toMatchObject({ status: "released", reference });
    expect(released.itemStates).toEqual({ name: "released", description: "released" });
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("released");
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
    expect(
      (await executeBatchOperation({ journal, prepared: conflicting(), sender, preflight, verify }))
        .status
    ).toBe("confirmed");
  });

  it("reads the chain first, so a landed operation is confirmed instead of released", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.submitAtomicBatch!).mockImplementationOnce(async (_calls, options = {}) => {
      await options.onBatchReference?.(reference);
      throw new Error("lost receipt response");
    });
    await executeBatchOperation({ journal, prepared, sender, preflight, verify });
    expect(
      (await releaseBatchOperation({ journal, operationId: prepared.id, ...scope, sender, verify }))
        .status
    ).toBe("confirmed");
  });

  it("refuses to release an operation that is not held", async () => {
    const { journal, prepared, sender } = setup();
    await executeBatchOperation({ journal, prepared, sender, preflight, verify });
    await expect(
      releaseBatchOperation({ journal, operationId: prepared.id, ...scope, sender, verify })
    ).resolves.toMatchObject({ status: "confirmed" });
    const fresh = conflicting("fresh");
    await journal.prepare(fresh);
    await expect(
      releaseBatchOperation({ journal, operationId: fresh.id, ...scope, sender, verify })
    ).resolves.toMatchObject({ status: "prepared" });
  });

  it("holds the items again when a reference arrives after a release", async () => {
    const { journal, prepared, sender } = setup();
    vi.mocked(sender.submitAtomicBatch!).mockRejectedValueOnce(new Error("connection lost"));
    await executeBatchOperation({ journal, prepared, sender, preflight, verify });
    await releaseBatchOperation({ journal, operationId: prepared.id, ...scope, sender, verify });

    await journal.recordSubmission(prepared.id, ["name", "description"], reference);
    expect(await journal.get(prepared.id)).toMatchObject({ status: "unresolved", reference });
    await expect(
      executeBatchOperation({ journal, prepared: conflicting(), sender, preflight, verify })
    ).rejects.toThrow("batch-items-held");
  });

  it("keeps an accepted wallet ID after another tab took the claim during the prompt", async () => {
    let now = 0;
    const { journal, prepared, sender } = setup("atomic", true, () => now);
    vi.mocked(sender.submitAtomicBatch!).mockImplementationOnce(async (_calls, options = {}) => {
      now += 120_000;
      await journal.claim(prepared.id, true);
      // The adapter keeps going when this checkpoint fails, as it must once a wallet has accepted.
      await options.onBatchReference?.(reference).catch(() => undefined);
      return { status: "unresolved", reference, receipts: [], sponsored: false };
    });
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("unresolved");
    expect((await journal.get(prepared.id))?.reference).toEqual(reference);

    now += 120_000;
    expect(
      (
        await reconcileBatchOperation({
          journal,
          operationId: prepared.id,
          ...scope,
          sender,
          verify,
        })
      ).status
    ).toBe("confirmed");
    expect(sender.submitAtomicBatch).toHaveBeenCalledOnce();
  });

  it("lets the holder finish after its lease lapsed, when no other tab took over", async () => {
    let now = 0;
    const { journal, prepared, sender } = setup("atomic", true, () => now);
    vi.mocked(sender.submitAtomicBatch!).mockImplementationOnce(async (_calls, options = {}) => {
      now += 120_000;
      await options.onBatchReference?.(reference);
      return {
        status: "confirmed",
        reference,
        receipts: [{ transactionHash: hash, status: "success" }],
        sponsored: false,
      };
    });
    expect(
      (await executeBatchOperation({ journal, prepared, sender, preflight, verify })).status
    ).toBe("confirmed");
  });
});

it("finishes verification from saved receipts after the wallet's status expires", async () => {
  const { journal, prepared, sender } = setup();
  const first = await executeBatchOperation({
    journal,
    prepared,
    sender,
    preflight,
    verify: async () => ["name"],
  });
  expect(first).toMatchObject({ status: "unresolved", receipts: [{ transactionHash: hash }] });
  vi.mocked(sender.reconcileBatch!).mockResolvedValue({
    status: "unresolved",
    reference,
    receipts: [],
    sponsored: false,
  });
  const recovered = await reconcileBatchOperation({
    journal,
    operationId: prepared.id,
    account,
    chainId: 42161,
    sender,
    verify,
  });
  expect(recovered).toMatchObject({ status: "confirmed", receipts: [{ transactionHash: hash }] });
});

it("keeps saved receipts when a later read sees less and the items stay unverified", async () => {
  const { journal, prepared, sender } = setup();
  await executeBatchOperation({ journal, prepared, sender, preflight, verify: async () => [] });
  vi.mocked(sender.reconcileBatch!).mockResolvedValue({
    status: "unresolved",
    reference,
    receipts: [],
    sponsored: false,
  });
  const recovered = await reconcileBatchOperation({
    journal,
    operationId: prepared.id,
    account,
    chainId: 42161,
    sender,
    verify: async () => [],
  });
  expect(recovered).toMatchObject({ status: "unresolved", receipts: [{ transactionHash: hash }] });
});
