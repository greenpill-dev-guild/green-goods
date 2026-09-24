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
    vaultNetDeposited = 1n,
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
    vaultNetDeposited?: bigint;
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
        works: [
          {
            id: "approved-work",
            title: "Recent approved work",
            status: "approved",
            createdAt: now,
          },
        ],
        assessments: [],
        hypercerts: [],
        allocations,
        gardenVaults: [{}],
        vaultNetDeposited,
        roleMembers,
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
      vaultNetDeposited: 0n,
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

  it("does not surface the domain recovery alert while domain state is unknown", () => {
    const { result } = renderDerivedState();

    expect(result.current.overviewBadge).toEqual({ severity: "none" });
    expect(result.current.gardenHealthSeverity).toBe("none");
    expect(result.current.overviewAlerts).toEqual([]);
  });
});
