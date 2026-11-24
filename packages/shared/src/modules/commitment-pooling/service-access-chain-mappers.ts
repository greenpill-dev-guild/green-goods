import { keccak256, stringToHex } from "viem";
import type {
  ServiceAccessConsent,
  ServiceAccessKey,
  ServiceAccessOffer,
} from "./service-access-types";
import {
  serviceAddress,
  serviceEnum,
  serviceFlag,
  serviceHash,
  serviceTuple,
  serviceUint,
  SERVICE_ZERO_ADDRESS,
  SERVICE_ZERO_HASH,
  type ServiceTuple,
} from "./service-access-chain-values";

export const SERVICE_CORE_STATES = [
  "NONE",
  "OFFERED",
  "REQUESTED",
  "ACCEPTED",
  "READY_FOR_CONFIRMATION",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
];
const OFFER_FIELDS = ["revision", "termsHash", "terms"];
const TERMS_FIELDS = [
  "route",
  "serviceTermsRef",
  "remedyTermsRef",
  "voucherChainId",
  "voucherIssuer",
  "voucherToken",
  "voucherUnits",
];
const CONSENT_FIELDS = [
  "termsRevision",
  "requestNonce",
  "buyerGarden",
  "voucherHolder",
  "termsHash",
  "claimHash",
];

export function mapAuthoritativeOffer(
  raw: unknown,
  rawCore: unknown
): { offer: ServiceAccessOffer; core: ServiceTuple } {
  const tuple = serviceTuple(raw, OFFER_FIELDS);
  const terms = serviceTuple(tuple.terms, TERMS_FIELDS);
  if (Array.isArray(rawCore)) throw new Error("Named complete core ABI tuple required");
  const core = serviceTuple(rawCore, [
    "poolId",
    "state",
    "direction",
    "commitmentType",
    "claimType",
    "claimMode",
    "unitLabel",
    "targetUnits",
    "consideration",
    "providerGarden",
    "counterparty",
  ]);
  const consideration = serviceTuple(core.consideration, ["rail", "source", "token", "amount"]);
  const route = serviceEnum(terms.route, [
    "legacy",
    "personal-gd",
    "voucher",
  ]) as ServiceAccessOffer["route"];
  const revision = serviceUint(tuple.revision, 64);
  const termsHash = serviceHash(tuple.termsHash);
  const serviceTermsRef = serviceHash(terms.serviceTermsRef);
  const remedyTermsRef = serviceHash(terms.remedyTermsRef);
  const voucherChain = serviceUint(terms.voucherChainId);
  const issuer = serviceAddress(terms.voucherIssuer);
  const token = serviceAddress(terms.voucherToken);
  const voucherUnits = serviceUint(terms.voucherUnits);
  const serviceUnits = serviceUint(core.targetUnits);
  const gdPrice = serviceUint(consideration.amount);
  if (typeof core.unitLabel !== "string") throw new Error("Invalid service unit label");
  const providerGarden = serviceAddress(core.providerGarden);
  if (route === "legacy") {
    if (revision !== 0n || termsHash !== SERVICE_ZERO_HASH)
      throw new Error("Malformed Legacy service terms");
  } else {
    if (
      revision === 0n ||
      termsHash === SERVICE_ZERO_HASH ||
      serviceTermsRef === SERVICE_ZERO_HASH ||
      remedyTermsRef === SERVICE_ZERO_HASH ||
      serviceUnits === 0n ||
      !core.unitLabel.trim() ||
      core.direction !== 0 ||
      core.commitmentType !== 1 ||
      core.claimType !== 1 ||
      core.claimMode !== 1
    )
      throw new Error("Invalid canonical service offer");
    if (
      route === "personal-gd"
        ? consideration.rail !== 2 ||
          gdPrice === 0n ||
          voucherChain !== 0n ||
          issuer !== SERVICE_ZERO_ADDRESS ||
          token !== SERVICE_ZERO_ADDRESS ||
          voucherUnits !== 0n
        : gdPrice !== 0n ||
          consideration.rail !== 0 ||
          voucherChain !== 100n ||
          issuer === SERVICE_ZERO_ADDRESS ||
          token === SERVICE_ZERO_ADDRESS ||
          voucherUnits === 0n
    )
      throw new Error("Service payment route mismatch");
  }
  return {
    core,
    offer: {
      route,
      revision,
      termsHash,
      serviceTermsRef,
      remedyTermsRef,
      serviceUnits,
      unitLabel: core.unitLabel,
      providerGarden,
      gdPrice,
      // Token metadata is intentionally unknown without a reviewed asset registry.
      voucher:
        route === "voucher"
          ? {
              asset: { chainId: 100, token, symbol: null, decimals: null },
              issuer,
              units: voucherUnits,
            }
          : null,
    },
  };
}

export function mapAuthoritativeConsent(
  raw: unknown,
  rawPending: unknown,
  rawAccepted: unknown,
  key: ServiceAccessKey,
  offer: ServiceAccessOffer,
  core: ServiceTuple
): { consent: ServiceAccessConsent | null; nextRequestNonce: bigint } {
  const tuple = serviceTuple(raw, CONSENT_FIELDS);
  const requestNonce = serviceUint(tuple.requestNonce, 64);
  const revision = serviceUint(tuple.termsRevision, 64);
  const claimHash = serviceHash(tuple.claimHash);
  const pending = serviceTuple(rawPending, [
    "claimant",
    "requestedBy",
    "kind",
    "gardenContext",
    "requestedAt",
    "active",
  ]);
  const active = serviceFlag(pending.active);
  const accepted = serviceTuple(rawAccepted, [
    "offer",
    "consent",
    "buyer",
    "serviceRecipient",
    "providerGarden",
    "serviceUnits",
    "unitLabelHash",
    "gdPrice",
  ]);
  const acceptedConsent = serviceTuple(accepted.consent, CONSENT_FIELDS);
  const acceptedRevision = serviceUint(acceptedConsent.termsRevision, 64);
  if (revision === 0n) {
    if (requestNonce !== 0n || claimHash !== SERVICE_ZERO_HASH || active)
      throw new Error("Malformed empty service consent");
    return { consent: null, nextRequestNonce: 1n };
  }
  if (requestNonce === 0n || claimHash === SERVICE_ZERO_HASH)
    throw new Error("Malformed service consent identity");
  const buyerGarden = serviceAddress(tuple.buyerGarden);
  const voucherHolder = serviceAddress(tuple.voucherHolder);
  const termsHash = serviceHash(tuple.termsHash);
  if (
    buyerGarden === SERVICE_ZERO_ADDRESS ||
    (offer.route === "personal-gd"
      ? voucherHolder !== SERVICE_ZERO_ADDRESS
      : voucherHolder === SERVICE_ZERO_ADDRESS)
  )
    throw new Error("Invalid service consent accounts");
  let state: ServiceAccessConsent["state"] = active ? "pending" : "inactive";
  if (
    active &&
    (serviceAddress(pending.claimant) !== key.buyer.toLowerCase() ||
      serviceAddress(pending.requestedBy) !== key.buyer.toLowerCase() ||
      pending.kind !== 1 ||
      serviceAddress(pending.gardenContext) !== buyerGarden)
  )
    throw new Error("Pending service consent identity mismatch");
  if (acceptedRevision > 0n) {
    const acceptedBuyer = serviceAddress(accepted.buyer);
    if (
      acceptedBuyer !== serviceAddress(core.counterparty) ||
      serviceAddress(accepted.serviceRecipient) !== acceptedBuyer
    )
      throw new Error("Accepted service buyer mismatch");
    if (acceptedBuyer === key.buyer.toLowerCase()) {
      const acceptedOffer = serviceTuple(accepted.offer, OFFER_FIELDS);
      if (
        acceptedRevision !== offer.revision ||
        serviceUint(acceptedOffer.revision, 64) !== offer.revision ||
        serviceHash(acceptedOffer.termsHash) !== offer.termsHash ||
        serviceHash(acceptedConsent.claimHash) !== claimHash ||
        serviceUint(acceptedConsent.requestNonce, 64) !== requestNonce ||
        serviceHash(acceptedConsent.termsHash) !== termsHash ||
        serviceAddress(acceptedConsent.buyerGarden) !== buyerGarden ||
        serviceAddress(acceptedConsent.voucherHolder) !== voucherHolder ||
        serviceUint(accepted.serviceUnits) !== offer.serviceUnits ||
        serviceUint(accepted.gdPrice) !== offer.gdPrice ||
        serviceAddress(accepted.providerGarden) !== offer.providerGarden ||
        serviceHash(accepted.unitLabelHash) !== keccak256(stringToHex(offer.unitLabel))
      )
        throw new Error("Accepted service terms mismatch");
      state = "accepted";
    } else state = "superseded";
  }
  return {
    consent: { revision, requestNonce, termsHash, claimHash, buyerGarden, voucherHolder, state },
    nextRequestNonce: requestNonce + 1n,
  };
}
