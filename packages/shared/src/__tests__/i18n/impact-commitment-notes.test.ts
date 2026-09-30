import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

// TEST-QUALITY: allow-small-test-file - the agreed community copy has one punctuation requirement across three locales

const COPY_KEYS = [
  "public.pool.impact.title",
  "public.pool.impact.lifecycle",
  "public.pool.impact.made.note",
  "public.pool.impact.kept.note",
  "public.pool.impact.support.note",
];

describe("community commitment copy", () => {
  for (const [locale, catalog] of Object.entries({ en, es, pt })) {
    it(`has translated copy without em dashes in ${locale}`, () => {
      for (const key of COPY_KEYS) {
        const text = (catalog as Record<string, string>)[key];
        expect(text, key).toBeTruthy();
        expect(text, key).not.toContain("—");
      }
    });
  }
});
