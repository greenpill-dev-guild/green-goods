/**
 * useAssessmentForm Tests
 *
 * Tests the Zod schema validation and form hook for assessment creation.
 * Covers required fields, cross-field date validation, metrics union schema,
 * and default values.
 */

import { describe, expect, it } from "vitest";

import {
  assessmentFormSchema,
  createDefaultAssessmentFormData,
  type AssessmentFormData,
} from "../../../hooks/assessment/useAssessmentForm";

// ============================================
// Test Helpers
// ============================================

function createValidFormData(overrides: Partial<AssessmentFormData> = {}): AssessmentFormData {
  return {
    title: "Urban Garden Assessment",
    description: "Assessment of conservation work",
    assessmentType: "biodiversity",
    capitals: ["natural"],
    metrics: '{"score": 85}',
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: "2025-01-01",
    endDate: "2025-06-30",
    location: "Portland, OR",
    tags: ["urban"],
    domain: 1,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("assessmentFormSchema", () => {
  // ------------------------------------------
  // Valid inputs
  // ------------------------------------------

  describe("valid inputs", () => {
    it("accepts complete valid form data with string metrics", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData());

      expect(result.success).toBe(true);
    });

    it("accepts object metrics", () => {
      const result = assessmentFormSchema.safeParse(
        createValidFormData({ metrics: { biodiversityScore: 85 } })
      );

      expect(result.success).toBe(true);
    });

    it("accepts numeric epoch ms dates", () => {
      const start = Date.now();
      const end = start + 86400000;
      const result = assessmentFormSchema.safeParse(
        createValidFormData({ startDate: start, endDate: end })
      );

      expect(result.success).toBe(true);
    });

    it("accepts unix seconds (auto-detected via heuristic)", () => {
      // Values < 10 billion are treated as unix seconds
      const startSec = 1700000000;
      const endSec = 1700086400;
      const result = assessmentFormSchema.safeParse(
        createValidFormData({ startDate: startSec, endDate: endSec })
      );

      expect(result.success).toBe(true);
    });

    it("defaults optional arrays to empty", () => {
      const data = createValidFormData();
      delete (data as any).capitals;
      delete (data as any).tags;

      const result = assessmentFormSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capitals).toEqual([]);
        expect(result.data.tags).toEqual([]);
      }
    });

    it("accepts domain values 0-3", () => {
      for (const domain of [0, 1, 2, 3]) {
        const result = assessmentFormSchema.safeParse(createValidFormData({ domain }));
        expect(result.success).toBe(true);
      }
    });
  });

  // ------------------------------------------
  // Required field validation
  // ------------------------------------------

  describe("required fields", () => {
    it("rejects empty title", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ title: "" }));

      expect(result.success).toBe(false);
    });

    it("rejects empty description", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ description: "" }));

      expect(result.success).toBe(false);
    });

    it("rejects empty assessmentType", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ assessmentType: "" }));

      expect(result.success).toBe(false);
    });

    it("rejects empty location", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ location: "" }));

      expect(result.success).toBe(false);
    });

    it("rejects empty string metrics", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ metrics: "" }));

      expect(result.success).toBe(false);
    });

    it("rejects empty object metrics", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ metrics: {} }));

      expect(result.success).toBe(false);
    });
  });

  // ------------------------------------------
  // Date cross-field validation
  // ------------------------------------------

  describe("date validation", () => {
    it("rejects endDate before startDate (string dates)", () => {
      const result = assessmentFormSchema.safeParse(
        createValidFormData({
          startDate: "2025-06-30",
          endDate: "2025-01-01",
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        const endDateIssue = result.error.issues.find((i) => i.path.includes("endDate"));
        expect(endDateIssue?.message).toBe("End date must be after start date");
      }
    });

    it("rejects endDate equal to startDate", () => {
      const result = assessmentFormSchema.safeParse(
        createValidFormData({
          startDate: "2025-01-01",
          endDate: "2025-01-01",
        })
      );

      expect(result.success).toBe(false);
    });

    it("rejects invalid date strings", () => {
      const result = assessmentFormSchema.safeParse(
        createValidFormData({
          startDate: "not-a-date",
          endDate: "2025-06-30",
        })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        const startIssue = result.error.issues.find((i) => i.path.includes("startDate"));
        expect(startIssue?.message).toBe("Start date is invalid");
      }
    });

    it("rejects empty startDate", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ startDate: "" }));

      expect(result.success).toBe(false);
    });

    it("rejects empty endDate", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ endDate: "" }));

      expect(result.success).toBe(false);
    });
  });

  // ------------------------------------------
  // Domain validation
  // ------------------------------------------

  describe("domain field", () => {
    it("rejects domain > 3", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ domain: 4 }));

      expect(result.success).toBe(false);
    });

    it("rejects negative domain", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ domain: -1 }));

      expect(result.success).toBe(false);
    });

    it("allows undefined domain", () => {
      const result = assessmentFormSchema.safeParse(createValidFormData({ domain: undefined }));

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Default values
// ============================================

describe("createDefaultAssessmentFormData", () => {
  it("returns empty form with correct structure", () => {
    const defaults = createDefaultAssessmentFormData();

    expect(defaults.title).toBe("");
    expect(defaults.description).toBe("");
    expect(defaults.assessmentType).toBe("");
    expect(defaults.capitals).toEqual([]);
    expect(defaults.metrics).toBe("");
    expect(defaults.evidenceMedia).toEqual([]);
    expect(defaults.reportDocuments).toEqual([]);
    expect(defaults.impactAttestations).toEqual([]);
    expect(defaults.startDate).toBe("");
    expect(defaults.endDate).toBe("");
    expect(defaults.location).toBe("");
    expect(defaults.tags).toEqual([]);
    expect(defaults.domain).toBeUndefined();
  });
});
