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

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RiAddLine } from "@remixicon/react";
import { describe, expect, it } from "vitest";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminListRow } from "@/components/AdminListRow";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { AdminTextField } from "@/components/AdminTextField";
import { render, screen } from "../test-utils";

describe("AdminDensityScale.guard (DL-011)", () => {
  it("buttons ride the 28/32/40 tiers as the shared Button's compact, sm and lg sizes", () => {
    render(
      <>
        <AdminButton size="sm">Small</AdminButton>
        <AdminButton size="md">Medium</AdminButton>
        <AdminButton size="lg">Large</AdminButton>
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
      expect(button).toHaveAttribute("data-component", "AdminButton");
    }
  });

  it("icon buttons ride the same 28/32/40 tiers with a mandatory accessible name", () => {
    render(
      <>
        <AdminIconButton size="sm" label="Move Up">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton size="md" label="Remove Photo">
          <RiAddLine />
        </AdminIconButton>
        <AdminIconButton size="lg" label="Open Settings">
          <RiAddLine />
        </AdminIconButton>
      </>
    );

    const sm = screen.getByRole("button", { name: "Move Up" });
    const md = screen.getByRole("button", { name: "Remove Photo" });
    const lg = screen.getByRole("button", { name: "Open Settings" });

    expect(sm).toHaveAttribute("data-size", "compact");
    expect(md).toHaveAttribute("data-size", "sm");
    expect(lg).toHaveAttribute("data-size", "lg");
    expect(md).toHaveClass("gg-icon-button");
    expect(md).toHaveAttribute("data-component", "AdminIconButton");
    expect(md).toHaveAttribute("title", "Remove Photo");
  });

  it("fields ride the responsive tier: 44px / 16px on touch widths, 40px / 14px from 640px (DL-030)", () => {
    render(<AdminTextField label="Garden name" />);

    const container = screen.getByRole("textbox", { name: "Garden name" }).parentElement;
    expect(container).not.toBeNull();
    expect(container).toHaveClass("min-h-11", "sm:min-h-10");
    const input = screen.getByRole("textbox", { name: "Garden name" });
    // The field role: 16px text on touch widths and 14px from 640px (index.css),
    // its 20px line centred in the tier: 12 + 20 + 12 and 10 + 20 + 10.
    expect(input).toHaveClass("type-field", "leading-5", "py-3", "sm:py-2.5");
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
      // lg and md land on the 40px lg tier, sm on the 32px md tier, compact on the
      // 28px sm tier: the same h-10 / h-8 / h-7 AdminButton renders above.
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
      // Each size capped at its block, as the fixed-height AdminButton was, so a
      // stretching row never grows a button.
      "--gg-button-block-cap-lg": "var(--gg-button-block-lg)",
      "--gg-button-block-cap-md": "var(--gg-button-block-md)",
      "--gg-button-block-cap-sm": "var(--gg-button-block-sm)",
      "--gg-button-block-cap-compact": "var(--gg-button-block-compact)",
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
    // The adapters reserve the old hit-target margin around each tier (DL-115):
    // 6px around 28 and 32px, 2px around 40px, on the adapters alone.
    const reserve = {
      "--gg-button-reserve-lg": "0.125rem",
      "--gg-button-reserve-md": "0.125rem",
      "--gg-button-reserve-sm": "0.375rem",
      "--gg-button-reserve-compact": "0.375rem",
    };
    expect(
      ggTokens(
        adminCss,
        ':where([data-component="AdminButton"], [data-component="AdminIconButton"]) {'
      )
    ).toEqual(reserve);
    expect(
      ggTokens(
        surfacesCss,
        '[data-surface-scope="admin"] :where([data-component="AdminButton"], [data-component="AdminIconButton"]) {'
      )
    ).toEqual(reserve);
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
