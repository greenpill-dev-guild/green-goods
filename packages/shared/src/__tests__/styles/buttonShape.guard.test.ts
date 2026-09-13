/**
 * Guard: button and field shape follow the locked rules.
 *
 * Button corners drifted for months because no primitive encoded them, and the
 * guidance named a Tailwind class whose token had changed. This guard reads the
 * shipped CSS so the button corner per surface (DL-026), the field corner
 * (DL-022), and the shared height scale (DL-023) cannot drift silently again.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(resolve(__dirname, "../../styles/theme.css"), "utf-8");
const generated = readFileSync(resolve(__dirname, "../../styles/design-md.generated.css"), "utf-8");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Declarations of the first rule whose selector list is `selector`, ignoring whitespace between selectors. */
const block = (selector: string, source = theme) => {
  const selectorList = selector
    .split(",")
    .map((part) => escape(part.trim()))
    .join("\\s*,\\s*");
  return source.match(new RegExp(`(?:^|\\n)\\s*${selectorList}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
};
/** Declarations of the `:root` rule that declares `property`. */
const rootBlockWith = (property: string) =>
  Array.from(theme.matchAll(/(?:^|\n)\s*:root\s*\{([^}]*)\}/g), (match) => match[1]).find((body) =>
    body.includes(`${property}:`)
  ) ?? "";
const declaration = (body: string, property: string) =>
  body.match(new RegExp(`(?:^|[;\\s])${escape(property)}:\\s*([^;]+);`))?.[1]?.trim();

const REM = 16;
const px = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.endsWith("rem")) return Number.parseFloat(trimmed) * REM;
  if (trimmed.endsWith("px")) return Number.parseFloat(trimmed);
  throw new Error(`Unexpected length: ${value}`);
};
const tokenPx = (token: string) =>
  px(theme.match(new RegExp(`${escape(token)}:\\s*([^;]+);`))?.[1] ?? "");
const borderPx = (selector: string) =>
  px((declaration(block(selector), "border") ?? "").split(/\s+/)[0]);

/**
 * Rendered hit-area height of a `::after` whose block inset reads
 * `calc((<size> - <target>) / 2 - <gap>)`. An absolute box is laid out against the
 * padding box, inside the border, so the hit area is `size - 2 * border - 2 * inset`:
 * it reaches the target only when the gap gives the border back.
 */
const hitAreaPx = (inset: string, sizePx: number, border: number) => {
  const blockInset = inset.match(/^calc\(\((\S+) - (\S+)\) \/ 2 - (\S+)\)/);
  if (!blockInset) throw new Error(`Unexpected hit-area inset: ${inset}`);
  const [, size, target, gap] = blockInset;
  const offset = ((size.startsWith("var(") ? sizePx : px(size)) - px(target)) / 2 - px(gap);
  return sizePx - 2 * border - 2 * offset;
};

describe("button shape guard (DL-023, DL-026)", () => {
  it("projects the 12px squircle step from DesignMD", () => {
    expect(generated).toMatch(/--gg-radius-squircle:\s*12px;/);
    expect(theme).toMatch(/--radius-squircle:\s*var\(--gg-radius-squircle\);/);
  });

  it("gives every emphasis the surface corner, with no corner of its own", () => {
    const emphasis = block(".gg-button[data-emphasis]");
    expect(declaration(emphasis, "border-radius")).toBe("var(--gg-button-radius)");
    expect(declaration(emphasis, "font-weight")).toBe("var(--gg-button-weight)");
    for (const name of ["primary", "secondary", "tertiary"]) {
      expect(
        declaration(block(`.gg-button[data-emphasis="${name}"]`), "border-radius")
      ).toBeUndefined();
    }
  });

  it("uses the 12px squircle in the app and 16px on the public website", () => {
    const app = rootBlockWith("--gg-button-radius");
    expect(declaration(app, "--gg-button-radius")).toBe("var(--radius-squircle)");
    expect(declaration(app, "--gg-button-radius-pressed")).toBe("var(--radius-md)");
    expect(declaration(app, "--gg-button-weight")).toBe("var(--text-label-sm--font-weight)");

    const website = block(':root:has([data-site="website"])');
    expect(declaration(website, "--gg-button-radius")).toBe("var(--radius-lg)");
    expect(declaration(website, "--gg-button-radius-pressed")).toBe("var(--radius-squircle)");
    expect(declaration(website, "--gg-button-weight")).toBe("var(--font-weight-semibold, 600)");
  });

  it.each([
    ["lg", 48, "--text-label-md--line-height"],
    ["md", 44, "--text-label-md--line-height"],
    ["sm", 40, "--text-label-sm--line-height"],
    ["compact", 32, "--text-label-sm--line-height"],
  ])("sizes %s to %ipx, matching the field scale", (size, height, lineHeightToken) => {
    const body = block(`.gg-button[data-size="${size}"]`);
    expect(px(declaration(body, "min-block-size") ?? "")).toBe(height);
    expect(declaration(body, "--gg-button-block")).toBe(declaration(body, "min-block-size"));
    // Border (1px each side) + vertical padding + line-height must equal the height,
    // so a one-line button renders at exactly the scale step.
    const paddingBlock = px((declaration(body, "padding") ?? "").split(/\s+/)[0]);
    expect(2 + paddingBlock * 2 + tokenPx(lineHeightToken)).toBe(height);
  });

  it("shows the pointer on every emphasis-API button, as on IconButton and Chip", () => {
    expect(declaration(block(".gg-button[data-size]"), "cursor")).toBe("pointer");
    expect(declaration(block(".gg-icon-button"), "cursor")).toBe("pointer");
  });

  it.each([
    ["sm", 40],
    ["compact", 32],
  ])("gives the %s button and icon button a 48px hit area", (size, height) => {
    const buttonInset = declaration(
      block('.gg-button[data-size="sm"]::after,\n  .gg-button[data-size="compact"]::after'),
      "inset"
    );
    expect(
      px(declaration(block(`.gg-button[data-size="${size}"]`), "--gg-button-block") ?? "")
    ).toBe(height);
    expect(hitAreaPx(buttonInset ?? "", height, borderPx(".gg-button"))).toBe(48);

    const iconInset = declaration(
      block(
        '.gg-icon-button[data-size="sm"]::after,\n  .gg-icon-button[data-size="compact"]::after'
      ),
      "inset"
    );
    expect(hitAreaPx(iconInset ?? "", height, borderPx(".gg-icon-button"))).toBe(48);
  });

  it.each([
    [".gg-chip", ".gg-chip::after"],
    ['.gg-chip[data-size="sm"]', '.gg-chip[data-size="sm"]::after'],
  ])("gives the %s chip a 44px hit area", (selector, afterSelector) => {
    const height = px(declaration(block(selector), "min-block-size") ?? "");
    const inset = declaration(block(afterSelector), "inset") ?? "";
    expect(hitAreaPx(inset, height, borderPx(".gg-chip"))).toBe(44);
  });

  it("tightens one step on press and keeps the resting corner under reduced motion (DL-001)", () => {
    const pressed =
      '.gg-button[data-emphasis="primary"]:active, .gg-button[data-emphasis="secondary"]:active';
    expect(declaration(block(pressed), "border-radius")).toBe("var(--gg-button-radius-pressed)");
    const reduced = theme.slice(theme.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(declaration(block(pressed, reduced), "border-radius")).toBe("var(--gg-button-radius)");
  });

  it("draws icon buttons as circles and chips as capsules", () => {
    const icon = block(".gg-icon-button");
    expect(declaration(icon, "--gg-icon-button-size")).toBe("2.75rem");
    expect(declaration(icon, "border-radius")).toBe("calc(var(--gg-icon-button-size) / 2)");
    expect(
      declaration(block('.gg-icon-button[data-size="compact"]'), "--gg-icon-button-size")
    ).toBe("2rem");
    const chip = block(".gg-chip");
    expect(declaration(chip, "border-radius")).toBe("var(--radius-full)");
    expect(declaration(chip, "min-block-size")).toBe("2rem");
  });
});

describe("field shape guard (DL-022, DL-023)", () => {
  it("gives every default field the 16px corner at the 44px md height", () => {
    const control = block(".gg-control");
    expect(declaration(control, "border-radius")).toBe("var(--radius-lg)");
    expect(declaration(control, "min-height")).toBe("2.75rem");
  });

  // Browsers grow a text input to its font's line box, so a min-height alone let
  // display-size digits render 45-56px tall.
  it.each([
    ['input.gg-control:not([data-surface="admin"])', 44],
    ['input.gg-control[data-size="sm"]:not([data-surface="admin"])', 40],
    ['input.gg-control[data-size="lg"]:not([data-surface="admin"])', 48],
  ])("holds %s at exactly %ipx, whatever its text size", (selector, height) => {
    const body = block(selector);
    expect(px(declaration(body, "block-size") ?? "")).toBe(height);
    expect(px(declaration(body, "min-block-size") ?? "")).toBe(height);
  });

  it("gives single-line fields no vertical padding, so the text centers in the fixed height", () => {
    expect(
      declaration(block('input.gg-control:not([data-surface="admin"])'), "padding-block")
    ).toBe("0");
  });

  it("restates the select chevron lane after the size rules reset the padding", () => {
    const lane = ".gg-control-select[data-size] {";
    expect(declaration(block(".gg-control-select[data-size]"), "padding-right")).toBe("2.25rem");
    for (const size of ["sm", "lg"]) {
      expect(theme.indexOf(`.gg-control[data-size="${size}"] {`)).toBeLessThan(theme.indexOf(lane));
    }
  });

  it("keeps the editorial field an underline with a visible invalid state", () => {
    const editorial = block('.gg-control[data-surface="editorial"]');
    expect(declaration(editorial, "border-radius")).toBe("0");
    expect(declaration(editorial, "border-width")).toBe("0 0 1px");
    expect(
      declaration(
        block('.gg-control[data-surface="editorial"][data-invalid="true"]'),
        "border-color"
      )
    ).toBe("rgb(var(--error-base))");
  });

  it("keeps a chevron lane on the editorial underline select", () => {
    const select = block('.gg-control-select[data-surface="editorial"]');
    expect(declaration(select, "padding-right")).toBe("1.75rem");
    expect(declaration(select, "background-position")).toBe("right 0.125rem center");
  });
});
