import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

// TEST-QUALITY: allow-small-test-file - one vocabulary rule (vaults withdraw, vouchers redeem) checked once per locale

/** Decision 4 of the voucher pilot design: Redeem belongs to vouchers alone, in every language. */
const VAULT_KEYS = /^(public\.vaults|app\.treasury|public\.fund\.endowments)\./;
const VOUCHER_VERB: Record<string, RegExp> = {
  en: /redeem|redemption/i,
  es: /canje|redim|redenci/i,
  pt: /resgat|resgate/i,
};

describe("vault copy keeps the voucher verb out", () => {
  it.each([
    ["en", en],
    ["es", es],
    ["pt", pt],
  ] as const)("says withdraw, never redeem, for a vault in %s", (locale, catalog) => {
    const offending = Object.entries(catalog as Record<string, string>).filter(
      ([key, text]) => VAULT_KEYS.test(key) && VOUCHER_VERB[locale]!.test(text)
    );
    expect(offending).toEqual([]);
  });
});
