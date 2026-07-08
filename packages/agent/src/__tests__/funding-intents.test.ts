import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { closeDB, getDB, initDB } from "../services/db";
import {
  type FundingIntentRecord,
  MemoryFundingIntentStore,
  redactFundingReceipt,
  sweepFundingIntents,
} from "../services/funding-intents";

let activeDbDir: string | undefined;

const baseRecord: FundingIntentRecord = {
  id: "fi_sweep",
  gardenId: "0x1111111111111111111111111111111111111111",
  gardenName: "Sweep Garden",
  destinationType: "cookieJar",
  destinationAddress: "0x2222222222222222222222222222222222222222",
  fundingIntent: "donate",
  paymentMethod: "card",
  availabilityKey: "v1:key",
  clientRequestId: "client-request-sweep",
  idempotencyFingerprint: "fingerprint",
  amountUsd: "25",
  chainId: 11155111,
  token: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  provider: "thirdweb",
  status: "started",
  receiptTokenHash: "receipt-hash",
  quoteExpiresAt: "2026-04-27T12:10:00.000Z",
  checkoutExpiresAt: "2026-04-27T12:10:00.000Z",
  transactionAttempts: [],
  createdAt: "2026-04-27T12:00:00.000Z",
  updatedAt: "2026-04-27T12:00:00.000Z",
};

afterEach(async () => {
  await closeDB();
  if (!activeDbDir) return;
  fs.rmSync(activeDbDir, { recursive: true, force: true });
  activeDbDir = undefined;
});

describe("funding intent sweep", () => {
  it("expires abandoned started and pending_provider intents through listPending", async () => {
    const store = new MemoryFundingIntentStore();
    await store.create(baseRecord);
    await store.create({
      ...baseRecord,
      id: "fi_pending",
      clientRequestId: "client-request-pending",
      status: "pending_provider",
    });
    await store.create({
      ...baseRecord,
      id: "fi_funded",
      clientRequestId: "client-request-funded",
      status: "funded",
    });

    const result = await sweepFundingIntents(store, () => Date.parse("2026-04-27T12:45:00.000Z"));

    expect(result).toEqual({ scanned: 2, expired: 2 });
    expect((await store.getById("fi_sweep"))?.status).toBe("expired");
    expect((await store.getById("fi_pending"))?.status).toBe("expired");
    expect((await store.getById("fi_funded"))?.status).toBe("funded");
    expect(store.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ intentId: "fi_sweep", status: "expired" }),
        expect.objectContaining({ intentId: "fi_pending", status: "expired" }),
      ])
    );
  });
});

describe("funding intent SQLite persistence", () => {
  it("persists route-local Endow receipt fields across create and update", async () => {
    activeDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "green-goods-funding-intents-"));
    initDB(path.join(activeDbDir, "funding-intents.db"));

    const db = getDB();
    const created = await db.createFundingIntent({
      ...baseRecord,
      id: "fi_vaults",
      destinationType: "vault",
      fundingIntent: "endow",
      clientRequestId: "client-request-vaults",
      sourceRoute: "/vaults",
      managementUrl: "/vaults?manage=positions",
      receiverAddress: "0x3333333333333333333333333333333333333333",
      quotedAssetAmount: "25000000",
      minAssetAmount: "25000000",
    });

    expect((await db.getFundingIntent(created.id))?.sourceRoute).toBe("/vaults");
    expect((await db.getFundingIntent(created.id))?.managementUrl).toBe("/vaults?manage=positions");

    await db.updateFundingIntent({
      ...created,
      status: "pending_onchain",
      updatedAt: "2026-04-27T12:05:00.000Z",
    });

    const updated = await db.getFundingIntent(created.id);
    expect(updated?.status).toBe("pending_onchain");
    expect(updated?.sourceRoute).toBe("/vaults");
    expect(updated?.managementUrl).toBe("/vaults?manage=positions");
  });
});

describe("redactFundingReceipt", () => {
  it("routes Endow receipts to public endowment management", () => {
    const receipt = redactFundingReceipt({
      ...baseRecord,
      destinationType: "vault",
      fundingIntent: "endow",
    });

    expect(receipt.appManagementCta).toBe("manage_endowments");
    expect(receipt.managementUrl).toBe("/fund?manage=endowments");
  });

  it("routes /vaults Endow receipts to route-local position management", () => {
    const receipt = redactFundingReceipt({
      ...baseRecord,
      destinationType: "vault",
      fundingIntent: "endow",
      sourceRoute: "/vaults",
      managementUrl: "/vaults?manage=positions",
    });

    expect(receipt.appManagementCta).toBe("manage_endowments");
    expect(receipt.managementUrl).toBe("/vaults?manage=positions");
  });

  it("does not add a management CTA for Donate receipts", () => {
    const receipt = redactFundingReceipt(baseRecord);

    expect(receipt.appManagementCta).toBeUndefined();
    expect(receipt.managementUrl).toBeUndefined();
  });
});
