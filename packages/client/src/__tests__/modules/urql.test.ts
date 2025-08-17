import { describe, it, expect } from "vitest";

import { createEasClient, greenGoodsIndexer } from "../../modules/urql";

describe("modules/urql", () => {
  it("creates EAS client and indexer", () => {
    const client = createEasClient();
    expect(client).toBeDefined();
    expect(typeof (client as any).query).toBe("function");

    expect(greenGoodsIndexer).toBeDefined();
    expect(typeof (greenGoodsIndexer as any).query).toBe("function");
  });
});
