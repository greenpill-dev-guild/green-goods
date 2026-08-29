import { describe, expect, it, vi } from "vitest";
import type { Address } from "../public-contracts";
import {
  getPublicGardenImpactChainConfig,
  isPublicGardenImpactChainSupported,
} from "../config/blockchain";
import {
  PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT,
  PublicGardenImpactSourceError,
  createPublicGardenImpactReaders,
} from "../modules/data/public-garden-impact-readers";
import type { GraphQLReader } from "../modules/data/graphql-client";

const gardenAddress: Address = "0x1111111111111111111111111111111111111111";

function reader(query: GraphQLReader["query"]): GraphQLReader {
  return { query };
}

describe("public garden impact source readers", () => {
  it("supports only chains covered by the Garden, EAS, and indexer sources", () => {
    expect([42161, 11155111].map(isPublicGardenImpactChainSupported)).toEqual([true, true]);
    expect([1, 42220, 31337, 10, Number.NaN].map(isPublicGardenImpactChainSupported)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("rejects Celo before constructing a fallback EAS reader", async () => {
    const createEasReader = vi.fn(() => reader(vi.fn()));
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader,
    });

    await expect(impactReaders.readWorks(42220, gardenAddress)).rejects.toMatchObject({
      source: "works",
      reason: "unsupported_chain",
    });
    expect(createEasReader).not.toHaveBeenCalled();
  });

  it("treats a structurally missing provider result as unavailable, not empty", async () => {
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () =>
        reader(vi.fn(async () => ({ data: {} })) as unknown as GraphQLReader["query"]),
    });

    await expect(impactReaders.readWorks(11155111, gardenAddress)).rejects.toMatchObject({
      source: "works",
      reason: "provider_failed",
    });
  });

  it("resolves the exact chain-qualified Garden account without replacing nullable fields", async () => {
    const config = getPublicGardenImpactChainConfig(11155111);
    expect(config).not.toBeNull();
    const readContract = vi.fn(async (input: { functionName: string }) => {
      if (input.functionName === "token") {
        return [11155111n, config?.gardenToken, 7n];
      }
      if (input.functionName === "account") return gardenAddress;
      if (input.functionName === "name" || input.functionName === "location") return "";
      throw new Error(`Unexpected function ${input.functionName}`);
    });
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () => reader(vi.fn()),
      createChainReader: (chainId) => {
        expect(chainId).toBe(11155111);
        return { readContract };
      },
    });

    await expect(impactReaders.readGarden(11155111, gardenAddress)).resolves.toEqual({
      id: gardenAddress,
      name: null,
      location: null,
    });
    expect(readContract.mock.calls.map(([input]) => input.functionName)).toEqual([
      "token",
      "account",
      "name",
      "location",
    ]);
  });

  it("rejects an account whose token binding belongs to another chain", async () => {
    const arbitrum = getPublicGardenImpactChainConfig(42161);
    const readContract = vi.fn(async () => [42161n, arbitrum?.gardenToken, 7n]);
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () => reader(vi.fn()),
      createChainReader: () => ({ readContract }),
    });

    await expect(impactReaders.readGarden(11155111, gardenAddress)).resolves.toBeNull();
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("keeps a Garden provider failure distinct from a missing Garden", async () => {
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () => reader(vi.fn()),
      createChainReader: () => ({
        readContract: vi.fn(async () => {
          throw new Error("RPC unavailable");
        }),
      }),
    });

    await expect(impactReaders.readGarden(11155111, gardenAddress)).rejects.toMatchObject({
      source: "works",
      reason: "provider_failed",
    });
  });

  it("decodes the nested numeric envelope returned by EAS", async () => {
    const easQuery = vi.fn(async (document, _variables, operationName) => {
      expect(String(document)).not.toMatch(/\n\s+(attester|recipient)\s*\n/);
      if (operationName === "readPublicGardenImpactWorks") {
        return {
          data: {
            attestations: [
              {
                id: "0xwork",
                timeCreated: 1_700_000_000,
                decodedDataJson: JSON.stringify([
                  { name: "actionUID", value: { value: { hex: "0x2a" } } },
                  { name: "title", value: { value: "Compost collection" } },
                  { name: "feedback", value: { value: "Collected safely" } },
                  { name: "media", value: { value: [] } },
                ]),
              },
            ],
          },
        };
      }
      return {
        data: {
          attestations: [
            {
              id: "0xapproval",
              timeCreated: 1_700_000_100,
              decodedDataJson: JSON.stringify([
                { name: "workUID", value: { value: "0xwork" } },
                { name: "approved", value: { value: true } },
              ]),
            },
          ],
        },
      };
    });
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () => reader(easQuery as GraphQLReader["query"]),
    });

    await expect(impactReaders.readWorks(11155111, gardenAddress)).resolves.toEqual([
      expect.objectContaining({ id: "0xwork", actionUID: 42, title: "Compost collection" }),
    ]);
    await expect(impactReaders.readApprovals(11155111)).resolves.toEqual([
      expect.objectContaining({ id: "0xapproval", workUID: "0xwork", approved: true }),
    ]);
  });

  it("queries every configured Assessment schema in one bounded source stream", async () => {
    const easQuery = vi.fn(async (_document, variables, operationName) => {
      expect(operationName).toBe("readPublicGardenImpactAssessments");
      expect(variables).toMatchObject({
        where: {
          schemaId: {
            in: expect.arrayContaining([
              "0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93",
              "0x9358f3371f9fcf6b3467c524da3ba5f8d43f8f0b9cc3ba12c925e77ecbcf06a0",
            ]),
          },
        },
      });
      return {
        data: {
          attestations: [
            { id: "0xassessment-v2", timeCreated: 100, decodedDataJson: "[]" },
            { id: "0xassessment-v3", timeCreated: 200, decodedDataJson: "[]" },
          ],
        },
      };
    });
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () => reader(easQuery as GraphQLReader["query"]),
    });

    await expect(impactReaders.readAssessments(42161, gardenAddress)).resolves.toEqual([
      { id: "0xassessment-v2", createdAt: 100 },
      { id: "0xassessment-v3", createdAt: 200 },
    ]);
    expect(easQuery).toHaveBeenCalledTimes(1);
  });

  it("reads Hypercert lifecycle update timestamps", async () => {
    const indexerQuery = vi.fn(async (document) => {
      expect(String(document)).toContain("updatedAt");
      return {
        data: {
          Hypercert: [
            {
              id: "11155111-7",
              status: "CLAIMED",
              mintedAt: 400,
              updatedAt: 650,
            },
          ],
        },
      };
    });
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(indexerQuery as GraphQLReader["query"]),
      createEasReader: () => reader(vi.fn()),
    });

    await expect(impactReaders.readCertificates(11155111, gardenAddress)).resolves.toEqual([
      {
        id: "11155111-7",
        status: "claimed",
        mintedAt: 400,
        updatedAt: 650,
      },
    ]);
  });

  it("fails a source closed when the 1,001st record exists", async () => {
    const indexerQuery = vi.fn(async (_document, variables) => {
      const offset = Number((variables as { offset?: number }).offset ?? 0);
      const length = offset < PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT ? 100 : 1;
      return {
        data: {
          Hypercert: Array.from({ length }, (_, index) => ({
            id: `11155111-${offset + index}`,
            status: "ACTIVE",
            mintedAt: offset + index,
            updatedAt: offset + index,
          })),
        },
      };
    });
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(indexerQuery as GraphQLReader["query"]),
      createEasReader: () => reader(vi.fn()),
    });

    await expect(impactReaders.readCertificates(11155111, gardenAddress)).rejects.toEqual(
      expect.objectContaining<Partial<PublicGardenImpactSourceError>>({
        source: "certificates",
        reason: "limit_exceeded",
      })
    );
    expect(indexerQuery).toHaveBeenCalledTimes(11);
  });

  it("applies the source ceiling across all Assessment schema versions", async () => {
    const easQuery = vi.fn(async (_document, variables) => {
      const skip = Number((variables as { skip?: number }).skip ?? 0);
      return {
        data: {
          attestations: Array.from(
            { length: skip < PUBLIC_GARDEN_IMPACT_SOURCE_LIMIT ? 100 : 1 },
            (_, index) => ({
              id: `0x${skip + index}`,
              timeCreated: skip + index,
              decodedDataJson: "[]",
            })
          ),
        },
      };
    });
    const impactReaders = createPublicGardenImpactReaders({
      indexerReader: reader(vi.fn()),
      createEasReader: () => reader(easQuery as GraphQLReader["query"]),
    });

    await expect(impactReaders.readAssessments(42161, gardenAddress)).rejects.toEqual(
      expect.objectContaining<Partial<PublicGardenImpactSourceError>>({
        source: "assessments",
        reason: "limit_exceeded",
      })
    );
    expect(easQuery).toHaveBeenCalledTimes(11);
  });
});
