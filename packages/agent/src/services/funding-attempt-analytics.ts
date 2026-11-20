import type { FundingIntentStatus } from "@green-goods/shared/public-contracts";
import { type FundingAttemptOutcome, trackFundingIntentEvent } from "./analytics";
import type { FundingIntentRecord, FundingIntentStore } from "./funding-intents";

/**
 * How each settled funding status ends its attempt. An abandoned checkout is the visitor's
 * choice, never a technical failure; a refund means the money did not stay.
 */
const FUNDING_ENDINGS: Partial<Record<FundingIntentStatus, FundingAttemptOutcome>> = {
  funded: "confirmed",
  funded_late: "confirmed",
  failed: "failed",
  refunded: "failed",
  expired: "cancelled",
};

function fundingAttemptProperties(record: FundingIntentRecord) {
  return {
    attempt_id: record.id,
    payment_method: record.paymentMethod,
    funding_intent: record.fundingIntent,
    destination_type: record.destinationType,
    source_route: record.sourceRoute,
    chain_id: record.chainId,
  };
}

/**
 * Records each funding intent as one attempt (PRD-1561): `funding_intent_started` when it is
 * created, and `funding_intent_ended` when its status first settles. The intent's id is the
 * attempt id, so an automatic retry with the same client request id shares it and a new press
 * gets a new one. A provider that funds an intent after it expired records a second ending,
 * `funding_status: funded_late`, which supersedes the expiry.
 */
export function withFundingAttemptAnalytics(store: FundingIntentStore): FundingIntentStore {
  async function recordEnding(
    previous: FundingIntentStatus | undefined,
    record: FundingIntentRecord
  ) {
    const outcome = FUNDING_ENDINGS[record.status];
    if (!outcome || previous === record.status) return;
    await trackFundingIntentEvent(
      "funding_intent_ended",
      {
        ...fundingAttemptProperties(record),
        outcome,
        funding_status: record.status,
        failure_code: record.failureCode,
      },
      record.gardenId
    );
  }

  return {
    getById: (id) => store.getById(id),
    getByClientRequestId: (clientRequestId) => store.getByClientRequestId(clientRequestId),
    appendEvent: (intentId, status, note, providerEventId) =>
      store.appendEvent(intentId, status, note, providerEventId),
    ...(store.listPending ? { listPending: store.listPending.bind(store) } : {}),
    async create(record) {
      const created = await store.create(record);
      await trackFundingIntentEvent(
        "funding_intent_started",
        fundingAttemptProperties(created),
        created.gardenId
      );
      await recordEnding(undefined, created);
      return created;
    },
    async update(record) {
      const previous = await store.getById(record.id);
      const updated = await store.update(record);
      await recordEnding(previous?.status, updated);
      return updated;
    },
  };
}
