import type { CosmoEvent } from "../src/handlers/cosmo-local-projections";

export const SOURCE = "0x000000000000000000000000000000000000a001";
export const ESCROW = "0x000000000000000000000000000000000000b001";
export const HOLDER = "0x000000000000000000000000000000000000c001";
export const CORE = "0x000000000000000000000000000000000000c002";
export const ISSUER = "0x000000000000000000000000000000000000d001";
export const TOKEN = "0x000000000000000000000000000000000000e001";
export const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
export const SETUP = hash(1),
  AUTH = hash(2),
  DECISION = hash(3),
  ACTIVATION = hash(4),
  DEPOSIT = hash(5);
export const EXACT = 9_007_199_254_740_993n;

export function event(
  eventName: string,
  params: CosmoEvent["params"] = {},
  block = 1,
  source = false
): CosmoEvent {
  return {
    eventName,
    chainId: source ? 42161 : 100,
    srcAddress: source ? SOURCE : ESCROW,
    params: { setupId: SETUP, ...params },
    block: { number: block, timestamp: block },
    transaction: { hash: hash(block + 100) },
    logIndex: 0,
  };
}
export function authorization() {
  return {
    version: 2n,
    sourceChainId: 42161n,
    sourceModule: SOURCE,
    coreModule: CORE,
    commitmentId: EXACT,
    termsRevision: EXACT,
    termsHash: hash(6),
    claimHash: hash(7),
    requestNonce: EXACT,
    buyer: HOLDER,
    holder: HOLDER,
    buyerGarden: CORE,
    providerGarden: ISSUER,
    destinationChainId: 100n,
    destinationEscrow: ESCROW,
    issuer: ISSUER,
    token: TOKEN,
    voucherUnits: EXACT,
    serviceUnits: 10n,
    unitLabelHash: hash(9),
    serviceTermsRef: hash(10),
    remedyTermsRef: hash(11),
    acceptanceDeadline: EXACT,
    remedyPolicy: 1n,
  };
}
export function authEvent(source = false, block = 1) {
  return event(
    source ? "VoucherSetupPrepared" : "VoucherSetupAuthorizationRecorded",
    {
      authorizationHash: AUTH,
      authorization: authorization(),
      ...(source ? { commitmentId: EXACT } : { messageId: hash(12) }),
    },
    block,
    source
  );
}
export function setupResult(sequence = EXACT, source = false, block = 3) {
  return event(
    "VoucherSetupResultRecorded",
    {
      sequence,
      result: {
        version: 2n,
        setupId: SETUP,
        authorizationHash: AUTH,
        resultSequence: sequence,
        phase: 2n,
        decision: 0n,
        issuerApproved: true,
        depositReceiptHash: DEPOSIT,
        depositedUnits: EXACT,
        setupRefundedUnits: 0n,
        appliedDecisionId: hash(0),
        actionSucceeded: true,
        failureHash: hash(0),
      },
    },
    block,
    source
  );
}
export function freeze(block = 4) {
  return event(
    "FinalAllocationFrozen",
    {
      decisionId: DECISION,
      holder: HOLDER,
      payloadHash: AUTH,
      activationDecisionId: ACTIVATION,
      approvedDeliveredServiceUnits: 4n,
      releaseVoucherUnits: EXACT - 7n,
      refundVoucherUnits: 7n,
      issuerReturnApprovalAtFreeze: 7n,
    },
    block
  );
}
export function leg(leg = 0n, attempts = 1n, state = 3n, block = 5) {
  return event(
    "FinalLegResult",
    {
      decisionId: DECISION,
      leg,
      legId: hash(20 + Number(leg)),
      recipient: leg === 0n ? ISSUER : HOLDER,
      voucherUnits: leg === 0n ? EXACT - 7n : 7n,
      state,
      attempts,
      failureHash: state === 3n ? hash(0) : hash(21),
    },
    block
  );
}
export function finalResult(sequence = EXACT, block = 9) {
  return event(
    "VoucherFinalResultRecorded",
    {
      sequence,
      result: {
        protocolVersion: 2n,
        setupId: SETUP,
        payloadHash: AUTH,
        sequence,
        activationDecisionId: ACTIVATION,
        decisionId: DECISION,
        issuerReturnApprovalAtFreeze: 7n,
        allocation: {
          approvedDeliveredServiceUnits: 4n,
          releaseVoucherUnits: EXACT - 7n,
          refundVoucherUnits: 7n,
        },
        release: { state: 3n, attempts: 2n, failureHash: hash(0) },
        refund: { state: 3n, attempts: 1n, failureHash: hash(0) },
      },
    },
    block,
    true
  );
}
export function sharedPresentment(block = 2) {
  return event(
    "VoucherPresented",
    { redemptionId: SETUP, holder: HOLDER, token: TOKEN, units: EXACT },
    block
  );
}
