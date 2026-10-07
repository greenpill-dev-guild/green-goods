/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { useWorkSubmissionPresentationModel } from "../../../hooks/client-ui/work/useWorkSubmissionPresentationModel";
import { createIntlWrapper } from "../../test-utils/render-helpers";
import { createMockGarden } from "../../test-utils/mock-factories";

vi.mock("../../../hooks/translation/useActionTranslation", () => ({
  useActionTranslation: (action: unknown) => ({ translatedAction: action }),
}));
vi.mock("../../../hooks/translation/useGardenTranslation", () => ({
  useGardenTranslation: (garden: unknown) => ({ translatedGarden: garden }),
}));

const address = "0x5eed000000000000000000000000000000000001";
const garden = createMockGarden({ id: address, name: "East beds" });

describe("work review garden identity", () => {
  it.each([
    { name: "unchanged address", selected: address, gardens: [garden], joinable: null },
    {
      name: "checksummed link address",
      selected: getAddress(address),
      gardens: [garden],
      joinable: null,
    },
    {
      name: "checksummed community garden",
      selected: address,
      gardens: [],
      joinable: { ...garden, id: getAddress(address) },
    },
  ])("keeps the garden name for $name", ({ selected, gardens, joinable }) => {
    const { result } = renderHook(
      () =>
        useWorkSubmissionPresentationModel({
          actions: [],
          gardens,
          joinableCommunityGarden: joinable,
          actionUID: null,
          gardenAddress: selected,
          selectedDomain: null,
        }),
      { wrapper: createIntlWrapper() }
    );
    expect(result.current.reviewData.garden.name).toBe("East beds");
    expect(result.current.reviewData.garden.id).toBe((gardens[0] ?? joinable)?.id);
  });

  it("does not substitute a different garden when the selected one is unavailable", () => {
    const { result } = renderHook(
      () =>
        useWorkSubmissionPresentationModel({
          actions: [],
          gardens: [garden],
          joinableCommunityGarden: garden,
          actionUID: null,
          gardenAddress: "0x1111111111111111111111111111111111111111",
          selectedDomain: null,
        }),
      { wrapper: createIntlWrapper() }
    );
    expect(result.current.reviewData.garden.name).toBe("Unknown garden");
    expect(result.current.reviewData.garden.id).toBe("0x1111111111111111111111111111111111111111");
  });
});
