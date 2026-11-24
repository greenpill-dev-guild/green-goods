import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import { describe, expect, it } from "vitest";
import { reportingText } from "../../services/reporting/copy";

// TEST-QUALITY: allow-small-test-file - the bot says its send stages in the Shared words, in each language

const word = (catalog: unknown, id: string) => (catalog as Record<string, string>)[id];

describe("the bot's still confirming words", () => {
  it.each([
    ["en", "Sent. Confirming is taking longer than usual."],
    ["es", word(es, "app.sendStage.stillConfirming.detail")],
    ["pt", word(pt, "app.sendStage.stillConfirming.detail")],
  ])("are the App's and the Hub's in %s", (locale, shared) => {
    for (const key of ["publish.stillConfirming", "review.stillConfirming"] as const) {
      const text = reportingText(locale, key);
      expect(text.startsWith(shared!)).toBe(true);
      expect(text).not.toContain("{");
    }
  });
});

// PRD-1568: a report or review a Safe only proposed waits for its signers, in the same words.
describe("the bot's Safe signers words", () => {
  it.each([
    [
      "en",
      "Waiting for the Safe's signers. Your Safe has the proposal. It goes through once enough of the Safe's owners sign it.",
    ],
    [
      "es",
      `${word(es, "app.sendStage.safeSigners")}. ${word(es, "app.sendStage.safeSigners.detail")}`,
    ],
    [
      "pt",
      `${word(pt, "app.sendStage.safeSigners")}. ${word(pt, "app.sendStage.safeSigners.detail")}`,
    ],
  ])("are the App's and the Hub's in %s", (locale, shared) => {
    for (const key of ["publish.safeSigners", "review.safeSigners"] as const) {
      const text = reportingText(locale, key);
      expect(text.startsWith(shared)).toBe(true);
      expect(text).not.toContain("{");
    }
  });
});
