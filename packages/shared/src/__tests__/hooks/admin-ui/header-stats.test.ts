/**
 * Header-stats helper tests
 *
 * Pin the MetaStrip item shapes shipped by the cleanup A6 stats slot. The
 * helpers are pure data-shapers around `formatMessage`; rendering coverage
 * lives at the view layer (Chrome MCP / data-component selectors) per the
 * cleanup proof_limit policy for visual changes.
 *
 * Cleanup item A6 from .plans/active/admin-design-revamp/handoffs/claude-cleanup.md.
 */

import { describe, expect, it, vi } from "vitest";

import { buildCommunityHeaderStats } from "../../../hooks/admin-ui/community/community.utils";
import { buildGardenHeaderStats } from "../../../hooks/admin-ui/garden/garden.utils";

function makeFormatMessage() {
  return vi.fn((descriptor: { id: string; defaultMessage?: string }) => descriptor.id);
}

describe("buildGardenHeaderStats", () => {
  it("returns an empty array when no garden is selected", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: false,
      gardenerCount: 5,
      pendingWorkCount: 2,
      treasuryBalance: "12.5",
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("emits gardeners / pending-work / treasury items in that order", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 5,
      pendingWorkCount: 2,
      treasuryBalance: "12.5",
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["gardeners", "pending-work", "treasury"]);
  });

  it("stringifies numeric counts and passes the treasury balance through unchanged", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 0,
      pendingWorkCount: 13,
      treasuryBalance: "1,234.56",
      formatMessage: makeFormatMessage(),
    });
    expect(items[0]?.value).toBe("0");
    expect(items[1]?.value).toBe("13");
    expect(items[2]?.value).toBe("1,234.56");
  });

  it("calls formatMessage with the canonical i18n ids and count parameter for plurals", () => {
    const formatMessage = makeFormatMessage();
    buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 1,
      pendingWorkCount: 1,
      treasuryBalance: "0",
      formatMessage,
    });
    const ids = formatMessage.mock.calls.map((call) => call[0].id);
    expect(ids).toEqual([
      "cockpit.garden.stats.gardeners",
      "cockpit.garden.stats.pendingWork",
      "cockpit.garden.stats.treasury",
    ]);
    expect(formatMessage.mock.calls[0]?.[1]).toEqual({ count: 1 });
    expect(formatMessage.mock.calls[1]?.[1]).toEqual({ count: 1 });
  });
});

describe("buildCommunityHeaderStats", () => {
  it("returns an empty array when no garden is selected", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: false,
      peopleCount: 5,
      poolCount: 2,
      vaultNetDeposited: 0n,
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("emits people / pools / treasury items in that order", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      peopleCount: 5,
      poolCount: 2,
      vaultNetDeposited: 0n,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["people", "pools", "treasury"]);
  });

  it("formats the vault balance via formatTokenAmount (zero renders as '0')", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      peopleCount: 0,
      poolCount: 0,
      vaultNetDeposited: 0n,
      formatMessage: makeFormatMessage(),
    });
    expect(items[2]?.value).toBe("0");
  });

  it("formats a non-zero vault balance with the token's 18 decimal precision (default)", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      peopleCount: 0,
      poolCount: 0,
      vaultNetDeposited: 1_500_000_000_000_000_000n, // 1.5 * 10^18
      formatMessage: makeFormatMessage(),
    });
    // formatTokenAmount uses the active locale; assert we get a 1 + decimal-separator + 5
    expect(items[2]?.value).toMatch(/^1[.,]5$/);
  });

  it("calls formatMessage with the canonical i18n ids and count parameter", () => {
    const formatMessage = makeFormatMessage();
    buildCommunityHeaderStats({
      hasSelectedGarden: true,
      peopleCount: 1,
      poolCount: 2,
      vaultNetDeposited: 0n,
      formatMessage,
    });
    const ids = formatMessage.mock.calls.map((call) => call[0].id);
    expect(ids).toEqual([
      "cockpit.community.stats.people",
      "cockpit.community.stats.pools",
      "cockpit.community.stats.treasury",
    ]);
    expect(formatMessage.mock.calls[0]?.[1]).toEqual({ count: 1 });
    expect(formatMessage.mock.calls[1]?.[1]).toEqual({ count: 2 });
  });
});
