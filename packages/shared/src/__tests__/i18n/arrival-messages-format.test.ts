/**
 * Arrival toast message format tests.
 *
 * The review message carries an ICU plural ({count, plural, ...}) and Home formats EVERY
 * arrival message with a `count` value. Nothing else exercises these strings at runtime —
 * a malformed ICU string would only throw in production when the toast fires — so this
 * suite proves each locale's arrival block formats cleanly through react-intl.
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

const ARRIVAL_KINDS = ["queue", "draft", "review", "operatorClear", "gardener", "signedIn"];

describe("app.home.arrival.* message formatting", () => {
  for (const [locale, messages] of LOCALES) {
    const intl = createIntl({ locale, messages }, createIntlCache());

    it(`formats every ${locale} arrival message with a count value (Home passes it to all kinds)`, () => {
      for (const kind of ARRIVAL_KINDS) {
        for (const part of ["title", "message", "action"]) {
          const id = `app.home.arrival.${kind}.${part}`;
          expect(messages[id], `${locale} is missing ${id}`).toBeTruthy();
          const formatted = intl.formatMessage({ id }, { count: 3 });
          expect(typeof formatted).toBe("string");
          expect((formatted as string).length).toBeGreaterThan(0);
        }
      }
    });

    it(`pluralizes the ${locale} review message for one vs many`, () => {
      const id = "app.home.arrival.review.message";
      const one = intl.formatMessage({ id }, { count: 1 }) as string;
      const many = intl.formatMessage({ id }, { count: 3 }) as string;
      expect(one).toContain("1");
      expect(many).toContain("3");
      expect(one).not.toBe(many);
    });
  }

  it("renders the exact en copy for the review count", () => {
    const intl = createIntl(
      { locale: "en", messages: en as Record<string, string> },
      createIntlCache()
    );
    expect(intl.formatMessage({ id: "app.home.arrival.review.message" }, { count: 1 })).toBe(
      "1 submission needs review."
    );
    expect(intl.formatMessage({ id: "app.home.arrival.review.message" }, { count: 3 })).toBe(
      "3 submissions need review."
    );
  });
});
