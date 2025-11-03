import { describe, it, expect, vi } from "vitest";

vi.mock("../../modules/urql", () => ({
  greenGoodsIndexer: {
    query: () => ({ toPromise: async () => ({ data: { Action: [], Garden: [] }, error: null }) }),
  },
}));

vi.mock("../../modules/pinata", () => ({
  getFileByHash: vi.fn(async () => ({ data: new Blob(["x"]) })),
}));

vi.mock("../../config", () => ({ DEFAULT_CHAIN_ID: 84532 }));

import { getActions, getGardens } from "../../modules/data/greengoods";

describe("modules/greengoods", () => {
  it("returns arrays for actions and gardens", async () => {
    const actions = await getActions();
    const gardens = await getGardens();
    expect(Array.isArray(actions)).toBe(true);
    expect(Array.isArray(gardens)).toBe(true);
  });
});
