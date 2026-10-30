/**
 * @vitest-environment happy-dom
 *
 * Focus-ring role guard — Cockpit M3 1a (PRD-644 round 2).
 *
 * `--tone-focus-ring` is the ONLY focus-indicator role in the cockpit
 * (packages/admin/DESIGN.md § Workspace Tinting). The 2026-08-29 audit found
 * AdminCheckbox keyboard-invisible, the AdminSearchToolbar input stripped of
 * any indicator, and the two field primitives ringing with
 * `--tone-on-surface-accent`. These assertions pin every one of them to the
 * canonical role so the class strings cannot silently regress.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADMIN_WORKSPACE_ROOTS } from "@green-goods/shared/utils/navigation/admin-routes";
import { describe, expect, it, vi } from "vitest";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTextField } from "@/components/AdminTextField";
import { fireEvent, render, screen } from "../test-utils";

const TONE_FOCUS_RING = "--tone-focus-ring";

/** Shared's control recipe, which the cockpit's fields render (DL-116). */
const theme = readFileSync(resolve(__dirname, "../../../../shared/src/styles/theme.css"), "utf-8");
const takesSharedRing = (input: HTMLElement) => {
  expect(input).toHaveClass("gg-control");
  expect(input.className).not.toContain("--tone-on-surface-accent");
  // The shared control resolves its ring from the tone where it sits, and draws it on focus.
  expect(theme).toMatch(
    /:where\(\.gg-control,[^)]*\)\s*\{\s*--gg-focus-ring:\s*var\(--tone-focus-ring,/
  );
  expect(theme).toMatch(
    /\.gg-control:focus-visible\s*\{[^}]*outline:\s*var\(--gg-focus-ring-width\)\s*solid\s*rgb\(var\(--gg-focus-ring\)\)/
  );
};

describe("admin focus-ring role", () => {
  it("AdminCheckbox input carries a visible focus-visible ring on the canonical role", () => {
    render(<AdminCheckbox label="Accept charter" />);
    const input = screen.getByRole("checkbox");
    expect(input.className).toContain("focus-visible:ring-2");
    expect(input.className).toContain(TONE_FOCUS_RING);
  });

  it("AdminSearchToolbar pill shows the canonical ring while its input is focused", () => {
    render(<AdminSearchToolbar search="" onSearchChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    const pill = input.parentElement as HTMLElement;
    expect(pill.className).toContain(TONE_FOCUS_RING);
  });

  it("AdminInlineField takes the shared control's ring, on the canonical role", () => {
    render(
      <AdminInlineField label="Action id" value="" onChange={vi.fn()} action={<span>Add</span>} />
    );
    takesSharedRing(screen.getByRole("textbox"));
  });

  it("AdminTextField takes the shared control's ring, on the canonical role", () => {
    render(<AdminTextField label="Garden name" />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    takesSharedRing(input);
    // No wrapper draws a second ring around it.
    expect((input.parentElement as HTMLElement).className).not.toContain("ring-");
  });

  it("re-points the focus ring on workspace scopes only, never on a piece's own tone", () => {
    // The shared Button and the state block carry a data-tone of their own (danger,
    // neutral). Matched by a bare [data-tone] rule, a danger button re-derived its
    // ring from the green fallback and kept the light ring in dark outside a workspace.
    const tokens = readFileSync(resolve(__dirname, "../../styles/admin-m3-tokens.css"), "utf-8");
    const rules = Array.from(
      tokens.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g),
      ([, selector, body]) => ({ selector, body })
    );
    const tonedRepoints = rules.filter(
      ({ selector, body }) => selector.includes("data-tone") && body.includes("--focus-ring:")
    );

    expect(tonedRepoints).toHaveLength(1);
    const [{ selector }] = tonedRepoints;
    expect(selector).not.toContain("[data-tone]");
    const named = Array.from(selector.matchAll(/\[data-tone="([^"]+)"\]/g), ([, tone]) => tone);
    expect(named.sort()).toEqual(Object.keys(ADMIN_WORKSPACE_ROOTS).sort());
  });

  it("no elevation token voids the focus ring that shares its box-shadow", () => {
    // Tailwind joins an elevation shadow arbitrary and ring utilities into one
    // box-shadow list, and `none` inside a list voids the whole declaration.
    const tokens = readFileSync(resolve(__dirname, "../../styles/admin-m3-tokens.css"), "utf-8");
    const value = (level: string) =>
      Array.from(tokens.matchAll(new RegExp(`--m3-elevation-${level}:\\s*([^;]+);`, "g")), (m) =>
        m[1].trim()
      );

    expect(value("\\d+").length).toBeGreaterThan(0);
    expect(value("\\d+")).not.toContain("none");
    // Light and dark level 0: a transparent zero shadow, as Tailwind's shadow-none sets.
    expect(value("0")).toEqual(["0 0 transparent", "0 0 transparent"]);
  });
});
