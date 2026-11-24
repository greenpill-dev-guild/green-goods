/**
 * Who reviews a garden's work: the check work approval and Home's review duty use, so Your Work's
 * To Review tab shows to the same accounts (DL-149).
 *
 * @vitest-environment happy-dom
 */

import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useReviewerGardenIds } from "../../../hooks/work/useReviewerGardenIds";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

const mocks = vi.hoisted(() => ({ gardens: [] as unknown[] }));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => ACCOUNT }));
vi.mock("../../../modules/data/greengoods", () => ({ getGardens: async () => mocks.gardens }));

describe("useReviewerGardenIds", () => {
  it.each([
    ["a steward", { stewards: [ACCOUNT] }, true],
    ["an owner", { owners: [ACCOUNT] }, true],
    ["an evaluator alone", { evaluators: [ACCOUNT] }, false],
    ["a gardener alone", { gardeners: [ACCOUNT] }, false],
  ])("answers for %s of a garden", async (_role, roster, reviews) => {
    mocks.gardens = [
      {
        id: "garden",
        stewards: [OTHER],
        owners: [OTHER],
        evaluators: [],
        gardeners: [],
        ...roster,
      },
    ];

    const { result } = renderHookWithQueryClient(() => useReviewerGardenIds());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reviewerGardenIds).toEqual(reviews ? ["garden"] : []);
  });
});
