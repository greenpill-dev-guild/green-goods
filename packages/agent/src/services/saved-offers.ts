import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  SAVED_OFFER_MAX_RECORDS_PER_OWNER,
  type SavedOfferPayloadV1,
  type SavedOfferRecord,
} from "@green-goods/shared/public-contracts";
import type { Address } from "@green-goods/shared/types";
import type { ProfileAvatarSignatureVerifier } from "./profile-avatars";
import * as db from "./db";

export type SavedOffersSignatureVerifier = ProfileAvatarSignatureVerifier;

export type SavedOfferCipher = {
  encrypt(plaintext: string): { ciphertext: string; nonce: string };
  decrypt(encrypted: { ciphertext: string; nonce: string }): string;
};

export function createSavedOfferCipher(secret: string): SavedOfferCipher {
  const key = parseEncryptionKey(secret);
  return {
    encrypt(plaintext) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return {
        ciphertext: Buffer.concat([encrypted, authTag]).toString("base64"),
        nonce: nonce.toString("base64"),
      };
    },
    decrypt({ ciphertext, nonce }) {
      const combined = Buffer.from(ciphertext, "base64");
      if (combined.length < 17) throw new Error("Invalid Saved Offer ciphertext");
      const authTag = combined.subarray(combined.length - 16);
      const encrypted = combined.subarray(0, combined.length - 16);
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    },
  };
}

export type SavedOfferStore = {
  list(chainId: number, owner: Address): Promise<SavedOfferRecord[]>;
  get(chainId: number, owner: Address, savedOfferId: string): Promise<SavedOfferRecord | undefined>;
  compareAndSwap(input: {
    chainId: number;
    owner: Address;
    savedOfferId: string;
    payload: string;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    | { ok: true; record: SavedOfferRecord }
    | { ok: false; currentVersion: number; reason?: "owner_limit_exceeded" }
  >;
  tombstone(input: {
    chainId: number;
    owner: Address;
    savedOfferId: string;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    | { ok: true; version: number }
    | { ok: false; reason: "not_found" | "version_conflict"; currentVersion: number }
  >;
};

type EncryptedMemoryRecord = {
  savedOfferId: string;
  ciphertext: string;
  nonce: string;
  version: number;
  updatedAt: string;
  deleted: boolean;
};

export class MemorySavedOfferStore implements SavedOfferStore {
  private records = new Map<string, EncryptedMemoryRecord>();
  constructor(private readonly cipher: SavedOfferCipher) {}

  async list(chainId: number, owner: Address): Promise<SavedOfferRecord[]> {
    return [...this.records.entries()]
      .filter(
        ([key, record]) => key.startsWith(`${chainId}:${owner.toLowerCase()}:`) && !record.deleted
      )
      .map(([, record]) => this.toRecord(record))
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.savedOfferId.localeCompare(right.savedOfferId)
      );
  }

  async get(
    chainId: number,
    owner: Address,
    savedOfferId: string
  ): Promise<SavedOfferRecord | undefined> {
    const record = this.records.get(savedOfferKey(chainId, owner, savedOfferId));
    return record && !record.deleted ? this.toRecord(record) : undefined;
  }

  async compareAndSwap(input: {
    chainId: number;
    owner: Address;
    savedOfferId: string;
    payload: string;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    | { ok: true; record: SavedOfferRecord }
    | { ok: false; currentVersion: number; reason?: "owner_limit_exceeded" }
  > {
    const key = savedOfferKey(input.chainId, input.owner, input.savedOfferId);
    const existing = this.records.get(key);
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== input.expectedVersion) return { ok: false, currentVersion };
    if (!existing || existing.deleted) {
      const ownerPrefix = `${input.chainId}:${input.owner.toLowerCase()}:`;
      const activeCount = [...this.records.entries()].filter(
        ([recordKey, record]) => recordKey.startsWith(ownerPrefix) && !record.deleted
      ).length;
      if (activeCount >= SAVED_OFFER_MAX_RECORDS_PER_OWNER) {
        return { ok: false, currentVersion, reason: "owner_limit_exceeded" };
      }
    }
    const encrypted = this.cipher.encrypt(input.payload);
    const stored: EncryptedMemoryRecord = {
      savedOfferId: input.savedOfferId,
      ...encrypted,
      version: currentVersion + 1,
      updatedAt: input.updatedAt,
      deleted: false,
    };
    this.records.set(key, stored);
    return { ok: true, record: this.toRecord(stored) };
  }

  async tombstone(input: {
    chainId: number;
    owner: Address;
    savedOfferId: string;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    | { ok: true; version: number }
    | { ok: false; reason: "not_found" | "version_conflict"; currentVersion: number }
  > {
    const key = savedOfferKey(input.chainId, input.owner, input.savedOfferId);
    const existing = this.records.get(key);
    const currentVersion = existing?.version ?? 0;
    if (!existing || existing.deleted) return { ok: false, reason: "not_found", currentVersion };
    if (currentVersion !== input.expectedVersion) {
      return { ok: false, reason: "version_conflict", currentVersion };
    }
    const version = currentVersion + 1;
    this.records.set(key, {
      ...existing,
      ciphertext: "",
      nonce: "",
      version,
      updatedAt: input.updatedAt,
      deleted: true,
    });
    return { ok: true, version };
  }

  private toRecord(record: EncryptedMemoryRecord): SavedOfferRecord {
    return {
      savedOfferId: record.savedOfferId,
      payload: JSON.parse(this.cipher.decrypt(record)) as SavedOfferPayloadV1,
      version: record.version,
      updatedAt: record.updatedAt,
    };
  }
}

export function createSqliteSavedOfferStore(cipher: SavedOfferCipher): SavedOfferStore {
  return {
    list: (chainId, owner) => db.listSavedOffers(cipher, chainId, owner),
    get: (chainId, owner, savedOfferId) => db.getSavedOffer(cipher, chainId, owner, savedOfferId),
    compareAndSwap: (input) => db.compareAndSwapSavedOffer(cipher, input),
    tombstone: (input) => db.tombstoneSavedOffer(input),
  };
}

export type SavedOffersOwnerSession = { chainId: number; owner: Address; expiresAt: number };
export type SavedOffersSessionStore = {
  issueChallenge(input: {
    chainId: number;
    owner: Address;
    audience: string;
  }): Promise<{ nonce: string; expiresAt: number }>;
  consumeChallenge(input: {
    chainId: number;
    owner: Address;
    audience: string;
    nonce: string;
  }): Promise<"valid" | "expired" | "invalid">;
  createSession(input: {
    chainId: number;
    owner: Address;
  }): Promise<{ token: string; expiresAt: number }>;
  authenticate(token: string): Promise<SavedOffersOwnerSession | undefined>;
};

export class MemorySavedOffersSessionStore implements SavedOffersSessionStore {
  private readonly challenges = new Map<
    string,
    { chainId: number; owner: Address; audience: string; expiresAt: number }
  >();
  private readonly sessions = new Map<string, SavedOffersOwnerSession>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
  }

  async issueChallenge(input: { chainId: number; owner: Address; audience: string }) {
    this.sweepExpired();
    const nonce = randomBytes(32).toString("hex");
    const expiresAt = Math.floor(this.now() / 1000) + 5 * 60;
    this.challenges.set(challengeHash(nonce), {
      ...input,
      owner: input.owner.toLowerCase() as Address,
      expiresAt,
    });
    return { nonce, expiresAt };
  }

  async consumeChallenge(input: {
    chainId: number;
    owner: Address;
    audience: string;
    nonce: string;
  }): Promise<"valid" | "expired" | "invalid"> {
    const key = challengeHash(input.nonce);
    const challenge = this.challenges.get(key);
    this.challenges.delete(key);
    if (!challenge) return "invalid";
    if (challenge.expiresAt < Math.floor(this.now() / 1000)) return "expired";
    if (
      challenge.chainId !== input.chainId ||
      challenge.owner !== input.owner.toLowerCase() ||
      challenge.audience !== input.audience
    )
      return "invalid";
    return "valid";
  }

  async createSession(input: { chainId: number; owner: Address }) {
    this.sweepExpired();
    const token = randomBytes(32).toString("hex");
    const expiresAt = Math.floor(this.now() / 1000) + 15 * 60;
    this.sessions.set(sessionHash(token), {
      chainId: input.chainId,
      owner: input.owner.toLowerCase() as Address,
      expiresAt,
    });
    return { token, expiresAt };
  }

  async authenticate(token: string): Promise<SavedOffersOwnerSession | undefined> {
    this.sweepExpired();
    const key = sessionHash(token);
    const session = this.sessions.get(key);
    if (!session) return undefined;
    if (session.expiresAt < Math.floor(this.now() / 1000)) {
      this.sessions.delete(key);
      return undefined;
    }
    return session;
  }

  private sweepExpired(): void {
    const now = Math.floor(this.now() / 1000);
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(key);
    }
    for (const [key, session] of this.sessions) {
      if (session.expiresAt < now) this.sessions.delete(key);
    }
  }
}

function parseEncryptionKey(secret: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  const decoded = Buffer.from(secret, "base64");
  if (
    decoded.length === 32 &&
    decoded.toString("base64").replace(/=+$/, "") === secret.replace(/=+$/, "")
  )
    return decoded;
  throw new Error("SAVED_OFFERS_ENCRYPTION_KEY must be 32 bytes encoded as hex or base64");
}

function savedOfferKey(chainId: number, owner: Address, savedOfferId: string): string {
  return `${chainId}:${owner.toLowerCase()}:${savedOfferId}`;
}

function challengeHash(nonce: string): string {
  return createHash("sha256").update(`saved-offer-challenge:${nonce}`).digest("hex");
}

function sessionHash(token: string): string {
  return createHash("sha256").update(`saved-offer-session:${token}`).digest("hex");
}
