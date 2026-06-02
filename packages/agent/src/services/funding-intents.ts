import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  Address,
  ClientCheckoutSession,
  CreateFundingIntentRequest,
  FundingIntentStatus,
  FundingTransactionAttempt,
  PublicFundingReceipt,
  PublicFundingManagementUrl,
  PublicPaymentMethod,
  PublicFundingSourceRoute,
} from "@green-goods/shared/public-contracts";
import * as db from "./db";

export interface FundingIntentRecord {
  id: string;
  gardenId: string;
  gardenName: string;
  gardenLocation?: string;
  destinationType: CreateFundingIntentRequest["destinationType"];
  destinationAddress: Address;
  fundingIntent: CreateFundingIntentRequest["fundingIntent"];
  paymentMethod: PublicPaymentMethod;
  availabilityKey: string;
  clientRequestId: string;
  idempotencyFingerprint: string;
  amountUsd: string;
  chainId: number;
  token: Address;
  provider: "thirdweb";
  providerSessionId?: string;
  providerPaymentId?: string;
  status: FundingIntentStatus;
  payerEmailHash?: string;
  receiptTokenHash: string;
  quoteExpiresAt: string;
  checkoutExpiresAt?: string;
  receiverAddress?: Address;
  sourceRoute?: PublicFundingSourceRoute;
  managementUrl?: PublicFundingManagementUrl;
  quotedAssetAmount?: string;
  minAssetAmount?: string;
  fundedAssetAmount?: string;
  fundingTxHash?: string;
  failureCode?: PublicFundingReceipt["failureCode"];
  checkoutSession?: ClientCheckoutSession;
  transactionAttempts: FundingTransactionAttempt[];
  createdAt: string;
  updatedAt: string;
}

export interface FundingIntentStore {
  create(record: FundingIntentRecord): Promise<FundingIntentRecord>;
  getById(id: string): Promise<FundingIntentRecord | undefined>;
  getByClientRequestId(clientRequestId: string): Promise<FundingIntentRecord | undefined>;
  update(record: FundingIntentRecord): Promise<FundingIntentRecord>;
  appendEvent(
    intentId: string,
    status: FundingIntentStatus,
    note: string,
    providerEventId?: string
  ): Promise<void>;
  /**
   * Return all intents that may need scheduled-sweep reconciliation
   * (`started` and `pending_provider`). Optional limit caps the slice for
   * very large tables.
   */
  listPending?(limit?: number): Promise<FundingIntentRecord[]>;
}

export class MemoryFundingIntentStore implements FundingIntentStore {
  private byId = new Map<string, FundingIntentRecord>();
  private byClientRequestId = new Map<string, string>();
  readonly events: Array<{
    intentId: string;
    status: FundingIntentStatus;
    note: string;
    providerEventId?: string;
  }> = [];

  async create(record: FundingIntentRecord): Promise<FundingIntentRecord> {
    this.byId.set(record.id, record);
    this.byClientRequestId.set(record.clientRequestId, record.id);
    return record;
  }

  async getById(id: string): Promise<FundingIntentRecord | undefined> {
    return this.byId.get(id);
  }

  async getByClientRequestId(clientRequestId: string): Promise<FundingIntentRecord | undefined> {
    const id = this.byClientRequestId.get(clientRequestId);
    return id ? this.byId.get(id) : undefined;
  }

  async update(record: FundingIntentRecord): Promise<FundingIntentRecord> {
    this.byId.set(record.id, record);
    this.byClientRequestId.set(record.clientRequestId, record.id);
    return record;
  }

  async appendEvent(
    intentId: string,
    status: FundingIntentStatus,
    note: string,
    providerEventId?: string
  ): Promise<void> {
    this.events.push({ intentId, status, note, providerEventId });
  }

  async listPending(limit = 1000): Promise<FundingIntentRecord[]> {
    const out: FundingIntentRecord[] = [];
    for (const record of this.byId.values()) {
      if (record.status === "started" || record.status === "pending_provider") {
        out.push(record);
        if (out.length >= limit) break;
      }
    }
    return out;
  }
}

export function createSqliteFundingIntentStore(): FundingIntentStore {
  return {
    create: (record) => db.createFundingIntent(record),
    getById: (id) => db.getFundingIntent(id),
    getByClientRequestId: (clientRequestId) =>
      db.getFundingIntentByClientRequestId(clientRequestId),
    update: (record) => db.updateFundingIntent(record),
    appendEvent: (intentId, status, note, providerEventId) =>
      db.appendFundingIntentEvent(intentId, status, note, providerEventId),
    listPending: (limit?: number) => db.listPendingFundingIntents(limit ?? 1000),
  };
}

/**
 * Sweep stale `started` and `pending_provider` intents through
 * `expireIfAbandoned` so visitors who never return don't leave intents in a
 * pending state forever. Read-time reconciliation continues to handle the
 * happy-path case; this sweep is the safety net.
 */
export async function sweepFundingIntents(
  store: FundingIntentStore,
  now: () => number = Date.now
): Promise<{ scanned: number; expired: number }> {
  if (!store.listPending) return { scanned: 0, expired: 0 };
  const pending = await store.listPending();
  let expired = 0;
  for (const record of pending) {
    const reconciled = expireIfAbandoned(record, now());
    if (reconciled !== record) {
      await store.update(reconciled);
      await store.appendEvent(reconciled.id, reconciled.status, "expired by scheduled sweep");
      expired += 1;
    }
  }
  return { scanned: pending.length, expired };
}

export function createReceiptToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createFundingIntentId(): string {
  return `fi_${randomUUID().replace(/-/g, "")}`;
}

export function normalizeEmailHash(email: string | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized ? hashSecret(normalized) : undefined;
}

export function normalizeDecimalString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) return undefined;
  const [whole, fraction = ""] = trimmed.split(".");
  const normalizedWhole = String(BigInt(whole));
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

export function createIdempotencyFingerprint(
  request: CreateFundingIntentRequest,
  provider: "thirdweb"
): string | undefined {
  const amountUsd = normalizeDecimalString(request.amountUsd);
  if (!amountUsd) return undefined;

  const parts = [
    request.gardenId.trim().toLowerCase(),
    request.destinationType,
    request.destinationAddress.trim().toLowerCase(),
    request.fundingIntent,
    request.paymentMethod,
    amountUsd,
    String(request.chainId),
    request.token.trim().toLowerCase(),
    request.availabilityKey,
    provider,
    request.receiverAddress?.trim().toLowerCase() ?? "",
    request.sourceRoute ?? "/fund",
    normalizeEmailHash(request.payerEmail) ?? "",
  ];

  return hashSecret(parts.join("|"));
}

export function redactFundingReceipt(record: FundingIntentRecord): PublicFundingReceipt {
  const managementUrl =
    record.fundingIntent === "endow"
      ? (record.managementUrl ??
        (record.sourceRoute === "/vaults" ? "/vaults?manage=positions" : "/fund?manage=endowments"))
      : undefined;

  return {
    id: record.id,
    status: record.status,
    garden: {
      id: record.gardenId,
      name: record.gardenName,
      location: record.gardenLocation,
    },
    destination: {
      type: record.destinationType,
      address: record.destinationAddress,
    },
    fundingIntent: record.fundingIntent,
    amount: {
      amountUsd: record.amountUsd,
      token: record.token,
      chainId: record.chainId,
      quotedAssetAmount: record.quotedAssetAmount,
      minAssetAmount: record.minAssetAmount,
      fundedAssetAmount: record.fundedAssetAmount,
    },
    fundingTxHash: record.fundingTxHash,
    receiverAddress: record.receiverAddress,
    quoteExpiresAt: record.quoteExpiresAt,
    updatedAt: record.updatedAt,
    appManagementCta: record.fundingIntent === "endow" ? "manage_endowments" : undefined,
    managementUrl,
    failureCode: record.failureCode,
  };
}

export function expireIfAbandoned(
  record: FundingIntentRecord,
  now = Date.now()
): FundingIntentRecord {
  if (record.status !== "started" && record.status !== "pending_provider") return record;

  const quoteExpiry = Date.parse(record.checkoutExpiresAt ?? record.quoteExpiresAt);
  const fallbackExpiry = Date.parse(record.createdAt) + 30 * 60 * 1000;
  const expiresAt = Number.isFinite(quoteExpiry) ? quoteExpiry : fallbackExpiry;
  if (now <= expiresAt) return record;

  return {
    ...record,
    status: "expired",
    failureCode: "expired",
    updatedAt: new Date(now).toISOString(),
  };
}

export function transitionFundingStatus(
  current: FundingIntentStatus,
  next: FundingIntentStatus
): FundingIntentStatus {
  const terminal = new Set<FundingIntentStatus>(["funded", "funded_late", "failed", "refunded"]);
  if (terminal.has(current)) return current;
  if (current === "expired" && next === "funded") return "funded_late";
  if (current === "expired") return current;
  return next;
}
