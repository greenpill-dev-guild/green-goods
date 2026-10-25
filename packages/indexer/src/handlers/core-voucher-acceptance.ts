import { indexer, type VoucherCoreConfiguration, type EarnedVoucherRevision } from "envio";
import {
  assertSame,
  cosmoId,
  cursor,
  identity,
  integer,
  position,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { sameFacts } from "./voucher-service-projections";

export async function projectCoreVoucher(event: CosmoEvent, context: CosmoContext): Promise<void> {
  const p = event.params;
  if (
    event.eventName === "EarnedVoucherModulePinned" ||
    event.eventName === "VoucherServiceSetupModulePinned"
  ) {
    const earned = event.eventName === "EarnedVoucherModulePinned";
    const id = cosmoId(event.chainId, event.srcAddress);
    const record: VoucherCoreConfiguration = (await context.VoucherCoreConfiguration.get(id)) ?? {
      ...identity(event),
      earnedModule: undefined,
      serviceSetupModule: undefined,
      earnedPinSeen: false,
      servicePinSeen: false,
      ...cursor("earnedPinned"),
      ...cursor("servicePinned"),
      ...times(event),
    };
    const peer = text(p, "module");
    const known = earned ? record.earnedModule : record.serviceSetupModule;
    if (known !== undefined) {
      assertSame(known, peer, "immutable named voucher peer");
      return;
    }
    await context.VoucherCoreConfiguration.set({
      ...record,
      ...(earned
        ? { earnedPinSeen: true, earnedModule: peer, ...cursor("earnedPinned", event) }
        : { servicePinSeen: true, serviceSetupModule: peer, ...cursor("servicePinned", event) }),
      ...times(event, record),
    });
    return;
  }
  const commitmentId = integer(p, "commitmentId");
  if (event.eventName === "VoucherServiceAcceptanceRecorded") {
    const fields = {
      commitmentId,
      setupModule: text(p, "setupModule"),
      claimHash: text(p, "claimHash"),
      termsRevision: integer(p, "revision"),
      requestNonce: integer(p, "requestNonce"),
      setupId: text(p, "setupId"),
      authorizationHash: text(p, "authorizationHash"),
      depositReceiptHash: text(p, "depositReceiptHash"),
    };
    const id = cosmoId(event.chainId, event.srcAddress, commitmentId);
    const existing = await context.VoucherServiceAcceptance.get(id);
    if (existing) {
      sameFacts(existing, fields, "accepted voucher setup");
      return;
    }
    await context.VoucherServiceAcceptance.set({
      ...identity(event, commitmentId),
      ...fields,
      claimEntityId: cosmoId(event.chainId, event.srcAddress, fields.claimHash),
      sourceSetupEntityId: cosmoId(event.chainId, fields.setupModule, fields.setupId),
      ...position(event),
    });
    return;
  }
  if (
    event.eventName !== "EarnedVoucherTermsBound" &&
    event.eventName !== "EarnedVoucherAcceptanceRecorded"
  )
    throw new Error("Unrouted core voucher event");
  const revision = integer(p, "revision");
  const fields = {
    commitmentId,
    revision,
    module: text(p, "module"),
    termsHash: text(p, "termsHash"),
  };
  const id = cosmoId(event.chainId, event.srcAddress, `${commitmentId}-${revision}`);
  const record: EarnedVoucherRevision = (await context.EarnedVoucherRevision.get(id)) ?? {
    ...identity(event, `${commitmentId}-${revision}`),
    ...fields,
    boundSeen: false,
    acceptedSeen: false,
    creator: undefined,
    counterparty: undefined,
    ...cursor("bound"),
    ...cursor("accepted"),
    ...times(event),
  };
  sameFacts(record, fields, "earned voucher revision");
  if (event.eventName === "EarnedVoucherTermsBound") {
    if (record.boundSeen) return;
    await context.EarnedVoucherRevision.set({
      ...record,
      boundSeen: true,
      ...cursor("bound", event),
      ...times(event, record),
    });
  } else {
    const accepted = { creator: text(p, "creator"), counterparty: text(p, "counterparty") };
    sameFacts(record, accepted, "earned accepted participants");
    if (record.acceptedSeen) return;
    await context.EarnedVoucherRevision.set({
      ...record,
      ...accepted,
      acceptedSeen: true,
      ...cursor("accepted", event),
      ...times(event, record),
    });
  }
}
for (const event of [
  "EarnedVoucherModulePinned",
  "VoucherServiceSetupModulePinned",
  "EarnedVoucherTermsBound",
  "EarnedVoucherAcceptanceRecorded",
  "VoucherServiceAcceptanceRecorded",
] as const) {
  indexer.onEvent({ contract: "CommitmentPoolingModule", event }, async ({ event, context }) => {
    await projectCoreVoucher(event, context);
  });
}
