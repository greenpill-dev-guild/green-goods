/**
 * Guard: the client's element defaults never restyle the shared controls.
 *
 * typography.css sits in Tailwind's utilities layer, which outranks the shared
 * controls' components layer whatever the specificity. A bare `a { color }` made
 * every Button rendered as a link link-green, and a bare `* { font-family }` took
 * the serif off the editorial field; both reached the pre-merge screenshots.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../styles/typography.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);
const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, selector, body]) => ({
  selector: selector.trim().replace(/\s+/g, " "),
  body,
}));
const declares = (body: string, property: string) =>
  new RegExp(`(?:^|[;\\s])${property}\\s*:`).test(body);

describe("client typography layer", () => {
  it("colours links but not links rendered as shared buttons", () => {
    const linkColour = rules.filter(
      (rule) => /(?:^|,\s*)a(?=[\s,:]|$)/.test(rule.selector) && declares(rule.body, "color")
    );
    expect(linkColour.map((rule) => rule.selector)).toEqual([
      "a:where(:not(.gg-button, .gg-icon-button, .gg-chip))",
    ]);
  });

  it("sets the sans face everywhere except the editorial field", () => {
    const universal = rules.filter(
      (rule) => rule.selector.startsWith("*") && declares(rule.body, "font-family")
    );
    expect(universal.map((rule) => rule.selector)).toEqual([
      '*:where(:not(.gg-control[data-surface="editorial"]))',
    ]);
  });
});
