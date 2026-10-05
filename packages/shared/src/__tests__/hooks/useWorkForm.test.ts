/**
 * useWorkForm module tests
 *
 * Validates dynamic Zod schema generation from WorkInput[] config,
 * replacing hardcoded planting fields, and the location consent hook.
 */

import { act, cleanup, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWorkFormSchema,
  normalizeNumberDetail,
  useWorkLocation,
  type WorkFormData,
} from "../../hooks/work/useWorkForm";
import type { WorkInput } from "../../types/domain";
import { instructionTemplates } from "../../utils/action/templates";

function validValueForInput(input: WorkInput): unknown {
  switch (input.type) {
    case "number":
      return 1;
    case "select":
      return input.options[0] ?? "test";
    case "band":
      return input.bands?.[0] ?? input.options[0] ?? "test";
    case "multi-select":
      return [input.options[0] ?? "test"];
    case "repeater":
      return [
        Object.fromEntries(
          (input.repeaterFields ?? []).map((field) => [field.key, validValueForInput(field)])
        ),
      ];
    default:
      return "test";
  }
}

describe("hooks/work/useWorkForm", () => {
  describe("buildWorkFormSchema", () => {
    it("always includes feedback and timeSpentMinutes", () => {
      const schema = buildWorkFormSchema([]);
      const result = schema.safeParse({
        feedback: "test",
        timeSpentMinutes: 1.5, // hours, will be normalized to minutes
      });

      expect(result.success).toBe(true);
    });

    it("converts hour input to minutes exactly once", () => {
      const schema = buildWorkFormSchema([]);
      const result = schema.safeParse({
        feedback: "test",
        timeSpentMinutes: "60",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeSpentMinutes).toBe(3600);
      }
    });

    it("lets time spent stay empty", () => {
      const result = buildWorkFormSchema([]).safeParse({ feedback: "", timeSpentMinutes: "" });

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.timeSpentMinutes).toBeUndefined();
    });

    // What a details form holds for a field the person never filled, in either app.
    const EMPTY_VALUES: Record<WorkInput["type"], unknown[]> = {
      number: [undefined],
      text: [""],
      textarea: [""],
      select: ["", undefined],
      band: ["", undefined],
      "multi-select": [[]],
      repeater: [[], undefined],
    };

    it.each(
      Object.entries(EMPTY_VALUES)
    )("lets an empty optional %s through and holds an empty required one", (type, empties) => {
      const input = (required: boolean): WorkInput => ({
        key: "detail",
        title: "Detail",
        placeholder: "",
        type: type as WorkInput["type"],
        required,
        options: [],
      });

      for (const empty of empties) {
        const values = { feedback: "", detail: empty };
        expect(buildWorkFormSchema([input(false)]).safeParse(values).success).toBe(true);
        expect(buildWorkFormSchema([input(true)]).safeParse(values).success).toBe(false);
      }
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

    it("blocks an empty required repeater", () => {
      const schema = buildWorkFormSchema([
        {
          key: "categoryBreakdown",
          title: "Category Breakdown",
          placeholder: "",
          type: "repeater",
          required: true,
          options: [],
          repeaterFields: [
            {
              key: "category",
              title: "Category",
              placeholder: "",
              type: "select",
              required: true,
              options: ["Plastic"],
            },
          ],
        },
      ]);

      expect(schema.safeParse({ feedback: "", categoryBreakdown: [] }).success).toBe(false);
      expect(
        schema.safeParse({ feedback: "", categoryBreakdown: [{ category: "Plastic" }] }).success
      ).toBe(true);
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

    it("accepts complete values and blocks missing requirements for every action template", () => {
      const actionTemplates = Object.entries(instructionTemplates).filter(
        ([slug]) => slug !== "default"
      );

      expect(actionTemplates).toHaveLength(23);
      for (const [slug, template] of actionTemplates) {
        const inputs = template.uiConfig.details.inputs;
        const schema = buildWorkFormSchema(inputs);
        const completeValues = Object.fromEntries(
          inputs.map((input) => [input.key, validValueForInput(input)])
        );

        expect(
          schema.safeParse({ feedback: "", ...completeValues }).success,
          `${slug} should accept all required details`
        ).toBe(true);

        for (const requiredInput of inputs.filter((input) => input.required)) {
          const incompleteValues = { ...completeValues };
          delete incompleteValues[requiredInput.key];
          expect(
            schema.safeParse({ feedback: "", ...incompleteValues }).success,
            `${slug} should require ${requiredInput.key}`
          ).toBe(false);
        }
      }
    });
  });
  it("retains only rounded, explicitly supplied location coordinates", () => {
    const schema = buildWorkFormSchema([]);
    expect(
      schema.parse({ location: { lat: 12.345678, lng: -23.456789, accuracy: 1 } }).location
    ).toEqual({ lat: 12.346, lng: -23.457 });
    expect(schema.parse({ location: undefined }).location).toBeUndefined();
    expect(schema.safeParse({ location: { lat: 91, lng: 0 } }).success).toBe(false);
  });
});

describe("normalizeNumberDetail", () => {
  it.each([
    ["", undefined],
    [undefined, undefined],
    [null, undefined],
    ["abc", undefined],
    ["12", 12],
    ["1.5", 1.5],
    ["-4", -4],
    [7, 7],
  ])("reads %j as %j", (raw, value) => {
    expect(normalizeNumberDetail(raw)).toBe(value);
  });
});

describe("work location consent", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rounds before entering form state and clears on opt-out", () => {
    let capture!: PositionCallback;
    const getCurrentPosition = vi.fn((callback: PositionCallback) => {
      capture = callback;
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const { result } = renderHook(() => {
      const form = useForm<WorkFormData>();
      return { form, location: useWorkLocation(form.control, form.setValue) };
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    act(() => result.current.location.handleLocationToggle());
    act(() =>
      capture({
        coords: { latitude: 12.345678, longitude: -34.567891, accuracy: 1 },
      } as GeolocationPosition)
    );
    expect(result.current.form.getValues("location")).toEqual({ lat: 12.346, lng: -34.568 });
    act(() => result.current.location.handleLocationToggle());
    expect(result.current.form.getValues("location")).toBeUndefined();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
});
