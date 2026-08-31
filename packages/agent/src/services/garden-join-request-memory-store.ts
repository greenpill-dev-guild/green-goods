import { randomUUID } from "node:crypto";
import type { Address } from "@green-goods/shared/public-contracts";
import {
  decryptGardenJoinRequestRecord,
  GARDEN_JOIN_REQUEST_MAX_PENDING_PER_GARDEN,
  GARDEN_JOIN_REQUEST_RETENTION_MS,
  type CreateGardenJoinRequestRecord,
  type EncryptedGardenJoinRequest,
  type GardenJoinRequestCipher,
  type GardenJoinRequestPersonalFields,
  type GardenJoinRequestRecord,
  type GardenJoinRequestStore,
  type ResolveGardenJoinRequestRecord,
  type WithdrawGardenJoinRequestRecord,
} from "./garden-join-requests";

export class MemoryGardenJoinRequestStore implements GardenJoinRequestStore {
  private readonly records = new Map<string, EncryptedGardenJoinRequest>();
  private readonly proofNonces = new Map<string, string>();

  constructor(
    private readonly cipher: GardenJoinRequestCipher,
    private readonly generators: { id(): string } = { id: randomUUID }
  ) {}

  async create(input: CreateGardenJoinRequestRecord) {
    const accountAddressKey = this.cipher.accountKey(input.accountAddress);
    const requestedAt = Date.parse(input.requestedAt);
    for (const [id, record] of this.records) {
      if (
        record.gardenAddress === input.gardenAddress &&
        record.state === "pending" &&
        Date.parse(record.expiresAt) <= requestedAt
      ) {
        this.records.delete(id);
      }
    }
    const existing = this.findPending(input.gardenAddress, accountAddressKey);
    if (existing) return { created: false as const, request: this.decrypt(existing) };
    const pendingCount = [...this.records.values()].filter(
      (record) => record.gardenAddress === input.gardenAddress && record.state === "pending"
    ).length;
    if (pendingCount >= GARDEN_JOIN_REQUEST_MAX_PENDING_PER_GARDEN) {
      return { created: false as const, full: true as const };
    }
    const id = this.generators.id();
    const encrypted = this.cipher.encrypt(
      JSON.stringify({
        accountAddress: input.accountAddress,
        displayName: input.displayName,
        ...(input.note ? { note: input.note } : {}),
      } satisfies GardenJoinRequestPersonalFields)
    );
    const record: EncryptedGardenJoinRequest = {
      id,
      gardenAddress: input.gardenAddress,
      accountAddressKey,
      ...encrypted,
      kind: "garden_membership",
      state: "pending",
      requestedVia: input.requestedVia,
      requestedAt: input.requestedAt,
      expiresAt: input.expiresAt,
      updatedAt: input.requestedAt,
      revision: 0,
    };
    this.records.set(id, record);
    return { created: true as const, request: this.decrypt(record) };
  }

  async getMine(
    gardenAddress: Address,
    accountAddress: Address,
    nowIso = new Date().toISOString()
  ) {
    const accountAddressKey = this.cipher.accountKey(accountAddress);
    this.deleteExpiredPending(gardenAddress, nowIso, accountAddressKey);
    const record = [...this.records.values()]
      .filter(
        (candidate) =>
          candidate.gardenAddress === gardenAddress &&
          candidate.accountAddressKey === accountAddressKey
      )
      .sort(compareNewest)[0];
    return record ? this.decrypt(record) : undefined;
  }

  async getById(gardenAddress: Address, requestId: string) {
    const record = this.records.get(requestId);
    return record?.gardenAddress === gardenAddress ? this.decrypt(record) : undefined;
  }

  async listPending(
    gardenAddress: Address,
    options: { cursor?: string; limit?: number; nowIso?: string } = {}
  ) {
    this.deleteExpiredPending(gardenAddress, options.nowIso ?? new Date().toISOString());
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const ordered = [...this.records.values()]
      .filter(
        (record) =>
          record.gardenAddress === gardenAddress &&
          record.state === "pending" &&
          (!options.cursor || cursorFor(record) < options.cursor)
      )
      .sort(compareNewest);
    const page = ordered.slice(0, limit);
    return {
      items: page.map((record) => this.decrypt(record)),
      ...(ordered.length > limit && page.at(-1) ? { nextCursor: cursorFor(page.at(-1)!) } : {}),
    };
  }

  async resolve(input: ResolveGardenJoinRequestRecord) {
    const record = this.records.get(input.requestId);
    if (!record || record.gardenAddress !== input.gardenAddress) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (record.revision !== input.expectedRevision) {
      return { ok: false as const, reason: "revision_conflict" as const };
    }
    if (record.state !== "pending") {
      return { ok: false as const, reason: "not_pending" as const };
    }
    const personal = this.decryptPersonal(record);
    const { reason: _reason, ...personalWithoutReason } = personal;
    const encrypted = this.cipher.encrypt(
      JSON.stringify({
        ...personalWithoutReason,
        ...(input.state === "declined" && input.reason ? { reason: input.reason } : {}),
      } satisfies GardenJoinRequestPersonalFields)
    );
    const updated: EncryptedGardenJoinRequest = {
      ...record,
      ...encrypted,
      state: input.state,
      resolvedAt: input.resolvedAt,
      updatedAt: input.resolvedAt,
      revision: record.revision + 1,
    };
    this.records.set(record.id, updated);
    return { ok: true as const, request: this.decrypt(updated) };
  }

  async reconcileWelcomed(gardenAddress: Address, requestId: string, resolvedAt: string) {
    const record = this.records.get(requestId);
    if (!record || record.gardenAddress !== gardenAddress) return undefined;
    if (record.state === "welcomed") return this.decrypt(record);
    const personal = this.decryptPersonal(record);
    const { reason: _reason, ...personalWithoutReason } = personal;
    const encrypted = this.cipher.encrypt(JSON.stringify(personalWithoutReason));
    const updated: EncryptedGardenJoinRequest = {
      ...record,
      ...encrypted,
      state: "welcomed",
      resolvedAt,
      updatedAt: resolvedAt,
      revision: record.revision + 1,
    };
    this.records.set(record.id, updated);
    return this.decrypt(updated);
  }

  async claimProof(nonce: string, expiresAt: string) {
    const nonceHash = this.cipher.proofKey(nonce);
    if (this.proofNonces.has(nonceHash)) return false;
    this.proofNonces.set(nonceHash, expiresAt);
    return true;
  }

  async withdraw(input: WithdrawGardenJoinRequestRecord) {
    const record = this.records.get(input.requestId);
    if (
      !record ||
      record.gardenAddress !== input.gardenAddress ||
      record.accountAddressKey !== this.cipher.accountKey(input.accountAddress) ||
      record.state !== "pending" ||
      record.revision !== input.expectedRevision
    ) {
      return false;
    }
    return this.records.delete(record.id);
  }

  async sweep(nowIso: string) {
    const now = Date.parse(nowIso);
    let expiredPending = 0;
    let deletedResolved = 0;
    for (const [id, record] of this.records) {
      const pendingExpired = record.state === "pending" && Date.parse(record.expiresAt) <= now;
      const resolvedExpired =
        record.state !== "pending" &&
        Boolean(record.resolvedAt) &&
        Date.parse(record.resolvedAt!) + GARDEN_JOIN_REQUEST_RETENTION_MS <= now;
      if (pendingExpired || resolvedExpired) {
        this.records.delete(id);
        if (pendingExpired) expiredPending += 1;
        else deletedResolved += 1;
      }
    }
    for (const [nonce, expiresAt] of this.proofNonces) {
      if (Date.parse(expiresAt) <= now) this.proofNonces.delete(nonce);
    }
    return { expiredPending, deletedResolved };
  }

  inspectEncryptedRecords(): EncryptedGardenJoinRequest[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  inspectProofKeys(): string[] {
    return [...this.proofNonces.keys()];
  }

  private findPending(gardenAddress: Address, accountAddressKey: string) {
    return [...this.records.values()].find(
      (record) =>
        record.gardenAddress === gardenAddress &&
        record.accountAddressKey === accountAddressKey &&
        record.state === "pending"
    );
  }

  private deleteExpiredPending(
    gardenAddress: Address,
    nowIso: string,
    accountAddressKey?: string
  ): void {
    const now = Date.parse(nowIso);
    for (const [id, record] of this.records) {
      if (
        record.gardenAddress === gardenAddress &&
        record.state === "pending" &&
        Date.parse(record.expiresAt) <= now &&
        (accountAddressKey === undefined || record.accountAddressKey === accountAddressKey)
      ) {
        this.records.delete(id);
      }
    }
  }

  private decryptPersonal(record: EncryptedGardenJoinRequest): GardenJoinRequestPersonalFields {
    return JSON.parse(
      this.cipher.decrypt({ ciphertext: record.ciphertext, nonce: record.nonce })
    ) as GardenJoinRequestPersonalFields;
  }

  private decrypt(record: EncryptedGardenJoinRequest): GardenJoinRequestRecord {
    return decryptGardenJoinRequestRecord(this.cipher, record);
  }
}

function compareNewest(
  left: EncryptedGardenJoinRequest,
  right: EncryptedGardenJoinRequest
): number {
  return right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id);
}

function cursorFor(record: EncryptedGardenJoinRequest): string {
  return `${record.requestedAt}|${record.id}`;
}
