import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { SheetBody } from "./SheetBody";
import { SheetFooter } from "./SheetFooter";

const meta: Meta<typeof SheetBody> = {
  title: "Shared/Canvas/Sheet anatomy/SheetBody",
  component: SheetBody,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "**SheetBody** — the scrollable middle slot for dialog / inspector panel content.",
          "",
          "Anatomy from `design_handoff_admin-revamp/screens/sheet-system.css`:",
          "- `flex: 1; min-height: 0; overflow-y: auto` so it grows inside the sheet's flex column",
          "- Hidden scrollbar (no scrollbar gutter)",
          "- `padded={true}` (default) applies `20px 16px` padding for form-style content",
          "- The host sheet can retune that inset through `--gg-sheet-body-padding` (and the footer's through `--gg-sheet-footer-padding`); the cockpit's docked side sheet sets 24px sides from 640px",
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
 * A host sheet that sets `--gg-sheet-body-padding` and `--gg-sheet-footer-padding`
 * moves both insets at once, as the cockpit's docked side sheet does at 24px so
 * its content lines up with its header; a host that sets nothing keeps the
 * handoff's 16px (see `PaddedDefault`).
 */
export const HostInset: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div
      data-testid="host-sheet"
      className="flex flex-col overflow-hidden border border-stroke-soft bg-bg-white-0"
      style={
        {
          width: 360,
          height: 360,
          borderRadius: "var(--radius-sheet, 24px)",
          "--gg-sheet-body-padding": "20px 24px",
          "--gg-sheet-footer-padding": "12px 24px",
        } as React.CSSProperties
      }
    >
      <SheetBody padded={true}>
        <div className="text-sm text-text-sub">
          The body starts 24px in, level with the header title.
        </div>
      </SheetBody>
      <SheetFooter>
        <button
          type="button"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-error-base hover:bg-error-lighter"
        >
          Disconnect
        </button>
      </SheetFooter>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const host = within(canvasElement).getByTestId("host-sheet");
    const body = host.querySelector<HTMLElement>('[data-component="SheetBody"]');
    const footer = host.querySelector<HTMLElement>('[data-component="SheetFooter"]');
    if (!body || !footer) throw new Error("SheetBody or SheetFooter not found");
    await expect(getComputedStyle(body).padding).toBe("20px 24px");
    await expect(getComputedStyle(footer).padding).toBe("12px 24px");
  },
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
