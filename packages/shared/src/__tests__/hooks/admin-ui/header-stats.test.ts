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

import { buildActionsHeaderStats } from "../../../hooks/admin-ui/actions/actions.utils";
import { buildCommunityHeaderStats } from "../../../hooks/admin-ui/community/community.utils";
import { buildGardenHeaderStats } from "../../../hooks/admin-ui/garden/garden.utils";
import { buildHubHeaderStats } from "../../../hooks/admin-ui/hub/hub.utils";

function makeFormatMessage() {
  return vi.fn((descriptor: { id: string; defaultMessage?: string }) => descriptor.id);
}

describe("buildGardenHeaderStats", () => {
  it("returns an empty array when no garden is selected", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: false,
      gardenerCount: 5,
      impactCount: 2,
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("emits gardeners / impact items in that order (pending work lives on Hub)", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 5,
      impactCount: 2,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["gardeners", "impact"]);
  });

  it("stringifies numeric counts", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 0,
      impactCount: 13,
      formatMessage: makeFormatMessage(),
    });
    expect(items[0]?.value).toBe("0");
    expect(items[1]?.value).toBe("13");
  });

  it("calls formatMessage with the canonical i18n ids and count parameter for plurals", () => {
    const formatMessage = makeFormatMessage();
    buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 1,
      impactCount: 1,
      formatMessage,
    });
    const ids = formatMessage.mock.calls.map((call) => call[0].id);
    expect(ids).toEqual(["cockpit.garden.stats.gardeners", "cockpit.garden.stats.impact"]);
    expect(formatMessage.mock.calls[0]?.[1]).toEqual({ count: 1 });
    expect(formatMessage.mock.calls[1]?.[1]).toEqual({ count: 1 });
  });
});

describe("buildCommunityHeaderStats", () => {
  it("returns an empty array when no garden is selected", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: false,
      vaultNetDeposited: 0n,
      distributedAmount: 0n,
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("emits treasury / distributed items in that order (people + pools live on the tabs)", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      vaultNetDeposited: 0n,
      distributedAmount: 0n,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["treasury", "distributed"]);
  });

  it("formats both token amounts via formatTokenAmount (zero renders as '0')", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      vaultNetDeposited: 0n,
      distributedAmount: 0n,
      formatMessage: makeFormatMessage(),
    });
    expect(items[0]?.value).toBe("0");
    expect(items[1]?.value).toBe("0");
  });

  it("formats non-zero balances with the token's 18 decimal precision (default)", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      vaultNetDeposited: 1_500_000_000_000_000_000n, // 1.5 * 10^18
      distributedAmount: 500_000_000_000_000_000n, // 0.5 * 10^18
      formatMessage: makeFormatMessage(),
    });
    // formatTokenAmount uses the active locale; assert digit + decimal-separator + digit
    expect(items[0]?.value).toMatch(/^1[.,]5$/);
    expect(items[1]?.value).toMatch(/^0[.,]5$/);
  });

  it("calls formatMessage with the canonical i18n ids", () => {
    const formatMessage = makeFormatMessage();
    buildCommunityHeaderStats({
      hasSelectedGarden: true,
      vaultNetDeposited: 0n,
      distributedAmount: 0n,
      formatMessage,
    });
    const ids = formatMessage.mock.calls.map((call) => call[0].id);
    expect(ids).toEqual([
      "cockpit.community.stats.treasury",
      "cockpit.community.stats.distributed",
    ]);
  });
});

describe("buildHubHeaderStats", () => {
  it("returns an empty array when no garden is selected", () => {
    const items = buildHubHeaderStats({
      hasSelectedGarden: false,
      overdueCount: 3,
      waitingCount: 1,
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("emits overdue / waiting aging counts in order (stage depth lives on the tabs)", () => {
    const items = buildHubHeaderStats({
      hasSelectedGarden: true,
      overdueCount: 3,
      waitingCount: 1,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["overdue", "waiting"]);
    expect(items.map((item) => item.value)).toEqual(["3", "1"]);
  });

  it("calls formatMessage with the canonical i18n ids", () => {
    const formatMessage = makeFormatMessage();
    buildHubHeaderStats({
      hasSelectedGarden: true,
      overdueCount: 0,
      waitingCount: 0,
      formatMessage,
    });
    expect(formatMessage.mock.calls.map((call) => call[0].id)).toEqual([
      "cockpit.hub.stats.overdue",
      "cockpit.hub.stats.waiting",
    ]);
  });
});

describe("buildActionsHeaderStats", () => {
  it("emits registry-level total / domains items (additive vs the lifecycle tabs)", () => {
    const items = buildActionsHeaderStats({
      totalCount: 12,
      domainsCovered: 3,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["total", "domains"]);
    expect(items.map((item) => item.value)).toEqual(["12", "3"]);
  });

  it("passes the count parameter through for pluralization", () => {
    const formatMessage = makeFormatMessage();
    buildActionsHeaderStats({ totalCount: 1, domainsCovered: 4, formatMessage });
    expect(formatMessage.mock.calls.map((call) => call[0].id)).toEqual([
      "cockpit.actions.stats.total",
      "cockpit.actions.stats.domains",
    ]);
    expect(formatMessage.mock.calls[0]?.[1]).toEqual({ count: 1 });
    expect(formatMessage.mock.calls[1]?.[1]).toEqual({ count: 4 });
  });
});
