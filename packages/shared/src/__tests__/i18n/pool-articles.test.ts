import { describe, expect, it } from "vitest";

import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

/**
 * PRD-772 — gender agreement on the loanword "pool".
 *
 * "Pool" is masculine in both Spanish and Portuguese: el pool / los pools,
 * o pool / os pools. The RAE treats it as a masculine anglicism (and suggests
 * consorcio / agrupación / grupo as native alternatives), and the financial
 * sense both catalogs use follows the same pattern — "el pool bancario",
 * "el pool de liquidez".
 *
 * The catalogs used to mix genders: Spanish had three feminine strings against
 * thirty-three masculine ones, and the Portuguese string was briefly translated
 * to "piscina" — a swimming pool, not a signal pool. Rather than pin the
 * individual strings, this scans both catalogs so a new feminine "pool" fails
 * wherever it is introduced.
 */
const FEMININE_ARTICLE_BEFORE_POOL =
  /\b(la|las|una|unas|esta|estas|de la|a la|da|das|uma|umas|essa|essas)\s+pools?\b/i;

describe("i18n pool gender agreement (PRD-772)", () => {
  const catalogs: [string, Record<string, string>][] = [
    ["es", es as Record<string, string>],
    ["pt", pt as Record<string, string>],
  ];

  for (const [locale, catalog] of catalogs) {
    it(`treats "pool" as masculine throughout the ${locale} catalog`, () => {
      const offenders = Object.entries(catalog)
        .filter(([, value]) => FEMININE_ARTICLE_BEFORE_POOL.test(value))
        .map(([key, value]) => `${key}: ${value}`);

      expect(offenders).toEqual([]);
    });
  }

  it("does not translate the signal pool as a swimming pool in Portuguese", () => {
    const offenders = Object.entries(pt as Record<string, string>)
      .filter(([, value]) => /piscina/i.test(value))
      .map(([key]) => key);

    expect(offenders).toEqual([]);
  });
});
