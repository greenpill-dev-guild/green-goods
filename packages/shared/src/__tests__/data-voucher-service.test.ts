import { serviceAccessAvailableActions } from "../modules/commitment-pooling/service-access";
import { voucherFinalDecisionId } from "../modules/commitment-pooling/service-access-voucher-hashes";
import { describe, expect, it, vi } from "vitest";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import {
  discoverVoucherSetups,
  readVoucherDestinationObservation,
} from "../modules/commitment-pooling/data-voucher-service";
import {
  readIndexedEarnedOptIn,
  retainIndexedEarnedOptIn,
} from "../modules/commitment-pooling/data-earned-voucher";
import { createCommitmentPoolingReadRepository } from "../modules/commitment-pooling/read-repository";
import type { GraphQLReader } from "../modules/data/graphql-client";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import type { NetworkContracts } from "../types/contracts";

const EMPTY = `0x${"0".repeat(64)}` as const,
  HASH = `0x${"e".repeat(64)}` as const;
const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200",
};
const reader = (data: unknown) => ({ query: vi.fn().mockResolvedValue({ data }) }) as GraphQLReader;
function destination() {
  const s = createServiceRehearsalSnapshot(key),
    setup = s.voucherSetups[0]!,
    a = setup.authorization;
  const result = setup.destination!.result,
    allocation = {
      approvedDeliveredServiceUnits: 3n,
      releaseVoucherUnits: 40n,
      refundVoucherUnits: 60n,
    };
  const decisionId = voucherFinalDecisionId(a, result.appliedDecisionId!, allocation, 60n);
  setup.destination = null;
  const scope = { chainId: 100, moduleAddress: a.destinationEscrow, setupId: setup.setupId };
  return {
    setup,
    data: {
      VoucherServiceCustody: [
        {
          ...scope,
          id: `100-${a.destinationEscrow}-${setup.setupId}`,
          authorizationSeen: true,
          authorizationHash: setup.authorizationHash,
          sourceSetupEntityId: `42161-${a.sourceModule}-${setup.setupId}`,
          holderAbortRequestSeen: false,
        },
      ],
      VoucherServiceSetupResult: [
        {
          ...scope,
          id: `100-${a.destinationEscrow}-${setup.setupId}-3`,
          endpointRole: "DESTINATION",
          protocolVersion: 2,
          authorizationHash: setup.authorizationHash,
          sequence: "3",
          phase: 3,
          decision: 1,
          issuerApproved: true,
          depositReceiptHash: result.depositReceiptHash,
          depositedUnits: "100",
          setupRefundedUnits: "0",
          appliedDecisionId: result.appliedDecisionId,
          actionSucceeded: true,
          failureHash: EMPTY,
        },
      ],
      VoucherServiceFinalAllocation: [
        {
          ...scope,
          id: `100-${a.destinationEscrow}-${setup.setupId}-${decisionId}`,
          freezeSeen: true,
          holder: a.holder,
          payloadHash: setup.authorizationHash,
          decisionId,
          activationDecisionId: result.appliedDecisionId,
          issuerReturnApprovalAtFreeze: "60",
          approvedDeliveredServiceUnits: "3",
          releaseVoucherUnits: "40",
          refundVoucherUnits: "60",
          releaseState: 3,
          releaseAttempts: "1",
          releaseFailureHash: EMPTY,
          refundState: 3,
          refundAttempts: "1",
          refundFailureHash: EMPTY,
        },
      ],
      VoucherServiceAcknowledgment: [
        {
          ...scope,
          id: `100-${a.destinationEscrow}-${HASH}-1`,
          finalResult: true,
          sequence: "9007199254740993",
          sent: true,
          messageId: HASH,
        },
      ],
    },
  };
}

describe("scoped voucher projections", () => {
  it("discovers older authorizations with exact large commitment IDs through the pinned source", async () => {
    const largeKey = { ...key, commitmentId: 1n << 180n },
      module = key.coreModule;
    const row = {
      id: `42161-${module}-${HASH}`,
      chainId: 42161,
      moduleAddress: module,
      setupId: HASH,
      coreModule: key.coreModule,
      commitmentId: largeKey.commitmentId.toString(),
      buyer: key.buyer,
      authorizationSeen: true,
    };
    const r = reader({ VoucherServiceSetup: [row] });
    expect(await discoverVoucherSetups(largeKey, module, r)).toEqual([HASH]);
    expect(r.query).toHaveBeenCalledWith(
      expect.stringContaining("authorizationSeen: {_eq: true}"),
      expect.objectContaining({ commitment: largeKey.commitmentId.toString() }),
      "discoverVoucherSetups"
    );
    for (const patch of [
      { chainId: 100 },
      { moduleAddress: key.buyer },
      { buyer: key.coreModule },
      { commitmentId: 9007199254740993 },
      { setupId: "0x01" },
    ])
      await expect(
        discoverVoucherSetups(
          largeKey,
          module,
          reader({ VoucherServiceSetup: [{ ...row, ...patch }] })
        )
      ).rejects.toThrow();
  });

  it("keeps durable destination closure and ACK-sent evidence separate from missing source final reconciliation", async () => {
    const { setup, data } = destination();
    await readVoucherDestinationObservation(setup, reader(data));
    expect(setup.destination).toMatchObject({
      evidence: "indexed",
      issuerReturnCeiling: null,
      pendingAction: "unknown",
      finalAllocation: {
        financiallyClosed: true,
        allocation: {
          approvedDeliveredServiceUnits: 3n,
          releaseVoucherUnits: 40n,
          refundVoucherUnits: 60n,
        },
      },
    });
    expect(setup.acknowledgments.final).toMatchObject({
      sent: true,
      sentSequence: 9007199254740993n,
      sourceObservedSequence: 0n,
    });
    expect(setup.source.finalResult).toBeNull();
    expect(setup.availableActions).toEqual([]);
  });

  it("does not retain a partial projection when a later scoped observation is invalid", async () => {
    const { setup, data } = destination();
    data.VoucherServiceAcknowledgment[0]!.moduleAddress = key.buyer;
    await expect(readVoucherDestinationObservation(setup, reader(data))).rejects.toThrow(
      "scope mismatch"
    );
    expect(setup.destination).toBeNull();
    expect(setup.acknowledgments.final.sent).toBe(false);
  });

  it("rejects unrelated destination scopes and contradictory immutable final quantities", async () => {
    for (const patch of [
      { holder: key.coreModule },
      { payloadHash: HASH },
      { releaseVoucherUnits: "41" },
      { refundVoucherUnits: "060" },
      { releaseAttempts: 1 },
    ]) {
      const { setup, data } = destination();
      Object.assign(data.VoucherServiceFinalAllocation[0]!, patch);
      await expect(readVoucherDestinationObservation(setup, reader(data))).rejects.toThrow();
      expect(setup.destination).toBeNull();
    }
  });
});

describe("positive indexed earned binding", () => {
  const row = {
    id: `42161-${key.coreModule}-1024-9`,
    chainId: 42161,
    moduleAddress: key.coreModule,
    commitmentId: "1024",
    revision: "9",
    module: key.buyer,
    termsHash: HASH,
    boundSeen: true,
    acceptedSeen: false,
  };
  it("preserves unknown ordinary compatibility and never treats projection absence as an unbound proof", async () => {
    expect(await readIndexedEarnedOptIn(key, reader({ EarnedVoucherRevision: [] }))).toBeNull();
    for (const patch of [
      { revision: "18446744073709551616" },
      { chainId: 100 },
      { module: "invalid" },
      { termsHash: "0x01" },
    ])
      await expect(
        readIndexedEarnedOptIn(key, reader({ EarnedVoucherRevision: [{ ...row, ...patch }] }))
      ).rejects.toThrow();
    const s = createServiceRehearsalSnapshot(key);
    s.acceptancePolicy.earned.status = "unknown";
    const before = structuredClone(s.acceptancePolicy);
    retainIndexedEarnedOptIn(s, null);
    expect(s.acceptancePolicy).toEqual(before);
  });

  it("keeps existing exact personal service recovery independent of incomplete earned evidence", () => {
    const s = createServiceRehearsalSnapshot({ ...key, commitmentId: 1022n });
    s.acceptancePolicy.earned.status = "unknown";
    s.consent = {
      revision: s.offer!.revision,
      termsHash: s.offer!.termsHash,
      requestNonce: 1n,
      claimHash: HASH,
      buyerGarden: s.eligibleBuyerGardens[0]!.address,
      voucherHolder: `0x${"0".repeat(40)}`,
      state: "pending",
    };
    retainIndexedEarnedOptIn(s, { module: key.buyer, revision: 9n, termsHash: HASH });
    expect(s.complete).toBe(true);
    expect(serviceAccessAvailableActions(s)).toContain("withdrawClaim");
    s.consent.state = "withdrawn";
    expect(serviceAccessAvailableActions(s)).not.toContain("requestClaim");
    expect(s.acceptancePolicy.earned.accountRouteAvailable).toBe(false);
  });

  it("retains a positive scoped opt-in when authoritative RPC is unavailable without inventing account consent", async () => {
    const query = vi.fn(async (_document: unknown, _variables: unknown, operation: string) => {
      if (operation === "readIndexedEarnedOptIn") return { data: { EarnedVoucherRevision: [row] } };
      return { data: { ServiceOfferRevision: [], ServiceClaimConsent: [] } };
    });
    const repository = createCommitmentPoolingReadRepository({ query } as GraphQLReader, {
      read: async () => {
        throw new Error("RPC timeout");
      },
      contracts: () => ({ commitmentPoolingModule: key.coreModule }) as NetworkContracts,
    });
    const result = await repository.getServiceAccess(key);
    expect(result).toMatchObject({
      complete: false,
      mode: "unavailable",
      knownService: false,
      acceptancePolicy: {
        kind: "earned",
        knownOptIn: true,
        blockGenericMemberAcceptance: true,
        earned: {
          status: "bound",
          revision: 9n,
          terms: null,
          participantConsentRevision: null,
          accountRouteAvailable: false,
        },
      },
    });
    expect(result.availableActions).toEqual([]);
  });
});
