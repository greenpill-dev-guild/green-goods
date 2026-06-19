import {
  buildCommandPaletteResults,
  groupCommandPaletteResults,
  type Action,
  type Garden,
  type GardenAssessment,
} from "@green-goods/shared";
import type { IntlShape } from "react-intl";
import { describe, expect, it, vi } from "vitest";

const formatMessage = ((descriptor: { defaultMessage?: string; id: string }) =>
  descriptor.defaultMessage ?? descriptor.id) as IntlShape["formatMessage"];

const eligibleGarden = {
  id: "0x0000000000000000000000000000000000000aaa",
  name: "Chakra Farm",
  location: "Quito",
  tokenAddress: "0x9990000000000000000000000000000000000999",
} as Garden;

function assessment(id: string, gardenAddress: string, title: string): GardenAssessment {
  return {
    id,
    gardenAddress,
    title,
  } as GardenAssessment;
}

describe("buildCommandPaletteResults", () => {
  it("routes assessment results through the eligible garden context", () => {
    const selectGarden = vi.fn();

    const results = buildCommandPaletteResults({
      query: "soil",
      role: "deployer",
      formatMessage,
      staticRoutes: [],
      eligibleGardens: [eligibleGarden],
      actions: [],
      assessments: [
        assessment("assessment-1", "0x0000000000000000000000000000000000000aaa", "Soil health"),
      ],
      selectGarden,
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: "assessment-assessment-1",
        href: "/garden/impact?gardenAddress=0x0000000000000000000000000000000000000aaa&section=assessments&item=assessment-1",
        subtitle: "Chakra Farm",
      }),
    ]);

    results[0]?.onSelect?.();
    expect(selectGarden).toHaveBeenCalledWith(eligibleGarden);
  });

  it("omits assessments outside the eligible admin garden set", () => {
    const results = buildCommandPaletteResults({
      query: "water",
      role: "deployer",
      formatMessage,
      staticRoutes: [],
      eligibleGardens: [eligibleGarden],
      actions: [],
      assessments: [
        assessment("assessment-2", "0x0000000000000000000000000000000000000bbb", "Water health"),
      ],
      selectGarden: vi.fn(),
    });

    expect(results.some((result) => result.id === "assessment-assessment-2")).toBe(false);
  });

  it("groups results in stable command palette category order", () => {
    const groups = groupCommandPaletteResults(
      [
        { id: "action-1", label: "Action", href: "/actions/1", category: "actions" },
        { id: "page-hub", label: "Hub", href: "/hub/work", category: "pages" },
        {
          id: "garden-1",
          label: "Garden",
          href: "/garden/overview",
          category: "gardens",
        },
      ],
      formatMessage
    );

    expect(groups.map((group) => group.category)).toEqual(["pages", "gardens", "actions"]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ["page-hub"],
      ["garden-1"],
      ["action-1"],
    ]);
  });

  it("hides action records from non-deployer command palettes", () => {
    const results = buildCommandPaletteResults({
      query: "mulch",
      role: "operator",
      formatMessage,
      staticRoutes: [],
      eligibleGardens: [eligibleGarden],
      actions: [{ id: "action-1", title: "Mulch day", startTime: null } as Action],
      assessments: [],
      selectGarden: vi.fn(),
    });

    expect(results.some((result) => result.category === "actions")).toBe(false);
  });

  it("keeps team-only static routes deployer-only", () => {
    const staticRoutes = [
      {
        id: "page-community",
        labelId: "cockpit.nav.community",
        defaultLabel: "Community",
        href: "/community",
      },
      {
        id: "page-cookies",
        labelId: "cockpit.community.cookies.title",
        defaultLabel: "Campaign cookie jars",
        href: "/cookies",
        roles: ["deployer" as const],
      },
      {
        id: "page-actions",
        labelId: "app.admin.nav.actions",
        defaultLabel: "Actions",
        href: "/actions",
        roles: ["deployer" as const],
      },
    ];

    const operatorResults = buildCommandPaletteResults({
      query: "co",
      role: "operator",
      formatMessage,
      staticRoutes,
      eligibleGardens: [],
      actions: [],
      assessments: [],
      selectGarden: vi.fn(),
    });
    const deployerResults = buildCommandPaletteResults({
      query: "cookie",
      role: "deployer",
      formatMessage,
      staticRoutes,
      eligibleGardens: [],
      actions: [],
      assessments: [],
      selectGarden: vi.fn(),
    });

    expect(operatorResults).toEqual([expect.objectContaining({ id: "page-community" })]);
    expect(deployerResults).toEqual([
      expect.objectContaining({ id: "page-cookies", href: "/cookies" }),
    ]);
  });
});
