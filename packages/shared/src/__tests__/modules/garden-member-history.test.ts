import { describe, expect, it, vi } from "vitest";
import type { GraphQLReader } from "../../modules/data/graphql-client";
import {
  getGardenMemberHistory,
  getGardenRoleChanges,
} from "../../modules/data/garden-member-history";

const garden = "0x1111111111111111111111111111111111111111";
const otherGarden = "0x2222222222222222222222222222222222222222";
const account = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const event = (block: number, role = 0, action = "GRANTED", overrides = {}) => ({
  id: `event-${block}-${role}-${action}`,
  chainId: 42161,
  garden,
  account,
  role,
  action,
  timestamp: 1_700_000_000 + block,
  blockNumber: String(block),
  logIndex: role,
  txHash: `0x${block.toString(16).padStart(64, "0")}`,
  ...overrides,
});
const read = (rows: unknown[]) => {
  const query = vi.fn().mockResolvedValue({ data: { GardenRoleEvent: rows } });
  return { query, reader: { query } as GraphQLReader };
};

describe("getGardenMemberHistory", () => {
  it("keeps garden join and role appointment dates separate from another garden", async () => {
    const { reader, query } = read([
      event(1, 0, "GRANTED", { garden: otherGarden }),
      event(10),
      event(20, 2),
    ]);
    const rows = await getGardenMemberHistory({ account, chainId: 42161 }, reader);
    expect(rows).toEqual([
      expect.objectContaining({ garden: otherGarden, joinedAt: 1_700_000_001_000 }),
      {
        garden,
        account,
        joinedAt: 1_700_000_010_000,
        memberSince: 1_700_000_010_000,
        roleSince: { gardener: 1_700_000_010_000, steward: 1_700_000_020_000 },
        recordedRoles: ["steward", "gardener"],
      },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        where: { chainId: { _eq: 42161 }, account: { _eq: account } },
        limit: 200,
        offset: 0,
      }),
      "getGardenMemberHistory",
      undefined
    );
  });

  it("reconstructs a rejoin after the last role is removed, in chain order", async () => {
    const { reader } = read([
      event(40),
      event(30, 2, "REVOKED"),
      event(10),
      event(20, 2),
      event(25, 0, "REVOKED"),
      event(20, 2),
    ]);
    const [history] = await getGardenMemberHistory({ garden, chainId: 42161 }, reader);
    expect(history).toEqual({
      garden,
      account,
      joinedAt: 1_700_000_010_000,
      memberSince: 1_700_000_040_000,
      roleSince: { gardener: 1_700_000_040_000 },
      recordedRoles: ["steward", "gardener"],
    });
  });

  it("records every role granted, revoked or not, so a removal is never offered back (PRD-979)", async () => {
    // A Steward grant mints Steward, Evaluator and Gardener; Evaluator is then removed by itself.
    const { reader } = read([event(10, 2), event(10, 1), event(10, 0), event(20, 1, "REVOKED")]);
    const [history] = await getGardenMemberHistory({ garden, chainId: 42161 }, reader);
    expect(history.roleSince).toEqual({ steward: 1_700_000_010_000, gardener: 1_700_000_010_000 });
    expect(history.recordedRoles).toEqual(["steward", "evaluator", "gardener"]);
  });

  it("records a role whose only event is a revocation, so it is never offered back", async () => {
    // The hat was minted before the indexer's first block; only its removal was recorded.
    const { reader } = read([event(10, 2), event(20, 1, "REVOKED")]);
    const [history] = await getGardenMemberHistory({ garden, chainId: 42161 }, reader);
    expect(history.recordedRoles).toEqual(["steward", "evaluator"]);
  });

  it("does not reset membership while another role remains or from repeated grants", async () => {
    const { reader } = read([event(1, 2), event(2), event(3, 0, "REVOKED"), event(4), event(5, 2)]);
    const [history] = await getGardenMemberHistory({ garden, chainId: 42161 }, reader);
    expect(history.memberSince).toBe(1_700_000_001_000);
    expect(history.roleSince).toEqual({ steward: 1_700_000_001_000, gardener: 1_700_000_004_000 });
  });

  it("retains first join after departure and invents no date for a revoke without a grant", async () => {
    const { reader } = read([
      event(1),
      event(2, 0, "REVOKED"),
      event(3, 2, "REVOKED", { garden: otherGarden }),
    ]);
    const rows = await getGardenMemberHistory({ account, chainId: 42161 }, reader);
    expect(rows[0]).toMatchObject({
      joinedAt: 1_700_000_001_000,
      memberSince: null,
      roleSince: {},
    });
    expect(rows[1]).toMatchObject({ joinedAt: null, memberSince: null, roleSince: {} });
  });

  it("reads all pages before returning dates and refuses a partial history", async () => {
    const { reader, query } = read([]);
    query
      .mockResolvedValueOnce({
        data: { GardenRoleEvent: Array.from({ length: 200 }, (_, i) => event(i + 1)) },
      })
      .mockResolvedValueOnce({ data: { GardenRoleEvent: [event(201, 0, "REVOKED")] } });
    expect(
      (await getGardenMemberHistory({ garden, chainId: 42161 }, reader))[0].memberSince
    ).toBeNull();
    expect(query).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ offset: 200 }),
      "getGardenMemberHistory",
      undefined
    );
    query
      .mockResolvedValueOnce({
        data: { GardenRoleEvent: Array.from({ length: 200 }, (_, i) => event(i + 1)) },
      })
      .mockResolvedValueOnce({ data: {} });
    await expect(getGardenMemberHistory({ garden, chainId: 42161 }, reader)).rejects.toThrow(
      "membership history"
    );
  });

  it("rejects malformed or out-of-scope events and surfaces an unavailable indexer schema", async () => {
    for (const bad of [
      event(1, 8),
      event(1, 0, "UNKNOWN"),
      event(1, 0, "GRANTED", { timestamp: null }),
      event(1, 0, "GRANTED", { chainId: 11155111 }),
      event(1, 0, "GRANTED", { garden: otherGarden }),
    ]) {
      const { reader } = read([bad]);
      await expect(getGardenMemberHistory({ garden, chainId: 42161 }, reader)).rejects.toThrow(
        "membership history"
      );
    }
    const query = vi
      .fn()
      .mockResolvedValue({ error: new Error("field GardenRoleEvent not found") });
    await expect(
      getGardenMemberHistory({ garden, chainId: 42161 }, { query } as GraphQLReader)
    ).rejects.toThrow("GardenRoleEvent not found");
  });
});

describe("getGardenRoleChanges", () => {
  it("counts a first role as a join, a later one as a change, and a return after leaving as a join", async () => {
    // Role 0 is gardener and 2 steward. The member leaves both, then comes back.
    const { reader } = read([
      event(10),
      event(20, 2),
      event(25, 2),
      event(30, 2, "REVOKED"),
      event(31, 0, "REVOKED"),
      event(40),
    ]);
    const changes = await getGardenRoleChanges({ garden, chainId: 42161 }, reader);
    expect(changes.map(({ kind, role, at }) => [kind, role, at])).toEqual([
      ["joined", "gardener", 1_700_000_040_000],
      ["revoked", "gardener", 1_700_000_031_000],
      ["revoked", "steward", 1_700_000_030_000],
      // A second grant of a role already held changes nothing and is left out.
      ["granted", "steward", 1_700_000_020_000],
      ["joined", "gardener", 1_700_000_010_000],
    ]);
  });
});
