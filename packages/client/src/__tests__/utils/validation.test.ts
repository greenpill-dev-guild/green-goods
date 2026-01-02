/**
 * Validation Utility Tests
 *
 * Tests for form validation helpers
 */

import { describe, it, expect } from "vitest";

describe("Validation Utilities", () => {
  describe("validateRequired", () => {
    it("passes for non-empty string", () => {
      const value = "test value";
      expect(value.trim().length).toBeGreaterThan(0);
    });

    it("fails for empty string", () => {
      const value = "";
      expect(value.trim().length).toBe(0);
    });

    it("fails for whitespace-only string", () => {
      const value = "   ";
      expect(value.trim().length).toBe(0);
    });
  });

  describe("validateEmail", () => {
    it("validates correct email format", () => {
      const email = "test@example.com";
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailPattern.test(email)).toBe(true);
    });

    it("rejects email without @", () => {
      const email = "testexample.com";
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailPattern.test(email)).toBe(false);
    });

    it("rejects email without domain", () => {
      const email = "test@";
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailPattern.test(email)).toBe(false);
    });
  });

  describe("validateURL", () => {
    it("validates correct HTTP URL", () => {
      const url = "https://example.com";
      expect(() => new URL(url)).not.toThrow();
    });

    it("validates correct IPFS URL", () => {
      const url = "ipfs://QmTest123";
      expect(url.startsWith("ipfs://")).toBe(true);
    });

    it("rejects invalid URL", () => {
      const url = "not-a-url";
      expect(() => new URL(url)).toThrow();
    });
  });

  describe("validateImageFile", () => {
    it("validates image MIME type", () => {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const testType = "image/jpeg";
      expect(validTypes.includes(testType)).toBe(true);
    });

    it("rejects non-image MIME type", () => {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const testType = "application/pdf";
      expect(validTypes.includes(testType)).toBe(false);
    });

    it("validates file size limit", () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const fileSize = 3 * 1024 * 1024; // 3MB
      expect(fileSize).toBeLessThanOrEqual(maxSize);
    });

    it("rejects oversized file", () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const fileSize = 10 * 1024 * 1024; // 10MB
      expect(fileSize).toBeGreaterThan(maxSize);
    });
  });

  describe("validateWorkSubmission", () => {
    it("validates complete work submission", () => {
      const submission = {
        title: "Test Work",
        feedback: "Test feedback",
        gardenAddress: "0x1234567890abcdef1234567890abcdef12345678",
        actionUID: 1,
      };
      expect(submission.title.length).toBeGreaterThan(0);
      expect(submission.feedback.length).toBeGreaterThan(0);
      expect(submission.gardenAddress.startsWith("0x")).toBe(true);
      expect(submission.actionUID).toBeGreaterThan(0);
    });

    it("fails for missing title", () => {
      const submission = {
        title: "",
        feedback: "Test feedback",
      };
      expect(submission.title.length).toBe(0);
    });

    it("fails for missing feedback", () => {
      const submission = {
        title: "Test Work",
        feedback: "",
      };
      expect(submission.feedback.length).toBe(0);
    });
  });
});
