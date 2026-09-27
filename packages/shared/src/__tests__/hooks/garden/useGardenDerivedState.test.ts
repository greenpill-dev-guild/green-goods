import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGardenDerivedState } from "../../../hooks/garden/useGardenDerivedState";
import type { CookieJar } from "../../../types/cookie-jar";

const roleMembers = {
  owner: [],
  steward: [],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

describe("useGardenDerivedState", () => {
  function renderDerivedState({
    domainMask,
    openSection = vi.fn(),
    cookieJars = [],
    canAccessCommunity = true,
    allocations = [],
    hasEndowment = true,
    works,
    worksComplete,
    gardenReviewQueue,
    members = roleMembers,
  }: {
    domainMask?: number;
    openSection?: Parameters<typeof useGardenDerivedState>[0]["openSection"];
    cookieJars?: CookieJar[];
    canAccessCommunity?: boolean;
    allocations?: Array<{
      txHash: string;
      timestamp: number;
      cookieJarAmount: bigint;
      fractionsAmount: bigint;
      juiceboxAmount: bigint;
    }>;
    hasEndowment?: boolean;
    works?: Parameters<typeof useGardenDerivedState>[0]["works"];
    worksComplete?: boolean;
    gardenReviewQueue?: Parameters<typeof useGardenDerivedState>[0]["gardenReviewQueue"];
    members?: Parameters<typeof useGardenDerivedState>[0]["roleMembers"];
  } = {}) {
    const now = Date.now();

    return renderHook(() =>
      useGardenDerivedState({
        garden: {
          id: "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12",
          domainMask,
          name: "No Domain Garden",
          chainId: 11155111,
        },
        works: works ?? [
          {
            id: "approved-work",
            title: "Recent approved work",
            status: "approved",
            createdAt: now,
          },
        ],
        worksComplete,
        gardenReviewQueue,
        assessments: [],
        hypercerts: [],
        allocations,
        gardenVaults: [{}],
        hasEndowment,
        roleMembers: members,
        selectedRange: "30d",
        activityFilter: "all",
        memberSearch: "",
        section: undefined,
        canAccessCommunity,
        cookieJars,
        formatMessage: ({ id }, values) => (values ? `${id} ${JSON.stringify(values)}` : id),
        openSection,
      })
    );
  }

  // Sepolia DAI, so the claim-limit rule knows the asset.
  const daiJar = (overrides: Partial<CookieJar>): CookieJar => ({
    jarAddress: "0x7A3d0000000000000000000000000000000041C2",
    gardenAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    assetAddress: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
    currency: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
    balance: 998n * 10n ** 16n,
    decimals: 18,
    maxWithdrawal: 10n ** 16n,
    withdrawalInterval: 86400n,
    minDeposit: 0n,
    isPaused: false,
    emergencyWithdrawalEnabled: true,
    ...overrides,
  });

  it("surfaces a recovery alert when a garden has no action domains", () => {
    const openSection = vi.fn();
    const { result } = renderDerivedState({ domainMask: 0, openSection });

    expect(result.current.overviewBadge).toEqual({ severity: "warn", count: 1 });
    expect(result.current.tabBadges.overview).toEqual({ severity: "warn", count: 1 });
    expect(result.current.gardenHealthSeverity).toBe("warn");
    expect(result.current.gardenHealthLabel).toBe("app.garden.detail.health.status.attention");
    expect(result.current.overviewAlerts).toHaveLength(1);
    expect(result.current.overviewAlerts[0]).toMatchObject({
      key: "domain-empty",
      severity: "warn",
      label: "app.garden.detail.alert.noDomains",
    });

    result.current.overviewAlerts[0].onAction();

    expect(openSection).toHaveBeenCalledWith("overview", "health");
  });

  it("raises a critical alert for a funded jar whose claim limit is low, and opens its editor", () => {
    const openSection = vi.fn();
    const jar = daiJar({});
    const { result } = renderDerivedState({ openSection, cookieJars: [jar] });

    expect(result.current.overviewAlerts).toHaveLength(1);
    const [alert] = result.current.overviewAlerts;
    expect(alert).toMatchObject({
      key: `jar-limit-low-${jar.jarAddress.toLowerCase()}`,
      severity: "critical",
      label: 'app.garden.detail.alert.jarLimitLow {"asset":"DAI","limit":"0.01"}',
      description: 'app.garden.detail.alert.jarLimitLowFunded {"asset":"DAI","balance":"9.98"}',
    });

    alert.onAction();

    expect(openSection).toHaveBeenCalledWith("community", "payouts", `jar-limit-${jar.jarAddress}`);
  });

  it("only warns while the low-limit jar is empty, and clears once the limit is raised", () => {
    const empty = renderDerivedState({ cookieJars: [daiJar({ balance: 0n })] });
    expect(empty.result.current.overviewAlerts[0]).toMatchObject({
      severity: "warn",
      description: "app.garden.detail.alert.jarLimitLowEmpty",
    });

    const raised = renderDerivedState({
      cookieJars: [daiJar({ maxWithdrawal: 10n * 10n ** 18n })],
    });
    expect(raised.result.current.overviewAlerts).toEqual([]);
  });

  it("keeps community activity visible without unreachable links or alerts when Community is denied", () => {
    const allocation = {
      txHash: "0xallocation",
      timestamp: Date.now(),
      cookieJarAmount: 1n,
      fractionsAmount: 0n,
      juiceboxAmount: 0n,
    };
    // An empty vault and a low-limit jar: both alerts open Community.
    const communitySignals = {
      cookieJars: [daiJar({})],
      allocations: [allocation],
      hasEndowment: false,
    };
    const { result } = renderDerivedState({ ...communitySignals, canAccessCommunity: false });

    expect(result.current.overviewAlerts).toEqual([]);
    // No status may point at an alert the viewer cannot see.
    expect(result.current.gardenHealthSeverity).toBe("none");
    expect(result.current.overviewBadge).toEqual({ severity: "none" });
    expect(result.current.tabBadges.community).toEqual({ severity: "none" });
    expect(
      result.current.activityEvents.find((event) => event.category === "community")
    ).toMatchObject({
      id: "allocation-0xallocation",
      href: undefined,
    });
    expect(
      result.current.activityEvents.find((event) => event.category === "work")?.href
    ).toBeTruthy();

    const permitted = renderDerivedState(communitySignals);
    expect(permitted.result.current.overviewAlerts.map((alert) => alert.key)).toEqual([
      "treasury-critical",
      `jar-limit-low-${daiJar({}).jarAddress.toLowerCase()}`,
    ]);
    expect(permitted.result.current.gardenHealthSeverity).toBe("critical");
    expect(
      permitted.result.current.activityEvents.find((event) => event.category === "community")?.href
    ).toContain("/community/payouts");
  });

  it("reads Critical only when review has stalled, and Needs Attention for work waiting a week", () => {
    const daysAgo = (days: number) => Math.floor((Date.now() - days * 86_400_000) / 1000);
    const waiting = [
      { id: "old", status: "pending", createdAt: daysAgo(10) },
      { id: "new", status: "pending", createdAt: daysAgo(1) },
    ];
    const stalled = renderDerivedState({
      works: [
        ...waiting,
        { id: "done", status: "approved", createdAt: daysAgo(20), reviewedAt: daysAgo(9) },
      ],
    });
    expect(stalled.result.current.gardenHealthSeverity).toBe("critical");
    expect(stalled.result.current.tabBadges.work).toEqual({ severity: "critical", count: 2 });
    expect(stalled.result.current.overviewAlerts[0]).toMatchObject({
      key: "work-critical",
      label: 'app.garden.detail.alert.workCritical {"count":2}',
    });

    const reviewing = renderDerivedState({
      works: [
        ...waiting,
        { id: "done", status: "approved", createdAt: daysAgo(3), reviewedAt: daysAgo(2) },
      ],
    });
    expect(reviewing.result.current.gardenHealthSeverity).toBe("warn");
    expect(reviewing.result.current.overviewAlerts[0]).toMatchObject({
      key: "work-warning",
      label: 'app.garden.detail.alert.workWarning {"count":1}',
    });
  });

  it("reads a garden beyond its newest page from the garden's whole queue", () => {
    const daysAgo = (days: number) => Math.floor((Date.now() - days * 86_400_000) / 1000);
    const page = [{ id: "new", status: "pending", createdAt: daysAgo(1) }];

    const pageOnly = renderDerivedState({ works: page, worksComplete: false });
    expect(pageOnly.result.current.tabBadges.work).toEqual({ severity: "none" });

    const gardenWide = renderDerivedState({
      works: page,
      worksComplete: false,
      gardenReviewQueue: {
        lastReviewedAt: daysAgo(9),
        waiting: [
          { id: "old", submittedAt: daysAgo(40) },
          { id: "new", submittedAt: daysAgo(1) },
        ],
      },
    });
    expect(gardenWide.result.current.tabBadges.work).toEqual({ severity: "critical", count: 2 });
    expect(gardenWide.result.current.overviewAlerts[0]).toMatchObject({
      key: "work-critical",
      label: 'app.garden.detail.alert.workCritical {"count":2}',
    });
  });

  it("does not surface the domain recovery alert while domain state is unknown", () => {
    const { result } = renderDerivedState();

    expect(result.current.overviewBadge).toEqual({ severity: "none" });
    expect(result.current.gardenHealthSeverity).toBe("none");
    expect(result.current.overviewAlerts).toEqual([]);
  });

  it("counts each person once across roles, whatever the address casing", () => {
    const steward = "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12";
    const { result } = renderDerivedState({
      members: {
        ...roleMembers,
        owner: [steward],
        steward: [steward.toLowerCase()],
        gardener: ["0x1111111111111111111111111111111111111111"],
      },
    });

    // Three role seats, two people (DL-049).
    expect(result.current.memberCount).toBe(2);
    expect(result.current.directoryEntries[0]?.roles).toEqual(["owner", "steward"]);
  });
});
