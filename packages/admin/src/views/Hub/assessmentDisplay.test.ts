import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import { assessmentDomainLabelId, formatReportingPeriod } from "./assessmentDisplay";

// A reader west of UTC, set on the formatter so the test does not depend on the
// zone of the machine running it.
const intl = createIntl({ locale: "en", timeZone: "America/Sao_Paulo", messages: {} });

// Create Assessment stores each end of the period as UTC midnight of the day
// the author picked.
const JUL_1_2026 = Date.UTC(2026, 6, 1) / 1000;
const SEP_30_2026 = Date.UTC(2026, 8, 30) / 1000;

describe("assessmentDisplay", () => {
  it("reads the reporting period as the days the author picked, whatever zone the reader is in", () => {
    // Read in the reader's own zone, the period would say Jun 30 – Sep 29.
    expect(formatReportingPeriod(intl, JUL_1_2026, SEP_30_2026)).toMatch(
      /^Jul 1\s–\sSep 30, 2026$/u
    );
  });

  it("accepts the period in milliseconds as well as seconds", () => {
    expect(formatReportingPeriod(intl, JUL_1_2026 * 1000, SEP_30_2026 * 1000)).toMatch(
      /^Jul 1\s–\sSep 30, 2026$/u
    );
  });

  it.each([
    { label: "no start", start: null, end: SEP_30_2026 },
    { label: "no end", start: JUL_1_2026, end: undefined },
    { label: "a zero start", start: 0, end: SEP_30_2026 },
  ])("reads a period with $label as not set", ({ start, end }) => {
    expect(formatReportingPeriod(intl, start, end)).toBeNull();
  });

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
