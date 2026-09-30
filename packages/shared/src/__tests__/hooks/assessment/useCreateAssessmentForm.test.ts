import { describe, expect, it } from "vitest";

import {
  createAssessmentFormSchema,
  createDefaultAssessmentForm,
} from "../../../hooks/assessment/useCreateAssessmentForm";
import { CynefinPhase, Domain, type SmartOutcome } from "../../../types/domain";

function createValidFormData(
  overrides: { smartOutcomes?: SmartOutcome[]; domain?: Domain | null } = {}
) {
  return {
    title: "Kigali Community Solar",
    description: "Assessment of phase two deployment",
    location: "Kigali, Rwanda",
    diagnosis: "Households need reliable renewable power for evening work.",
    smartOutcomes: [
      { description: "Generate clean power", metric: "kwhGenerated", target: 500 },
      { description: "Install panels", metric: "panelsInstalled", target: 50 },
    ],
    cynefinPhase: CynefinPhase.COMPLICATED,
    domain: Domain.SOLAR,
    selectedActionUIDs: ["action-1"],
    sdgTargets: [7],
    reportingPeriodStart: "2026-01-01",
    reportingPeriodEnd: "2026-03-31",
    attachments: [],
    ...overrides,
  };
}

describe("createAssessmentFormSchema", () => {
  it("starts with no domain chosen, and still requires one", () => {
    expect(createDefaultAssessmentForm().domain).toBeNull();

    const result = createAssessmentFormSchema.safeParse(createValidFormData({ domain: null }));

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["domain"]);
  });

  it("accepts different metrics within one assessment", () => {
    const result = createAssessmentFormSchema.safeParse(createValidFormData());

    expect(result.success).toBe(true);
  });

  it("rejects repeated metrics within one assessment", () => {
    const result = createAssessmentFormSchema.safeParse(
      createValidFormData({
        smartOutcomes: [
          { description: "Generate clean power", metric: "kwhGenerated", target: 500 },
          { description: "Raise production baseline", metric: "kwhGenerated", target: 650 },
        ],
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Each metric can only be used once per assessment",
            path: ["smartOutcomes", 0, "metric"],
          }),
          expect.objectContaining({
            message: "Each metric can only be used once per assessment",
            path: ["smartOutcomes", 1, "metric"],
          }),
        ])
      );
    }
  });
});
