import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGardenerDeliveryEnabled } from "../modules/commitment-pooling/data-settlement";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../modules/data/graphql-client", () => ({ greenGoodsIndexer: { query } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("indexed gardener delivery gate", () => {
  it.each([
    [[], false],
    [[{ chainId: 42161, role: "SOURCE", gardenerDeliveryEnabled: null }], false],
    [[{ chainId: 42161, role: "SOURCE", gardenerDeliveryEnabled: false }], false],
    [[{ chainId: 42161, role: "SOURCE", gardenerDeliveryEnabled: true }], true],
    [[{ chainId: 42220, role: "SOURCE", gardenerDeliveryEnabled: true }], false],
    [[{ chainId: 42161, role: "EXECUTOR", gardenerDeliveryEnabled: true }], false],
    [[{ chainId: 42161, role: "SOURCE" }], false],
  ])("requires the explicit production SOURCE flag for %j", async (configurations, expected) => {
    query.mockResolvedValue({ data: { SettlementConfiguration: configurations } });
    expect(await getGardenerDeliveryEnabled()).toBe(expected);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      { chainId: 42161 },
      "getSettlementConfigurations"
    );
  });

  it("propagates a failed fresh read instead of using a previous enabled result", async () => {
    query.mockResolvedValueOnce({
      data: {
        SettlementConfiguration: [
          { chainId: 42161, role: "SOURCE", gardenerDeliveryEnabled: true },
        ],
      },
    });
    expect(await getGardenerDeliveryEnabled()).toBe(true);
    query.mockResolvedValueOnce({ error: new Error("indexer unavailable") });
    await expect(getGardenerDeliveryEnabled()).rejects.toThrow("indexer unavailable");
  });
});
