/**
 * useCreateGardenForm Tests
 *
 * Tests the Zod schema for garden creation including slug validation
 * (mirrors on-chain _validateSlug), address validation, wizard step
 * field mapping, and default values.
 */

import { describe, expect, it } from "vitest";

import {
  createGardenSchema,
  gardenStepFields,
  createDefaultGardenForm,
  type CreateGardenFormData,
} from "../../../hooks/garden/useCreateGardenForm";
import { Domain } from "../../../types/domain";

// ============================================
// Test Helpers
// ============================================

const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";

function createValidForm(overrides: Partial<CreateGardenFormData> = {}): CreateGardenFormData {
  return {
    name: "Urban Garden Portland",
    slug: "urban-garden-pdx",
    description: "A community garden in Portland",
    location: "Portland, Oregon",
    bannerImage: "",
    metadata: "",
    openJoining: false,
    domains: [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE],
    gardeners: [VALID_ADDRESS],
    operators: [VALID_ADDRESS_2],
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("createGardenSchema", () => {
  // ------------------------------------------
  // Valid inputs
  // ------------------------------------------

  describe("valid inputs", () => {
    it("accepts complete valid form data", () => {
      const result = createGardenSchema.safeParse(createValidForm());

      expect(result.success).toBe(true);
    });

    it("accepts openJoining as true", () => {
      const result = createGardenSchema.safeParse(createValidForm({ openJoining: true }));

      expect(result.success).toBe(true);
    });

    it("accepts multiple gardeners and operators", () => {
      const result = createGardenSchema.safeParse(
        createValidForm({
          gardeners: [VALID_ADDRESS, VALID_ADDRESS_2],
          operators: [VALID_ADDRESS],
        })
      );

      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // Required field validation
  // ------------------------------------------

  describe("required fields", () => {
    it("rejects empty name", () => {
      const result = createGardenSchema.safeParse(createValidForm({ name: "" }));
      expect(result.success).toBe(false);
    });

    it("rejects empty description", () => {
      const result = createGardenSchema.safeParse(createValidForm({ description: "" }));
      expect(result.success).toBe(false);
    });

    it("rejects empty location", () => {
      const result = createGardenSchema.safeParse(createValidForm({ location: "" }));
      expect(result.success).toBe(false);
    });

    it("accepts empty gardeners array", () => {
      const result = createGardenSchema.safeParse(createValidForm({ gardeners: [] }));
      expect(result.success).toBe(true);
    });

    it("accepts empty operators array", () => {
      const result = createGardenSchema.safeParse(createValidForm({ operators: [] }));
      expect(result.success).toBe(true);
    });

    it("rejects empty domains array", () => {
      const result = createGardenSchema.safeParse(createValidForm({ domains: [] }));
      expect(result.success).toBe(false);
    });
  });

  // ------------------------------------------
  // Slug validation (mirrors _validateSlug)
  // ------------------------------------------

  describe("slug validation", () => {
    it("accepts valid lowercase slug with hyphens", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "my-garden" }));
      expect(result.success).toBe(true);
    });

    it("accepts numeric slug", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "garden123" }));
      expect(result.success).toBe(true);
    });

    it("rejects slug shorter than 3 characters", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "ab" }));
      expect(result.success).toBe(false);
    });

    it("rejects slug longer than 50 characters", () => {
      const longSlug = "a".repeat(51);
      const result = createGardenSchema.safeParse(createValidForm({ slug: longSlug }));
      expect(result.success).toBe(false);
    });

    it("rejects uppercase characters", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "My-Garden" }));
      expect(result.success).toBe(false);
    });

    it("rejects spaces", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "my garden" }));
      expect(result.success).toBe(false);
    });

    it("rejects slug starting with hyphen", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "-my-garden" }));
      expect(result.success).toBe(false);
    });

    it("rejects slug ending with hyphen", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "my-garden-" }));
      expect(result.success).toBe(false);
    });

    it("rejects consecutive hyphens", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "my--garden" }));
      expect(result.success).toBe(false);
    });

    it("rejects special characters", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "my_garden" }));
      expect(result.success).toBe(false);
    });

    it("accepts minimum length slug (3 chars)", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "abc" }));
      expect(result.success).toBe(true);
    });

    it("accepts maximum length slug (50 chars)", () => {
      const result = createGardenSchema.safeParse(createValidForm({ slug: "a".repeat(50) }));
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------
  // Address validation
  // ------------------------------------------

  describe("address validation", () => {
    it("rejects non-hex address", () => {
      const result = createGardenSchema.safeParse(
        createValidForm({ gardeners: ["not-an-address"] })
      );
      expect(result.success).toBe(false);
    });

    it("rejects address without 0x prefix", () => {
      const result = createGardenSchema.safeParse(
        createValidForm({ gardeners: ["1234567890123456789012345678901234567890"] })
      );
      expect(result.success).toBe(false);
    });

    it("rejects address that is too short", () => {
      const result = createGardenSchema.safeParse(createValidForm({ gardeners: ["0x1234"] }));
      expect(result.success).toBe(false);
    });

    it("rejects address that is too long", () => {
      const result = createGardenSchema.safeParse(
        createValidForm({ gardeners: ["0x12345678901234567890123456789012345678901"] })
      );
      expect(result.success).toBe(false);
    });

    it("accepts mixed-case hex address", () => {
      const result = createGardenSchema.safeParse(
        createValidForm({ gardeners: [VALID_ADDRESS_2] })
      );
      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Step field mapping
// ============================================

describe("gardenStepFields", () => {
  it("details step validates name, slug, description, location, bannerImage, domains", () => {
    expect(gardenStepFields.details).toEqual([
      "name",
      "slug",
      "description",
      "location",
      "bannerImage",
      "domains",
    ]);
  });

  it("team step validates gardeners, operators, openJoining", () => {
    expect(gardenStepFields.team).toEqual(["gardeners", "operators", "openJoining"]);
  });

  it("review step has no fields to validate", () => {
    expect(gardenStepFields.review).toEqual([]);
  });
});

// ============================================
// Default values
// ============================================

describe("createDefaultGardenForm", () => {
  it("returns empty form with correct structure", () => {
    const defaults = createDefaultGardenForm();

    expect(defaults.name).toBe("");
    expect(defaults.slug).toBe("");
    expect(defaults.description).toBe("");
    expect(defaults.location).toBe("");
    expect(defaults.bannerImage).toBe("");
    expect(defaults.metadata).toBe("");
    expect(defaults.openJoining).toBe(false);
    expect(defaults.domains).toEqual([Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE]);
    expect(defaults.gardeners).toEqual([]);
    expect(defaults.operators).toEqual([]);
  });
});
