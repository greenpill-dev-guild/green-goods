import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import {
  type Abi,
  type AbiParameter,
  type Hex,
  decodeAbiParameters,
  keccak256,
  stringToHex,
} from "viem";
import { serviceFlag, serviceTuple, serviceUint } from "./service-access-chain-values";
import {
  parseVoucherAuthorization,
  mapVoucherSetupResult,
  mapVoucherFinalResult,
} from "./service-access-voucher-chain-mappers";
import { voucherAuthorizationIdentity } from "./service-access-voucher-hashes";
import { EscrowABI, issuerRead, type ServiceIssuerChain } from "./service-issuer-chain";
import { issuerAsset, issuerSame } from "./service-issuer-metadata";
import type {
  ServiceIssuerRoute,
  ServiceIssuerBookings,
  ServiceIssuerActor,
} from "./service-issuer-types";
import { discoverIssuerVoucherSetups } from "./data-voucher-service";
import type { GraphQLReader } from "../data/graphql-client";

const AUTH = SourceABI.find((v) => v.type === "function" && v.name === "getSetupAuthorization");
if (!AUTH || !("outputs" in AUTH) || !AUTH.outputs?.[0])
  throw new Error("Missing setup authorization ABI");
const AUTH_PARAMETER = AUTH.outputs[0] as AbiParameter;

export async function readIssuerBooking(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  assetId: string,
  action: { setupId: Hex; authorizationHash: Hex }
) {
  const asset = issuerAsset(route, assetId, true);
  const raw = serviceTuple(
    await issuerRead(
      chain,
      route.service.destination.address,
      "getSetupExecution",
      [action.setupId],
      EscrowABI as Abi
    ),
    [
      "authorization",
      "result",
      "pendingAction",
      "decision",
      "failureReason",
      "issuerReturnCeiling",
      "holderAbortRequested",
      "setupAcknowledgment",
      "finalAcknowledgment",
      "finalSequence",
      "finalAllocation",
    ]
  );
  if (typeof raw.authorization !== "string" || raw.authorization.length !== 1602)
    throw new Error("Canonical booking authorization unavailable");
  const [kind, value] = decodeAbiParameters(
    [{ type: "bytes32" }, AUTH_PARAMETER],
    raw.authorization as `0x${string}`
  );
  const authorization = parseVoucherAuthorization(value);
  const identity = voucherAuthorizationIdentity(authorization);
  if (
    kind !== keccak256(stringToHex("GREEN_GOODS_VOUCHER_SETUP_AUTHORIZATION_V2")) ||
    identity.setupId !== action.setupId ||
    identity.authorizationHash !== action.authorizationHash ||
    authorization.sourceChainId !== 42161 ||
    authorization.destinationChainId !== 100 ||
    !issuerSame(authorization.sourceModule, route.service.source.address) ||
    !issuerSame(authorization.coreModule, route.service.core.address) ||
    !issuerSame(authorization.destinationEscrow, route.service.destination.address) ||
    !issuerSame(authorization.issuer, asset.ownerReserve) ||
    !issuerSame(authorization.token, asset.token.address)
  )
    throw new Error("Booking issuer, terms, unit or exact authorization changed");
  const result = mapVoucherSetupResult(
    raw.result,
    action.setupId,
    action.authorizationHash,
    authorization
  );
  if (!result) throw new Error("Booking not received on Gnosis");
  const frozen = serviceUint(raw.finalSequence, 64) > 0n;
  const ceiling = serviceUint(raw.issuerReturnCeiling);
  if (ceiling > authorization.voucherUnits) throw new Error("Invalid issuer return ceiling");
  const finalAllocation = frozen
    ? mapVoucherFinalResult(
        await issuerRead(
          chain,
          route.service.destination.address,
          "getFinalResult",
          [action.setupId],
          EscrowABI as Abi
        ),
        action.setupId,
        action.authorizationHash,
        authorization
      )
    : null;
  if (frozen && !finalAllocation) throw new Error("Frozen booking allocation unavailable");
  return {
    authorization,
    result,
    ceiling,
    frozen,
    finalAllocation,
    reviewedTermsMatch: asset.service.offers
      ? asset.service.offers.some(
          (offer) =>
            authorization.serviceTermsRef === offer.serviceTermsRef &&
            authorization.remedyTermsRef === offer.remedyTermsRef &&
            authorization.unitLabelHash === keccak256(stringToHex(offer.unit)) &&
            authorization.serviceUnits === offer.serviceUnits &&
            authorization.voucherUnits === offer.voucherUnits
        )
      : !!asset.service.unit &&
        authorization.serviceTermsRef === asset.service.terms.digest &&
        authorization.unitLabelHash === keccak256(stringToHex(asset.service.unit)),
    holderAbortRequested: serviceFlag(raw.holderAbortRequested),
  };
}

/** Indexed custody discovers candidates; canonical authorization, custody and frozen allocation own each fact. */
export async function readIssuerBookings(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  actor: ServiceIssuerActor,
  reader: GraphQLReader
): Promise<ServiceIssuerBookings> {
  const asset = issuerAsset(route, actor.assetId, true);
  if (!issuerSame(actor.address, asset.ownerReserve))
    return { status: "unavailable", completeness: "unknown", records: [], reason: "not-issuer" };
  let discovered: Awaited<ReturnType<typeof discoverIssuerVoucherSetups>>;
  try {
    discovered = await discoverIssuerVoucherSetups(
      {
        chainId: 100,
        escrow: route.service.destination.address,
        issuer: asset.ownerReserve,
        token: asset.token.address,
      },
      reader
    );
  } catch {
    return {
      status: "unavailable",
      completeness: "unknown",
      records: [],
      reason: "indexer-unavailable",
    };
  }
  const records: ServiceIssuerBookings["records"][number][] = [];
  let approveReady = false;
  try {
    issuerAsset(route, actor.assetId);
    approveReady = true;
  } catch {
    /* Existing obligations outlive new-issuance eligibility. */
  }
  let mismatch = false;
  for (const hint of discovered.records) {
    try {
      const record = await readIssuerBooking(chain, route, actor.assetId, hint);
      if (!issuerSame(record.authorization.holder, hint.holder))
        throw new Error("Indexed holder mismatch");
      const timestamp = await chain.timestamp();
      const eligible =
        asset.kind === "individual" && !record.frozen && record.result.decision !== "abort";
      records.push({
        setupId: hint.setupId,
        authorizationHash: hint.authorizationHash,
        authorization: record.authorization,
        result: record.result,
        issuerReturnCeiling: record.ceiling,
        finalAllocation: record.finalAllocation,
        reviewedTermsMatch: record.reviewedTermsMatch,
        approvalEligible:
          eligible &&
          record.reviewedTermsMatch &&
          approveReady &&
          !record.result.issuerApproved &&
          record.result.decision === "none" &&
          !record.holderAbortRequested &&
          timestamp < record.authorization.acceptanceDeadline,
        returnEligible:
          eligible &&
          record.result.issuerApproved &&
          record.ceiling < record.authorization.voucherUnits,
      });
    } catch {
      mismatch = true;
    }
  }
  return {
    status: mismatch || discovered.partial ? "partial" : "observed",
    completeness: "unknown",
    records,
    ...(mismatch
      ? { reason: "canonical-mismatch" as const }
      : discovered.partial
        ? { reason: "partial-discovery" as const }
        : {}),
  };
}
