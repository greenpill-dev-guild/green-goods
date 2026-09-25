/**
 * Header-stats helper tests
 *
 * Pin the MetaStrip item shapes shipped by the cleanup A6 stats slot. The
 * helpers are pure data-shapers around `formatMessage`; rendering coverage
 * lives at the view layer (Chrome MCP / data-component selectors) per the
 * cleanup proof_limit policy for visual changes.
 */

import { describe, expect, it, vi } from "vitest";

import { buildActionsHeaderStats } from "../../../hooks/admin-ui/actions/actions.utils";
import {
  buildCommunityHeaderStats,
  selectAllocationSplits,
} from "../../../hooks/admin-ui/community/community.utils";
import { buildGardenHeaderStats } from "../../../hooks/admin-ui/garden/garden.utils";
import { buildHubHeaderStats } from "../../../hooks/admin-ui/hub/hub.utils";

function makeFormatMessage() {
  return vi.fn(
    (
      descriptor: { id: string; defaultMessage?: string },
      _values?: Record<string, string | number | boolean | Date | null | undefined>
    ) => descriptor.id
  );
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

  it("omits impact while hypercerts are still loading", () => {
    const items = buildGardenHeaderStats({
      hasSelectedGarden: true,
      gardenerCount: 5,
      impactCount: null,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["gardeners"]);
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
      endowmentByAsset: [],
      distributedAmounts: [0n],
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("emits treasury / distributed items in that order (people + pools live on the tabs)", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      endowmentByAsset: [],
      distributedAmounts: [0n],
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["treasury", "distributed"]);
  });

  it("renders an empty endowment and no distributions as '0'", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      endowmentByAsset: [],
      distributedAmounts: [0n],
      formatMessage: makeFormatMessage(),
    });
    expect(items[0]?.value).toBe("0");
    expect(items[1]?.value).toBe("0");
  });

  it("names each endowment asset beside its amount", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      endowmentByAsset: [
        {
          asset: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          symbol: "WETH",
          decimals: 18,
          amount: 1_500_000_000_000_000_000n, // 1.5 * 10^18
        },
        {
          asset: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
          symbol: "DAI",
          decimals: 18,
          amount: 12_000_000_000_000_000_000n,
        },
      ],
      distributedAmounts: [500_000_000_000_000_000n], // 0.5 * 10^18
      formatMessage: makeFormatMessage(),
    });
    // formatTokenAmount uses the active locale; assert digit + decimal-separator + digit
    expect(items[0]?.value).toMatch(/^1[.,]5 WETH · 12 DAI$/);
    expect(items[1]?.value).toMatch(/^0[.,]5$/);
  });

  it("calls formatMessage with the canonical i18n ids", () => {
    const formatMessage = makeFormatMessage();
    buildCommunityHeaderStats({
      hasSelectedGarden: true,
      endowmentByAsset: [],
      distributedAmounts: [0n],
      formatMessage,
    });
    const ids = formatMessage.mock.calls.map((call) => call[0].id);
    expect(ids).toEqual([
      "cockpit.community.stats.treasury",
      "cockpit.community.stats.distributed",
    ]);
  });

  it("omits distributed totals when allocations span multiple assets", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      endowmentByAsset: [],
      distributedAmounts: [500_000_000_000_000_000n, 1_000_000n],
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["treasury"]);
  });

  it("omits distributed totals while allocations are still loading", () => {
    const items = buildCommunityHeaderStats({
      hasSelectedGarden: true,
      endowmentByAsset: [],
      distributedAmounts: null,
      formatMessage: makeFormatMessage(),
    });
    expect(items.map((item) => item.id)).toEqual(["treasury"]);
  });
});

describe("selectAllocationSplits", () => {
  it("derives percentages from the most recent allocation", () => {
    expect(
      selectAllocationSplits([
        {
          cookieJarAmount: 1n,
          fractionsAmount: 3n,
          juiceboxAmount: 6n,
        },
        {
          cookieJarAmount: 9n,
          fractionsAmount: 0n,
          juiceboxAmount: 1n,
        },
      ])
    ).toEqual({ cookieJar: 10, fractions: 30, endowment: 60 });
  });

  it("returns null without a positive allocation total", () => {
    expect(selectAllocationSplits([])).toBeNull();
    expect(
      selectAllocationSplits([
        {
          cookieJarAmount: 0n,
          fractionsAmount: 0n,
          juiceboxAmount: 0n,
        },
      ])
    ).toBeNull();
  });
});

describe("buildHubHeaderStats", () => {
  it("returns an empty array when no garden is selected", () => {
    const items = buildHubHeaderStats({
      hasSelectedGarden: false,
      waitingOverWeekCount: 3,
      formatMessage: makeFormatMessage(),
    });
    expect(items).toEqual([]);
  });

  it("counts work waiting over a week in plain ink (stage depth lives on the tabs)", () => {
    const items = buildHubHeaderStats({
      hasSelectedGarden: true,
      waitingOverWeekCount: 3,
      formatMessage: makeFormatMessage(),
    });
    // No valueTone: work age never takes the critical pair.
    expect(items).toEqual([
      { id: "waiting-over-week", value: "3", label: "cockpit.hub.stats.waitingOverWeek" },
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
