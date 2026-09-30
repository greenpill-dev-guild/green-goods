import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

// TEST-QUALITY: allow-small-test-file - one copy rule for the /impact commitments band, run once per locale

/**
 * PRD-887 — the four marker notes on the /impact commitments band sit side by
 * side, one row on desktop and two on phones, so a note far longer than its
 * neighbours reads as a ragged band. The kept notes once ran 141–195
 * characters beside a 64-character open-pools note. Both kept notes count: the
 * band shows one or the other, depending on whether the kept share is public.
 */
const NOTE_KEYS = [
  "public.pool.impact.openPools.note",
  "public.pool.impact.fulfilled.note",
  "public.pool.impact.kept.rateNote",
  "public.pool.impact.kept.countsOnlyNote",
  "public.pool.impact.support.note",
];

describe("i18n /impact commitments band note lengths (PRD-887)", () => {
  const catalogs: [string, Record<string, string>][] = [
    ["en", en as Record<string, string>],
    ["es", es as Record<string, string>],
    ["pt", pt as Record<string, string>],
  ];

  for (const [locale, catalog] of catalogs) {
    it(`keeps every band note within 75–105 characters in ${locale}`, () => {
      const outsideBand = NOTE_KEYS.filter(
        (key) => catalog[key].length < 75 || catalog[key].length > 105
      ).map((key) => `${key}: ${catalog[key].length}`);

      expect(outsideBand).toEqual([]);
    });
  }
});
