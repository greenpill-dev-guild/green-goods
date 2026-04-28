import { describe, expect, it } from "vitest";
import {
  type FundingIntentRecord,
  MemoryFundingIntentStore,
  sweepFundingIntents,
} from "../services/funding-intents";

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
