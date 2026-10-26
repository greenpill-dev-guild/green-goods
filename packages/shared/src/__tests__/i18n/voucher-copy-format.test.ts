import { createIntl, createIntlCache } from "react-intl";
import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

/**
 * The voucher pilot's copy (app.voucher.*) came from the approved copy sheet with its sample
 * people, amounts and dates turned into placeholders. A translation that drops one would print
 * a sentence with a hole in it, and a malformed plural or select would only throw on screen.
 */
type Catalog = Record<string, string>;
const VOUCHER = /^app\.voucher\./;
/** Argument names, after dropping plain select and plural arms such as `feminine {da}`. */
const args = (text: string) =>
  new Set(
    [
      ...text
        .replace(/\b(?:feminine|masculine|other|zero|one|two|few|many|=\d+)\s*\{[^{}]*\}/g, "")
        .matchAll(/\{\s*(\w+)\s*[,}]/g),
    ].map((m) => m[1])
  );
const keys = Object.keys(en).filter((key) => VOUCHER.test(key));
const sample: Record<string, string | number> = {
  issuer: "Tech and Sun",
  issuerFull: "Tech and Sun",
  gender: "feminine",
  count: 2,
  threshold: 2,
  owners: 5,
};

describe("voucher pilot copy", () => {
  it("carries the slice-1 strings", () => {
    expect(keys.length).toBeGreaterThan(350);
  });

  it.each([
    ["es", es],
    ["pt", pt],
  ] as const)("keeps every English placeholder in %s, adding only grammatical gender", (_, catalog) => {
    const drift = keys.flatMap((key) => {
      const source = args((en as Catalog)[key]!);
      const target = args((catalog as Catalog)[key] ?? "");
      const missing = [...source].filter((name) => !target.has(name));
      const extra = [...target].filter((name) => !source.has(name) && name !== "gender");
      return missing.length || extra.length ? [`${key}: -${missing} +${extra}`] : [];
    });
    expect(drift).toEqual([]);
  });

  it.each([
    ["en", en],
    ["es", es],
    ["pt", pt],
  ] as const)("formats every message in %s", (locale, catalog) => {
    const errors: string[] = [];
    const intl = createIntl(
      { locale, messages: catalog as Catalog, onError: (error) => errors.push(error.message) },
      createIntlCache()
    );
    for (const key of keys) {
      const values = Object.fromEntries(
        [...args((catalog as Catalog)[key]!)].map((name) => [name, sample[name] ?? "1"])
      );
      expect(intl.formatMessage({ id: key }, values), key).not.toMatch(/[{}]/);
    }
    expect(errors).toEqual([]);
  });
});
