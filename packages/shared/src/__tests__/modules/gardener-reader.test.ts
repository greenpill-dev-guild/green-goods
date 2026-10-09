import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLReader } from "../../modules/data/graphql-client";

const query = vi.fn();
vi.mock("../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 11155111 }));
vi.mock("../../modules/data/graphql", () => ({
  greenGoodsGraphQL: (document: string) => document,
}));

import { getGardeners } from "../../modules/data/greengoods";

const reader = { query } as GraphQLReader;
const address = (index: number) => `0x${index.toString(16).padStart(40, "0")}`;
const gardener = (index: number, createdAt: number | null = 1_700_000_000) => ({
  id: `11155111-${address(index)}`,
  chainId: 11155111,
  createdAt,
  firstGarden: "11155111-1",
});

describe("getGardeners", () => {
  beforeEach(() => query.mockReset());

  it("matches chain-prefixed identities and keeps distinct first-role dates", async () => {
    query.mockResolvedValue({
      data: { Gardener: [gardener(1, 1_700_000_000), gardener(2, 1_710_000_000)] },
    });

    const rows = await getGardeners(reader);

    expect(rows.map((row) => [row.account, row.registeredAt])).toEqual([
      [address(1), 1_700_000_000_000],
      [address(2), 1_710_000_000_000],
    ]);
    expect(rows[0].username).toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      { chainId: 11155111, limit: 200, offset: 0 },
      "getGardeners"
    );
  });

  it("reads beyond the old 200-record limit", async () => {
    query
      .mockResolvedValueOnce({
        data: { Gardener: Array.from({ length: 200 }, (_, index) => gardener(index + 1)) },
      })
      .mockResolvedValueOnce({ data: { Gardener: [gardener(201)] } });

    const rows = await getGardeners(reader);

    expect(rows).toHaveLength(201);
    expect(rows[200].account).toBe(address(201));
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      { chainId: 11155111, limit: 200, offset: 200 },
      "getGardeners"
    );
  });

  it("does not invent a date or accept an ID from another chain", async () => {
    query.mockResolvedValue({
      data: {
        Gardener: [
          gardener(1, null),
          { ...gardener(2), id: `42161-${address(2)}` },
          { ...gardener(3), chainId: 42161 },
          { ...gardener(4), id: "malformed" },
        ],
      },
    });

    await expect(getGardeners(reader)).resolves.toEqual([
      expect.objectContaining({ account: address(1), registeredAt: null }),
    ]);
  });

  it("rejects a malformed later page instead of returning a partial roster", async () => {
    query
      .mockResolvedValueOnce({
        data: { Gardener: Array.from({ length: 200 }, (_, index) => gardener(index + 1)) },
      })
      .mockResolvedValueOnce({ data: {} });

    await expect(getGardeners(reader)).rejects.toThrow("missing the list");
  });
});
