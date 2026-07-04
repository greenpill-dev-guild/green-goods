import { SheetBody, SheetFooter } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminButton } from "./AdminButton";
import { AdminSideSheet } from "./AdminSideSheet";

const meta: Meta<typeof AdminSideSheet> = {
  title: "Admin/Primitives/AdminSideSheet",
  component: AdminSideSheet,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminSideSheet** - M3 modal side sheet reserved for the three",
          "global AppBar surfaces (Profile, Settings, Notifications).",
          "AdminDialog's sibling: same scrim, hairline header, close button,",
          "tone re-establishment, and instant-exit handling - only the",
          "geometry differs.",
          "",
          "**Responsive**: right-docked full-height panel at >= 640px,",
          "AdminDialog-identical bottom sheet below (the mobile notification",
          "bell keeps its glance-and-dismiss behavior).",
          "",
          "**Scope**: workspace action/detail/creation overlays stay centered",
          "`AdminDialog`s - enforced by AdminSideSheetStandard.guard.test.ts.",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "aria-dialog-name", enabled: true },
          { id: "color-contrast", enabled: true },
          { id: "button-name", enabled: true },
          { id: "focus-order-semantics", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminSideSheet>;

const SM_BREAKPOINT_PX = 640;
const EDGE_TOLERANCE_PX = 2;

const SAMPLE_ROWS = (
  <ul className="flex flex-col gap-2">
    {Array.from({ length: 12 }, (_, i) => (
      <li
        key={i}
        className="rounded-md border border-stroke-soft bg-bg-white-0 p-3 text-sm text-text-sub"
      >
        {`Row ${i + 1} — the panel content owns scrolling via SheetBody.`}
      </li>
    ))}
  </ul>
);

/**
 * Wait for the sheet's enter animation to finish so geometry is measured at
 * rest (the admin-owned keyframes animate transform + opacity).
 */
async function waitForSheetSettled(surface: HTMLElement) {
  await Promise.all(
    surface.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {}))
  );
}

function getOpenSurface(): HTMLElement {
  const surface = document.querySelector<HTMLElement>(
    '[data-component="AdminSideSheet"][data-slot="surface"][data-state="open"]'
  );
  if (!surface) throw new Error("AdminSideSheet surface not found");
  return surface;
}

/** Renders an already-open sheet so geometry assertions are deterministic. */
function OpenSideSheet({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
      Side sheet renders open (portaled to the document body).
      <AdminSideSheet open onOpenChange={() => undefined} title="Notifications" tone="hub">
        {children ?? <SheetBody padded>{SAMPLE_ROWS}</SheetBody>}
      </AdminSideSheet>
    </div>
  );
}

export const Default: Story = {
  tags: ["storybook-ci"],
  render: () => <OpenSideSheet />,
  play: async () => {
    const body = within(document.body);
    const sheet = await body.findByRole("dialog");
    await expect(within(sheet).getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(within(sheet).getByRole("button", { name: "Close" })).toBeVisible();

    const surface = getOpenSurface();
    await waitForSheetSettled(surface);
    const rect = surface.getBoundingClientRect();
    // A fixed element with right:0 / bottom:0 docks to the layout viewport
    // (documentElement.clientWidth/clientHeight) — NOT innerWidth/innerHeight,
    // which include the scrollbar and would read ~15px off whenever the story
    // canvas scrolls, failing a correct component.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    if (vw >= SM_BREAKPOINT_PX) {
      // Right-docked, full height.
      await expect(Math.abs(rect.right - vw)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      await expect(Math.abs(rect.top)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      await expect(Math.abs(rect.bottom - vh)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      // One shared width token, never wider than 560px + tolerance.
      await expect(rect.width).toBeLessThanOrEqual(560 + EDGE_TOLERANCE_PX);
    } else {
      // Bottom sheet below the sm breakpoint.
      await expect(Math.abs(rect.bottom - vh)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      await expect(rect.top).toBeGreaterThan(0);
    }
  },
};

export const MobileBottomSheet: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        story:
          "Below 640px the side sheet presents as an AdminDialog-identical bottom sheet — this is how the mobile notification bell renders.",
      },
    },
  },
  render: () => <OpenSideSheet />,
  play: async () => {
    const body = within(document.body);
    const sheet = await body.findByRole("dialog");
    await expect(within(sheet).getByRole("heading", { name: "Notifications" })).toBeVisible();

    const surface = getOpenSurface();
    await waitForSheetSettled(surface);
    const rect = surface.getBoundingClientRect();
    // Measure against the layout viewport (excludes scrollbar) — see Default.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    if (vw < SM_BREAKPOINT_PX) {
      await expect(Math.abs(rect.bottom - vh)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      // Docked to the bottom edge, spanning nearly the full width (not the right rail).
      await expect(rect.width).toBeGreaterThan(vw * 0.9);
    }
  },
};

export const WithPinnedFooter: Story = {
  tags: ["visual-harness"],
  parameters: {
    docs: {
      description: {
        story:
          "Panels compose SheetBody (scrolling middle) with an optional SheetFooter pinned outside the scroll region — shell padding and panel padding never stack.",
      },
    },
  },
  render: () => (
    <OpenSideSheet>
      <>
        <SheetBody padded>{SAMPLE_ROWS}</SheetBody>
        <SheetFooter>
          <AdminButton variant="text" onClick={() => undefined}>
            Secondary
          </AdminButton>
          <AdminButton variant="filled" onClick={() => undefined}>
            Primary
          </AdminButton>
        </SheetFooter>
      </>
    </OpenSideSheet>
  ),
};

// storybook-quality-allow state-harness: owns open state to exercise the real open/close cycle.
function SideSheetPreview() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-56 items-center justify-center">
      <AdminButton variant="filled" onClick={() => setOpen(true)}>
        Open side sheet
      </AdminButton>
      <AdminSideSheet open={open} onOpenChange={setOpen} title="Settings" tone="hub">
        <SheetBody padded>
          <p className="text-sm text-text-sub">
            Escape, the scrim, and the close button all close the sheet.
          </p>
        </SheetBody>
      </AdminSideSheet>
    </div>
  );
}

export const OpenCloseCycle: Story = {
  tags: ["storybook-ci"],
  render: () => <SideSheetPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Open side sheet" }));
    const sheet = await body.findByRole("dialog");
    await expect(within(sheet).getByRole("heading", { name: "Settings" })).toBeVisible();

    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(async () => {
      await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    });
  },
};
