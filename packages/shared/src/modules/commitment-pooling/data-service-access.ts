import { isAddress, type Hex } from "viem";
import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "./service-access-types";

type Row = Record<string, unknown>;

/** These observations are deliberately incomplete: emitted events omit full service terms. */
export interface ServiceOfferObservation {
  id: string;
  revision: bigint;
  termsHash: Hex;
  paymentRoute: 0 | 1 | 2;
  gdPrice: bigint;
  blockNumber: bigint;
}

export interface ServiceClaimObservation {
  id: string;
  claimHash: Hex;
  revision: bigint | null;
  requestNonce: bigint | null;
  buyerGarden: Address | null;
  voucherHolder: Address | null;
  requestSeen: boolean;
  acceptedSeen: boolean;
  withdrawnSeen: boolean;
}

export interface ServiceAccessProjection {
  key: ServiceAccessKey;
  evidence: "indexed";
  complete: false;
  offer: ServiceOfferObservation | null;
  claims: ServiceClaimObservation[];
}

function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed service projection");
  return value as Row;
}

function uint(value: unknown, bits = 256): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value))
    throw new Error("Invalid service integer");
  const result = BigInt(value);
  if (result >= 1n << BigInt(bits)) throw new Error("Service integer exceeds ABI bounds");
  return result;
}

function hash(value: unknown): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value))
    throw new Error("Invalid service hash");
  return value.toLowerCase() as Hex;
}

function address(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new Error("Invalid service account");
  return value.toLowerCase() as Address;
}

function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid service observation flag");
  return value;
}

function optional<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null || value === undefined ? null : parse(value);
}

function requireScope(row: Row, key: ServiceAccessKey) {
  if (
    row.chainId !== key.sourceChainId ||
    address(row.moduleAddress) !== key.coreModule.toLowerCase() ||
    uint(row.commitmentId) !== key.commitmentId
  )
    throw new Error("Service projection identity mismatch");
}

/** No absence, event flag or partial indexed record establishes canonical Legacy/current consent. */
export async function getServiceAccessProjection(
  key: ServiceAccessKey,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<ServiceAccessProjection> {
  const result = await reader.query<{
    ServiceOfferRevision: unknown[];
    ServiceClaimConsent: unknown[];
  }>(
    `query ServiceAccessProjection($chainId: Int!, $module: String!, $commitment: numeric!, $buyer: String!) {
      ServiceOfferRevision(where: {chainId: {_eq: $chainId}, moduleAddress: {_eq: $module}, commitmentId: {_eq: $commitment}}, order_by: {revision: desc}, limit: 1) {
        id chainId moduleAddress commitmentId revision termsHash paymentRoute gdPrice blockNumber
      }
      ServiceClaimConsent(where: {chainId: {_eq: $chainId}, moduleAddress: {_eq: $module}, commitmentId: {_eq: $commitment}, buyer: {_eq: $buyer}}, order_by: {updatedAt: desc}) {
        id chainId moduleAddress commitmentId buyer claimHash revision requestNonce buyerGarden voucherHolder requestSeen acceptedSeen withdrawnSeen
      }
    }`,
    {
      chainId: key.sourceChainId,
      module: key.coreModule.toLowerCase(),
      commitment: key.commitmentId.toString(),
      buyer: key.buyer.toLowerCase(),
    },
    "getServiceAccessProjection"
  );
  if (result.error) throw result.error;
  if (
    !Array.isArray(result.data.ServiceOfferRevision) ||
    !Array.isArray(result.data.ServiceClaimConsent)
  )
    throw new Error("Incomplete service projection response");
  const offers = result.data.ServiceOfferRevision.map((value): ServiceOfferObservation => {
    const row = record(value);
    requireScope(row, key);
    if (row.paymentRoute !== 0 && row.paymentRoute !== 1 && row.paymentRoute !== 2)
      throw new Error("Unsupported service route");
    const revision = uint(row.revision, 64);
    const id = `${key.sourceChainId}-${key.coreModule.toLowerCase()}-${key.commitmentId}-${revision}`;
    if (row.id !== id) throw new Error("Service revision identity mismatch");
    return {
      id,
      revision,
      termsHash: hash(row.termsHash),
      paymentRoute: row.paymentRoute,
      gdPrice: uint(row.gdPrice),
      blockNumber: uint(row.blockNumber),
    };
  });
  const claims = result.data.ServiceClaimConsent.map((value): ServiceClaimObservation => {
    const row = record(value);
    requireScope(row, key);
    const claimHash = hash(row.claimHash);
    const id = `${key.sourceChainId}-${key.coreModule.toLowerCase()}-${claimHash}`;
    if (row.id !== id || address(row.buyer) !== key.buyer.toLowerCase())
      throw new Error("Service claim identity mismatch");
    return {
      id,
      claimHash,
      revision: optional(row.revision, (value) => uint(value, 64)),
      requestNonce: optional(row.requestNonce, (value) => uint(value, 64)),
      buyerGarden: optional(row.buyerGarden, address),
      voucherHolder: optional(row.voucherHolder, address),
      requestSeen: flag(row.requestSeen),
      acceptedSeen: flag(row.acceptedSeen),
      withdrawnSeen: flag(row.withdrawnSeen),
    };
  });
  return { key, evidence: "indexed", complete: false, offer: offers[0] ?? null, claims };
}

export function unavailableServiceAccess(
  key: ServiceAccessKey,
  projection?: ServiceAccessProjection
): ServiceAccessSnapshot {
  const known = !!projection?.offer && projection.offer.paymentRoute !== 0;
  return {
    key,
    mode: "unavailable",
    knownService:
      projection?.offer !== null &&
      projection?.offer !== undefined &&
      projection.offer.paymentRoute !== 0,
    evidence: "indexed",
    complete: false,
    offer: null,
    consent: null,
    nextRequestNonce: 0n,
    coreState: null,
    pause: { core: null, sourceVoucher: null, destinationVoucher: null },
    eligibleBuyerGardens: [],
    personalFeeQuote: null,
    personalPaymentAccount: null,
    availableActions: [],
    personalPurchase: null,
    sourceBlock: null,
    sourceTimestamp: null,
    currentVoucherSetupId: null,
    voucherSetups: [],
    acceptancePolicy: {
      kind: "unknown",
      knownOptIn: known,
      blockGenericMemberAcceptance: known,
      earned: {
        status: "unknown",
        module: null,
        revision: null,
        termsHash: null,
        acceptedRevision: null,
        acceptedTermsHash: null,
        acceptedCounterparty: null,
        terms: null,
        creator: null,
        creatorConsentRevision: null,
        participant: null,
        participantConsentRevision: null,
        accountRouteAvailable: false,
      },
    },
    capabilities: {
      mutation: "unavailable",
      reasons: [
        "deployment-unreviewed",
        "chain-unconfigured",
        "signer-unavailable",
        "authoritative-view-unconfigured",
        "projection-incomplete",
      ],
      sourceBuyer: key.buyer,
      celoDepositor: null,
      gnosisHolder: null,
      canSignSource: false,
      canSendSource: false,
      canSignCelo: false,
      canSignHolder: false,
      canSendDestination: false,
    },
  };
}
