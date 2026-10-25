/**
 * AdminDensityScale.guard — pins the compact cockpit metric (DL-011).
 *
 * The cockpit control scale is 28 / 32 / 36 / 40 / 44:
 *   buttons 28 (sm) / 32 (md) / 40 (lg), the shared Button's compact / sm / lg
 *   on the cockpit's tokens (DL-115) · fields 44 on touch widths and 40 from
 *   640px (DL-030) · toolbar pills 36 · inline field 32 (button-row axis) ·
 *   chips 32 · identity pill 36 · list rows from 44, growing with their content.
 * Shell chrome (AppBar, FAB, nav dock) is deliberately outside this scale.
 *
 * Heights are class-level contracts (h-* / min-h-*) because jsdom cannot
 * measure layout; the classes ARE the shipped geometry.
 *
 * @vitest-environment happy-dom
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiAddLine } from "@remixicon/react";
import { describe, expect, it } from "vitest";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminListRow } from "@/components/AdminListRow";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { AdminTextField } from "@/components/AdminTextField";
import { render, screen } from "../test-utils";

/** Every .tsx file under `dir`, stories and tests left out. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.(stories|test)\.tsx$/.test(name) ? [path] : [];
  });

/**
 * The text of each JSX opening tag `pattern` finds, up to its closing `>` outside braces,
 * with block and whole-line comments left out.
 */
const openingTags = (raw: string, pattern: RegExp): string[] => {
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return Array.from(source.matchAll(pattern), (match) => {
    const start = match.index ?? 0;
    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    return source.slice(start, end);
  });
};

describe("AdminDensityScale.guard (DL-011)", () => {
  it("buttons ride the 28/32/40 tiers as the shared Button's compact, sm and lg sizes", () => {
    render(
      <>
        <Button type="button" size="compact">
          Small
        </Button>
        <Button type="button" size="sm">
          Medium
        </Button>
        <Button type="button" size="lg">
          Large
        </Button>
      </>
    );

    const sm = screen.getByRole("button", { name: "Small" });
    const md = screen.getByRole("button", { name: "Medium" });
    const lg = screen.getByRole("button", { name: "Large" });

    // The heights, the 44px finger box and the one 14px label come from the
    // tokens pinned below: compact 28, sm 32, lg 40 (DL-115, DL-031).
    for (const [button, size] of [
      [sm, "compact"],
      [md, "sm"],
      [lg, "lg"],
    ] as const) {
      expect(button).toHaveClass("gg-button");
      expect(button).toHaveAttribute("data-size", size);
    }
  });

  it("icon buttons ride the same 28/32/40 tiers with a mandatory accessible name", () => {
    render(
      <>
        <IconButton size="compact" aria-label="Move Up" title="Move Up" icon={<RiAddLine />} />
        <IconButton size="sm" aria-label="Remove Photo" title="Remove Photo" icon={<RiAddLine />} />
        <IconButton
          size="lg"
          aria-label="Open Settings"
          title="Open Settings"
          icon={<RiAddLine />}
        />
      </>
    );

    const sm = screen.getByRole("button", { name: "Move Up" });
    const md = screen.getByRole("button", { name: "Remove Photo" });
    const lg = screen.getByRole("button", { name: "Open Settings" });

    expect(sm).toHaveAttribute("data-size", "compact");
    expect(md).toHaveAttribute("data-size", "sm");
    expect(lg).toHaveAttribute("data-size", "lg");
    expect(md).toHaveClass("gg-icon-button");
    expect(md).toHaveAttribute("title", "Remove Photo");
  });

  it("fields ride the responsive tier: 44px / 16px on touch widths, 40px / 14px from 640px (DL-030)", () => {
    render(<AdminTextField label="Garden name" />);

    // The field is Shared's control on the admin surface (DL-116), whose recipe holds the tier.
    const input = screen.getByRole("textbox", { name: "Garden name" });
    expect(input).toHaveAttribute("data-component", "TextInput");
    expect(input).toHaveAttribute("data-surface", "admin");
    const theme = readFileSync(
      resolve(__dirname, "../../../../shared/src/styles/theme.css"),
      "utf-8"
    );
    const rule = (selector: RegExp) => theme.match(selector)?.[1] ?? "";
    const touch = rule(/\n\s*input\.gg-control\[data-surface="admin"\],[^{]*\{([^}]*)\}/);
    expect(touch).toMatch(/block-size:\s*2\.75rem/);
    const desktop = theme.slice(theme.indexOf("@media (min-width: 40rem)"));
    expect(rule(/\.gg-control\[data-surface="admin"\]\s*\{([^}]*)\}/)).toMatch(
      /font-size:\s*var\(--type-body-lg/
    );
    expect(desktop).toMatch(
      /input\.gg-control\[data-surface="admin"\],[^{]*\{[^}]*block-size:\s*2\.5rem/
    );
    expect(desktop).toMatch(
      /\.gg-control\[data-surface="admin"\]\s*\{[^}]*font-size:\s*var\(--type-body-md/
    );
  });

  it("list rows grow with their content above the 44px floor, never on a button tier", () => {
    render(
      <AdminListRow>
        <span>Canopy baseline</span>
        <span>Sep 23, 2026</span>
      </AdminListRow>
    );

    const row = screen.getByRole("button", { name: /Canopy baseline/ });
    expect(row).toHaveClass("block", "w-full", "min-h-11");
    expect(row.className).not.toMatch(/(^|\s)h-(7|8|10)(\s|$)/);
  });

  it("the inline field shares the 32px md-button axis", () => {
    render(
      <AdminInlineField
        label="Action id"
        value=""
        onChange={() => {}}
        action={<button type="button">Register</button>}
      />
    );
    expect(screen.getByRole("textbox", { name: /Action id/ })).toHaveClass("h-8");
  });

  it("maps the shared family onto the cockpit tiers through index.css tokens, mirrored in Storybook (DL-031)", () => {
    const adminCss = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");
    const surfacesCss = readFileSync(
      resolve(__dirname, "../../../../shared/.storybook/surfaces.css"),
      "utf-8"
    );
    const ggTokens = (source: string, from: string) => {
      const start = source.indexOf(from);
      expect(start).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("\n}", start));
      return Object.fromEntries(
        Array.from(body.matchAll(/^\s*(--gg-[\w-]+):\s*([^;]+);/gm), (m) => [m[1], m[2].trim()])
      );
    };
    // The unlayered :root block in index.css (the shared theme layer declares
    // --gg-label-* inside @layer theme, so only an unlayered rule outranks it).
    const admin = ggTokens(adminCss, "\n:root {");
    expect(admin).toEqual({
      "--gg-button-radius": "var(--radius-full)",
      "--gg-button-radius-pressed": "var(--radius-full)",
      "--gg-button-radius-compact": "var(--radius-full)",
      "--gg-button-radius-compact-pressed": "var(--radius-full)",
      "--gg-button-weight": "500",
      "--gg-label-md": "0.875rem",
      "--gg-label-sm": "0.875rem",
      // lg and md land on the 40px tier, sm on 32px and compact on 28px: the
      // tiers the buttons above render.
      "--gg-button-block-lg": "2.5rem",
      "--gg-button-block-md": "2.5rem",
      "--gg-button-block-sm": "2rem",
      "--gg-button-block-compact": "1.75rem",
      "--gg-button-inline-lg": "1.25rem",
      "--gg-button-inline-md": "1.25rem",
      "--gg-button-inline-sm": "1rem",
      "--gg-button-inline-compact": "0.625rem",
      "--gg-icon-size-lg": "2.5rem",
      "--gg-icon-size-md": "2.5rem",
      "--gg-icon-size-sm": "2rem",
      "--gg-icon-size-compact": "1.75rem",
      "--gg-hit-block": "2.75rem",
      // The cockpit's look on the shared family (DL-115): no press scale, round
      // icon buttons with an 18px glyph, and the neutral disabled pair instead of
      // a dim, with an aria-disabled button keeping its pointer for a hover reason.
      // Each size capped at its block, as the cockpit's fixed-height pill was, so a
      // stretching row never grows a button, with the hit-target classes' margin
      // reserved around it, 6px around 28 and 32px and 2px around 40px (DL-119).
      "--gg-button-block-cap-lg": "var(--gg-button-block-lg)",
      "--gg-button-block-cap-md": "var(--gg-button-block-md)",
      "--gg-button-block-cap-sm": "var(--gg-button-block-sm)",
      "--gg-button-block-cap-compact": "var(--gg-button-block-compact)",
      "--gg-button-reserve-lg": "0.125rem",
      "--gg-button-reserve-md": "0.125rem",
      "--gg-button-reserve-sm": "0.375rem",
      "--gg-button-reserve-compact": "0.375rem",
      "--gg-button-pressed-transform": "none",
      "--gg-icon-button-glyph": "1.125rem",
      "--gg-icon-button-radius-pressed": "var(--radius-full)",
      "--gg-button-disabled-opacity": "1",
      "--gg-button-disabled-fill": "rgb(var(--m3-on-surface) / 0.12)",
      "--gg-button-disabled-ink": "rgb(var(--m3-on-surface) / 0.38)",
      "--gg-button-aria-disabled-events": "auto",
      // Shared fields, secondary buttons and chips draw the cockpit's control-grade
      // outline, and focus draws one solid 2px ring with no halo (F3).
      "--gg-control-outline": "var(--m3-outline)",
      "--gg-focus-ring-width": "2px",
      "--gg-focus-halo-alpha": "0",
      // The message line under every field reserves two lines, as the app's do (F3).
      "--gg-field-message-lines": "2",
      // A selected chip lays the neutral ink layer at the cockpit's state
      // opacities on hover and press; the app sets neither (DL-116).
      "--gg-chip-state-hover": "var(--m3-state-hover)",
      "--gg-chip-state-pressed": "var(--m3-state-pressed)",
      // The state block's calm mark stays neutral: the workspace tone keeps to
      // its budget (Rule 18).
      "--gg-state-mark-fill": "rgb(var(--text-strong-950) / 0.06)",
      "--gg-state-mark-ink": "rgb(var(--text-sub-600))",
      // The type roles at the cockpit's density: titles 22 / 16 / 14, body and
      // labels 14 at -0.006em, small labels and meta 12 (labels at 500), chips 11,
      // and field text 16px on touch widths (14px from 640px, a media rule).
      "--gg-type-title-lg-size": "1.375rem",
      "--gg-type-title-lg-line": "1.75rem",
      "--gg-type-title-md-size": "1rem",
      "--gg-type-title-md-line": "1.5rem",
      "--gg-type-title-sm-size": "0.875rem",
      "--gg-type-title-sm-line": "1.25rem",
      "--gg-type-body-size": "0.875rem",
      "--gg-type-body-line": "1.25rem",
      "--gg-type-body-tracking": "-0.006em",
      "--gg-type-label-size": "0.875rem",
      "--gg-type-label-line": "1.25rem",
      "--gg-type-label-tracking": "-0.006em",
      "--gg-type-label-sm-size": "0.75rem",
      "--gg-type-label-sm-line": "1rem",
      "--gg-type-label-sm-weight": "500",
      "--gg-type-label-sm-tracking": "0px",
      "--gg-type-meta-size": "0.75rem",
      "--gg-type-meta-line": "1rem",
      "--gg-type-meta-sm-size": "0.6875rem",
      "--gg-type-meta-sm-line": "1rem",
      "--gg-type-field-size": "1rem",
      "--gg-type-field-line": "1.25rem",
      "--gg-type-field-tracking": "0px",
      // The phone sheet (F5): the card step and its hairline under the shared
      // sheet material, and the 22px dialog title in the shared header.
      "--gg-sheet-fill": "rgb(var(--admin-surface-0))",
      "--gg-sheet-edge": "rgb(var(--neutral-200))",
      "--gg-sheet-title-size": "var(--gg-type-title-lg-size)",
      "--gg-sheet-title-line": "var(--gg-type-title-lg-line)",
      // A card's one-line title at 13px / 600 (F7), and the shared card surface
      // on the cockpit's own ladder: its card, the app's linen-grade edge and
      // the fill one step above the card.
      "--gg-type-card-title-size": "0.8125rem",
      "--gg-type-card-title-line": "1.125rem",
      "--gg-type-card-title-weight": "600",
      "--gg-card-surface": "var(--admin-surface-0)",
      "--gg-card-edge": "var(--neutral-200)",
      "--gg-card-fill": "var(--m3-surface-container-high)",
    });
    // The Storybook admin scope must render what production renders.
    expect(ggTokens(surfacesCss, '[data-surface-scope="admin"] {')).toEqual(admin);
    // In dark the sheet is the lifted card with its hairline, and the disabled
    // pair takes the dark ink, re-declared so a dark scope below the root
    // resolves its own.
    const dark = {
      "--gg-sheet-fill": "rgb(var(--admin-surface-0))",
      "--gg-sheet-edge": "rgb(var(--earth-700))",
      "--gg-button-disabled-fill": "rgb(var(--m3-on-surface) / 0.12)",
      "--gg-button-disabled-ink": "rgb(var(--m3-on-surface) / 0.38)",
    };
    expect(ggTokens(adminCss, '\n[data-theme="dark"] {\n  --gg-sheet')).toEqual(dark);
    expect(
      ggTokens(surfacesCss, '[data-surface-scope="admin"][data-theme="dark"] {')
    ).toMatchObject(dark);
  });

  it("keeps the glyph tier and the disabled pair over call-site classes, and skips a shared piece's own buttons (DL-119)", () => {
    const adminCss = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");
    const surfacesCss = readFileSync(
      resolve(__dirname, "../../../../shared/.storybook/surfaces.css"),
      "utf-8"
    );
    const themeCss = readFileSync(
      resolve(__dirname, "../../../../shared/src/styles/theme.css"),
      "utf-8"
    );
    const declarations = (source: string, selector: string) => {
      const start = source.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      return source.slice(start, source.indexOf("\n}", start)).replace(/\s+/g, " ");
    };
    // Outside every layer in index.css, so an icon's h-4 w-4 or a call site's
    // warning colors never win over the tier or the pair (the utilities layer
    // beats the shared rules in the components layer).
    for (const [selector, body] of [
      [
        ".gg-icon-button:not([data-piece-control]) svg",
        "inline-size: var(--gg-icon-button-glyph, 1.25rem);",
      ],
      ['.gg-icon-button[data-size="compact"]:not([data-piece-control]) svg', "inline-size: 1rem;"],
      [
        '.gg-button[data-emphasis]:is(:disabled, [aria-disabled="true"])',
        "background: var(--gg-button-disabled-fill, var(--gg-button-fill));",
      ],
      [
        '.gg-icon-button:is(:disabled, [aria-disabled="true"])',
        "color: var(--gg-button-disabled-ink, var(--gg-icon-button-ink));",
      ],
    ] as const) {
      expect(declarations(adminCss, selector)).toContain(body);
      expect(declarations(surfacesCss, `[data-surface-scope="admin"] ${selector}`)).toContain(body);
      // At the top level: no brace left open before it, so no @layer holds it.
      const before = adminCss
        .slice(0, adminCss.indexOf(`${selector} {`))
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(before.split("{").length - before.split("}").length, selector).toBe(0);
    }
    // A shared piece's own buttons keep the app's layout: no reserve, no cap.
    const reset = declarations(themeCss, "  :is(.gg-button, .gg-icon-button)[data-piece-control]");
    for (const size of ["lg", "md", "sm", "compact"]) {
      expect(reset).toContain(`--gg-button-reserve-${size}: 0;`);
      expect(reset).toContain(`--gg-button-block-cap-${size}: none;`);
    }
    // Every Button or IconButton a shared piece renders carries the mark.
    const sharedComponents = resolve(__dirname, "../../../../shared/src/components");
    const files = sourceFiles(sharedComponents);
    const unmarked = files.flatMap((file) =>
      openingTags(readFileSync(file, "utf-8"), /<(Button|IconButton)\b/g)
        .filter((tag) => !tag.includes("data-piece-control"))
        .map((tag) => `${file.slice(sharedComponents.length + 1)}: ${tag.slice(0, 40)}`)
    );
    expect(files.length).toBeGreaterThan(0);
    expect(unmarked).toEqual([]);
  });

  it("names the type on every cockpit Button, so one in a form never submits it by accident", () => {
    // The shared Button leaves `type` to its caller, where a native button
    // defaults to submit; a link drawn as one (`asChild`) has none.
    const adminSource = resolve(__dirname, "../..");
    const files = sourceFiles(adminSource);
    const untyped = files.flatMap((file) =>
      openingTags(readFileSync(file, "utf-8"), /<Button\b/g)
        .filter((tag) => !/\btype=|\basChild\b|\{\.\.\./.test(tag))
        .map((tag) => `${file.slice(adminSource.length + 1)}: ${tag.slice(0, 60)}`)
    );
    expect(files.length).toBeGreaterThan(0);
    expect(untyped).toEqual([]);
  });

  it("tunes the shared state block only through its tokens, never by restyling it (DL-031, DL-106)", () => {
    // Storybook never loads these stylesheets, so a rule in them that restyles the block reaches
    // only the running cockpit: four such rules drew every cockpit state at a 72px tile, a 22px
    // title and a 16px line until acceptance pass 1. The cockpit sets --gg-state-mark-* instead.
    const stylesDir = resolve(__dirname, "../../styles");
    const stylesheets = [
      resolve(__dirname, "../../index.css"),
      ...readdirSync(stylesDir)
        .filter((name) => name.endsWith(".css"))
        .map((name) => resolve(stylesDir, name)),
    ];
    const offenders = stylesheets.flatMap((path) => {
      const css = readFileSync(path, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
      return [...css.matchAll(/([^{}]+)\{/g)]
        .map((match) => match[1].trim())
        .filter((selector) => /data-component="EmptyState"|\.gg-state-mark/.test(selector))
        .map((selector) => `${path.split("/src/")[1]}: ${selector}`);
    });
    expect(offenders).toEqual([]);
  });

  it("toolbar pills sit at the 36px tier", () => {
    render(
      <>
        <AdminSearchToolbar search="" onSearchChange={() => {}} placeholder="Search gardens" />
        <AdminSortSelect
          value="recent"
          onChange={() => {}}
          options={[{ value: "recent", label: "Newest" }]}
        />
      </>
    );

    const searchPill = screen.getByRole("textbox").closest('[class*="m3-shape-full"]');
    expect(searchPill?.className ?? "").toContain("h-9");
    const sortPill = screen.getByRole("combobox").closest("label");
    expect(sortPill?.className ?? "").toContain("h-9");
  });
});
