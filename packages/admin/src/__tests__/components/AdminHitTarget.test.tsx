/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AdminButton } from "@/components/AdminButton";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { renderWithProviders, screen } from "../test-utils";

describe("compact admin hit targets", () => {
  it("reserves the full 44px block size around 32px visual controls", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/admin-m3-tokens.css"), "utf8");

    expect(css).toMatch(/\.admin-hit-target\s*{[^}]*margin-block:\s*0\.375rem;/s);
    expect(css).toMatch(/\.admin-hit-target::before\s*{[^}]*height:\s*max\(100%, 2\.75rem\);/s);
  });

  it("applies the reserved hit target to each compact primitive", () => {
    renderWithProviders(
      <>
        <AdminButton size="sm">Review</AdminButton>
        <AdminFilterChip label="Open" selected={false} onToggle={vi.fn()} />
      </>
    );

    expect(screen.getByRole("button", { name: "Review" })).toHaveClass("admin-hit-target");
    expect(screen.getByRole("button", { name: "Open" })).toHaveClass("admin-hit-target");
  });
});
