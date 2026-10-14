import { describe, expect, it } from "vitest";
import { assessmentDomainLabelId } from "./assessmentDisplay";

describe("assessmentDisplay", () => {
  it.each([
    { domain: 1, labelId: "app.domain.tab.agro" },
    { domain: 3, labelId: "app.domain.tab.waste" },
    // A value outside the known domains names no domain rather than a wrong one.
    { domain: 9, labelId: null },
    { domain: null, labelId: null },
  ])("names domain $domain as $labelId", ({ domain, labelId }) => {
    expect(assessmentDomainLabelId(domain)).toBe(labelId);
  });
});
