import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGardenDerivedState } from "../../../hooks/garden/useGardenDerivedState";

const roleMembers = {
  owner: [],
  operator: [],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

describe("useGardenDerivedState", () => {
  function renderDerivedState(domainMask: number | undefined, openSection = vi.fn()) {
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
        allocations: [],
        gardenVaults: [{}],
        vaultNetDeposited: 1n,
        roleMembers,
        selectedRange: "30d",
        activityFilter: "all",
        memberSearch: "",
        section: undefined,
        formatMessage: ({ id }) => id,
        openSection,
      })
    );
  }

  it("surfaces a recovery alert when a garden has no action domains", () => {
    const openSection = vi.fn();
    const { result } = renderDerivedState(0, openSection);

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

  it("does not surface the domain recovery alert while domain state is unknown", () => {
    const { result } = renderDerivedState(undefined);

    expect(result.current.overviewBadge).toEqual({ severity: "none" });
    expect(result.current.gardenHealthSeverity).toBe("none");
    expect(result.current.overviewAlerts).toEqual([]);
  });
});
