import { describe, expect, it, vi } from "vitest";
import {
  decodeFunctionResult,
  encodeFunctionResult,
  keccak256,
  stringToHex,
  type Abi,
  type AbiParameter,
} from "viem";
import CoreABI from "@green-goods/contracts/abis/ICommitmentPoolingModule.json";
import ServiceABI from "@green-goods/contracts/abis/ICommitmentServiceOffers.json";
import PersonalABI from "@green-goods/contracts/abis/ISettlementPersonalServicePurchases.json";
import { CELO_G_DOLLAR_TOKEN } from "../config/tokens";
import { readServiceAccess } from "../modules/commitment-pooling/service-access-chain";
import {
  mapAuthoritativeConsent,
  mapAuthoritativeOffer,
} from "../modules/commitment-pooling/service-access-chain-mappers";
import { mapPersonalServicePurchase } from "../modules/commitment-pooling/service-access-personal";
import {
  serviceTuple,
  serviceUint,
} from "../modules/commitment-pooling/service-access-chain-values";
import { createServiceAccessReadRepository } from "../modules/commitment-pooling/service-access-read-repository";
import type { GraphQLReader } from "../modules/data/graphql-client";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import type { NetworkContracts } from "../types/contracts";

const ZERO = `0x${"0".repeat(40)}` as const;
const ZERO_HASH = `0x${"0".repeat(64)}` as const;
const HASH = `0x${"a".repeat(64)}` as const;
const CLAIM = `0x${"b".repeat(64)}` as const;
const GARDEN = "0x0000000000000000000000000000000000000333";
const SAFE = "0x0000000000000000000000000000000000000444";
const SETTLEMENT = "0x0000000000000000000000000000000000000555";
const BIG = (1n << 120n) + 789n;
const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000111",
  commitmentId: 7n,
  buyer: "0x0000000000000000000000000000000000000222",
};
const asset = { chainId: 42220, token: CELO_G_DOLLAR_TOKEN.address, symbol: "G$", decimals: 18 };

function defaultABIValue(parameter: AbiParameter): unknown {
  if (parameter.type.endsWith("[]")) return [];
  if (parameter.type === "tuple" && "components" in parameter)
    return Object.fromEntries(
      parameter.components.map((entry) => [entry.name, defaultABIValue(entry)])
    );
  if (parameter.type === "address") return ZERO;
  if (parameter.type === "bool") return false;
  if (parameter.type === "string") return "";
  if (parameter.type === "bytes32") return ZERO_HASH;
  if (parameter.type.startsWith("uint")) return 0n;
  throw new Error(`Unhandled ABI fixture type ${parameter.type}`);
}

function fixture() {
  const terms = {
    route: 1,
    serviceTermsRef: HASH,
    remedyTermsRef: HASH,
    voucherChainId: 0n,
    voucherIssuer: ZERO,
    voucherToken: ZERO,
    voucherUnits: 0n,
  };
  const offer = { revision: (1n << 63n) + 11n, termsHash: HASH, terms };
  const core = {
    poolId: 1n,
    state: 1,
    direction: 0,
    commitmentType: 1,
    claimType: 1,
    claimMode: 1,
    unitLabel: "lessons",
    targetUnits: 10n,
    consideration: { rail: 2, source: ZERO, token: ZERO, amount: BIG },
    providerGarden: GARDEN,
    counterparty: ZERO,
  };
  const consent = {
    termsRevision: offer.revision,
    requestNonce: (1n << 63n) + 17n,
    buyerGarden: GARDEN,
    voucherHolder: ZERO,
    termsHash: HASH,
    claimHash: CLAIM,
  };
  const emptyConsent = {
    termsRevision: 0n,
    requestNonce: 0n,
    buyerGarden: ZERO,
    voucherHolder: ZERO,
    termsHash: ZERO_HASH,
    claimHash: ZERO_HASH,
  };
  const emptyOffer = {
    revision: 0n,
    termsHash: ZERO_HASH,
    terms: { ...terms, route: 0, serviceTermsRef: ZERO_HASH, remedyTermsRef: ZERO_HASH },
  };
  const accepted = {
    offer: emptyOffer,
    consent: emptyConsent,
    buyer: ZERO,
    serviceRecipient: ZERO,
    providerGarden: ZERO,
    serviceUnits: 0n,
    unitLabelHash: ZERO_HASH,
    gdPrice: 0n,
  };
  const purchase = {
    terms: {
      version: 1,
      purchaseId: HASH,
      sourceChainId: 42161n,
      sourceModule: SETTLEMENT,
      commitmentId: key.commitmentId,
      termsRevision: offer.revision,
      termsHash: HASH,
      claimHash: CLAIM,
      requestNonce: consent.requestNonce,
      buyer: key.buyer,
      recipient: key.buyer,
      buyerGarden: GARDEN,
      providerGarden: GARDEN,
      destinationChainId: 42220n,
      token: asset.token,
      price: BIG,
      custodySafe: SAFE,
      authorizedDepositor: key.buyer,
      refundAccount: key.buyer,
      disclosedGrossAmount: BIG,
      disclosedNetAmount: BIG,
    },
    deposit: {
      chainId: 0n,
      token: ZERO,
      transactionHash: ZERO_HASH,
      logIndex: 0,
      blockNumber: 0n,
      blockHash: ZERO_HASH,
      depositingAccount: ZERO,
      custodySafe: ZERO,
      grossDebit: 0n,
      receivedAmount: 0n,
    },
    outcome: 0,
    payoutPlanId: 0n,
  };
  const funding = {
    commitmentId: key.commitmentId,
    funder: key.buyer,
    garden: GARDEN,
    refundAccount: key.buyer,
    expectedAmount: BIG,
    depositedAmount: 0n,
    depositReference: ZERO_HASH,
    state: 1,
    refundDisbursementId: 0n,
    pledgedAt: 1n,
    depositRecordedAt: 0n,
    consumedAt: 0n,
    closedAt: 0n,
  };
  const table: Record<string, unknown> = {
    serviceOfferProtocolVersion: 1,
    voucherAcceptanceProtocolVersion: 1,
    voucherServiceSetupModule: ZERO,
    getEarnedVoucherBinding: {
      module: ZERO,
      revision: 0n,
      termsHash: ZERO_HASH,
      acceptedRevision: 0n,
      acceptedTermsHash: ZERO_HASH,
      acceptedCounterparty: ZERO,
    },
    getServiceOfferTerms: offer,
    getCommitment: core,
    paused: false,
    getServiceClaimConsent: consent,
    getPendingClaim: {
      claimant: key.buyer,
      requestedBy: key.buyer,
      kind: 1,
      gardenContext: GARDEN,
      requestedAt: 1n,
      active: true,
    },
    getAcceptedServiceTerms: accepted,
    commitmentPoolingModule: key.coreModule,
    DESTINATION_EVM_CHAIN_ID: 42220n,
    gDollarToken: asset.token,
    fundingOfCommitmentFunder: 1n,
    getPersonalServicePurchase: purchase,
    getCommitmentFunding: funding,
    settlementAccountOf: {
      chainId: 42220n,
      account: SAFE,
      active: true,
      recoveryOwners: [ZERO, ZERO, ZERO],
      rolesModifier: ZERO,
      roleKey: ZERO_HASH,
      allowanceKey: ZERO_HASH,
      permissionsConfigHash: ZERO_HASH,
      recoveryConfigHash: ZERO_HASH,
      recoveryThreshold: 0,
    },
  };
  const read = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (!(functionName in table)) throw new Error(`Unexpected view ${functionName}`);
    return table[functionName];
  });
  const contracts = vi.fn(
    () =>
      ({
        commitmentPoolingModule: key.coreModule,
        settlementModule: SETTLEMENT,
      }) as NetworkContracts
  );
  return {
    terms,
    offer,
    core,
    consent,
    accepted,
    emptyOffer,
    purchase,
    funding,
    table,
    read,
    contracts,
  };
}

describe("authoritative service reads", () => {
  it("hydrates exact supported personal terms and frozen funding through the configured proxies without enabling writes", async () => {
    const f = fixture();
    const snapshot = await readServiceAccess(key, undefined, f);
    expect(snapshot).toMatchObject({
      evidence: "onchain",
      mode: "personal-gd",
      complete: true,
      nextRequestNonce: f.consent.requestNonce + 1n,
      offer: { revision: f.offer.revision, gdPrice: BIG },
      personalPurchase: {
        fundingId: 1n,
        price: BIG,
        requestNonce: f.consent.requestNonce,
        custodySafe: SAFE,
      },
      capabilities: { mutation: "unavailable" },
      availableActions: [],
    });
    expect(f.read.mock.calls.every(([call]) => call.functionName !== "getExecutionResult")).toBe(
      true
    );
  });

  it("never calls a fallback network or a caller-selected core address", async () => {
    const f = fixture();
    expect(
      (await readServiceAccess({ ...key, sourceChainId: 100 }, undefined, f)).capabilities.reasons
    ).toEqual(["chain-unconfigured"]);
    expect(f.contracts).not.toHaveBeenCalled();
    expect((await readServiceAccess({ ...key, coreModule: key.buyer }, undefined, f)).mode).toBe(
      "unavailable"
    );
    expect(f.read).not.toHaveBeenCalled();
  });

  it("distinguishes an unsupported old deployment from authoritative Legacy", async () => {
    const f = fixture();
    f.table.serviceOfferProtocolVersion = 2;
    expect((await readServiceAccess(key, undefined, f)).mode).toBe("unavailable");
    f.table.serviceOfferProtocolVersion = 1;
    f.table.getServiceOfferTerms = f.emptyOffer;
    const result = await readServiceAccess(key, undefined, f);
    expect(result).toMatchObject({
      mode: "legacy",
      evidence: "onchain",
      complete: true,
      knownService: false,
    });
  });

  it("keeps a failed protocol read unknown rather than claiming the deployment is unsupported", async () => {
    const f = fixture();
    f.read.mockRejectedValue(new Error("RPC timeout"));
    expect(await readServiceAccess(key, undefined, f)).toMatchObject({
      mode: "unavailable",
      complete: false,
      capabilities: { reasons: ["authoritative-read-failed"] },
    });
  });

  it("does not silently coerce malformed ABI tuples, enums, bytes or integers", async () => {
    for (const malformed of [
      { revision: 5 },
      { termsHash: "0xab" },
      { terms: { ...fixture().terms, route: 3 } },
      { terms: { ...fixture().terms, voucherIssuer: "not-an-address" } },
    ]) {
      const f = fixture();
      f.table.getServiceOfferTerms = { ...f.offer, ...malformed };
      expect((await readServiceAccess(key, undefined, f)).mode).toBe("unavailable");
    }
    expect(() => serviceTuple([1n], ["revision", "termsHash"])).toThrow("tuple length");
    expect(() => serviceUint(9007199254740992)).toThrow("integer");
  });

  it("preserves terms if a personal funding dependency fails and reports the missing proof", async () => {
    const f = fixture();
    f.table.commitmentPoolingModule = key.buyer;
    expect(await readServiceAccess(key, undefined, f)).toMatchObject({
      mode: "personal-gd",
      complete: false,
      offer: { termsHash: HASH },
      capabilities: { reasons: expect.arrayContaining(["authoritative-read-failed"]) },
    });
  });

  it("uses real ABI encoding/decoding for the new nested tuple views", () => {
    const f = fixture();
    const decode = (abi: Abi, functionName: string, result: unknown) =>
      decodeFunctionResult({
        abi,
        functionName,
        data: encodeFunctionResult({ abi, functionName, result }),
      });
    const { offer, core } = mapAuthoritativeOffer(
      decode(ServiceABI as Abi, "getServiceOfferTerms", f.offer),
      f.core
    );
    const consent = mapAuthoritativeConsent(
      decode(ServiceABI as Abi, "getServiceClaimConsent", f.consent),
      f.table.getPendingClaim,
      decode(ServiceABI as Abi, "getAcceptedServiceTerms", f.accepted),
      key,
      offer,
      core
    );
    expect(consent.consent!.requestNonce).toBe(f.consent.requestNonce);
    const purchase = mapPersonalServicePurchase(
      key,
      SETTLEMENT,
      1n,
      decode(PersonalABI as Abi, "getPersonalServicePurchase", f.purchase),
      f.funding,
      asset
    );
    expect(purchase.price).toBe(BIG);
    const getter = (CoreABI as Abi).find(
      (entry) => entry.type === "function" && entry.name === "getCommitment"
    );
    if (!getter || getter.type !== "function" || !getter.outputs[0])
      throw new Error("Missing canonical core view ABI");
    const fullCore = { ...(defaultABIValue(getter.outputs[0]) as object), ...f.core };
    const decodedCore = decode(CoreABI as Abi, "getCommitment", fullCore);
    expect(mapAuthoritativeOffer(f.offer, decodedCore).offer.serviceUnits).toBe(10n);
    expect(() => mapAuthoritativeOffer(f.offer, Object.values(f.core))).toThrow(
      "complete core ABI tuple"
    );
  });

  it("validates the accepted buyer and exact consent instead of relabeling another accepted claim", async () => {
    const f = fixture();
    f.table.getCommitment = { ...f.core, counterparty: key.buyer, state: 3 };
    f.table.getAcceptedServiceTerms = {
      offer: f.offer,
      consent: f.consent,
      buyer: key.buyer,
      serviceRecipient: key.buyer,
      providerGarden: GARDEN,
      serviceUnits: 10n,
      unitLabelHash: keccak256(stringToHex("lessons")),
      gdPrice: BIG,
    };
    f.table.getPendingClaim = { ...(f.table.getPendingClaim as object), active: false };
    expect((await readServiceAccess(key, undefined, f)).consent!.state).toBe("accepted");
    f.table.getAcceptedServiceTerms = {
      ...(f.table.getAcceptedServiceTerms as object),
      serviceRecipient: SAFE,
    };
    expect((await readServiceAccess(key, undefined, f)).complete).toBe(false);
  });

  it("represents verified shortfall and selected late refund with no child without inventing completion", () => {
    const f = fixture();
    const purchase = {
      ...f.purchase,
      outcome: 2,
      deposit: {
        chainId: 42220n,
        token: asset.token,
        transactionHash: HASH,
        logIndex: 4294967295,
        blockNumber: 999n,
        blockHash: CLAIM,
        depositingAccount: key.buyer,
        custodySafe: SAFE,
        grossDebit: 70n,
        receivedAmount: 60n,
      },
    };
    const funding = { ...f.funding, state: 2, depositedAmount: 60n, depositReference: HASH };
    // Viem decodes uint32 logIndex as a number; uint64 and token amounts stay bigint.
    const decoded = decodeFunctionResult({
      abi: PersonalABI as Abi,
      functionName: "getPersonalServicePurchase",
      data: encodeFunctionResult({
        abi: PersonalABI as Abi,
        functionName: "getPersonalServicePurchase",
        result: purchase,
      }),
    });
    const result = mapPersonalServicePurchase(key, SETTLEMENT, 1n, decoded, funding, asset);
    expect(result).toMatchObject({
      outcome: "refund",
      refundDisbursementId: 0n,
      deposit: { evidence: "privileged-steward", logIndex: 4294967295n, receivedAmount: 60n },
    });
  });

  it("keeps authoritative reads usable when the optional indexer is unavailable", async () => {
    const f = fixture();
    const repository = createServiceAccessReadRepository(
      {
        query: vi.fn().mockResolvedValue({ error: new Error("index unavailable") }),
      } as GraphQLReader,
      f
    );
    expect((await repository.getServiceAccess(key)).mode).toBe("personal-gd");
  });
});
