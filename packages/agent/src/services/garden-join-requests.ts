import { createHmac, randomUUID } from "node:crypto";
import {
  createEncryptedRecordCipher,
  type EncryptedRecordCipher,
  parseRecordEncryptionKey,
} from "./record-encryption";
import type { Address } from "@green-goods/shared/public-contracts";
import type {
  GardenJoinRequestedVia,
  GardenJoinRequestKind,
  GardenJoinRequestQueueItem,
  GardenJoinRequestSelfRecord,
  GardenJoinRequestState,
} from "@green-goods/shared/public-contracts/join-requests";

export const GARDEN_JOIN_REQUEST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const GARDEN_JOIN_REQUEST_MAX_PENDING_PER_GARDEN = 100;
const GARDEN_JOIN_REQUEST_RATE_LIMIT_NOTICE_MS = 10 * 60 * 1000;

export class GardenJoinRequestRateLimitPressure {
  private readonly limitedAtByGarden = new Map<Address, number>();

  mark(gardenAddress: Address, now: number): void {
    this.limitedAtByGarden.set(gardenAddress, now);
  }

  hasRecent(gardenAddress: Address, now: number): boolean {
    const limitedAt = this.limitedAtByGarden.get(gardenAddress);
    if (limitedAt === undefined) return false;
    if (now - limitedAt <= GARDEN_JOIN_REQUEST_RATE_LIMIT_NOTICE_MS) return true;
    this.limitedAtByGarden.delete(gardenAddress);
    return false;
  }
}

export type GardenJoinRequestCipher = EncryptedRecordCipher & {
  accountKey(address: Address): string;
  proofKey(nonce: string): string;
  countGrantKey(payload: string): string;
};

export type GardenJoinRequestRecord = GardenJoinRequestQueueItem & {
  gardenAddress: Address;
};

export type CreateGardenJoinRequestRecord = {
  kind?: GardenJoinRequestKind;
  gardenAddress: Address;
  accountAddress: Address;
  displayName: string;
  note?: string;
  requestedVia: GardenJoinRequestedVia;
  requestedAt: string;
  expiresAt: string;
};

export type ResolveGardenJoinRequestRecord = {
  kind?: GardenJoinRequestKind;
  gardenAddress: Address;
  requestId: string;
  expectedRevision: number;
  state: Extract<GardenJoinRequestState, "welcomed" | "declined">;
  reason?: string;
  resolvedAt: string;
};

export type WithdrawGardenJoinRequestRecord = {
  kind?: GardenJoinRequestKind;
  gardenAddress: Address;
  accountAddress: Address;
  requestId: string;
  expectedRevision: number;
};

export type GardenJoinRequestStore = {
  create(
    input: CreateGardenJoinRequestRecord
  ): Promise<
    { created: boolean; request: GardenJoinRequestRecord } | { created: false; full: true }
  >;
  getMine(
    gardenAddress: Address,
    accountAddress: Address,
    nowIso?: string,
    kind?: GardenJoinRequestKind
  ): Promise<GardenJoinRequestRecord | undefined>;
  getById(gardenAddress: Address, requestId: string): Promise<GardenJoinRequestRecord | undefined>;
  listPending(
    gardenAddress: Address,
    options?: { cursor?: string; limit?: number; nowIso?: string; kind?: GardenJoinRequestKind }
  ): Promise<{ items: GardenJoinRequestRecord[]; nextCursor?: string }>;
  /** Pending requests of every kind, without decrypting any of them. */
  countPending(gardenAddress: Address, nowIso: string): Promise<number>;
  resolve(
    input: ResolveGardenJoinRequestRecord
  ): Promise<
    | { ok: true; request: GardenJoinRequestRecord }
    | { ok: false; reason: "not_found" | "revision_conflict" | "not_pending" }
  >;
  reconcileWelcomed(
    gardenAddress: Address,
    requestId: string,
    resolvedAt: string,
    kind?: GardenJoinRequestKind
  ): Promise<GardenJoinRequestRecord | undefined>;
  claimProof(nonce: string, expiresAt: string): Promise<boolean>;
  withdraw(input: WithdrawGardenJoinRequestRecord): Promise<boolean>;
  sweep(nowIso: string): Promise<{ expiredPending: number; deletedResolved: number }>;
};

export type GardenJoinRequestPersonalFields = {
  accountAddress: Address;
  displayName: string;
  note?: string;
  reason?: string;
};

export type EncryptedGardenJoinRequest = {
  id: string;
  gardenAddress: Address;
  accountAddressKey: string;
  ciphertext: string;
  nonce: string;
  kind: GardenJoinRequestKind;
  state: GardenJoinRequestState;
  requestedVia: GardenJoinRequestedVia;
  requestedAt: string;
  expiresAt: string;
  resolvedAt?: string;
  updatedAt: string;
  revision: number;
};

export function createGardenJoinRequestCipher(secret: string): GardenJoinRequestCipher {
  const key = parseRecordEncryptionKey(secret, "JOIN_REQUESTS_ENCRYPTION_KEY");
  return {
    ...createEncryptedRecordCipher(key, "Invalid garden join request ciphertext"),
    accountKey(address) {
      return createHmac("sha256", key)
        .update(`garden-join-account:${address.toLowerCase()}`)
        .digest("hex");
    },
    proofKey(nonce) {
      return createHmac("sha256", key)
        .update(`garden-join-proof:${nonce.toLowerCase()}`)
        .digest("hex");
    },
    countGrantKey(payload) {
      return createHmac("sha256", key).update(`garden-join-count-grant:${payload}`).digest("hex");
    },
  };
}

function toGardenJoinRequestRecord(
  record: EncryptedGardenJoinRequest,
  personal: GardenJoinRequestPersonalFields
): GardenJoinRequestRecord {
  return {
    id: record.id,
    gardenAddress: record.gardenAddress,
    kind: record.kind,
    state: record.state,
    revision: record.revision,
    requestedVia: record.requestedVia,
    requestedAt: record.requestedAt,
    expiresAt: record.expiresAt,
    ...(record.resolvedAt ? { resolvedAt: record.resolvedAt } : {}),
    ...(record.state === "declined" && personal.reason ? { reason: personal.reason } : {}),
    canAskAgain: record.state !== "pending",
    accountAddress: personal.accountAddress,
    displayName: personal.displayName,
    ...(personal.note ? { note: personal.note } : {}),
  };
}

export function decryptGardenJoinRequestRecord(
  cipher: GardenJoinRequestCipher,
  record: EncryptedGardenJoinRequest
): GardenJoinRequestRecord {
  const personal = JSON.parse(
    cipher.decrypt({ ciphertext: record.ciphertext, nonce: record.nonce })
  ) as GardenJoinRequestPersonalFields;
  return toGardenJoinRequestRecord(record, personal);
}

export function createSqliteGardenJoinRequestStore(
  cipher: GardenJoinRequestCipher,
  generators: { id(): string } = { id: randomUUID }
): GardenJoinRequestStore {
  return {
    create: (input) =>
      import("./db").then((db) => db.createGardenJoinRequest(cipher, generators.id(), input)),
    getMine: (gardenAddress, accountAddress, nowIso, kind) =>
      import("./db").then((db) =>
        db.getGardenJoinRequestMine(cipher, gardenAddress, accountAddress, nowIso, kind)
      ),
    getById: (gardenAddress, requestId) =>
      import("./db").then((db) => db.getGardenJoinRequestById(cipher, gardenAddress, requestId)),
    listPending: (gardenAddress, options) =>
      import("./db").then((db) => db.listPendingGardenJoinRequests(cipher, gardenAddress, options)),
    countPending: (gardenAddress, nowIso) =>
      import("./db").then((db) => db.countPendingGardenJoinRequests(gardenAddress, nowIso)),
    resolve: (input) => import("./db").then((db) => db.resolveGardenJoinRequest(cipher, input)),
    reconcileWelcomed: (gardenAddress, requestId, resolvedAt, kind) =>
      import("./db").then((db) =>
        db.reconcileWelcomedGardenJoinRequest(cipher, gardenAddress, requestId, resolvedAt, kind)
      ),
    claimProof: (nonce, expiresAt) =>
      import("./db").then((db) =>
        db.claimGardenJoinRequestProof(cipher.proofKey(nonce), expiresAt)
      ),
    withdraw: (input) => import("./db").then((db) => db.withdrawGardenJoinRequest(cipher, input)),
    sweep: (nowIso) => import("./db").then((db) => db.sweepGardenJoinRequests(nowIso)),
  };
}

export function toGardenJoinRequestSelfRecord(
  record: GardenJoinRequestRecord
): GardenJoinRequestSelfRecord {
  return {
    id: record.id,
    kind: record.kind,
    state: record.state,
    revision: record.revision,
    requestedVia: record.requestedVia,
    requestedAt: record.requestedAt,
    expiresAt: record.expiresAt,
    ...(record.resolvedAt ? { resolvedAt: record.resolvedAt } : {}),
    ...(record.reason ? { reason: record.reason } : {}),
    canAskAgain: record.canAskAgain,
  };
}
