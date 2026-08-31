/**
 * AdminDensityScale.guard — pins the compact cockpit metric (DL-011).
 *
 * The cockpit control scale is 28 / 32 / 36 / 40 / 44:
 *   buttons 28 (sm) / 32 (md) / 40 (lg) · fields 44 · toolbar pills 36 ·
 *   inline field 32 (button-row axis) · chips 32 · identity pill 36.
 * Shell chrome (AppBar, FAB, nav dock) is deliberately outside this scale.
 *
 * Heights are class-level contracts (h-* / min-h-*) because jsdom cannot
 * measure layout; the classes ARE the shipped geometry.
 *
 * @vitest-environment jsdom
 */

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
    expect(lg).toHaveClass("h-10");
    // 14px labels at every size — lg no longer jumps to body-lg.
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
    expect(lg).toHaveClass("h-10", "w-10");
    expect(md).toHaveAttribute("data-component", "AdminIconButton");
    expect(md).toHaveAttribute("title", "Remove Photo");
  });

  it("fields sit at the 44px tier with 14px control text", () => {
    render(<AdminTextField label="Garden name" />);

    const container = screen.getByRole("textbox", { name: "Garden name" }).parentElement;
    expect(container).not.toBeNull();
    expect(container).toHaveClass("min-h-11");
    expect(screen.getByRole("textbox", { name: "Garden name" })).toHaveClass("text-body-md");
    expect(screen.getByRole("textbox", { name: "Garden name" })).not.toHaveClass("text-body-lg");
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
