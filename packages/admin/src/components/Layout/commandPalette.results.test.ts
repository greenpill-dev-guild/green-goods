import {
  buildCommandPaletteResults,
  groupCommandPaletteResults,
  type Garden,
  type GardenAssessment,
} from "@green-goods/shared";
import type { IntlShape } from "react-intl";
import { describe, expect, it, vi } from "vitest";

const formatMessage = ((descriptor: { defaultMessage?: string; id: string }) =>
  descriptor.defaultMessage ?? descriptor.id) as IntlShape["formatMessage"];

const eligibleGarden = {
  id: "garden-1",
  name: "Chakra Farm",
  location: "Quito",
  tokenAddress: "0x0000000000000000000000000000000000000aaa",
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
});
