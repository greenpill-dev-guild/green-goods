/**
 * AdminDensityScale.guard — pins the compact cockpit metric (DL-011).
 *
 * The cockpit control scale is 28 / 32 / 36 / 40 / 44:
 *   buttons 28 (sm) / 32 (md) / 40 (lg) · fields 44 on touch widths and 40 from
 *   640px (DL-030) · toolbar pills 36 · inline field 32 (button-row axis) ·
 *   chips 32 · identity pill 36.
 * Shell chrome (AppBar, FAB, nav dock) is deliberately outside this scale.
 *
 * Heights are class-level contracts (h-* / min-h-*) because jsdom cannot
 * measure layout; the classes ARE the shipped geometry.
 *
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RiAddLine } from "@remixicon/react";
import { describe, expect, it } from "vitest";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { AdminTextField } from "@/components/AdminTextField";
import { render, screen } from "../test-utils";

describe("AdminDensityScale.guard (DL-011)", () => {
  it("buttons ride the 28/32/40 compact tiers with expanded hit targets below 44px", () => {
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

    expect(sm).toHaveClass("h-7");
    expect(sm).toHaveClass("admin-hit-target");
    expect(md).toHaveClass("h-8");
    expect(md).toHaveClass("admin-hit-target");
    expect(lg).toHaveClass("h-10", "admin-hit-target-lg");
    // One 14px label at every size (DL-030): sm no longer drops to label-sm.
    expect(sm).toHaveClass("text-label-lg");
    expect(sm).not.toHaveClass("text-label-sm");
    expect(lg).not.toHaveClass("text-body-lg");
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

    expect(sm).toHaveClass("h-7", "w-7", "admin-hit-target");
    expect(md).toHaveClass("h-8", "w-8", "admin-hit-target");
    expect(lg).toHaveClass("h-10", "w-10", "admin-hit-target-lg");
    expect(md).toHaveAttribute("data-component", "AdminIconButton");
    expect(md).toHaveAttribute("title", "Remove Photo");
  });

  it("fields ride the responsive tier: 44px / 16px on touch widths, 40px / 14px from 640px (DL-030)", () => {
    render(<AdminTextField label="Garden name" />);

    const container = screen.getByRole("textbox", { name: "Garden name" }).parentElement;
    expect(container).not.toBeNull();
    expect(container).toHaveClass("min-h-11", "sm:min-h-10");
    const input = screen.getByRole("textbox", { name: "Garden name" });
    expect(input).toHaveClass("text-body-lg", "sm:text-body-md", "pt-5", "sm:pt-4");
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
    });
    // The Storybook admin scope must render what production renders.
    expect(ggTokens(surfacesCss, '[data-surface-scope="admin"] {')).toEqual(admin);
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
