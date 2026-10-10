import { describe, expect, it } from "vitest";

import { selectPublicSurfaceState } from "../../../hooks/public/publicSurfaceState";

describe("selectPublicSurfaceState", () => {
  it.each([
    [{ isLoading: true, isError: true, itemCount: 0 }, "loading"],
    [{ isLoading: false, isError: true, itemCount: 2 }, "error"],
    [{ isLoading: false, isError: false, itemCount: 0 }, "empty"],
    [{ isLoading: false, isError: false, itemCount: 2 }, "ready"],
  ] as const)("maps %o to %s", (input, expected) => {
    expect(selectPublicSurfaceState(input)).toBe(expected);
  });
});
