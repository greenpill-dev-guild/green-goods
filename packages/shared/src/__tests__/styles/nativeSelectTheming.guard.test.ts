/**
 * Guard: native select popups follow the app theme.
 *
 * A `<select>` popup is painted by the browser, not by the control. It ignores
 * the control's own surface and inherits only its text colour, so a dark-theme
 * select drew light text onto the UA's light list and the options vanished
 * (PRD-922). Two rules keep that shut, and both have to stay:
 *
 * - `color-scheme` tied to `data-theme`, so the UA paints the popup, the
 *   scrollbars, and the date pickers in the theme the app is actually in
 *   rather than the one the OS is in.
 * - an explicit option pair on themed surface tokens, as the belt to that
 *   braces — it survives a UA that ignores `color-scheme`, and it has to ride
 *   tokens that flip, which `--neutral-0` / `--neutral-950` do not.
 *
 * The rule is deliberately written against `select option` rather than a single
 * control class: the cockpit fields, the shared `gg-control-select`, and the sort
 * rails are three different components and only the element is common. The
 * combinator is descendant, not child — an <optgroup> reparents its options, and
 * a child combinator silently skipped every grouped row.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(resolve(__dirname, "../../styles/theme.css"), "utf-8");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Declarations of the first rule whose selector list is `selector`. */
const block = (selector: string, source = theme) => {
  const selectorList = selector
    .split(",")
    .map((part) => escape(part.trim()))
    .join("\\s*,\\s*");
  return source.match(new RegExp(`(?:^|\\n)\\s*${selectorList}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
};

/** Declarations of the `:root` rule that declares `property`. */
const rootBlockDeclaring = (property: string) => {
  const matches = theme.matchAll(/(?:^|\n)\s*:root\s*\{([^}]*)\}/g);
  for (const match of matches) {
    if (new RegExp(`(?:^|;|\\n)\\s*${escape(property)}\\s*:`).test(match[1])) return match[1];
  }
  return "";
};

describe("native select theming", () => {
  it("declares the colour scheme on the light root", () => {
    expect(rootBlockDeclaring("color-scheme")).toMatch(/color-scheme\s*:\s*light\s*;/);
  });

  it("flips the colour scheme with the dark tokens", () => {
    const dark = block(':root[data-theme="dark"], [data-theme="dark"]');

    expect(dark).not.toBe("");
    expect(dark).toMatch(/color-scheme\s*:\s*dark\s*;/);
  });

  it("paints option rows from themed surface tokens in dark", () => {
    const options = block('[data-theme="dark"] select option, [data-theme="dark"] select optgroup');

    expect(options).not.toBe("");
    expect(options).toMatch(/background-color\s*:\s*rgb\(var\(--bg-soft-200\)\)/);
    expect(options).toMatch(/color\s*:\s*rgb\(var\(--text-strong-950\)\)/);
  });

  it("keeps the option pair off tokens that hold one value in both themes", () => {
    const options = block('[data-theme="dark"] select option, [data-theme="dark"] select optgroup');
    const dark = block(':root[data-theme="dark"], [data-theme="dark"]');

    // Whatever the pair names must be re-declared by the dark block; a token the
    // dark block never touches is a fixed value wearing a semantic name.
    for (const token of options.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
      expect(dark).toMatch(new RegExp(`${escape(token[1])}\\s*:`));
    }
  });
});
