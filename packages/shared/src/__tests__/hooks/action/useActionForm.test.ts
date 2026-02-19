/**
 * Action Form Schema Tests
 *
 * Tests the createActionSchema Zod validation for creating actions.
 * Covers required fields, nested instruction config, and edge cases.
 */

import { describe, expect, it } from "vitest";
import { createActionSchema, type CreateActionFormData } from "../../../hooks/action/useActionForm";

// ============================================
// Helper
// ============================================

function createValidFormData(
  overrides: Partial<CreateActionFormData> = {}
): Record<string, unknown> {
  return {
    title: "Plant Trees",
    startTime: new Date("2025-01-01"),
    endTime: new Date("2025-12-31"),
    capitals: [1, 2],
    media: [new File(["content"], "photo.jpg", { type: "image/jpeg" })],
    instructionConfig: {
      description: "Plant native trees in the garden area",
      uiConfig: {
        media: {
          title: "Upload Photos",
          description: "Take photos of planted trees",
          maxImageCount: 5,
          minImageCount: 1,
          required: true,
          needed: ["before", "after"],
          optional: ["during"],
        },
        details: {
          title: "Details",
          description: "Provide planting details",
          feedbackPlaceholder: "How did it go?",
          inputs: [
            {
              id: "species",
              type: "text",
              label: "Tree species",
            },
          ],
        },
        review: {
          title: "Review",
          description: "Review your submission before sending",
        },
      },
    },
    ...overrides,
  };
}

// ============================================
// Test Suite
// ============================================

describe("createActionSchema", () => {
  describe("valid data", () => {
    it("accepts a fully valid form", () => {
      const result = createActionSchema.safeParse(createValidFormData());
      expect(result.success).toBe(true);
    });

    it("coerces string dates", () => {
      const data = createValidFormData({
        startTime: "2025-01-01" as unknown as Date,
        endTime: "2025-12-31" as unknown as Date,
      });
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("title validation", () => {
    it("rejects empty title", () => {
      const data = createValidFormData({ title: "" });
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Title is required");
      }
    });

    it("rejects missing title", () => {
      const data = createValidFormData();
      delete (data as Record<string, unknown>).title;
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("capitals validation", () => {
    it("rejects empty capitals array", () => {
      const data = createValidFormData({ capitals: [] });
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const capitalIssue = result.error.issues.find((i) => i.path.includes("capitals"));
        expect(capitalIssue?.message).toBe("Select at least one capital");
      }
    });

    it("accepts multiple capitals", () => {
      const data = createValidFormData({ capitals: [1, 2, 3] });
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("media validation", () => {
    it("rejects empty media array", () => {
      const data = createValidFormData({ media: [] });
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const mediaIssue = result.error.issues.find((i) => i.path.includes("media"));
        expect(mediaIssue?.message).toBe("At least one image required");
      }
    });

    it("accepts multiple media files", () => {
      const files = [
        new File(["a"], "photo1.jpg", { type: "image/jpeg" }),
        new File(["b"], "photo2.jpg", { type: "image/jpeg" }),
      ];
      const data = createValidFormData({ media: files });
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("instructionConfig validation", () => {
    it("rejects missing instruction config", () => {
      const data = createValidFormData();
      delete (data as Record<string, unknown>).instructionConfig;
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("validates nested media config", () => {
      const data = createValidFormData();
      const config = data.instructionConfig as Record<string, unknown>;
      const uiConfig = config.uiConfig as Record<string, unknown>;
      delete uiConfig.media;
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("accepts optional input fields", () => {
      const data = createValidFormData();
      const config = data.instructionConfig as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      config.uiConfig.details.inputs = [
        {
          id: "species",
          type: "text",
          label: "Tree species",
          placeholder: "e.g., Oak",
          required: true,
        },
      ];
      const result = createActionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("type inference", () => {
    it("inferred type matches CreateActionFormData", () => {
      const data = createValidFormData();
      const result = createActionSchema.safeParse(data);
      if (result.success) {
        const formData: CreateActionFormData = result.data;
        expect(formData.title).toBe("Plant Trees");
        expect(formData.capitals).toEqual([1, 2]);
        expect(formData.instructionConfig.description).toBe(
          "Plant native trees in the garden area"
        );
      }
    });
  });
});
