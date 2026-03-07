/**
 * useWorkForm + buildWorkFormSchema Tests
 *
 * Validates dynamic Zod schema generation from WorkInput[] config,
 * replacing hardcoded planting fields.
 */

import { describe, expect, it } from "vitest";

import { buildWorkFormSchema } from "../../hooks/work/useWorkForm";
import type { WorkInput } from "../../types/domain";

describe("hooks/work/useWorkForm", () => {
  describe("buildWorkFormSchema", () => {
    it("always includes feedback and timeSpentMinutes", () => {
      const schema = buildWorkFormSchema([]);
      const result = schema.safeParse({
        feedback: "test",
        timeSpentMinutes: "1.5", // hours, will be normalized to minutes
      });

      expect(result.success).toBe(true);
    });

    it("normalizes hour strings to minutes exactly once", () => {
      const schema = buildWorkFormSchema([]);
      const result = schema.parse({
        feedback: "test",
        timeSpentMinutes: "1.5",
      });

      expect(result.timeSpentMinutes).toBe(90);
    });

    it("validates required number fields", () => {
      const inputs: WorkInput[] = [
        {
          key: "participantsCount",
          title: "Participants",
          placeholder: "0",
          type: "number",
          required: true,
          options: [],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      // Missing required field should fail
      const fail = schema.safeParse({ feedback: "", timeSpentMinutes: 1 });
      expect(fail.success).toBe(false);

      // With valid number should pass
      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        participantsCount: 12,
      });
      expect(pass.success).toBe(true);
    });

    it("validates optional number fields", () => {
      const inputs: WorkInput[] = [
        {
          key: "yieldKg",
          title: "Yield (kg)",
          placeholder: "0",
          type: "number",
          required: false,
          options: [],
          unit: "kg",
        },
      ];

      const schema = buildWorkFormSchema(inputs);
      const result = schema.safeParse({ feedback: "", timeSpentMinutes: 1 });
      expect(result.success).toBe(true);
    });

    it("validates required select fields", () => {
      const inputs: WorkInput[] = [
        {
          key: "milestoneType",
          title: "Milestone Type",
          placeholder: "Select",
          type: "select",
          required: true,
          options: ["solar_kw", "battery_kwh", "internet_mbps"],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      // Empty string should fail
      const fail = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        milestoneType: "",
      });
      expect(fail.success).toBe(false);

      // Valid selection should pass
      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        milestoneType: "solar_kw",
      });
      expect(pass.success).toBe(true);
    });

    it("validates required multi-select fields", () => {
      const inputs: WorkInput[] = [
        {
          key: "speciesTags",
          title: "Species",
          placeholder: "Select species",
          type: "multi-select",
          required: true,
          options: ["oak", "maple", "pine"],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      // Empty array should fail
      const fail = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        speciesTags: [],
      });
      expect(fail.success).toBe(false);

      // Array with values should pass
      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        speciesTags: ["oak", "pine"],
      });
      expect(pass.success).toBe(true);
    });

    it("validates band fields as select (string)", () => {
      const inputs: WorkInput[] = [
        {
          key: "siteSizeBand",
          title: "Site Size",
          placeholder: "Select range",
          type: "band",
          required: true,
          options: [],
          bands: ["small", "medium", "large"],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      const fail = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        siteSizeBand: "",
      });
      expect(fail.success).toBe(false);

      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        siteSizeBand: "medium",
      });
      expect(pass.success).toBe(true);
    });

    it("validates text and textarea fields", () => {
      const inputs: WorkInput[] = [
        {
          key: "notes",
          title: "Notes",
          placeholder: "Enter notes",
          type: "textarea",
          required: true,
          options: [],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      const fail = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        notes: "",
      });
      expect(fail.success).toBe(false);

      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        notes: "Some useful notes",
      });
      expect(pass.success).toBe(true);
    });

    it("validates repeater fields as arrays of objects", () => {
      const inputs: WorkInput[] = [
        {
          key: "categoryBreakdown",
          title: "Category Breakdown",
          placeholder: "",
          type: "repeater",
          required: false,
          options: [],
          repeaterFields: [
            {
              key: "category",
              title: "Category",
              placeholder: "Select",
              type: "select",
              required: true,
              options: ["plastic", "metal", "organic"],
            },
            {
              key: "amountKg",
              title: "Amount (kg)",
              placeholder: "0",
              type: "number",
              required: true,
              options: [],
            },
          ],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      // Valid repeater data
      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        categoryBreakdown: [
          { category: "plastic", amountKg: 15 },
          { category: "metal", amountKg: 8 },
        ],
      });
      expect(pass.success).toBe(true);
    });

    it("handles mixed required and optional fields", () => {
      const inputs: WorkInput[] = [
        {
          key: "seedlingsPlanted",
          title: "Seedlings",
          placeholder: "0",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "plantingMethod",
          title: "Method",
          placeholder: "Select",
          type: "select",
          required: false,
          options: ["direct", "transplant"],
        },
      ];

      const schema = buildWorkFormSchema(inputs);

      // Only required fields present — should pass
      const pass = schema.safeParse({
        feedback: "",
        timeSpentMinutes: 1,
        seedlingsPlanted: 50,
      });
      expect(pass.success).toBe(true);
    });
  });
});
