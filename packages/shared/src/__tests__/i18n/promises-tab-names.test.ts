import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

type LocaleCatalog = Record<string, string>;

/**
 * DL-077: the Garden workspace's Pool tab is called Promises, the name the app
 * already gives a garden's tab, and its card for asks is Review Promises.
 * "Waiting for approval" read from the asker's side, so the cockpit no longer
 * says it anywhere.
 *
 * Rather than pin each string, this scans every cockpit message, so one that
 * names the card the old way fails wherever it is written.
 */
const locales: Array<{ locale: string; messages: LocaleCatalog; retired: RegExp }> = [
  { locale: "en", messages: en, retired: /waiting for approval/i },
  { locale: "es", messages: es, retired: /esperando aprobación/i },
  { locale: "pt", messages: pt, retired: /à espera de aprovação/i },
];

describe("the cockpit's Promises tab names (DL-077)", () => {
  describe.each(locales)("$locale", ({ messages, retired }) => {
    it("calls the tab what the app calls a garden's Promises tab", () => {
      expect(messages["cockpit.garden.pool.tab"]).toBe(messages["app.garden.pool"]);
    });

    it("has no cockpit message that uses a retired name", () => {
      const offenders = Object.entries(messages)
        .filter(([key, value]) => key.startsWith("cockpit.") && retired.test(value))
        .map(([key, value]) => `${key}: ${value}`);

      expect(offenders).toEqual([]);
    });
  });
});
