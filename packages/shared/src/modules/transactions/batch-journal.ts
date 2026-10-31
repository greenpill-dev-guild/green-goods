import Dexie, { type EntityTable } from "dexie";
import type { Address } from "../../types/domain";
import { openDexieDatabase } from "../data/indexed-db";
import { getTransactionScopeKey } from "./types";
import { isCanonicalTransactionHash } from "./confirmation";
import { assertBatchQuote } from "./batch-budget";
import { assertPreparedBatch } from "./prepared-batch";
import {
  batchReferenceKey,
  type BatchItemState,
  type BatchRecord,
  type BatchReference,
  type PreparedBatch,
} from "./batch-types";

const LEASE_MS = 60_000;
const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const uncertain = new Set(["awaiting-approval", "submitted", "unresolved"]);
/** What a group becomes once its send is known to be accepted, whatever was assumed before. */
function afterAcceptance(status: BatchItemState): BatchItemState {
  if (status === "prepared" || status === "awaiting-approval") return "submitted";
  return status === "confirmed" || status === "submitted" ? status : "unresolved";
}
interface RetiredOperation {
  id: string;
  fingerprint: string;
  scope: string;
  status: string;
  updatedAt: number;
}
interface Claim {
  id: string;
  token: string;
  expiresAt: number;
}

/** Account-scoped records survive identity resets; only the matching owner can resume them. */
export class BatchJournal extends Dexie {
  private operations!: EntityTable<BatchRecord, "id">;
  private claims!: EntityTable<Claim, "id">;
  private retired!: EntityTable<RetiredOperation, "id">;
  constructor(
    name = "green-goods-transaction-batches",
    private readonly now = Date.now
  ) {
    super(name);
    this.version(1).stores({ operations: "id, scope, updatedAt", claims: "id", retired: "id" });
  }

  private async ready() {
    if (!this.isOpen()) await openDexieDatabase(this, "batch-journal");
  }
  async get(id: string): Promise<BatchRecord | undefined> {
    await this.ready();
    const record = await this.operations.get(id);
    if (record) this.validate(record);
    return record;
  }
  private validate(record: BatchRecord) {
    if (
      record.version !== 1 ||
      record.id !== record.prepared.id ||
      record.scope !== getTransactionScopeKey(record.prepared.account, record.prepared.chainId)
    )
      throw new Error("batch-invalid-record");
    assertPreparedBatch(record.prepared);
    const statuses = new Set([
      "prepared",
      "awaiting-approval",
      "submitted",
      "confirmed",
      "reverted",
      "unresolved",
      "declined",
      "released",
    ]);
    if (
      !statuses.has(record.status) ||
      !Array.isArray(record.groups) ||
      !Array.isArray(record.receipts) ||
      record.groups.length === 0
    )
      throw new Error("batch-invalid-record");
    const expected = record.prepared.items.map((item) => item.id);
    if (
      record.groups.length !== (record.prepared.mode === "sequential" ? expected.length : 1) ||
      record.groups.some(
        (group) =>
          group.itemIds.length !== (record.prepared.mode === "sequential" ? 1 : expected.length)
      )
    )
      throw new Error("batch-invalid-record");
    const actual = record.groups.flatMap((group) => group.itemIds);
    if (
      actual.length !== expected.length ||
      new Set(actual).size !== expected.length ||
      actual.some((id, index) => id !== expected[index])
    )
      throw new Error("batch-invalid-record");
    for (const receipt of record.receipts)
      if (
        !isCanonicalTransactionHash(receipt.transactionHash) ||
        !["success", "reverted"].includes(receipt.status)
      )
        throw new Error("batch-invalid-record");
    if (
      record.status === "confirmed" &&
      (record.groups.some((group) => group.status !== "confirmed") ||
        expected.some((id) => record.itemStates[id] !== "confirmed") ||
        !record.receipts.length ||
        record.receipts.some((receipt) => receipt.status !== "success"))
    )
      throw new Error("batch-invalid-record");
    // A status that frees its items cannot sit over a send that may still be live.
    if (
      !uncertain.has(record.status) &&
      (record.groups.some((group) => uncertain.has(group.status)) ||
        expected.some((id) => uncertain.has(record.itemStates[id])))
    )
      throw new Error("batch-invalid-record");
    if (
      ["reverted", "declined", "released"].includes(record.status) &&
      !record.groups.some((group) => group.status === record.status)
    )
      throw new Error("batch-invalid-record");
    for (const group of record.groups) {
      if (group.quote && record.prepared.budget)
        assertBatchQuote(record.prepared.budget, group.quote);
      if (group.confirmedItemIds?.some((id) => !group.itemIds.includes(id)))
        throw new Error("batch-invalid-record");
      if (
        group.status === "confirmed" &&
        (!group.receipts.length ||
          group.receipts.some(
            (receipt) =>
              receipt.status !== "success" || !isCanonicalTransactionHash(receipt.transactionHash)
          ))
      )
        throw new Error("batch-invalid-record");
      if (!statuses.has(group.status) || !Array.isArray(group.receipts))
        throw new Error("batch-invalid-record");
      if (
        group.reference &&
        (group.reference.kind === "wallet-calls" || group.reference.kind === "wallet-transaction"
          ? typeof group.reference.id !== "string" || !group.reference.id
          : !isCanonicalTransactionHash(group.reference.hash))
      )
        throw new Error("batch-invalid-record");
      if (
        group.reference &&
        (group.reference.chainId !== record.prepared.chainId ||
          group.reference.account.toLowerCase() !== record.prepared.account.toLowerCase())
      )
        throw new Error("batch-reference-scope-mismatch");
    }
  }
  async list(account: Address, chainId: number): Promise<BatchRecord[]> {
    await this.ready();
    const records = await this.operations
      .where("scope")
      .equals(getTransactionScopeKey(account, chainId))
      .toArray();
    for (const record of records) this.validate(record);
    return records;
  }
  async prepare(prepared: PreparedBatch): Promise<BatchRecord> {
    assertPreparedBatch(prepared);
    await this.ready();
    return this.transaction("rw", this.operations, this.retired, async () => {
      if (await this.retired.get(prepared.id)) throw new Error("batch-operation-retired");
      const existing = await this.operations.get(prepared.id);
      if (existing) {
        this.validate(existing);
        if (existing.prepared.fingerprint !== prepared.fingerprint)
          throw new Error("batch-intent-changed");
        return existing;
      }
      const itemIds = prepared.items.map((item) => item.id);
      const record: BatchRecord = {
        version: 1,
        id: prepared.id,
        scope: getTransactionScopeKey(prepared.account, prepared.chainId),
        prepared,
        status: "prepared",
        itemStates: Object.fromEntries(itemIds.map((id) => [id, "prepared"])),
        groups: (prepared.mode === "sequential" ? itemIds.map((id) => [id]) : [itemIds]).map(
          (ids) => ({
            itemIds: ids,
            status: "prepared",
            receipts: [],
          })
        ),
        receipts: [],
        updatedAt: this.now(),
      };
      await this.operations.add(record);
      return record;
    });
  }
  async claim(id: string, recovery = false): Promise<string> {
    await this.ready();
    return this.transaction("rw", this.operations, this.claims, async () => {
      const record = await this.operations.get(id);
      if (!record) throw new Error("batch-not-found");
      this.validate(record);
      if (record.status !== "prepared" && !recovery) throw new Error("batch-recovery-required");
      const items = new Set(record.prepared.items.map((item) => item.id));
      const others = await this.operations.where("scope").equals(record.scope).toArray();
      for (const other of others) {
        this.validate(other);
        if (
          !other.prepared.items.some((item) => items.has(item.id)) ||
          other.prepared.domain !== record.prepared.domain
        )
          continue;
        const claim = await this.claims.get(other.id);
        if (
          (claim && claim.expiresAt > this.now()) ||
          (other.id !== id && uncertain.has(other.status))
        )
          throw new Error("batch-items-held");
      }
      const token = crypto.randomUUID();
      await this.claims.put({ id, token, expiresAt: this.now() + LEASE_MS });
      return token;
    });
  }
  async renew(id: string, token: string): Promise<void> {
    await this.ready();
    await this.transaction("rw", this.claims, async () => {
      await this.assertClaim(id, token);
      await this.claims.put({ id, token, expiresAt: this.now() + LEASE_MS });
    });
  }
  /** Expiry lets another tab take over; until one does, the holder is still the only writer. */
  private async assertClaim(id: string, token: string) {
    const claim = await this.claims.get(id);
    if (!claim || claim.token !== token) throw new Error("batch-claim-lost");
  }
  /**
   * An accepted submission outranks any lease, so this needs no claim. It only adds identity: it
   * never clears one, and a reference that arrives after a release holds the items again.
   */
  async recordSubmission(
    id: string,
    itemIds: readonly string[],
    reference: BatchReference
  ): Promise<void> {
    await this.ready();
    await this.transaction("rw", this.operations, async () => {
      const record = await this.operations.get(id);
      if (!record) throw new Error("batch-not-found");
      const group = record.groups.find(
        (candidate) => candidate.itemIds.join("\0") === itemIds.join("\0")
      );
      if (!group) throw new Error("batch-group-mismatch");
      // A reference saved at signing is only a candidate until the network answers with its own.
      if (group.reference && group.status !== "awaiting-approval") {
        if (batchReferenceKey(group.reference) === batchReferenceKey(reference)) return;
        throw new Error("batch-reference-mismatch");
      }
      const status = afterAcceptance(group.status);
      const next: BatchRecord = {
        ...record,
        reference,
        status: status === "confirmed" ? record.status : status,
        groups: record.groups.map((candidate) =>
          candidate === group ? { ...group, reference, status } : candidate
        ),
        itemStates: {
          ...record.itemStates,
          ...Object.fromEntries(
            group.itemIds.map((item) => [
              item,
              group.confirmedItemIds?.includes(item) ? "confirmed" : status,
            ])
          ),
        },
        updatedAt: this.now(),
      };
      this.validate(next);
      await this.operations.put(next);
    });
  }
  async checkpoint(
    id: string,
    token: string,
    patch: Partial<Omit<BatchRecord, "id" | "prepared" | "scope" | "version">>
  ): Promise<BatchRecord> {
    await this.ready();
    return this.transaction("rw", this.operations, this.claims, async () => {
      await this.assertClaim(id, token);
      const record = await this.operations.get(id);
      if (!record) throw new Error("batch-not-found");
      const next = {
        ...record,
        ...patch,
        id: record.id,
        prepared: record.prepared,
        scope: record.scope,
        version: record.version,
        updatedAt: this.now(),
      };
      this.validate(next);
      await this.operations.put(next);
      return next;
    });
  }
  async release(id: string, token: string): Promise<void> {
    await this.ready();
    await this.transaction("rw", this.claims, async () => {
      if ((await this.claims.get(id))?.token === token) await this.claims.delete(id);
    });
  }
  async prune(): Promise<void> {
    await this.ready();
    await this.transaction("rw", this.operations, this.claims, this.retired, async () => {
      for (const record of await this.operations
        .where("updatedAt")
        .below(this.now() - TERMINAL_RETENTION_MS)
        .toArray()) {
        this.validate(record);
        if (!["confirmed", "declined", "reverted", "released"].includes(record.status)) continue;
        if (((await this.claims.get(record.id))?.expiresAt ?? 0) > this.now()) continue;
        await this.retired.put({
          id: record.id,
          fingerprint: record.prepared.fingerprint,
          scope: record.scope,
          status: record.status,
          updatedAt: record.updatedAt,
        });
        await this.operations.delete(record.id);
        await this.claims.delete(record.id);
      }
    });
  }
}
