import { describe, expect, it, vi } from "vitest";
import {
  getServiceAccessProjection,
  unavailableServiceAccess,
} from "../modules/commitment-pooling/data-service-access";
import { createCommitmentPoolingReadRepository } from "../modules/commitment-pooling/read-repository";
import type { GraphQLReader } from "../modules/data/graphql-client";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";

const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000001",
  commitmentId: 5n,
  buyer: "0x0000000000000000000000000000000000000002",
};
const HASH = `0x${"a".repeat(64)}`;
const big = "18446744073709551614";

function rows() {
  return {
    ServiceOfferRevision: [
      {
        id: `42161-${key.coreModule}-5-${big}`,
        chainId: 42161,
        moduleAddress: key.coreModule,
        commitmentId: "5",
        revision: big,
        termsHash: HASH,
        paymentRoute: 1,
        gdPrice: "340282366920938463463374607431768211456",
        blockNumber: "9007199254740993",
      },
    ],
    ServiceClaimConsent: [
      {
        id: `42161-${key.coreModule}-${HASH}`,
        chainId: 42161,
        moduleAddress: key.coreModule,
        commitmentId: "5",
        buyer: key.buyer,
        claimHash: HASH,
        revision: big,
        requestNonce: big,
        buyerGarden: null,
        voucherHolder: null,
        requestSeen: false,
        acceptedSeen: true,
        withdrawnSeen: false,
      },
    ],
  };
}

describe("service access projection reader", () => {
  it("uses the injected repository and preserves exact decimal integers and incomplete observation meaning", async () => {
    const query = vi.fn().mockResolvedValue({ data: rows() });
    const repository = createCommitmentPoolingReadRepository({ query } as GraphQLReader);
    const result = await repository.getServiceAccessProjection(key);
    expect(result).toMatchObject({
      complete: false,
      evidence: "indexed",
      offer: {
        revision: BigInt(big),
        gdPrice: 1n << 128n,
        blockNumber: 9007199254740993n,
      },
      claims: [
        { requestNonce: BigInt(big), requestSeen: false, acceptedSeen: true, buyerGarden: null },
      ],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("moduleAddress: {_eq: $module}"),
      { chainId: 42161, module: key.coreModule, commitment: "5", buyer: key.buyer },
      "getServiceAccessProjection"
    );
    expect(unavailableServiceAccess(key, result)).toMatchObject({
      mode: "unavailable",
      knownService: true,
      consent: null,
      offer: null,
    });
  });

  it("does not infer Legacy or a fresh nonce from absent projection rows", async () => {
    const result = await getServiceAccessProjection(key, {
      query: vi
        .fn()
        .mockResolvedValue({ data: { ServiceOfferRevision: [], ServiceClaimConsent: [] } }),
    } as GraphQLReader);
    expect(unavailableServiceAccess(key, result)).toMatchObject({
      mode: "unavailable",
      complete: false,
      nextRequestNonce: 0n,
      availableActions: [],
    });
  });

  it("rejects unknown discriminators and malformed integer/address/hash data instead of coercing", async () => {
    for (const changed of [
      { paymentRoute: 8 },
      { revision: 9007199254740992 },
      { revision: "18446744073709551616" },
      { gdPrice: "01" },
      { termsHash: "0xaa" },
      { moduleAddress: "bad" },
    ]) {
      const data = rows();
      Object.assign(data.ServiceOfferRevision[0]!, changed);
      await expect(
        getServiceAccessProjection(key, {
          query: vi.fn().mockResolvedValue({ data }),
        } as GraphQLReader)
      ).rejects.toThrow();
    }
  });

  it("rejects same business identifiers from a different source module, chain or buyer", async () => {
    for (const changed of [
      { chainId: 100 },
      { moduleAddress: key.buyer },
      { buyer: key.coreModule },
    ]) {
      const data = rows();
      Object.assign(data.ServiceClaimConsent[0]!, changed);
      await expect(
        getServiceAccessProjection(key, {
          query: vi.fn().mockResolvedValue({ data }),
        } as GraphQLReader)
      ).rejects.toThrow("identity mismatch");
    }
  });

  it("propagates unavailable or incomplete projection responses", async () => {
    const error = new Error("indexer unavailable");
    await expect(
      getServiceAccessProjection(key, {
        query: vi.fn().mockResolvedValue({ error }),
      } as GraphQLReader)
    ).rejects.toBe(error);
    await expect(
      getServiceAccessProjection(key, {
        query: vi.fn().mockResolvedValue({ data: {} }),
      } as GraphQLReader)
    ).rejects.toThrow("Incomplete");
  });
});
