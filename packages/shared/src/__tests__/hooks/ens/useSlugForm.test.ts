/**
 * useSlugForm Hook Tests
 *
 * Tests Zod schema validation and React Hook Form integration for ENS slug input.
 * The slugSchema mirrors on-chain _validateSlug() for instant client-side feedback.
 */

import { describe, expect, it } from "vitest";

import { slugSchema } from "../../../hooks/ens/useSlugForm";

// ============================================================================
// SLUG SCHEMA VALIDATION (Pure Zod — no React needed)
// ============================================================================

describe("slugSchema", () => {
  describe("valid slugs", () => {
    it.each(["abc", "alice", "my-garden", "a1b2c3", "green-goods-42"])("accepts '%s'", (slug) => {
      const result = slugSchema.safeParse({ slug });
      expect(result.success).toBe(true);
    });

    it("accepts exactly 50 characters", () => {
      const result = slugSchema.safeParse({ slug: "a".repeat(50) });
      expect(result.success).toBe(true);
    });
  });

  describe("rejects slugs too short", () => {
    it.each(["", "a", "ab"])("rejects '%s'", (slug) => {
      const result = slugSchema.safeParse({ slug });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes("Too short") || m.includes("at least"))).toBe(true);
      }
    });
  });

  describe("rejects slugs too long", () => {
    it("rejects 51 characters", () => {
      const result = slugSchema.safeParse({ slug: "a".repeat(51) });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes("Too long") || m.includes("at most"))).toBe(true);
      }
    });
  });

  describe("rejects invalid characters", () => {
    it.each([
      "Alice",
      "MY-GARDEN",
      "my garden",
      "my.garden",
      "my_garden",
      "alice@eth",
    ])("rejects '%s'", (slug) => {
      const result = slugSchema.safeParse({ slug });
      expect(result.success).toBe(false);
    });
  });

  describe("rejects invalid hyphen placement", () => {
    it("rejects leading hyphen", () => {
      const result = slugSchema.safeParse({ slug: "-alice" });
      expect(result.success).toBe(false);
    });

    it("rejects trailing hyphen", () => {
      const result = slugSchema.safeParse({ slug: "alice-" });
      expect(result.success).toBe(false);
    });

    it("rejects consecutive hyphens", () => {
      const result = slugSchema.safeParse({ slug: "my--garden" });
      expect(result.success).toBe(false);
    });
  });

  describe("error messages match contract rules", () => {
    it("shows min length message", () => {
      const result = slugSchema.safeParse({ slug: "ab" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Too short (min 3 characters)");
      }
    });

    it("shows max length message", () => {
      const result = slugSchema.safeParse({ slug: "a".repeat(51) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Too long (max 50 characters)");
      }
    });

    it("shows character set message for uppercase", () => {
      const result = slugSchema.safeParse({ slug: "Alice" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Only lowercase letters, numbers, and hyphens");
      }
    });
  });
});
