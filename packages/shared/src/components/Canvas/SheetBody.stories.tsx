import type { Meta, StoryObj } from "@storybook/react";
import { SheetBody } from "./SheetBody";

const meta: Meta<typeof SheetBody> = {
  title: "Shared/Canvas/Sheet anatomy/SheetBody",
  component: SheetBody,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "**SheetBody** — the scrollable middle slot for `LeftSheet` / `RightSheet` content.",
          "",
          "Anatomy from `design_handoff_admin-revamp/screens/sheet-system.css`:",
          "- `flex: 1; min-height: 0; overflow-y: auto` so it grows inside the sheet's flex column",
          "- Hidden scrollbar (no scrollbar gutter)",
          "- `padded={true}` (default) applies `20px 16px` padding for form-style content",
          "- `padded={false}` for edge-to-edge lists (notifications, member rosters)",
          "",
          "Compose with `<SheetFooter>` below for pinned-footer behavior.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        // SheetBody is a passive scroll container — no interactive role. It
        // inherits the parent dialog's focus context.
        rules: [{ id: "scrollable-region-focusable", enabled: true }],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SheetBody>;

const longContent = (
  <div className="space-y-3">
    <h3 className="text-base font-semibold text-text-strong">Account</h3>
    <p className="text-sm text-text-sub">
      Manage your wallet, network, theme, and notification preferences.
    </p>
    {Array.from({ length: 12 }, (_, i) => (
      <div
        key={i}
        className="rounded-md border border-stroke-soft bg-bg-white-0 p-3 text-sm text-text-strong"
      >
        Section item {i + 1} — placeholder content to demonstrate scroll behavior inside a sheet
        body. Hidden scrollbar keeps the visual quiet.
      </div>
    ))}
  </div>
);

const listContent = (
  <ul className="divide-y divide-stroke-soft">
    {[
      { id: "n1", title: "New submission pending", body: "Maria Garcia · 2m ago" },
      { id: "n2", title: "Submission flagged", body: "Luis Hernández · 18m ago" },
      { id: "n3", title: "Action certified", body: "Marta Vega · 1h ago" },
      { id: "n4", title: "New submission pending", body: "Diego Flores · 5h ago" },
    ].map((n) => (
      <li key={n.id} className="px-4 py-3">
        <div className="text-[13px] font-semibold text-text-strong">{n.title}</div>
        <div className="text-xs text-text-sub">{n.body}</div>
      </li>
    ))}
  </ul>
);

const sheetFrame = (children: React.ReactNode) => (
  <div
    className="flex flex-col overflow-hidden border border-stroke-soft bg-bg-white-0"
    style={{ width: 360, height: 480, borderRadius: "var(--radius-sheet, 24px)" }}
  >
    <div className="flex items-center justify-between border-b border-stroke-soft px-4 py-3">
      <span className="text-[15px] font-bold leading-tight">Account</span>
    </div>
    {children}
  </div>
);

/**
 * Default `padded={true}` — applies handoff `20px 16px` body padding for
 * form-shaped content (Profile, Settings, etc.).
 */
export const PaddedDefault: Story = {
  render: () => sheetFrame(<SheetBody padded={true}>{longContent}</SheetBody>),
};

/**
 * `padded={false}` — edge-to-edge for list-shaped content (Notifications,
 * member rosters). The list rows manage their own item-level padding.
 */
export const EdgeToEdgeList: Story = {
  render: () => sheetFrame(<SheetBody padded={false}>{listContent}</SheetBody>),
};

/**
 * Demonstrates `flex: 1` + scroll behavior — body fills available height and
 * scrolls when content overflows. Scrollbar is hidden by design.
 */
export const ScrollOverflow: Story = {
  render: () =>
    sheetFrame(
      <SheetBody padded={true}>
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="mb-2 rounded bg-bg-soft p-2 text-sm">
            Row {i + 1} of 30
          </div>
        ))}
      </SheetBody>
    ),
};
