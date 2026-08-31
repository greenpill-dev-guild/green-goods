/**
 * @vitest-environment jsdom
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

import { AdminCheckbox } from "@/components/AdminCheckbox";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminTextField } from "@/components/AdminTextField";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "../test-utils";

const TONE_FOCUS_RING = "--tone-focus-ring";

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

  it("AdminInlineField focus ring rides the canonical role, not the accent-text role", () => {
    render(
      <AdminInlineField label="Action id" value="" onChange={vi.fn()} action={<span>Add</span>} />
    );
    const input = screen.getByRole("textbox");
    expect(input.className).toContain(TONE_FOCUS_RING);
    expect(input.className).not.toContain("--tone-on-surface-accent");
  });

  it("AdminTextField outlined focus treatment rides the canonical role", () => {
    render(<AdminTextField label="Garden name" variant="outlined" />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    // The outline ring lives on the input's container div. The floating label
    // and caret legitimately keep --tone-on-surface-accent (accent TEXT role);
    // only the ring itself must ride the focus role.
    const ringContainer = input.parentElement as HTMLElement;
    expect(ringContainer.className).toContain("ring-2");
    expect(ringContainer.className).toContain(TONE_FOCUS_RING);
    expect(ringContainer.className).not.toContain("--tone-on-surface-accent");
  });
});
