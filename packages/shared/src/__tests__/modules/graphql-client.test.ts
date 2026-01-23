import { describe, it, expect } from "vitest";

import { createEasClient, greenGoodsIndexer } from "../../modules/data/graphql-client";

describe("modules/graphql-client", () => {
  it("creates EAS client and indexer", () => {
    const client = createEasClient();
    expect(client).toBeDefined();
    expect(typeof client.query).toBe("function");

    expect(greenGoodsIndexer).toBeDefined();
    expect(typeof greenGoodsIndexer.query).toBe("function");
  });
});
