import CoreABI from "@green-goods/contracts/abis/ICommitmentPoolingModule.json";
import { readServiceAccess } from "../modules/commitment-pooling/service-access-chain";
import type { NetworkContracts } from "../types/contracts";
import { describe, expect, it, vi } from "vitest";
import { decodeFunctionResult, encodeFunctionResult, type Abi, type AbiParameter } from "viem";
import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import { readEarnedAcceptance } from "../modules/commitment-pooling/service-access-earned-chain";
import { assertEarnedRewardAgreed } from "../modules/commitment-pooling/earned-agreement";
import type { ServiceChainRead } from "../modules/commitment-pooling/service-access-chain";
import { parseContractError } from "../utils/errors/contract-errors";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";

const key = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100" as const,
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200" as const,
};
const HASH = `0x${"a".repeat(64)}` as const;
const ZERO = `0x${"0".repeat(40)}` as const,
  EMPTY = `0x${"0".repeat(64)}` as const;
function defaultValue(parameter: AbiParameter): unknown {
  if (parameter.type.endsWith("[]")) return [];
  if (parameter.type === "tuple" && "components" in parameter)
    return Object.fromEntries(
      parameter.components.map((entry) => [entry.name, defaultValue(entry)])
    );
  if (parameter.type === "address") return ZERO;
  if (parameter.type === "bool") return false;
  if (parameter.type === "string") return "";
  if (parameter.type === "bytes32") return EMPTY;
  if (parameter.type.startsWith("uint")) return 0n;
  throw new Error(`Unhandled core fixture type ${parameter.type}`);
}

describe("earned terms canonical account reads", () => {
  it("hydrates the exact issuer-approved frozen revision and separately reads actual creator and counterparty consent", async () => {
    const s = createServiceRehearsalSnapshot(key);
    const terms = {
      revision: 9n,
      termsHash: HASH,
      issuerApproved: true,
      frozen: true,
      agreed: {
        issuer: key.buyer,
        issuerAuthority: key.coreModule,
        token: key.buyer,
        totalUnits: (1n << 180n) + 7n,
        allocationPolicy: HASH,
        serviceTermsRef: HASH,
        season: (1n << 80n) + 1n,
      },
    };
    const decoded = decodeFunctionResult({
      abi: EntitlementABI as Abi,
      functionName: "getTerms",
      data: encodeFunctionResult({
        abi: EntitlementABI as Abi,
        functionName: "getTerms",
        result: terms,
      }),
    });
    const table: Record<string, unknown> = {
      voucherAcceptanceProtocolVersion: 1,
      getEarnedVoucherBinding: {
        module: key.coreModule,
        revision: 9n,
        termsHash: HASH,
        acceptedRevision: 0n,
        acceptedTermsHash: EMPTY,
        acceptedCounterparty: ZERO,
      },
      commitmentPooling: key.coreModule,
      LOCAL_CHAIN_ID: 42161n,
      remoteChainId: 100n,
      getTerms: decoded,
      consentRevision: 9n,
      paused: false,
    };
    const read = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (!(functionName in table)) throw new Error("Unexpected canonical read");
      return table[functionName];
    });
    // ICommitmentPoolingModule.ClaimType.Individual: the member agrees from their own account.
    await readEarnedAcceptance(
      s,
      { creator: key.coreModule, counterparty: key.buyer, claimType: 1 },
      read
    );
    expect(s.acceptancePolicy).toMatchObject({
      kind: "service",
      knownOptIn: true,
      blockGenericMemberAcceptance: true,
      earned: {
        status: "bound",
        revision: 9n,
        creator: key.coreModule,
        participant: key.buyer,
        creatorConsentRevision: 9n,
        participantConsentRevision: 9n,
        claimType: "individual",
        viewerConsentRevision: 9n,
        modulePaused: false,
        accountRouteAvailable: false,
        terms: {
          totalUnits: (1n << 180n) + 7n,
          season: (1n << 80n) + 1n,
          issuerApproved: true,
          frozen: true,
          asset: { chainId: 100, symbol: null, decimals: null },
        },
      },
    });
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "consentRevision", args: [1024n, key.coreModule] })
    );
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "consentRevision", args: [1024n, key.buyer] })
    );
    expect(s.voucherSetups[0]!.source.acceptedEver).not.toBeNull();
  });
});

describe("independent earned acceptance evidence", () => {
  it("keeps an unsupported old getter unknown without globally blocking ordinary member flows", async () => {
    const s = createServiceRehearsalSnapshot(key);
    s.knownService = false;
    s.acceptancePolicy = {
      ...s.acceptancePolicy,
      kind: "unknown",
      knownOptIn: false,
      blockGenericMemberAcceptance: false,
      earned: { ...s.acceptancePolicy.earned, status: "unknown" },
    };
    await readEarnedAcceptance(s, {}, async () => {
      throw new Error("unsupported old getter");
    });
    expect(s.acceptancePolicy).toMatchObject({
      kind: "unknown",
      knownOptIn: false,
      blockGenericMemberAcceptance: false,
      earned: { status: "unknown" },
    });
  });

  it("preserves positive earned binding with independent canonical account consent when hydration fails", async () => {
    const s = createServiceRehearsalSnapshot(key);
    const read = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "voucherAcceptanceProtocolVersion") return 1;
      if (functionName === "getEarnedVoucherBinding")
        return {
          module: key.coreModule,
          revision: 9n,
          termsHash: HASH,
          acceptedRevision: 0n,
          acceptedTermsHash: EMPTY,
          acceptedCounterparty: ZERO,
        };
      throw new Error("Terms RPC unavailable");
    });
    await readEarnedAcceptance(s, {}, read);
    expect(s.acceptancePolicy).toMatchObject({
      kind: "service",
      knownOptIn: true,
      blockGenericMemberAcceptance: true,
      earned: {
        status: "bound",
        revision: 9n,
        participantConsentRevision: null,
        accountRouteAvailable: false,
      },
    });
    expect(s.voucherSetups[0]!.source.acceptedEver).not.toBeNull();
  });
});

describe("route-zero earned voucher boundary", () => {
  it("does not mark route-zero complete when an independently bound earned voucher cannot be hydrated", async () => {
    const getter = (CoreABI as Abi).find(
      (entry) => entry.type === "function" && entry.name === "getCommitment"
    );
    if (!getter || getter.type !== "function") throw new Error("Real core getter ABI required");
    const fullCore = {
      ...(defaultValue(getter.outputs[0]!) as object),
      poolId: 1n,
      state: 1,
      creator: key.buyer,
      leadProvider: key.buyer,
      commitmentType: 1,
      claimType: 1,
      claimMode: 1,
      providerGarden: "0x0000000000000000000000000000000000000300",
      unitLabel: "fictional work units",
      targetUnits: 10n,
    };
    const decodedCore = decodeFunctionResult({
      abi: CoreABI as Abi,
      functionName: "getCommitment",
      data: encodeFunctionResult({
        abi: CoreABI as Abi,
        functionName: "getCommitment",
        result: fullCore,
      }),
    });
    const table: Record<string, unknown> = {
      serviceOfferProtocolVersion: 1,
      voucherAcceptanceProtocolVersion: 1,
      getServiceOfferTerms: {
        revision: 0n,
        termsHash: EMPTY,
        terms: {
          route: 0,
          serviceTermsRef: EMPTY,
          remedyTermsRef: EMPTY,
          voucherChainId: 0n,
          voucherIssuer: ZERO,
          voucherToken: ZERO,
          voucherUnits: 0n,
        },
      },
      getCommitment: decodedCore,
      paused: false,
      getEarnedVoucherBinding: {
        module: "0x000000000000000000000000000000000000f009",
        revision: 1n,
        termsHash: HASH,
        acceptedRevision: 0n,
        acceptedTermsHash: EMPTY,
        acceptedCounterparty: ZERO,
      },
    };
    const read = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (!(functionName in table))
        throw new Error(`Unconfigured authoritative view ${functionName}`);
      return table[functionName];
    });
    const snapshot = await readServiceAccess(key, undefined, {
      read,
      contracts: () =>
        ({ commitmentPoolingModule: key.coreModule, settlementModule: ZERO }) as NetworkContracts,
    });
    expect(snapshot.complete).toBe(false);
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getEarnedVoucherBinding" })
    );
  });
});

describe("a take-up of a request with a voucher reward", () => {
  const MODULE = "0x0000000000000000000000000000000000000400" as const;
  const input = {
    chainId: key.sourceChainId,
    core: key.coreModule,
    commitmentId: key.commitmentId,
    claimant: key.buyer,
  };
  /** The core's binding for the request, and the claimant's own agreement on the reward module. */
  function chain(module: `0x${string}`, agreed = 0n): ServiceChainRead {
    return async ({ functionName, address }) => {
      if (functionName === "getEarnedVoucherBinding" && address === key.coreModule)
        return {
          module,
          revision: 1n,
          termsHash: HASH,
          acceptedRevision: 0n,
          acceptedTermsHash: EMPTY,
          acceptedCounterparty: ZERO,
        };
      if (functionName === "consentRevision" && address === MODULE) return agreed;
      throw new Error(`Unexpected read ${functionName}`);
    };
  }

  it("goes ahead for a request with no reward, and for a reward its claimant agreed to", async () => {
    await expect(assertEarnedRewardAgreed(input, chain(ZERO))).resolves.toBeUndefined();
    await expect(assertEarnedRewardAgreed(input, chain(MODULE, 1n))).resolves.toBeUndefined();
  });

  it("stops before queueing a take-up its claimant hasn't agreed to, in the chain's own words", async () => {
    const refused = await assertEarnedRewardAgreed(input, chain(MODULE)).catch((e: unknown) => e);
    // The core refuses the same take-up with VoucherConsentMissing() (0x51789899).
    for (const error of [refused, new Error("reverted with the following signature: 0x51789899")])
      expect(parseContractError(error)).toMatchObject({
        name: "VoucherConsentMissing",
        message: "This promise has a reward to agree to first",
      });
  });

  it("decides nothing when the reward can't be read: the claim's own check still stops it", async () => {
    const unread: ServiceChainRead = async () => {
      throw new Error("RPC unavailable");
    };
    await expect(assertEarnedRewardAgreed(input, unread)).resolves.toBeUndefined();
  });
});
