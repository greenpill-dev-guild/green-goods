import type { Address, Work } from "@green-goods/shared/types/domain";
import { ZERO_ADDRESS } from "@green-goods/shared/utils/blockchain/address";
import { describe, expect, it } from "vitest";
import {
  extractWorkGardenIds,
  resolveWorkNavigation,
} from "../../views/Home/WorkDashboard/workDashboardUtils";

const GARDEN_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;

function createWork(overrides: Partial<Work>): Work {
  return {
    id: "work-1",
    title: "Test work",
    actionUID: 1,
    gardenerAddress: "0x2222222222222222222222222222222222222222" as Address,
    gardenAddress: GARDEN_ADDRESS,
    feedback: "Test feedback",
    metadata: "{}",
    media: [],
    createdAt: 1,
    status: "pending",
    ...overrides,
  };
}

describe("workDashboardUtils", () => {
  it("excludes the zero-address placeholder from garden lookups", () => {
    const works = [
      createWork({ id: "without-garden", gardenAddress: ZERO_ADDRESS }),
      createWork({ id: "with-garden", gardenAddress: GARDEN_ADDRESS }),
    ];

    expect(extractWorkGardenIds(works)).toEqual([GARDEN_ADDRESS]);
  });

  it("does not navigate to the zero-address placeholder", () => {
    const work = createWork({ id: "without-garden", gardenAddress: ZERO_ADDRESS });

    expect(resolveWorkNavigation(work, new Map())).toBeNull();
  });

  it("uses the original work garden when an approval carries the zero-address placeholder", () => {
    const original = createWork({ id: "work-1", gardenAddress: GARDEN_ADDRESS });

    expect(
      resolveWorkNavigation(
        { workUID: original.id, gardenAddress: ZERO_ADDRESS },
        new Map([[original.id, original]])
      )
    ).toEqual({ workId: original.id, gardenId: GARDEN_ADDRESS });
  });
});
