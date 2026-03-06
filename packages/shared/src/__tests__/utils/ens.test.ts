/**
 * ENS Utility Tests
 *
 * Tests pure slug validation and suggestion functions from utils/blockchain/ens.ts.
 * These mirror the on-chain _validateSlug() rules for instant frontend feedback.
 */

import { describe, expect, it, vi } from "vitest";

// Mock the pimlico config before importing ens utils (they import createPublicClientForChain)
vi.mock("../../config/pimlico", () => ({
  createPublicClientForChain: vi.fn(() => ({
    getEnsName: vi.fn(async () => null),
    getEnsAddress: vi.fn(async () => null),
    getEnsAvatar: vi.fn(async () => null),
  })),
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { suggestSlug, validateSlug } from "../../utils/blockchain/ens";

// ============================================================================
// VALIDATE SLUG
// ============================================================================

describe("validateSlug", () => {
  describe("valid slugs", () => {
    it("accepts lowercase letters", () => {
      expect(validateSlug("alice")).toEqual({ valid: true });
    });

    it("accepts slugs with hyphens", () => {
      expect(validateSlug("my-garden")).toEqual({ valid: true });
    });

    it("accepts slugs with numbers", () => {
      expect(validateSlug("a1b2c3")).toEqual({ valid: true });
    });

    it("accepts minimum length slug (3 chars)", () => {
      expect(validateSlug("abc")).toEqual({ valid: true });
    });

    it("accepts exactly 50 characters (max length)", () => {
      const slug = "a".repeat(50);
      expect(validateSlug(slug)).toEqual({ valid: true });
    });

    it("accepts mixed letters, numbers, and hyphens", () => {
      expect(validateSlug("green-goods-42")).toEqual({ valid: true });
    });
  });

  describe("invalid slugs — length", () => {
    it("rejects too short (1 char)", () => {
      const result = validateSlug("a");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Too short");
    });

    it("rejects too short (2 chars)", () => {
      const result = validateSlug("ab");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Too short");
    });

    it("rejects too long (51 chars)", () => {
      const slug = "a".repeat(51);
      const result = validateSlug(slug);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Too long");
    });
  });

  describe("invalid slugs — hyphen placement", () => {
    it("rejects leading hyphen", () => {
      const result = validateSlug("-alice");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cannot start or end with hyphen");
    });

    it("rejects trailing hyphen", () => {
      const result = validateSlug("alice-");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cannot start or end with hyphen");
    });

    it("rejects consecutive hyphens", () => {
      const result = validateSlug("my--garden");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No consecutive hyphens");
    });
  });

  describe("invalid slugs — character set", () => {
    it("rejects uppercase letters", () => {
      const result = validateSlug("Alice");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only lowercase");
    });

    it("rejects spaces", () => {
      const result = validateSlug("my garden");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only lowercase");
    });

    it("rejects dots", () => {
      const result = validateSlug("my.garden");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only lowercase");
    });

    it("rejects underscores", () => {
      const result = validateSlug("my_garden");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only lowercase");
    });

    it("rejects special characters", () => {
      const result = validateSlug("alice@eth");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Only lowercase");
    });
  });

  describe("edge cases", () => {
    it("rejects empty string", () => {
      const result = validateSlug("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Too short");
    });

    it("rejects string of only hyphens", () => {
      const result = validateSlug("---");
      expect(result.valid).toBe(false);
      // Should fail on leading/trailing hyphen check
      expect(result.error).toBeDefined();
    });
  });
});

// ============================================================================
// SUGGEST SLUG
// ============================================================================

describe("suggestSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(suggestSlug("Alice Smith")).toBe("alice-smith");
  });

  it("strips special characters", () => {
    expect(suggestSlug("My Garden!!")).toBe("my-garden");
  });

  it("collapses leading/trailing hyphens", () => {
    expect(suggestSlug("---test---")).toBe("test");
  });

  it("lowercases uppercase names", () => {
    expect(suggestSlug("UPPERCASE")).toBe("uppercase");
  });

  it("truncates to 50 characters", () => {
    const longName = "a".repeat(60);
    const result = suggestSlug(longName);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("collapses consecutive hyphens from replaced chars", () => {
    expect(suggestSlug("hello   world")).toBe("hello-world");
  });

  it("handles numeric-only input", () => {
    expect(suggestSlug("12345")).toBe("12345");
  });

  it("handles empty string", () => {
    expect(suggestSlug("")).toBe("");
  });

  it("replaces dots and underscores with hyphens", () => {
    expect(suggestSlug("my.garden_project")).toBe("my-garden-project");
  });

  it("produces a valid slug from a typical display name", () => {
    const slug = suggestSlug("Green Goods Community Garden #1");
    const validation = validateSlug(slug);
    expect(validation.valid).toBe(true);
  });
});
