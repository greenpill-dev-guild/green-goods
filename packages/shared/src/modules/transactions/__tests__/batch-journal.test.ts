import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { BatchJournal } from "../batch-journal";
import { prepareBatch } from "../prepared-batch";
import { createMockContractCall } from "../../../__tests__/test-utils/transaction-fakes";

const account = "0x1111111111111111111111111111111111111111" as const;
const journals: BatchJournal[] = [];
function journal(name = crypto.randomUUID()) {
  const db = new BatchJournal(`test-batches-${name}`);
  journals.push(db);
  return db;
}
function batch(id = "operation", item = "member:alice") {
  return prepareBatch({
    id,
    account,
    chainId: 42161,
    domain: "members",
    mode: "atomic",
    items: [{ id: item, call: createMockContractCall({ account }) }],
  });
}
afterEach(async () => {
  for (const db of journals.splice(0)) await db.delete();
});

describe("BatchJournal", () => {
  it("keeps opaque wallet IDs and immutable calldata through database reopen", async () => {
    const db = journal();
    const prepared = batch();
    await db.prepare(prepared);
    const claim = await db.claim(prepared.id);
    await db.checkpoint(prepared.id, claim, {
      status: "submitted",
      reference: { kind: "wallet-calls", id: "wallet:proposal/a", account, chainId: 42161 },
      receipts: [],
    });
    db.close();
    expect(await db.get(prepared.id)).toMatchObject({
      status: "submitted",
      reference: { id: "wallet:proposal/a" },
      prepared: { fingerprint: prepared.fingerprint },
    });
    expect((await db.get(prepared.id))?.prepared.items[0].call.value).toBe("0");
  });
  it("rejects concurrent tabs claiming overlapping logical items", async () => {
    const name = crypto.randomUUID();
    const first = journal(name);
    const second = journal(name);
    await first.prepare(batch());
    await second.prepare(batch("other"));
    const outcomes = await Promise.allSettled([first.claim("operation"), second.claim("other")]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("does not let an expired claim authorize resending an unknown operation", async () => {
    let now = 0;
    const db = new BatchJournal(`test-batches-${crypto.randomUUID()}`, () => now);
    journals.push(db);
    await db.prepare(batch());
    const token = await db.claim("operation");
    await db.checkpoint("operation", token, { status: "awaiting-approval" });
    now = 1_000_000;
    await expect(db.claim("operation")).rejects.toThrow("batch-recovery-required");
    await db.prune();
    expect((await db.get("operation"))?.status).toBe("awaiting-approval");
  });
  it("rejects changed intent and scopes reads to the account and chain", async () => {
    const db = journal();
    await db.prepare(batch());
    await expect(db.prepare(batch("operation", "different-member"))).rejects.toThrow(
      "batch-intent-changed"
    );
    expect(await db.list(account, 42161)).toHaveLength(1);
    expect(await db.list("0x2222222222222222222222222222222222222222", 42161)).toEqual([]);
    expect(await db.list(account, 42220)).toEqual([]);
  });
  it("refuses a stale send claim after another tab already completed the operation", async () => {
    const db = journal();
    await db.prepare(batch());
    const token = await db.claim("operation");
    const record = (await db.get("operation"))!;
    const receipts = [
      { transactionHash: `0x${"a".repeat(64)}` as const, status: "success" as const },
    ];
    await db.checkpoint("operation", token, {
      status: "confirmed",
      groups: record.groups.map((group) => ({ ...group, status: "confirmed", receipts })),
      receipts,
      itemStates: { "member:alice": "confirmed" },
    });
    await db.release("operation", token);
    await expect(db.claim("operation")).rejects.toThrow("batch-recovery-required");
  });
  it("rejects corrupt completion records rather than fabricating success", async () => {
    const db = journal();
    const record = await db.prepare(batch());
    await db.table("operations").put({ ...record, status: "confirmed" });
    await expect(db.get("operation")).rejects.toThrow("batch-invalid-record");
    await expect(db.prepare(batch())).rejects.toThrow("batch-invalid-record");
  });
  it("fences a stale writer after its claim is replaced", async () => {
    let now = 0;
    const db = new BatchJournal(`test-batches-${crypto.randomUUID()}`, () => now);
    journals.push(db);
    await db.prepare(batch());
    const token = await db.claim("operation");
    now = 1_000_000;
    await db.claim("operation");
    await expect(db.checkpoint("operation", token, { status: "submitted" })).rejects.toThrow(
      "batch-claim-lost"
    );
  });
});

it("retires terminal payloads without permitting their operation ID to be submitted again", async () => {
  let now = 0;
  const db = new BatchJournal(`test-batches-${crypto.randomUUID()}`, () => now);
  journals.push(db);
  const prepared = batch();
  const record = await db.prepare(prepared);
  const token = await db.claim(prepared.id);
  const receipts = [
    { transactionHash: `0x${"a".repeat(64)}` as const, status: "success" as const },
  ];
  await db.checkpoint(prepared.id, token, {
    status: "confirmed",
    groups: record.groups.map((group) => ({ ...group, status: "confirmed", receipts })),
    receipts,
    itemStates: { "member:alice": "confirmed" },
  });
  await db.release(prepared.id, token);
  now = 31 * 24 * 60 * 60 * 1000;
  await db.prune();
  expect(await db.get(prepared.id)).toBeUndefined();
  await expect(db.prepare(prepared)).rejects.toThrow("batch-operation-retired");
});

it("rejects restored group boundaries that split the approved atomic operation", async () => {
  const db = journal();
  const prepared = prepareBatch({
    id: "atomic",
    account,
    chainId: 42161,
    domain: "members",
    mode: "atomic",
    items: ["alice", "bob"].map((id) => ({ id, call: createMockContractCall({ account }) })),
  });
  const record = await db.prepare(prepared);
  await db.table("operations").put({
    ...record,
    groups: prepared.items.map((item) => ({
      itemIds: [item.id],
      status: "prepared",
      receipts: [],
    })),
  });
  await expect(db.get(prepared.id)).rejects.toThrow("batch-invalid-record");
});

it.each([
  "reverted",
  "declined",
  "released",
  "prepared",
] as const)("rejects a stored %s status over a group that may still be live", async (status) => {
  const db = journal();
  const record = await db.prepare(batch());
  await db.table("operations").put({
    ...record,
    status,
    groups: record.groups.map((group) => ({ ...group, status: "submitted" })),
  });
  await expect(db.get("operation")).rejects.toThrow("batch-invalid-record");
  await expect(db.prepare(batch("other", "member:bob"))).resolves.toBeDefined();
  await expect(db.claim("other")).rejects.toThrow("batch-invalid-record");
});

it("rejects a stored terminal status that no group carries", async () => {
  const db = journal();
  const record = await db.prepare(batch());
  await db.table("operations").put({ ...record, status: "reverted" });
  await expect(db.get("operation")).rejects.toThrow("batch-invalid-record");
});

it("keeps a reference another writer added while a recovery tab was reading", async () => {
  const db = journal();
  const record = await db.prepare(batch());
  const token = await db.claim("operation");
  const reference = { kind: "wallet-calls", id: "wallet:late", account, chainId: 42161 } as const;
  await db.recordSubmission("operation", ["member:alice"], reference);
  const written = await db.checkpoint("operation", token, {
    status: "unresolved",
    groups: record.groups.map((group) => ({ ...group, status: "unresolved" })),
    itemStates: { "member:alice": "unresolved" },
    reference: undefined,
  });
  expect(written).toMatchObject({ status: "unresolved", reference });
  expect(written.groups[0].reference).toEqual(reference);
});

it("lets the holder clear a reference that only ever came from signing", async () => {
  const db = journal();
  const record = await db.prepare(batch());
  const token = await db.claim("operation");
  const signed = {
    kind: "user-operation",
    hash: `0x${"c".repeat(64)}`,
    account,
    chainId: 42161,
  } as const;
  await db.checkpoint("operation", token, {
    status: "awaiting-approval",
    reference: signed,
    groups: record.groups.map((group) => ({
      ...group,
      status: "awaiting-approval",
      reference: signed,
    })),
  });
  const written = await db.checkpoint("operation", token, {
    status: "prepared",
    reference: undefined,
    groups: record.groups.map((group) => ({ ...group, status: "prepared" })),
  });
  expect(written.status).toBe("prepared");
  expect(written.groups[0].reference).toBeUndefined();
});
