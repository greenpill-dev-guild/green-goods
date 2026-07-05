import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { SheetBody } from "./SheetBody";
import { SheetFooter } from "./SheetFooter";

const meta: Meta<typeof SheetFooter> = {
  title: "Shared/Canvas/Sheet anatomy/SheetFooter",
  component: SheetFooter,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "**SheetFooter** — pinned action footer for dialog / inspector panels.",
          "",
          "Anatomy from `design_handoff_admin-revamp/screens/sheet-system.css`:",
          "- `padding: 12px 16px`",
          "- `border-top: 1px solid var(--hairline)`",
          "- `display: flex; align-items: center; gap: 8px`",
          "- `flex-shrink: 0` — keeps the footer pinned while `<SheetBody>` scrolls above",
          "- `background: var(--surface-raised)` so it sits cleanly above translucent content",
          "",
          "Compose with `<SheetBody>` above for the handoff pinned-footer pattern.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "button-name", enabled: true },
          { id: "color-contrast", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SheetFooter>;

const sheetFrame = (children: React.ReactNode) => (
  <div
    className="flex flex-col overflow-hidden border border-stroke-soft bg-bg-white-0"
    style={{ width: 360, height: 360, borderRadius: "var(--radius-sheet, 24px)" }}
  >
    {children}
  </div>
);

const ghostBtnClass =
  "rounded-full border border-outline px-3 py-1.5 text-sm font-medium text-text-strong hover:bg-bg-soft";
const primaryBtnClass = "rounded-full px-4 py-1.5 text-sm font-semibold text-bg-white-0";
const dangerBtnClass =
  "rounded-full px-4 py-1.5 text-sm font-medium text-error-base hover:bg-error-lighter";

/**
 * Save + Cancel pair — the canonical form footer. Save anchors right; cancel
 * sits next to it. Spacer in between collapses naturally.
 */
export const SaveAndCancel: Story = {
  render: () => (
    <SheetFooter>
      <button type="button" className={ghostBtnClass} onClick={fn()}>
        Cancel
      </button>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className={primaryBtnClass}
        style={{ background: "rgb(var(--tone-action, var(--green-800)))" }}
        onClick={fn()}
      >
        Save changes
      </button>
    </SheetFooter>
  ),
};

/**
 * Single danger action — full-width "Disconnect" / "Sign out" pattern. Pinned
 * to bottom even when SheetBody is short.
 */
export const SingleDangerAction: Story = {
  render: () =>
    sheetFrame(
      <>
        <SheetBody padded={true}>
          <div className="text-sm text-text-sub">Account preferences live here.</div>
        </SheetBody>
        <SheetFooter>
          <button type="button" className={`${dangerBtnClass} w-full text-left`} onClick={fn()}>
            Disconnect
          </button>
        </SheetFooter>
      </>
    ),
};

/**
 * Three-button group — multi-step wizard pattern (Back / Skip / Continue).
 */
export const ThreeButtonGroup: Story = {
  render: () => (
    <SheetFooter>
      <button type="button" className={ghostBtnClass} onClick={fn()}>
        Back
      </button>
      <button type="button" className={ghostBtnClass} onClick={fn()}>
        Skip
      </button>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className={primaryBtnClass}
        style={{ background: "rgb(var(--tone-action, var(--green-800)))" }}
        onClick={fn()}
      >
        Continue
      </button>
    </SheetFooter>
  ),
};

/**
 * Pinned-footer composition — long SheetBody scrolls; SheetFooter stays
 * anchored at the bottom of the sheet shell.
 */
export const PinnedFooterWithLongBody: Story = {
  render: () =>
    sheetFrame(
      <>
        <SheetBody padded={true}>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="mb-2 rounded bg-bg-soft p-2 text-sm">
              Form row {i + 1}
            </div>
          ))}
        </SheetBody>
        <SheetFooter>
          <button type="button" className={ghostBtnClass} onClick={fn()}>
            Cancel
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className={primaryBtnClass}
            style={{ background: "rgb(var(--tone-action, var(--green-800)))" }}
            onClick={fn()}
          >
            Save
          </button>
        </SheetFooter>
      </>
    ),
};
