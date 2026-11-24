import { indexer, type VoucherDistributionCommand } from "envio";
import {
  cosmoId,
  cursor,
  flag,
  identity,
  integer,
  position,
  projectVoucherEndpoint,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { sameFacts } from "./voucher-service-projections";

/** Adapter execution and acknowledgment records. Success here is not yet known to the source. */
export async function projectVoucherDistributionDelivery(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const p = event.params;
  const entitlementId = text(p, "entitlementId");
  const commandEntityId = cosmoId(event.chainId, event.srcAddress, entitlementId);
  if (event.eventName === "AcknowledgmentSent" || event.eventName === "AcknowledgmentFailed") {
    const sent = event.eventName === "AcknowledgmentSent";
    const provenance = position(event);
    const fields = {
      entitlementId,
      sequence: integer(p, "sequence"),
      sent,
      messageId: sent ? text(p, "messageId") : undefined,
      reason: sent ? undefined : text(p, "reason"),
    };
    const row = {
      ...identity(event, `${provenance.txHash}-${event.logIndex}`),
      ...fields,
      commandEntityId,
      ...provenance,
    };
    const existing = await context.VoucherDistributionAcknowledgment.get(row.id);
    if (existing) {
      sameFacts(existing, fields, "distribution acknowledgment observation");
      return;
    }
    await context.VoucherDistributionAcknowledgment.set(row);
    return;
  }
  const command: VoucherDistributionCommand = (await context.VoucherDistributionCommand.get(
    commandEntityId
  )) ?? {
    ...identity(event, entitlementId),
    entitlementId,
    payloadHash: undefined,
    firstMessageId: undefined,
    recordedSeen: false,
    latestSequence: undefined,
    delivered: false,
    ...cursor("recorded"),
    ...times(event),
  };
  if (event.eventName === "CommandRecorded") {
    const facts = { payloadHash: text(p, "payloadHash"), firstMessageId: text(p, "messageId") };
    sameFacts(command, facts, "distribution command");
    if (command.recordedSeen) return;
    await context.VoucherDistributionCommand.set({
      ...command,
      ...facts,
      recordedSeen: true,
      ...cursor("recorded", event),
      ...times(event, command),
    });
  } else if (event.eventName === "DistributionResult") {
    const sequence = integer(p, "sequence");
    const fields = {
      entitlementId,
      sequence,
      success: flag(p, "success"),
      failureHash: text(p, "failureHash"),
      reason: text(p, "reason"),
    };
    const attemptId = cosmoId(event.chainId, event.srcAddress, `${entitlementId}-${sequence}`);
    const known = await context.VoucherDistributionAttempt.get(attemptId);
    if (known) {
      sameFacts(known, fields, "distribution attempt");
      return;
    }
    await context.VoucherDistributionAttempt.set({
      ...identity(event, `${entitlementId}-${sequence}`),
      ...fields,
      commandEntityId,
      ...position(event),
    });
    await context.VoucherDistributionCommand.set({
      ...command,
      latestSequence:
        command.latestSequence === undefined || sequence > command.latestSequence
          ? sequence
          : command.latestSequence,
      // A successful attempt is terminal; the adapter refuses every later retry.
      delivered: command.delivered || fields.success,
      ...times(event, command),
    });
  } else {
    throw new Error("Unrouted distribution delivery event");
  }
}

for (const event of [
  "CommandRecorded",
  "DistributionResult",
  "AcknowledgmentSent",
  "AcknowledgmentFailed",
] as const) {
  indexer.onEvent({ contract: "GnosisVoucherAdapter", event }, async ({ event, context }) => {
    await projectVoucherDistributionDelivery(event, context);
  });
}
for (const event of ["VoucherEndpointPinned", "VoucherPauseChanged"] as const) {
  indexer.onEvent({ contract: "GnosisVoucherAdapter", event }, async ({ event, context }) => {
    await projectVoucherEndpoint(event, context);
  });
}
