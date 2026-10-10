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
/** The default of a `var(--token, default)` term, or the term itself. */
const fallback = (value: string) => value.match(/^var\([^,]+,\s*([^)]+)\)$/)?.[1]?.trim() ?? value;

/**
 * Rendered hit-area height of a `::after` whose block inset reads
 * `calc((<size> - <target>) / 2 - <gap>)`. An absolute box is laid out against the
 * padding box, inside the border, so the hit area is `size - 2 * border - 2 * inset`:
 * it reaches the target only when the gap gives the border back. A `var(--x, default)`
 * term resolves to its default, the value every surface without the token renders.
 */
const hitAreaPx = (inset: string, sizePx: number, border: number) => {
  const term = "(var\\([^)]*\\)|\\S+)";
  const blockInset = inset.match(new RegExp(`^calc\\(\\(${term} - ${term}\\) / 2 - (\\S+)\\)`));
  if (!blockInset) throw new Error(`Unexpected hit-area inset: ${inset}`);
  const [, size, target, gap] = blockInset;
  const sizeValue = size.startsWith("var(") && !size.includes(",") ? sizePx : px(fallback(size));
  const offset = (sizeValue - px(fallback(target))) / 2 - px(gap);
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

  it("uses the 16px field corner in the app and no corner on the public website (DL-029)", () => {
    const app = rootBlockWith("--gg-button-radius");
    expect(declaration(app, "--gg-button-radius")).toBe("var(--radius-lg)");
    expect(declaration(app, "--gg-button-radius-pressed")).toBe("var(--radius-squircle)");
    expect(declaration(app, "--gg-button-weight")).toBe("var(--text-label-sm--font-weight)");

    const website = block(':root:has([data-site="website"])');
    expect(declaration(website, "--gg-button-radius")).toBe("var(--radius-none)");
    expect(declaration(website, "--gg-button-radius-pressed")).toBe("var(--radius-none)");
    expect(declaration(website, "--gg-button-weight")).toBe("var(--font-weight-semibold, 600)");
  });

  it("projects the none step for the square website buttons", () => {
    expect(generated).toMatch(/--gg-radius-none:\s*0px;/);
    expect(theme).toMatch(/--radius-none:\s*var\(--gg-radius-none\);/);
  });

  it("has retired the legacy gg-button-<variant> classes", () => {
    expect(theme).not.toMatch(/\.gg-button-(primary|secondary|ghost|danger|size-)/);
  });

  it.each([
    ["lg", 48, "--text-label-md--line-height"],
    ["md", 44, "--text-label-md--line-height"],
    ["sm", 40, "--text-label-sm--line-height"],
    ["compact", 32, "--text-label-sm--line-height"],
  ])("sizes %s to %ipx by default from one surface token, matching the field scale (DL-031)", (size, height, lineHeightToken) => {
    const body = block(`.gg-button[data-size="${size}"]`);
    const blockToken = declaration(body, "--gg-button-block") ?? "";
    expect(blockToken).toMatch(new RegExp(`^var\\(--gg-button-block-${size}, [^)]+\\)$`));
    expect(px(fallback(blockToken))).toBe(height);
    const line =
      declaration(body, "--gg-button-line") ?? declaration(block(".gg-button"), "--gg-button-line");
    expect(line).toBe(`var(${lineHeightToken})`);
    // One rule derives the vertical padding from the block and the line, so a
    // one-line button renders at exactly its step on every surface: border (1px
    // each side) + padding + line-height equals the height, and the padding is a
    // whole pixel on every default step.
    const sized = block(".gg-button[data-size]");
    expect(declaration(sized, "min-block-size")).toBe("var(--gg-button-block)");
    expect(declaration(sized, "padding-block")).toBe(
      "calc((var(--gg-button-block) - var(--gg-button-line) - 2px) / 2)"
    );
    const paddingBlock = (height - tokenPx(lineHeightToken) - 2) / 2;
    expect(Number.isInteger(paddingBlock)).toBe(true);
    expect(paddingBlock).toBeGreaterThan(0);
  });

  it("shows the pointer on every emphasis-API button, as on IconButton and Chip", () => {
    expect(declaration(block(".gg-button[data-size]"), "cursor")).toBe("pointer");
    expect(declaration(block(".gg-icon-button"), "cursor")).toBe("pointer");
  });

  it.each([
    ["lg", 48],
    ["md", 44],
    ["sm", 40],
    ["compact", 32],
  ])("gives the %s button and icon button a 48px hit area by default", (size, height) => {
    const buttonInset = declaration(block(".gg-button[data-size]::after"), "inset");
    expect(
      px(fallback(declaration(block(`.gg-button[data-size="${size}"]`), "--gg-button-block") ?? ""))
    ).toBe(height);
    expect(hitAreaPx(buttonInset ?? "", height, borderPx(".gg-button"))).toBe(48);

    const iconInset = declaration(block(".gg-icon-button::after"), "inset");
    expect(hitAreaPx(iconInset ?? "", height, borderPx(".gg-icon-button"))).toBe(48);
  });

  it("lets a surface move the family's hit box with --gg-hit-block (the cockpit sets 44px)", () => {
    const inset = declaration(block(".gg-button[data-size]::after"), "inset") ?? "";
    expect(inset).toContain("var(--gg-hit-block, 3rem)");
    // No sideways overhang: it would count as scrollable overflow, and a
    // full-width sheet action on a phone would scroll the page by that much.
    expect(inset.endsWith(" -1px")).toBe(true);
    expect(declaration(block(".gg-icon-button::after"), "inset")).toContain(
      "var(--gg-hit-block, 3rem)"
    );
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
    expect(declaration(icon, "--gg-icon-button-size")).toBe("var(--gg-icon-size-md, 2.75rem)");
    expect(declaration(icon, "border-radius")).toBe("calc(var(--gg-icon-button-size) / 2)");
    expect(
      declaration(block('.gg-icon-button[data-size="compact"]'), "--gg-icon-button-size")
    ).toBe("var(--gg-icon-size-compact, 2rem)");
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

  it("holds a single-line admin control at the cockpit tier: 44px on touch widths, 40px from 640px (DL-030)", () => {
    const singleLine =
      'input.gg-control[data-surface="admin"],\n  select.gg-control[data-surface="admin"],\n  .gg-control-trigger[data-surface="admin"],\n  .gg-control-dropzone[data-surface="admin"]';
    const touch = block(singleLine);
    expect(px(declaration(touch, "block-size") ?? "")).toBe(44);
    expect(declaration(touch, "padding-block")).toBe("0");
    const desktop = theme.slice(theme.indexOf("@media (min-width: 40rem)"));
    expect(px(declaration(block(singleLine, desktop), "block-size") ?? "")).toBe(40);
    expect(declaration(block('.gg-control[data-surface="admin"]', desktop), "font-size")).toBe(
      "var(--type-body-md, 0.875rem)"
    );
  });

  it("gives the upload well and the field label their own shared classes (DL-031)", () => {
    expect(declaration(block(".gg-control-dropzone"), "border-style")).toBe("dashed");
    expect(declaration(block(".gg-field-label"), "font-size")).toBe("var(--gg-label-sm)");
    expect(declaration(block(".gg-field-label"), "font-weight")).toBe(
      "var(--text-label-md--font-weight, 500)"
    );
  });
});

describe("switch guard (DL-031)", () => {
  it("draws a 44 × 24 track with a 44px hit box, and the M3 52 × 32 track on the admin surface", () => {
    const track = block(".gg-switch");
    expect(px(declaration(track, "--gg-switch-inline") ?? "")).toBe(44);
    expect(px(declaration(track, "--gg-switch-block") ?? "")).toBe(24);
    expect(declaration(track, "width")).toBe("var(--gg-switch-inline)");
    expect(declaration(track, "height")).toBe("var(--gg-switch-block)");
    const inset = declaration(block(".gg-switch::after"), "inset") ?? "";
    expect(hitAreaPx(inset, 24, borderPx(".gg-switch"))).toBe(44);

    const admin = block('.gg-switch[data-surface="admin"]');
    expect(px(declaration(admin, "--gg-switch-inline") ?? "")).toBe(52);
    expect(px(declaration(admin, "--gg-switch-block") ?? "")).toBe(32);
    expect(px(declaration(admin, "--gg-switch-thumb") ?? "")).toBe(24);
    expect(hitAreaPx(inset, 32, borderPx(".gg-switch"))).toBe(44);
  });
});
