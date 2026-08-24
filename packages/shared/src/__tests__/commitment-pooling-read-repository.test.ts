import { describe, expect, it, vi } from "vitest";
import type { GraphQLReader } from "../modules/data/graphql-client";
import { createCommitmentPoolingReadRepository } from "../modules/commitment-pooling/read-repository";

describe("CommitmentPoolingReadRepository", () => {
  it("maps pool reads through its injected GraphQLReader", async () => {
    const query = vi.fn().mockResolvedValue({
      data: {
        CommitmentPool: [
          {
            id: "42161-7",
            chainId: 42161,
            poolId: "7",
            registrationSeen: true,
            state: "OPEN",
            poolType: "OPEN",
            updatedAt: 10,
          },
        ],
      },
    });
    const repository = createCommitmentPoolingReadRepository({ query } as GraphQLReader);

    await expect(repository.getCommitmentPools(42161)).resolves.toEqual([
      expect.objectContaining({ id: "42161-7", poolId: 7n, registrationSeen: true }),
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("query CommitmentPools"),
      { chainId: 42161 },
      "getCommitmentPools"
    );
  });

  it("propagates reader failures without consulting the default singleton", async () => {
    const failure = new Error("indexer unavailable");
    const repository = createCommitmentPoolingReadRepository({
      query: vi.fn().mockResolvedValue({ error: failure }),
    } as GraphQLReader);

    await expect(repository.getCommitmentPools(42161)).rejects.toBe(failure);
  });
});
