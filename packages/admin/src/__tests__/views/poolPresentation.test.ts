import { describe, expect, it } from "vitest";
import {
  directionEdgeClass,
  formatGoodDollarsCompact,
  formatUsdSummary,
} from "@/views/Garden/Pool/poolPresentation";

describe("poolPresentation", () => {
  it("edges an offer in the primary tone and a request in the information tone", () => {
    expect(directionEdgeClass("OFFER")).toContain("border-s-primary-base");
    expect(directionEdgeClass("REQUEST")).toContain("border-s-information-base");
    expect(directionEdgeClass("OFFER")).toContain("border-s-[3px]");
  });

  it("rounds a summary figure to whole dollars from $100 and shortens G$ beside it", () => {
    // Read at today's rate, cents on a large figure claim a precision it doesn't have.
    expect(formatUsdSummary(123_992n, "en")).toBe("$1,240");
    expect(formatUsdSummary(9_999n, "en")).toBe("$99.99");
    expect(formatGoodDollarsCompact(9_638_100n * 10n ** 18n, "en")).toBe("9.6M");
  });
});
