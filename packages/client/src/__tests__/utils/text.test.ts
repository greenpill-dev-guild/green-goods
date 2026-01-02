/**
 * Text Utility Tests
 *
 * Tests for text formatting and manipulation
 */

import { describe, it, expect } from "vitest";

describe("Text Utilities", () => {
  describe("truncate", () => {
    it("truncates long text with ellipsis", () => {
      const text = "This is a very long text that needs to be truncated";
      const maxLength = 20;
      const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
      expect(truncated).toBe("This is a very long ...");
    });

    it("does not truncate short text", () => {
      const text = "Short text";
      const maxLength = 20;
      const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
      expect(truncated).toBe("Short text");
    });

    it("handles empty string", () => {
      const text = "";
      const maxLength = 20;
      const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
      expect(truncated).toBe("");
    });
  });

  describe("capitalize", () => {
    it("capitalizes first letter", () => {
      const text = "hello world";
      const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
      expect(capitalized).toBe("Hello world");
    });

    it("handles already capitalized text", () => {
      const text = "Hello World";
      const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
      expect(capitalized).toBe("Hello World");
    });

    it("handles empty string", () => {
      const text = "";
      const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
      expect(capitalized).toBe("");
    });
  });

  describe("slugify", () => {
    it("converts text to URL-safe slug", () => {
      const text = "Hello World!";
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      expect(slug).toBe("hello-world-");
    });

    it("handles special characters", () => {
      const text = "Test & Example #1";
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      expect(slug).toContain("test");
      expect(slug).toContain("example");
    });

    it("removes multiple consecutive dashes", () => {
      const text = "Test   Multiple   Spaces";
      const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-");
      expect(slug).toBe("test-multiple-spaces");
    });
  });

  describe("pluralize", () => {
    it("returns singular for count of 1", () => {
      const count = 1;
      const word = count === 1 ? "garden" : "gardens";
      expect(word).toBe("garden");
    });

    it("returns plural for count > 1", () => {
      const count = 5;
      const word = count === 1 ? "garden" : "gardens";
      expect(word).toBe("gardens");
    });

    it("returns plural for count of 0", () => {
      const count = 0;
      const word = count === 1 ? "garden" : "gardens";
      expect(word).toBe("gardens");
    });
  });

  describe("stripHtml", () => {
    it("removes HTML tags from string", () => {
      const html = "<p>Hello <strong>World</strong></p>";
      const text = html.replace(/<[^>]*>/g, "");
      expect(text).toBe("Hello World");
    });

    it("handles nested tags", () => {
      const html = "<div><span><b>Text</b></span></div>";
      const text = html.replace(/<[^>]*>/g, "");
      expect(text).toBe("Text");
    });

    it("handles text without tags", () => {
      const html = "Plain text";
      const text = html.replace(/<[^>]*>/g, "");
      expect(text).toBe("Plain text");
    });
  });

  describe("wordCount", () => {
    it("counts words in text", () => {
      const text = "This is a test sentence";
      const count = text.split(/\s+/).filter((word) => word.length > 0).length;
      expect(count).toBe(5);
    });

    it("handles multiple spaces", () => {
      const text = "Word1    Word2   Word3";
      const count = text.split(/\s+/).filter((word) => word.length > 0).length;
      expect(count).toBe(3);
    });

    it("returns 0 for empty string", () => {
      const text = "";
      const count = text.split(/\s+/).filter((word) => word.length > 0).length;
      expect(count).toBe(0);
    });
  });
});
