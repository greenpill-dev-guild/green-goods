/**
 * getGardenHypercerts query-contract tests
 *
 * PRD-559 regression: the `GardenHypercerts` query must declare
 * `$gardenId: String!` to match the indexer's `Hypercert.garden: String!`
 * column. A prior `$gardenId: ID!` declaration was rejected by Hasura
 * ("variable 'gardenId' is declared as 'ID!', but used where 'String' is
 * expected") and broke garden hypercert loading on every garden the operator
 * switched to. Mocked-client unit tests don't exercise the real GraphQL
 * validator, so this test guards the query document string directly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: queryMock },
  GQLClient: class GQLClient {
    query = vi.fn();
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getGardenHypercerts } from "../../../modules/data/hypercerts-fetch";

describe("getGardenHypercerts query contract (PRD-559 regression)", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ data: { Hypercert: [] }, error: null });
  });

  it("declares $gardenId as String! to match the indexer's Hypercert.garden column", async () => {
    await getGardenHypercerts("0xGardenAddress", 42161);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [query, variables, source] = queryMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];

    // schema.graphql types Hypercert.garden as String!; ID! is rejected by Hasura.
    expect(query).toMatch(/\$gardenId:\s*String!/);
    expect(query).not.toMatch(/\$gardenId:\s*ID!/);
    expect(variables).toMatchObject({ gardenId: "0xGardenAddress", chainId: 42161 });
    expect(source).toBe("getGardenHypercerts");
  });
});
