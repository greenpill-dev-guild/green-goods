/**
 * AI Service Tests
 *
 * Tests for the NLU parsing logic used in the Telegram bot.
 * Voice transcription tests are skipped as they require the Whisper model.
 */

import { describe, it, expect } from "bun:test";
import { parseWorkTextRegex } from "../services/ai";

describe("parseWorkTextRegex", () => {
  describe("tree planting patterns", () => {
    it("parses 'planted X trees' pattern", () => {
      const result = parseWorkTextRegex("I planted 5 trees today");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]).toEqual({
        type: "planting",
        species: "tree",
        count: 5,
      });
      expect(result.notes).toBe("I planted 5 trees today");
    });

    it("parses 'X trees planted' pattern", () => {
      const result = parseWorkTextRegex("10 trees planted in the garden");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].count).toBe(10);
    });

    it("parses 'X trees' standalone pattern", () => {
      const result = parseWorkTextRegex("Added 3 trees near the pond");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].count).toBe(3);
    });

    it("handles singular 'tree'", () => {
      const result = parseWorkTextRegex("Planted 1 tree");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].count).toBe(1);
    });
  });

  describe("weeding patterns", () => {
    it("parses 'X kg weeds' pattern", () => {
      const result = parseWorkTextRegex("Removed 10kg of weeds");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]).toEqual({
        type: "weeding",
        species: "weed",
        amount: 10,
        unit: "kg",
      });
    });

    it("parses 'X lbs weeds' pattern", () => {
      const result = parseWorkTextRegex("Pulled 5 lbs weeds from bed A");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].amount).toBe(5);
      expect(result.tasks[0].unit).toBe("lbs");
    });

    it("parses 'weeded X' pattern", () => {
      const result = parseWorkTextRegex("Weeded 8 kg today");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].amount).toBe(8);
    });

    it("defaults to kg when unit is missing", () => {
      const result = parseWorkTextRegex("Removed 15 weeds");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].unit).toBe("kg");
    });
  });

  describe("general plant patterns", () => {
    it("parses 'planted X [species]' pattern", () => {
      const result = parseWorkTextRegex("Planted 20 tomatoes in the greenhouse");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]).toEqual({
        type: "planting",
        species: "tomatoes",
        count: 20,
      });
    });

    it("prioritizes tree pattern over general plant", () => {
      // Should only match trees, not "trees today"
      const result = parseWorkTextRegex("Planted 5 trees today");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].species).toBe("tree");
    });
  });

  describe("combined patterns", () => {
    it("parses multiple task types in one message", () => {
      const result = parseWorkTextRegex("Planted 10 trees and removed 5kg weeds");

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.find((t) => t.type === "planting")).toBeDefined();
      expect(result.tasks.find((t) => t.type === "weeding")).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("returns empty tasks for unrecognized input", () => {
      const result = parseWorkTextRegex("Had a great day at the garden");

      expect(result.tasks).toHaveLength(0);
      expect(result.notes).toBe("Had a great day at the garden");
    });

    it("handles empty input", () => {
      const result = parseWorkTextRegex("");

      expect(result.tasks).toHaveLength(0);
      expect(result.notes).toBe("");
    });

    it("is case insensitive", () => {
      const result = parseWorkTextRegex("PLANTED 5 TREES");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].count).toBe(5);
    });

    it("includes date in result", () => {
      const result = parseWorkTextRegex("Planted 5 trees");
      const today = new Date().toISOString().split("T")[0];

      expect(result.date).toBe(today);
    });

    it("preserves original text as notes", () => {
      const input = "Today I planted 5 oak trees near the river";
      const result = parseWorkTextRegex(input);

      expect(result.notes).toBe(input);
    });
  });
});
