import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import { describe, expect, it } from "vitest";
import { reportingText } from "../../services/reporting/copy";

// TEST-QUALITY: allow-small-test-file - the bot says still confirming in the Shared words, in each language

describe("the bot's still confirming words", () => {
  it.each([
    ["en", "Sent. Confirming is taking longer than usual."],
    ["es", (es as Record<string, string>)["app.sendStage.stillConfirming.detail"]],
    ["pt", (pt as Record<string, string>)["app.sendStage.stillConfirming.detail"]],
  ])("are the App's and the Hub's in %s", (locale, shared) => {
    for (const key of ["publish.stillConfirming", "review.stillConfirming"] as const) {
      const text = reportingText(locale, key);
      expect(text.startsWith(shared!)).toBe(true);
      expect(text).not.toContain("{");
    }
  });
});
