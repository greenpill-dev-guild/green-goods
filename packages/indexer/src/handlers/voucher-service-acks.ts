import { indexer } from "envio";
import {
  cosmoId,
  flag,
  identity,
  integer,
  position,
  text,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { sameFacts } from "./voucher-service-projections";

/** Setup and final acknowledgment lanes are independent transport observations, never transfers. */
export async function projectVoucherServiceAcknowledgment(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const sent = event.eventName === "VoucherServiceAcknowledgmentSent";
  if (!sent && event.eventName !== "VoucherServiceAcknowledgmentFailed")
    throw new Error("Unrouted service acknowledgment");
  const p = event.params,
    provenance = position(event),
    setupId = text(p, "setupId");
  const fields = {
    setupId,
    finalResult: flag(p, "finalResult"),
    sequence: integer(p, "sequence"),
    sent,
    messageId: sent ? text(p, "messageId") : undefined,
    reason: sent ? undefined : text(p, "reason"),
  };
  const row = {
    ...identity(event, `${provenance.txHash}-${event.logIndex}`),
    ...fields,
    custodyEntityId: cosmoId(event.chainId, event.srcAddress, setupId),
    ...provenance,
  };
  const existing = await context.VoucherServiceAcknowledgment.get(row.id);
  if (existing) {
    sameFacts(existing, fields, "service acknowledgment observation");
    return;
  }
  await context.VoucherServiceAcknowledgment.set(row);
}
for (const event of [
  "VoucherServiceAcknowledgmentSent",
  "VoucherServiceAcknowledgmentFailed",
] as const) {
  indexer.onEvent({ contract: "GnosisVoucherEscrow", event }, async ({ event, context }) => {
    await projectVoucherServiceAcknowledgment(event, context);
  });
}
