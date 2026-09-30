import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCommitmentClaimRequests,
  getCommitmentCycles,
  getCommitmentPools,
  getCommitments,
  getCommitmentSeries,
} from "../modules/commitment-pooling/data";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));

const emptyFieldByOperation: Record<string, string> = {
  getCommitmentPools: "CommitmentPool",
  getCommitmentCycles: "CommitmentCycle",
  getCommitments: "Commitment",
  getCommitmentClaimRequests: "CommitmentClaimRequest",
  getCommitmentSeries: "CommitmentSeries",
};

describe("commitment pooling public read boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(
      async (_document: string, _variables: unknown, operation: string) => ({
        data: { [emptyFieldByOperation[operation]]: [] },
      })
    );
  });

  it("puts the correct seen flag in every ordinary list query", async () => {
    await getCommitmentPools(42161);
    await getCommitmentCycles({ chainId: 42161, poolId: 9n });
    await getCommitments({ chainId: 42161, poolId: 9n });
    await getCommitmentClaimRequests(42161, 11n);
    await getCommitmentSeries({ chainId: 42161, poolId: 9n });

    const documents = Object.fromEntries(
      mocks.query.mock.calls.map(([document, _variables, operation]) => [operation, document])
    );
    expect(documents.getCommitmentPools).toContain("registrationSeen: { _eq: true }");
    expect(documents.getCommitmentCycles).toContain("seedSeen: { _eq: true }");
    expect(documents.getCommitments).toContain("creationSeen: { _eq: true }");
    expect(documents.getCommitmentClaimRequests).toContain("requestSeen: { _eq: true }");
    expect(documents.getCommitmentSeries).toContain("creationSeen: { _eq: true }");
  });

  it("fails closed or filters when an indexer returns an unseen placeholder anyway", async () => {
    mocks.query.mockResolvedValueOnce({
      data: { CommitmentPool: [{ id: "42161-9", registrationSeen: false }] },
    });
    await expect(getCommitmentPools(42161)).rejects.toThrow("unseen commitment pool placeholder");

    mocks.query.mockResolvedValueOnce({
      data: { CommitmentCycle: [{ id: "42161-10", seedSeen: false }] },
    });
    await expect(getCommitmentCycles({ chainId: 42161, poolId: 9n })).rejects.toThrow(
      "unseen commitment cycle placeholder"
    );

    mocks.query.mockResolvedValueOnce({
      data: { CommitmentSeries: [{ id: "42161-12", creationSeen: false }] },
    });
    await expect(getCommitmentSeries({ chainId: 42161 })).rejects.toThrow(
      "unseen commitment series placeholder"
    );

    mocks.query.mockResolvedValueOnce({
      data: { CommitmentClaimRequest: [{ id: "claim", requestSeen: false }] },
    });
    await expect(getCommitmentClaimRequests(42161, 11n)).rejects.toThrow(
      "unseen claim request placeholder"
    );

    mocks.query.mockResolvedValueOnce({
      data: {
        Commitment: [
          {
            id: "42161-11",
            chainId: 42161,
            commitmentId: "11",
            creationSeen: false,
            state: "OFFERED",
          },
        ],
      },
    });
    await expect(getCommitments({ chainId: 42161 })).resolves.toEqual([]);
  });
});
