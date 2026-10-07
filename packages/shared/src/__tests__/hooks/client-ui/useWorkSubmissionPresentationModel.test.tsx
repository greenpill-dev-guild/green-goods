// TEST-QUALITY: allow-small-test-file - direct presentation proof has no existing subject test; the controller suite adds auth, draft and queue mocks unrelated to address lookup
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { createMockGarden } from "../../test-utils/mock-factories";
import { useWorkSubmissionPresentationModel } from "../../../hooks/client-ui/work/useWorkSubmissionPresentationModel";

vi.mock("../../../hooks/translation/useGardenTranslation", () => ({
  useGardenTranslation: (garden: unknown) => ({ translatedGarden: garden }),
}));
vi.mock("../../../hooks/translation/useActionTranslation", () => ({
  useActionTranslation: (action: unknown) => ({ translatedAction: action }),
}));

const garden = createMockGarden({
  id: getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
  name: "Seedling Garden",
});
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(IntlProvider, { locale: "en", children });

it.each([
  false,
  true,
])("shows the garden for a recovered lowercase address (community fallback: %s)", (community) => {
  const { result } = renderHook(
    () =>
      useWorkSubmissionPresentationModel({
        actions: [],
        gardens: community ? [] : [garden],
        joinableCommunityGarden: community ? garden : null,
        actionUID: 1,
        gardenAddress: garden.id.toLowerCase(),
        selectedDomain: null,
      }),
    { wrapper }
  );
  expect(result.current.reviewData.garden.name).toBe("Seedling Garden");
  expect(result.current.reviewData.garden.id).toBe(garden.id);
});

it("does not substitute another garden when the selection is unavailable", () => {
  const selected = "0x1111111111111111111111111111111111111111";
  const { result } = renderHook(
    () =>
      useWorkSubmissionPresentationModel({
        actions: [],
        gardens: [garden],
        joinableCommunityGarden: garden,
        actionUID: 1,
        gardenAddress: selected,
        selectedDomain: null,
      }),
    { wrapper }
  );
  expect(result.current.reviewData.garden.name).toBe("Unknown garden");
  expect(result.current.reviewData.garden.id).toBe(selected);
});
