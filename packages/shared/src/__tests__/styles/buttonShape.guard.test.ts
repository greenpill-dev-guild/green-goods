/**
 * Guard: button and field shape follow the locked rules.
 *
 * DL-003 was codified for months while no primitive encoded it, and the
 * secondary corner drifted from 12px to 20px because the guidance named a
 * Tailwind class whose token had changed. This guard reads the shipped CSS so
 * the shape per emphasis (DL-021), the field corner (DL-022), and the shared
 * height scale (DL-023) cannot drift silently again.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync(resolve(__dirname, "../../styles/theme.css"), "utf-8");
const generated = readFileSync(resolve(__dirname, "../../styles/design-md.generated.css"), "utf-8");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Declarations of the first rule whose selector list is exactly `selector`. */
const block = (selector: string, source = theme) =>
  source.match(new RegExp(`(?:^|\\n)\\s*${escape(selector)}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
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

describe("button shape guard (DL-021, DL-023)", () => {
  it("projects the 12px squircle step from DesignMD", () => {
    expect(generated).toMatch(/--gg-radius-squircle:\s*12px;/);
    expect(theme).toMatch(/--radius-squircle:\s*var\(--gg-radius-squircle\);/);
  });

  it("makes a primary a capsule and a secondary or tertiary the squircle", () => {
    expect(declaration(block('.gg-button[data-emphasis="primary"]'), "border-radius")).toBe(
      "calc(var(--gg-button-block, 2.75rem) / 2)"
    );
    expect(declaration(block('.gg-button[data-emphasis="secondary"]'), "border-radius")).toBe(
      "var(--radius-squircle)"
    );
    expect(declaration(block('.gg-button[data-emphasis="tertiary"]'), "border-radius")).toBe(
      "var(--radius-squircle)"
    );
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

  it("keeps a 48px hit area on the two short sizes", () => {
    const hitArea = block(
      '.gg-button[data-size="sm"]::after,\n  .gg-button[data-size="compact"]::after'
    );
    expect(declaration(hitArea, "inset")).toBe(
      "calc((var(--gg-button-block) - 3rem) / 2) -0.25rem"
    );
  });

  it("morphs on press and keeps the resting shape under reduced motion (DL-001)", () => {
    expect(declaration(block('.gg-button[data-emphasis="primary"]:active'), "border-radius")).toBe(
      "var(--radius-squircle)"
    );
    expect(
      declaration(block('.gg-button[data-emphasis="secondary"]:active'), "border-radius")
    ).toBe("var(--radius-md)");
    const reduced = theme.slice(theme.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(
      declaration(block('.gg-button[data-emphasis="primary"]:active', reduced), "border-radius")
    ).toBe("calc(var(--gg-button-block, 2.75rem) / 2)");
    expect(
      declaration(block('.gg-button[data-emphasis="secondary"]:active', reduced), "border-radius")
    ).toBe("var(--radius-squircle)");
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

describe("field shape guard (DL-022)", () => {
  it("gives every default field the 16px corner at the 44px md height", () => {
    const control = block(".gg-control");
    expect(declaration(control, "border-radius")).toBe("var(--radius-lg)");
    expect(declaration(control, "min-height")).toBe("2.75rem");
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
