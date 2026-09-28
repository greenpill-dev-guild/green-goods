import { describe, expect, it } from "vitest";
import { directionEdgeClass } from "@/views/Garden/Pool/poolPresentation";

describe("poolPresentation", () => {
  it("edges an offer in the primary tone and a request in the information tone", () => {
    expect(directionEdgeClass("OFFER")).toContain("border-s-primary-base");
    expect(directionEdgeClass("REQUEST")).toContain("border-s-information-base");
    expect(directionEdgeClass("OFFER")).toContain("border-s-[3px]");
  });
});
