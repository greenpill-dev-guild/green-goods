import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { GraphQLReader } from "../data/graphql-client";
import type { ServiceAccessKey } from "./service-access-types";
import type { VoucherWalletScope } from "./service-access-wallet-types";
import type { ServiceVoucherSetup } from "./service-access-voucher-types";
import {
  serviceAddress,
  serviceFlag,
  serviceHash,
  serviceTuple,
  serviceUint,
  SERVICE_ZERO_HASH,
} from "./service-access-chain-values";
import {
  mapVoucherFinalResult,
  mapVoucherSetupResult,
} from "./service-access-voucher-chain-mappers";

function decimal(value: unknown, bits = 256) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value))
    throw new Error("Malformed indexed voucher integer");
  return serviceUint(BigInt(value), bits);
}
function row(value: unknown) {
  return serviceTuple(value, ["id", "chainId", "moduleAddress", "setupId"]);
}
function scope(value: unknown, chain: number, module: Address, setupId?: Hex) {
  const r = row(value);
  if (
    r.chainId !== chain ||
    serviceAddress(r.moduleAddress) !== module.toLowerCase() ||
    (setupId && serviceHash(r.setupId) !== setupId)
  )
    throw new Error("Voucher projection scope mismatch");
  return r;
}

/** Account-wide discovery is bounded and scoped; canonical reads still decide custody. */
export async function discoverWalletVoucherSetups(
  wallet: VoucherWalletScope,
  module: Address,
  reader: GraphQLReader
) {
  const result = await reader.query<{ VoucherServiceSetup: unknown[] }>(
    `query WalletVoucherSetups($chain: Int!, $module: String!, $core: String!, $account: String!) {
      VoucherServiceSetup(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $module}, coreModule: {_eq: $core}, holder: {_eq: $account}, authorizationSeen: {_eq: true}}, order_by: {id: asc}, limit: 101) {
        id chainId moduleAddress setupId coreModule commitmentId buyer holder authorizationSeen
      }
    }`,
    {
      chain: wallet.sourceChainId,
      module: module.toLowerCase(),
      core: wallet.coreModule.toLowerCase(),
      account: wallet.account.toLowerCase(),
    },
    "discoverWalletVoucherSetups"
  );
  if (result.error) throw result.error;
  if (!Array.isArray(result.data.VoucherServiceSetup))
    throw new Error("Wallet booking discovery unavailable");
  const seen = new Set<string>();
  const records = result.data.VoucherServiceSetup.slice(0, 100).map((value) => {
    const r = scope(value, wallet.sourceChainId, module);
    const setupId = serviceHash(r.setupId);
    if (
      seen.has(setupId) ||
      r.id !== `${wallet.sourceChainId}-${module.toLowerCase()}-${setupId}` ||
      serviceAddress(r.coreModule) !== wallet.coreModule.toLowerCase() ||
      serviceAddress(r.holder) !== wallet.account.toLowerCase() ||
      !serviceFlag(r.authorizationSeen)
    )
      throw new Error("Wallet booking discovery identity mismatch");
    seen.add(setupId);
    return { setupId, commitmentId: decimal(r.commitmentId), buyer: serviceAddress(r.buyer) };
  });
  return { records, partial: result.data.VoucherServiceSetup.length > 100 };
}

/** Issuer discovery is a scoped hint, never a balance, obligation total or signing authority. */
export async function discoverIssuerVoucherSetups(
  input: { chainId: 100; escrow: Address; issuer: Address; token: Address },
  reader: GraphQLReader
): Promise<{
  records: { setupId: Hex; authorizationHash: Hex; holder: Address }[];
  partial: boolean;
}> {
  const result = await reader.query<{ VoucherServiceCustody: unknown[] }>(
    `query IssuerVoucherSetups($chain: Int!, $escrow: String!, $issuer: String!, $token: String!) {
      VoucherServiceCustody(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $escrow}, issuer: {_eq: $issuer}, token: {_eq: $token}, authorizationSeen: {_eq: true}}, order_by: {id: asc}, limit: 101) {
        id chainId moduleAddress setupId issuer token holder authorizationSeen authorizationHash
      }
    }`,
    {
      chain: input.chainId,
      escrow: input.escrow.toLowerCase(),
      issuer: input.issuer.toLowerCase(),
      token: input.token.toLowerCase(),
    },
    "discoverIssuerVoucherSetups"
  );
  if (result.error) throw result.error;
  if (!Array.isArray(result.data.VoucherServiceCustody))
    throw new Error("Issuer booking discovery unavailable");
  const seen = new Set<string>();
  const records = result.data.VoucherServiceCustody.slice(0, 100).map((value) => {
    const r = scope(value, input.chainId, input.escrow);
    const setupId = serviceHash(r.setupId);
    const authorizationHash = serviceHash(r.authorizationHash);
    if (
      seen.has(setupId) ||
      r.id !== `${input.chainId}-${input.escrow.toLowerCase()}-${setupId}` ||
      !serviceFlag(r.authorizationSeen) ||
      serviceAddress(r.issuer) !== input.issuer.toLowerCase() ||
      serviceAddress(r.token) !== input.token.toLowerCase() ||
      authorizationHash === SERVICE_ZERO_HASH
    )
      throw new Error("Issuer booking discovery identity mismatch");
    seen.add(setupId);
    return { setupId, authorizationHash, holder: serviceAddress(r.holder) };
  });
  return { records, partial: result.data.VoucherServiceCustody.length > 100 };
}

/** Discovery is scoped to the core-pinned source module, never a bare setup hash. */
export async function discoverVoucherSetups(
  key: ServiceAccessKey,
  module: Address,
  reader: GraphQLReader
): Promise<Hex[]> {
  const result = await reader.query<{ VoucherServiceSetup: unknown[] }>(
    `query MemberVoucherSetups($chain: Int!, $module: String!, $core: String!, $commitment: numeric!, $buyer: String!) {
    VoucherServiceSetup(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $module}, coreModule: {_eq: $core}, commitmentId: {_eq: $commitment}, buyer: {_eq: $buyer}, authorizationSeen: {_eq: true}}, order_by: {requestNonce: desc}) {
      id chainId moduleAddress setupId coreModule commitmentId buyer authorizationSeen
    }
  }`,
    {
      chain: key.sourceChainId,
      module: module.toLowerCase(),
      core: key.coreModule.toLowerCase(),
      commitment: key.commitmentId.toString(),
      buyer: key.buyer.toLowerCase(),
    },
    "discoverVoucherSetups"
  );
  if (result.error) throw result.error;
  if (!Array.isArray(result.data.VoucherServiceSetup))
    throw new Error("Missing voucher setup discovery");
  return result.data.VoucherServiceSetup.map((value) => {
    const r = scope(value, key.sourceChainId, module);
    const id = serviceHash(r.setupId);
    if (
      r.id !== `${key.sourceChainId}-${module.toLowerCase()}-${id}` ||
      !serviceFlag(r.authorizationSeen) ||
      serviceAddress(r.coreModule) !== key.coreModule.toLowerCase() ||
      decimal(r.commitmentId) !== key.commitmentId ||
      serviceAddress(r.buyer) !== key.buyer.toLowerCase()
    )
      throw new Error("Voucher setup discovery identity mismatch");
    return id;
  });
}

/** Destination observations are independent indexed evidence; they never enable production mutations. */
export async function readVoucherDestinationObservation(
  setup: ServiceVoucherSetup,
  reader: GraphQLReader
): Promise<void> {
  const a = setup.authorization;
  const result = await reader.query<{
    VoucherServiceCustody: unknown[];
    VoucherServiceSetupResult: unknown[];
    VoucherServiceFinalAllocation: unknown[];
    VoucherServiceAcknowledgment: unknown[];
  }>(
    `query MemberVoucherCustody($chain: Int!, $escrow: String!, $setup: String!) {
    VoucherServiceCustody(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $escrow}, setupId: {_eq: $setup}}, limit: 1) {
      id chainId moduleAddress setupId authorizationSeen authorizationHash sourceSetupEntityId holderAbortRequestSeen
    }
    VoucherServiceSetupResult(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $escrow}, setupId: {_eq: $setup}, endpointRole: {_eq: "DESTINATION"}}, order_by: {sequence: desc}, limit: 1) {
      id chainId moduleAddress setupId endpointRole protocolVersion authorizationHash sequence phase decision issuerApproved depositReceiptHash depositedUnits setupRefundedUnits appliedDecisionId actionSucceeded failureHash
    }
    VoucherServiceFinalAllocation(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $escrow}, setupId: {_eq: $setup}, freezeSeen: {_eq: true}}, limit: 1) {
      id chainId moduleAddress setupId freezeSeen holder payloadHash decisionId activationDecisionId issuerReturnApprovalAtFreeze approvedDeliveredServiceUnits releaseVoucherUnits refundVoucherUnits releaseState releaseAttempts releaseFailureHash refundState refundAttempts refundFailureHash
    }
    VoucherServiceAcknowledgment(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $escrow}, setupId: {_eq: $setup}, sent: {_eq: true}}, order_by: {sequence: desc}) {
      id chainId moduleAddress setupId finalResult sequence sent messageId
    }
  }`,
    {
      chain: a.destinationChainId,
      escrow: a.destinationEscrow.toLowerCase(),
      setup: setup.setupId,
    },
    "readVoucherDestinationObservation"
  );
  if (result.error) throw result.error;
  const data = result.data;
  if (
    ![
      data.VoucherServiceCustody,
      data.VoucherServiceSetupResult,
      data.VoucherServiceFinalAllocation,
      data.VoucherServiceAcknowledgment,
    ].every(Array.isArray)
  )
    throw new Error("Incomplete voucher destination observations");
  const custody = data.VoucherServiceCustody[0];
  const rawResult = data.VoucherServiceSetupResult[0];
  if (!custody || !rawResult) return;
  const c = scope(custody, a.destinationChainId, a.destinationEscrow, setup.setupId);
  if (
    c.id !== `${a.destinationChainId}-${a.destinationEscrow}-${setup.setupId}` ||
    !serviceFlag(c.authorizationSeen) ||
    serviceHash(c.authorizationHash) !== setup.authorizationHash ||
    c.sourceSetupEntityId !== `${a.sourceChainId}-${a.sourceModule}-${setup.setupId}`
  )
    throw new Error("Custody authorization mismatch");
  const r = scope(rawResult, a.destinationChainId, a.destinationEscrow, setup.setupId);
  const sequence = decimal(r.sequence, 64);
  if (
    r.id !== `${a.destinationChainId}-${a.destinationEscrow}-${setup.setupId}-${sequence}` ||
    r.endpointRole !== "DESTINATION"
  )
    throw new Error("Destination result identity mismatch");
  const parsed = mapVoucherSetupResult(
    {
      ...r,
      version: r.protocolVersion,
      resultSequence: sequence,
      depositedUnits: decimal(r.depositedUnits),
      setupRefundedUnits: decimal(r.setupRefundedUnits),
    },
    setup.setupId,
    setup.authorizationHash,
    a
  );
  if (!parsed) throw new Error("Missing destination setup result");
  let finalAllocation = null;
  if (data.VoucherServiceFinalAllocation[0]) {
    const f = scope(
      data.VoucherServiceFinalAllocation[0],
      a.destinationChainId,
      a.destinationEscrow,
      setup.setupId
    );
    if (
      !serviceFlag(f.freezeSeen) ||
      serviceAddress(f.holder) !== a.holder ||
      f.id !==
        `${a.destinationChainId}-${a.destinationEscrow}-${setup.setupId}-${serviceHash(f.decisionId)}`
    )
      throw new Error("Final allocation identity mismatch");
    // Its sequence is not emitted by freeze/leg events. Keep this projection separate from ACK sequencing.
    const { sequence: _sequence, ...record } = mapVoucherFinalResult(
      {
        ...f,
        protocolVersion: 2,
        sequence: 1n,
        issuerReturnApprovalAtFreeze: decimal(f.issuerReturnApprovalAtFreeze),
        allocation: {
          approvedDeliveredServiceUnits: decimal(f.approvedDeliveredServiceUnits),
          releaseVoucherUnits: decimal(f.releaseVoucherUnits),
          refundVoucherUnits: decimal(f.refundVoucherUnits),
        },
        release: {
          state: f.releaseState,
          attempts: decimal(f.releaseAttempts, 64),
          failureHash: f.releaseFailureHash ?? SERVICE_ZERO_HASH,
        },
        refund: {
          state: f.refundState,
          attempts: decimal(f.refundAttempts, 64),
          failureHash: f.refundFailureHash ?? SERVICE_ZERO_HASH,
        },
      },
      setup.setupId,
      setup.authorizationHash,
      a
    )!;
    finalAllocation = record;
  }
  const observed = {
    evidence: "indexed" as const,
    result: parsed,
    issuerReturnCeiling: null,
    pendingAction: "unknown" as const,
    holderAbortRequested: serviceFlag(c.holderAbortRequestSeen),
    allowance: null,
    holderBalance: null,
    finalAllocation,
  };
  const acknowledgments = structuredClone(setup.acknowledgments);
  acknowledgments.setup.destinationSequence = sequence;
  for (const value of data.VoucherServiceAcknowledgment) {
    const ack = scope(value, a.destinationChainId, a.destinationEscrow, setup.setupId);
    if (!serviceFlag(ack.sent)) throw new Error("Unsent acknowledgment in sent projection");
    serviceHash(ack.messageId);
    const lane = serviceFlag(ack.finalResult) ? acknowledgments.final : acknowledgments.setup;
    const observedSequence = decimal(ack.sequence, 64);
    if (lane.sentSequence === null || observedSequence > lane.sentSequence) {
      lane.sentSequence = observedSequence;
      lane.sent = true;
    }
  }
  setup.destination = observed;
  setup.acknowledgments = acknowledgments;
}
