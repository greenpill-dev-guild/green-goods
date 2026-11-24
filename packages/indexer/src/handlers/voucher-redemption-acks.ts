import { indexer } from "envio";

import {
  assertSame,
  cosmoId,
  identity,
  integer,
  position,
  text,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";

/** An acknowledgment attempt is evidence about transport, never another economic action. */
export async function projectRedemptionAcknowledgment(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const sent = event.eventName === "RedemptionAcknowledgmentSent";
  if (!sent && event.eventName !== "RedemptionAcknowledgmentFailed") {
    throw new Error(`Unrouted redemption acknowledgment: ${event.eventName}`);
  }
  const provenance = position(event);
  const redemptionId = text(event.params, "redemptionId");
  const observation = {
    ...identity(event, `${provenance.txHash}-${event.logIndex}`),
    redemptionId,
    custodyEntityId: cosmoId(event.chainId, event.srcAddress, redemptionId),
    sequence: integer(event.params, "sequence"),
    sent,
    messageId: sent ? text(event.params, "messageId") : undefined,
    reason: sent ? undefined : text(event.params, "reason"),
    ...provenance,
  };
  const existing = await context.VoucherRedemptionAcknowledgment.get(observation.id);
  if (existing) {
    for (const key of ["redemptionId", "sequence", "sent", "messageId", "reason"] as const) {
      assertSame(existing[key], observation[key], `acknowledgment observation ${key}`);
    }
    return;
  }
  await context.VoucherRedemptionAcknowledgment.set(observation);
}

for (const eventName of [
  "RedemptionAcknowledgmentSent",
  "RedemptionAcknowledgmentFailed",
] as const) {
  indexer.onEvent(
    { contract: "GnosisVoucherEscrow", event: eventName },
    async ({ event, context }) => {
      await projectRedemptionAcknowledgment(event, context);
    }
  );
}
