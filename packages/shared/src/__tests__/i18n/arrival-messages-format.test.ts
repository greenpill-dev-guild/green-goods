/**
 * Arrival toast message format tests.
 *
 * Home formats the arrival toast's copy through react-intl, and the copy for uploads waiting in
 * another garden names it through an ICU argument (PWA Home step 12). Nothing else exercises
 * these strings in every locale at runtime, so a malformed ICU string would only throw in
 * production when the toast fires; this suite proves each locale's arrival block formats cleanly.
 */

import { createIntl, createIntlCache } from "react-intl";
import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

const LOCALES: Array<[string, Record<string, string>]> = [
  ["en", en as Record<string, string>],
  ["es", es as Record<string, string>],
  ["pt", pt as Record<string, string>],
];

const ARRIVAL_IDS = ["title", "message", "messageInGarden", "action"].map(
  (part) => `app.home.arrival.queue.${part}`
);

describe("app.home.arrival.* message formatting", () => {
  for (const [locale, messages] of LOCALES) {
    it(`formats every ${locale} arrival message, and names the garden uploads wait in`, () => {
      const intl = createIntl({ locale, messages }, createIntlCache());
      for (const id of ARRIVAL_IDS) {
        expect(messages[id], `${locale} is missing ${id}`).toBeTruthy();
        const formatted = intl.formatMessage({ id }, { garden: "Vida Verde" });
        expect(typeof formatted).toBe("string");
        expect((formatted as string).length).toBeGreaterThan(0);
      }
      expect(
        intl.formatMessage(
          { id: "app.home.arrival.queue.messageInGarden" },
          { garden: "Vida Verde" }
        )
      ).toContain("Vida Verde");
    });
  }
});
