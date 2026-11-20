import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initAgentAnalytics, resetAgentAnalyticsForTests } from "../services/analytics";
import { withFundingAttemptAnalytics } from "../services/funding-attempt-analytics";
import { type FundingIntentRecord, MemoryFundingIntentStore } from "../services/funding-intents";
import { mockPostHog } from "./setup";

const GARDEN = "0x1111111111111111111111111111111111111111";

const intent: FundingIntentRecord = {
  id: "fi_attempt",
  gardenId: GARDEN,
  gardenName: "Attempt Garden",
  destinationType: "vault",
  destinationAddress: "0x2222222222222222222222222222222222222222",
  fundingIntent: "endow",
  paymentMethod: "card",
  availabilityKey: "v1:key",
  clientRequestId: "client-request-attempt",
  idempotencyFingerprint: "fingerprint",
  amountUsd: "25",
  chainId: 11155111,
  token: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  provider: "thirdweb",
  status: "started",
  receiptTokenHash: "receipt-hash",
  quoteExpiresAt: "2026-04-27T12:10:00.000Z",
  sourceRoute: "/vaults",
  transactionAttempts: [],
  createdAt: "2026-04-27T12:00:00.000Z",
  updatedAt: "2026-04-27T12:00:00.000Z",
};

/** Each captured event's name and the properties a question reads. */
function captured() {
  return mockPostHog.capture.mock.calls.map(([{ event, properties }]) => ({
    event,
    attempt_id: properties.attempt_id,
    outcome: properties.outcome,
    funding_status: properties.funding_status,
  }));
}

describe("funding intent attempts (PRD-1561)", () => {
  beforeEach(() => {
    resetAgentAnalyticsForTests();
    mockPostHog.capture.mockReset();
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true, testGardens: GARDEN });
  });

  afterEach(() => {
    resetAgentAnalyticsForTests();
  });

  it("starts an attempt with the intent's id and ends it once, however often the status repeats", async () => {
    const store = withFundingAttemptAnalytics(new MemoryFundingIntentStore());

    await store.create(intent);
    await store.update({ ...intent, status: "pending_provider" });
    await store.update({ ...intent, status: "funded" });
    // A redelivered provider webhook writes the same settled status again.
    await store.update({ ...intent, status: "funded", updatedAt: "2026-04-27T12:05:00.000Z" });

    expect(captured()).toEqual([
      {
        event: "funding_intent_started",
        attempt_id: "fi_attempt",
        outcome: undefined,
        funding_status: undefined,
      },
      {
        event: "funding_intent_ended",
        attempt_id: "fi_attempt",
        outcome: "confirmed",
        funding_status: "funded",
      },
    ]);
    expect(mockPostHog.capture.mock.calls[0]?.[0].properties).toMatchObject({
      schema_version: 1,
      payment_method: "card",
      funding_intent: "endow",
      destination_type: "vault",
      source_route: "/vaults",
      chain_id: 11155111,
      app_surface: "agent",
      is_test_garden: true,
    });
  });

  it("counts an abandoned checkout as cancelled and a provider failure as failed", async () => {
    const store = withFundingAttemptAnalytics(new MemoryFundingIntentStore());

    await store.create(intent);
    await store.update({ ...intent, status: "expired", failureCode: "expired" });
    await store.create({ ...intent, id: "fi_failed", clientRequestId: "client-request-failed" });
    await store.update({
      ...intent,
      id: "fi_failed",
      clientRequestId: "client-request-failed",
      status: "failed",
      failureCode: "provider_failed",
    });

    const endings = mockPostHog.capture.mock.calls
      .map(([{ event, properties }]) => ({ event, ...properties }))
      .filter(({ event }) => event === "funding_intent_ended");
    expect(endings).toMatchObject([
      { attempt_id: "fi_attempt", outcome: "cancelled", failure_code: "expired" },
      { attempt_id: "fi_failed", outcome: "failed", failure_code: "provider_failed" },
    ]);
  });

  it("starts and ends a proof the visitor's own wallet already settled", async () => {
    const store = withFundingAttemptAnalytics(new MemoryFundingIntentStore());

    await store.create({ ...intent, status: "funded" });

    expect(captured()).toEqual([
      {
        event: "funding_intent_started",
        attempt_id: "fi_attempt",
        outcome: undefined,
        funding_status: undefined,
      },
      {
        event: "funding_intent_ended",
        attempt_id: "fi_attempt",
        outcome: "confirmed",
        funding_status: "funded",
      },
    ]);
  });

  it("records a late payment after an expiry as the attempt's newer ending", async () => {
    const store = withFundingAttemptAnalytics(new MemoryFundingIntentStore());

    await store.create(intent);
    await store.update({ ...intent, status: "expired" });
    await store.update({ ...intent, status: "funded_late" });

    expect(captured().slice(1)).toEqual([
      {
        event: "funding_intent_ended",
        attempt_id: "fi_attempt",
        outcome: "cancelled",
        funding_status: "expired",
      },
      {
        event: "funding_intent_ended",
        attempt_id: "fi_attempt",
        outcome: "confirmed",
        funding_status: "funded_late",
      },
    ]);
  });
});
