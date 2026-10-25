import { indexer, type ServiceClaimConsent } from "envio";

import {
  assertSame,
  cosmoId,
  cursor,
  identity,
  integer,
  position,
  smallInteger,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { cursorWins } from "./commitment-pool-projections";

const SERVICE_EVENTS = [
  "ServiceOfferTermsSet",
  "ServiceClaimConsentRequested",
  "ServiceClaimConsentAccepted",
  "ServiceClaimConsentWithdrawn",
] as const;

export async function projectServiceOffer(event: CosmoEvent, context: CosmoContext): Promise<void> {
  const params = event.params;
  const commitmentId = integer(params, "commitmentId");
  if (event.eventName === "ServiceOfferTermsSet") {
    const revision = integer(params, "revision");
    const facts = {
      ...identity(event, `${commitmentId}-${revision}`),
      commitmentId,
      revision,
      termsHash: text(params, "termsHash"),
      paymentRoute: smallInteger(params, "route", 2n),
      gdPrice: integer(params, "gdPrice"),
      ...position(event),
    };
    const existing = await context.ServiceOfferRevision.get(facts.id);
    if (existing) {
      for (const key of ["termsHash", "paymentRoute", "gdPrice"] as const) {
        assertSame(existing[key], facts[key], `immutable service revision ${key}`);
      }
      return;
    }
    await context.ServiceOfferRevision.set(facts);
    return;
  }
  const claimHash = text(params, "claimHash");
  const buyer = text(params, "buyer");
  const id = cosmoId(event.chainId, event.srcAddress, claimHash);
  const existing = await context.ServiceClaimConsent.get(id);
  const consent: ServiceClaimConsent = existing ?? {
    ...identity(event, claimHash),
    commitmentId,
    buyer,
    claimHash,
    revision: undefined,
    requestNonce: undefined,
    revisionEntityId: undefined,
    buyerGarden: undefined,
    voucherHolder: undefined,
    requestSeen: false,
    acceptedSeen: false,
    withdrawnSeen: false,
    ...cursor("requested"),
    ...cursor("accepted"),
    ...cursor("withdrawn"),
    ...times(event),
  };
  assertSame(consent.commitmentId, commitmentId, "service claim commitment");
  assertSame(consent.buyer, buyer, "service claim buyer");
  let next = { ...consent, ...times(event, consent) };
  if (event.eventName === "ServiceClaimConsentWithdrawn") {
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        consent.withdrawnBlockNumber,
        consent.withdrawnLogIndex
      )
    ) {
      next = { ...next, withdrawnSeen: true, ...cursor("withdrawn", event) };
    }
  } else if (
    event.eventName === "ServiceClaimConsentRequested" ||
    event.eventName === "ServiceClaimConsentAccepted"
  ) {
    const revision = integer(params, "revision");
    const requestNonce = integer(params, "requestNonce");
    if (consent.revision !== undefined)
      assertSame(consent.revision, revision, "service claim revision");
    if (consent.requestNonce !== undefined)
      assertSame(consent.requestNonce, requestNonce, "service claim nonce");
    next = {
      ...next,
      revision,
      requestNonce,
      revisionEntityId: cosmoId(event.chainId, event.srcAddress, `${commitmentId}-${revision}`),
    };
    if (event.eventName === "ServiceClaimConsentRequested") {
      if (consent.requestSeen) {
        assertSame(consent.buyerGarden, text(params, "buyerGarden"), "service claim buyer garden");
        assertSame(consent.voucherHolder, text(params, "voucherHolder"), "service claim holder");
        return;
      }
      next = {
        ...next,
        requestSeen: true,
        buyerGarden: text(params, "buyerGarden"),
        voucherHolder: text(params, "voucherHolder"),
        ...cursor("requested", event),
      };
    } else {
      next = { ...next, acceptedSeen: true, ...cursor("accepted", event) };
    }
  } else {
    throw new Error(`Unrouted service offer event: ${event.eventName}`);
  }
  await context.ServiceClaimConsent.set(next);
}

for (const eventName of SERVICE_EVENTS) {
  indexer.onEvent(
    { contract: "CommitmentPoolingModule", event: eventName },
    async ({ event, context }) => {
      await projectServiceOffer(event, context);
    }
  );
}
