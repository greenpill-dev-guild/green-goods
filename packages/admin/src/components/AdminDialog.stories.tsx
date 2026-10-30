import { Button } from "@green-goods/shared/components/Button";
import { RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { ADMIN_FLOW_DIALOG_CLASS, AdminConfirmDialog, AdminDialog } from "./AdminDialog";
import { AdminTextField } from "./AdminTextField";
import { ActionFlowShell } from "./Layout/ActionFlowShell";

const meta: Meta<typeof AdminDialog> = {
  title: "Admin/Primitives/AdminDialog",
  component: AdminDialog,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminDialog** - the cockpit's dialog: its own surface (16dp corners,",
          "surface-container-high, elevation 2, 32 percent scrim) under the shared",
          "`SheetHeader` (DL-117): the 22px title, the target line, the description",
          "and the close button on the title's line, with no icon. The confirm family's",
          "Cancel and confirm are the shared `SheetActions`.",
          "",
          "**Tone-aware** - focus ring on the close button consumes",
          "`var(--tone-focus-ring, var(--m3-primary))` so it tints to the active",
          "workspace (action color in light, bright accent in dark).",
          "",
          "**On phones (below 640px)** - the installed app's bottom sheet in look (F5):",
          "the shared sheet material, the grip (visual only) and the shared",
          "`SheetHeader` with the 22px title and the target line, no icon. Opening,",
          "closing and focus stay Radix's, as on desktop.",
          "",
          "**Accessibility**: Radix dialog; Escape closes the topmost dialog; focus",
          "is trapped while open and returns to the opener on close.",
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
type Story = StoryObj<typeof AdminDialog>;

// Custom 390x844 mobile viewport. The Storybook viewport parameter resizes the
// real browser window in the addon-vitest CI runner (proven by
// ActionsSheetDescriptor.stories), so the play functions below can assert
// against the actual `sm:` (640px) breakpoint boundary.
const ADMIN_MOBILE_390_VIEWPORT = {
  adminMobile390x844: {
    name: "Admin mobile 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

const SM_BREAKPOINT_PX = 640;
const CENTER_TOLERANCE_PX = 2;
const VIEWPORT_EDGE_TOLERANCE_PX = 1;

const LONG_DIALOG_BODY = (
  <div className="space-y-4">
    {Array.from({ length: 16 }, (_, i) => (
      <p key={i}>
        {`Paragraph ${i + 1}: lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`}
      </p>
    ))}
  </div>
);

/**
 * Renders an already-open AdminDialog directly (no trigger click) so the
 * storybook-ci geometry assertions run against a deterministic surface. The
 * interactive `DialogPreview` stories above stay as docs for the open path.
 */
function OpenGeometryDialog({
  title,
  description,
  body,
}: {
  title: string;
  description: string;
  body: ReactNode;
}) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6 type-meta text-[rgb(var(--m3-on-surface-variant))]">
      Dialog renders open (portaled to the document body).
      <AdminDialog
        open
        onOpenChange={() => undefined}
        title={title}
        description={description}
        actions={
          <>
            <Button type="button" emphasis="tertiary" size="sm" onClick={() => undefined}>
              Cancel
            </Button>
            <Button type="button" emphasis="primary" size="sm" onClick={() => undefined}>
              Confirm
            </Button>
          </>
        }
      >
        {body}
      </AdminDialog>
    </div>
  );
}

/**
 * Wait for the dialog's enter animation to finish so geometry is measured at
 * rest. The admin-owned keyframes (admin-m3-components.css) animate transform +
 * opacity, so a naive measurement could land mid-flight. `getAnimations()`
 * resolves once every running CSS animation on the surface has settled.
 */
async function waitForDialogSettled(surface: HTMLElement) {
  await Promise.all(
    (surface.getAnimations?.() ?? []).map((animation) => animation.finished.catch(() => undefined))
  );
}

/**
 * Assert the open-animation contract is real — driven by an admin dialog
 * keyframe, not the removed dead Tailwind `animate-*` classes. The duration
 * check is skipped when the runner emulates reduced motion (which legitimately
 * zeroes the duration); the keyframe name still proves the rule is wired.
 */
async function expectRealEnterAnimation(surface: HTMLElement, keyframe: RegExp) {
  const style = getComputedStyle(surface);
  await expect(style.animationName).toMatch(keyframe);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await expect(style.animationDuration).not.toBe("0s");
  }
}

function DialogPreview({
  title,
  description,
  body,
  confirmLabel = "Confirm",
}: {
  title: string;
  description: string;
  body: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <Button
        type="button"
        emphasis="primary"
        size="sm"
        leadingIcon={<RiWallet3Line className="h-[18px] w-[18px]" aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        Open dialog
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        actions={
          <>
            <Button type="button" emphasis="tertiary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" emphasis="primary" size="sm" onClick={() => setOpen(false)}>
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div>{body}</div>
      </AdminDialog>
    </div>
  );
}

export const Default: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <DialogPreview
      title="Confirm deposit"
      description="Deposit 250 DAI into North Meadow cookie jar?"
      body="Funds will be available to payout recipients immediately after confirmation."
      confirmLabel="Deposit"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    for (const gesture of ["cancel", "escape"]) {
      await userEvent.click(canvas.getByRole("button", { name: "Open dialog" }));
      const dialog = await body.findByRole("dialog", { name: "Confirm deposit" });
      await waitForDialogSettled(dialog);
      if (gesture === "cancel") {
        await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      } else {
        await userEvent.keyboard("{Escape}");
      }
      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(document.body).not.toHaveAttribute("data-scroll-locked");
        expect(document.body.style.pointerEvents).toBe("");
        // Focus returns to the opener.
        expect(canvas.getByRole("button", { name: "Open dialog" })).toHaveFocus();
      });
    }
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <DialogPreview
        title="Confirm deposit"
        description="Deposit 250 DAI into North Meadow cookie jar?"
        body="Funds will be available after confirmation."
        confirmLabel="Deposit"
      />
      <DialogPreview
        title="Unable to withdraw"
        description="This jar has no available balance."
        body="Top up the jar to continue."
        confirmLabel="Dismiss"
      />
    </div>
  ),
};

/** Long body - verifies dialog scrolls inside its surface when content exceeds viewport. */
export const LongBody: Story = {
  render: () => (
    <DialogPreview
      title="Read before continuing"
      description="A long supporting message - dialog body should scroll cleanly."
      body={Array.from(
        { length: 12 },
        (_, i) =>
          `Paragraph ${i + 1}: lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`
      ).join("\n\n")}
      confirmLabel="I understand"
    />
  ),
};

export const MobileSheetContract: Story = {
  globals: { viewport: { value: "mobile" } },
  render: () => (
    <DialogPreview
      title="Edit Domains"
      description="Mobile action dialogs use a full-width sheet while desktop remains centered."
      body="The body scrolls inside the AdminDialog surface and actions stay pinned below it."
      confirmLabel="Save"
    />
  ),
};

export const PaletteVariant: Story = {
  render: () => (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <AdminDialog
        open
        onOpenChange={() => undefined}
        title="Command palette"
        description="Search pages, gardens, actions..."
        variant="palette"
        hideCloseButton
      >
        <div className="flex items-center gap-3 border-b border-stroke-soft px-4">
          <input
            aria-label="Search commands"
            placeholder="Search pages, gardens, actions..."
            className="h-10 flex-1 bg-transparent type-field outline-none"
          />
        </div>
        <div className="p-2">
          <button className="flex w-full rounded-sm px-3 py-2 text-left type-body text-text-sub">
            Hub
          </button>
          <button className="flex w-full rounded-sm px-3 py-2 text-left type-body text-text-sub">
            Garden
          </button>
        </div>
      </AdminDialog>
    </div>
  ),
};

/**
 * Flow variant — the action-flow dialog host for the admin action flows (Submit
 * Work, Create Assessment, Create Hypercert, Manage Members). AdminDialog suppresses
 * its own structured header and zeroes its padding so the consumer owns the chrome
 * through ActionFlowShell: one pinned header (context + title), one scrolling body,
 * one pinned footer. A bounded, centered card with a 32% scrim on desktop; a
 * full-width bottom sheet on mobile — never a fullscreen takeover. Width comes
 * from the shared ADMIN_FLOW_DIALOG_CLASS constant, not a local max-width override.
 * The play test guards the single-header contract: the AdminDialog structured
 * header must stay suppressed.
 */
const FLOW_SECTIONS = ["Action details", "Time & notes", "Evidence photos", "Review"];

function FlowSheet() {
  return (
    <AdminDialog
      open
      size="lg"
      variant="flow"
      className={ADMIN_FLOW_DIALOG_CLASS}
      onOpenChange={() => undefined}
      title="Submit Work"
      description="Capture the action, evidence, and notes for a new contribution."
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Submit Work"
        context="Rio Rainforest Lab"
        footer={
          <>
            <div className="min-w-0 flex-1" aria-live="polite" />
            <div className="flex gap-2">
              <Button type="button" emphasis="tertiary" size="sm" onClick={() => undefined}>
                Cancel
              </Button>
              <Button type="button" emphasis="primary" size="sm" onClick={() => undefined}>
                Submit work
              </Button>
            </div>
          </>
        }
      >
        <div className="space-y-6">
          {FLOW_SECTIONS.map((sectionTitle, index) => (
            <section
              key={sectionTitle}
              className="space-y-3 rounded-[var(--m3-shape-lg)] border border-stroke-soft p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-weak type-meta font-semibold text-text-sub">
                  {`0${index + 1}`}
                </span>
                <h2 className="type-title-md text-text-strong">{sectionTitle}</h2>
              </div>
              <div className="h-10 w-full rounded-lg border border-stroke-soft bg-bg-white" />
              <div className="h-20 w-full rounded-lg border border-stroke-soft bg-bg-white" />
            </section>
          ))}
        </div>
      </ActionFlowShell>
    </AdminDialog>
  );
}

export const FlowVariant: Story = {
  tags: ["storybook-ci"],
  render: () => <FlowSheet />,
  play: async () => {
    const surface = document.querySelector<HTMLElement>(
      '[data-component="AdminDialog"][data-slot="surface"]'
    );
    await waitFor(() => expect(surface).not.toBeNull());
    // Flow variant drives the action-flow host — centered on desktop,
    // full-width bottom sheet on mobile, never a fullscreen takeover.
    // The flow variant sizes itself through FLOW_SIZE; the size scale collapsed to
    // sm/md/lg, so the surface reports the "lg" tier.
    await expect(surface).toHaveAttribute("data-variant", "flow");
    await expect(surface).toHaveAttribute("data-size", "lg");
    // Single header: the flow variant suppresses AdminDialog's structured header
    // (data-slot="header"), so ActionFlowShell's header is the only title bar.
    await expect(surface?.querySelector('[data-slot="header"]')).toBeNull();
    await expect(surface?.querySelector('[data-region="action-flow-header"]')).not.toBeNull();
    // ActionFlowShell pins its footer through the shared SheetFooter.
    await expect(surface?.querySelector('[data-component="SheetFooter"]')).not.toBeNull();
    // The flow keeps the dialog's absolute close beside its own header; an
    // unlayered `.m3-state-layer { position: relative }` once dropped it into
    // flow over the headline.
    const close = surface?.querySelector<HTMLElement>(':scope > [data-slot="close"]');
    await expect(close).not.toBeNull();
    if (close) await expect(getComputedStyle(close).position).toBe("absolute");
  },
};

export const ConfirmVariant: Story = {
  render: () => (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <AdminConfirmDialog
        isOpen
        onClose={() => undefined}
        onConfirm={() => undefined}
        title="Emergency pause"
        description="Pause deposits and withdrawals for this vault?"
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  ),
};

/** A confirmation that rests on facts shows them under the description. */
export const ConfirmWithDetails: Story = {
  render: () => (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <AdminConfirmDialog
        isOpen
        onClose={() => undefined}
        onConfirm={() => undefined}
        title="Update Per-Claim Limit"
        description="Gardeners in Riverbend Garden will be able to claim up to 10 DAI at a time, once a day."
        confirmLabel="Update Limit"
      >
        <dl className="divide-y divide-stroke-soft rounded-lg bg-bg-weak px-3">
          {[
            ["Per-claim limit", "0.01 → 10 DAI"],
            ["Jar holds", "9.98 DAI · one claim could empty it"],
            ["Signs as", "Garden account"],
          ].map(([term, value]) => (
            <div key={term} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="shrink-0 type-meta-sm text-text-soft">{term}</dt>
              <dd className="text-right type-meta font-medium text-text-strong">{value}</dd>
            </div>
          ))}
        </dl>
      </AdminConfirmDialog>
    </div>
  ),
};

/**
 * Close-button geometry guard, in addon-vitest browser mode where the real
 * `@layer` cascade applies. A structured dialog's close sits in the shared
 * header on the title's line (DL-117): anchored at the surface's right edge,
 * clear of the headline. The flow's absolute close is guarded in FlowVariant.
 */
export const CloseButtonGeometry: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <AdminDialog
        open
        onOpenChange={() => undefined}
        title="Close button clearance"
        description="The close affordance anchors top-right, clear of the headline."
        actions={
          <Button type="button" emphasis="primary" size="sm" onClick={() => undefined}>
            Done
          </Button>
        }
      >
        <div>Body content used to anchor the geometry assertions.</div>
      </AdminDialog>
    </div>
  ),
  play: async () => {
    const surface = await within(document.body).findByRole("dialog", {
      name: /close button clearance/i,
    });
    await waitForDialogSettled(surface);
    await waitFor(async () => {
      const header = surface.querySelector<HTMLElement>(
        '[data-component="SheetHeader"][data-slot="root"]'
      );
      await expect(header).not.toBeNull();
      if (!header) return;
      const surfaceRect = surface.getBoundingClientRect();
      const closeRect = within(header)
        .getByRole("button", { name: "Close" })
        .getBoundingClientRect();
      const titleRect = within(surface)
        .getByRole("heading", { name: /close button clearance/i })
        .getBoundingClientRect();
      // On the title's line, at the surface's right edge, clear of the headline.
      await expect(surfaceRect.right - closeRect.right).toBeLessThan(24);
      await expect(closeRect.left).toBeGreaterThan(surfaceRect.left + surfaceRect.width / 2);
      await expect(titleRect.right).toBeLessThanOrEqual(
        closeRect.left + VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(closeRect.top).toBeLessThanOrEqual(titleRect.bottom);
      await expect(closeRect.bottom).toBeGreaterThanOrEqual(titleRect.top);
    });
  },
};

/**
 * Desktop centered geometry. Runs in addon-vitest browser mode at the default
 * (>=640px) viewport. Proves the surface is centered and fully on-screen,
 * regression-guarding the "uncentered desktop dialog" and "backdrop-only
 * dialog" defects.
 */
export const DesktopGeometry: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <OpenGeometryDialog
      title="Centered desktop dialog"
      description="Desktop centers the dialog within the viewport."
      body="Short body so the surface stays compact and clearly centered."
    />
  ),
  play: async () => {
    // The centered desktop layout is gated on the `sm:` breakpoint; fail loud
    // if the runner viewport ever drops below it (which would make these
    // assertions silently test the mobile sheet instead).
    await expect(window.innerWidth).toBeGreaterThanOrEqual(SM_BREAKPOINT_PX);

    const surface = await within(document.body).findByRole("dialog", {
      name: /centered desktop dialog/i,
    });

    // Scrim exists and covers the viewport.
    const scrim = document.body.querySelector<HTMLElement>(
      '[data-component="AdminDialog"][data-slot="overlay"]'
    );
    await expect(scrim).not.toBeNull();
    await expect((scrim?.getBoundingClientRect().width ?? 0) > 0).toBe(true);

    // Real enter animation (desktop = centered-modal zoom), then settle before
    // measuring geometry at rest.
    await expectRealEnterAnimation(surface, /adminDialogModalIn/);
    await waitForDialogSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      // Non-zero rect.
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      // Horizontally + vertically centered within tolerance.
      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;
      await expect(Math.abs(centerX - window.innerWidth / 2)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(Math.abs(centerY - window.innerHeight / 2)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      // Fully inside the viewport.
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.top).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.bottom).toBeLessThanOrEqual(
        window.innerHeight + VIEWPORT_EDGE_TOLERANCE_PX
      );
    });

    // Footer actions render and are visible.
    const actions = within(surface).getByTestId("admin-dialog-actions");
    await expect(actions).toBeVisible();
    await expect(actions.getBoundingClientRect().width).toBeGreaterThan(0);
  },
};

/**
 * Mobile full-width bottom-sheet geometry at a real 390x844 viewport.
 * Regression-guards mobile sheet overflow, off-bottom sheets, hidden/floating
 * footers, and the close-button overlap defect, and pins the shared phone
 * sheet (F5): the grip, the shared header's close on the title's line, the
 * 22px title and the sheet material.
 */
export const MobileSheetGeometry: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: {
      options: ADMIN_MOBILE_390_VIEWPORT,
    },
  },
  globals: { viewport: { value: "adminMobile390x844" } },
  render: () => (
    <OpenGeometryDialog
      title="Mobile bottom sheet"
      description="Mobile presents the dialog as a bottom-anchored sheet."
      body={LONG_DIALOG_BODY}
    />
  ),
  play: async () => {
    // Mobile regime: viewport is below the `sm` (640px) breakpoint, so the
    // full-width bottom-sheet layout is active and the desktop centered layout
    // is NOT in play.
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);

    const surface = await within(document.body).findByRole("dialog", {
      name: /mobile bottom sheet/i,
    });

    // Scrim is present (guards the "backdrop-only" / missing-scrim defect on the
    // mobile sheet too, not just desktop).
    const scrim = document.body.querySelector<HTMLElement>(
      '[data-component="AdminDialog"][data-slot="overlay"]'
    );
    await expect(scrim).not.toBeNull();
    await expect((scrim?.getBoundingClientRect().width ?? 0) > 0).toBe(true);

    // Real enter animation (mobile = bottom-sheet slide), then settle before
    // measuring geometry at rest.
    await expectRealEnterAnimation(surface, /adminDialogSheetIn/);
    await waitForDialogSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      // Non-zero rect.
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      // Bottom-aligned sheet.
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      // True full-width bottom sheet: both horizontal edges meet the viewport.
      await expect(Math.abs(rect.left)).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(Math.abs(rect.right - window.innerWidth)).toBeLessThanOrEqual(
        VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(Math.abs(rect.width - window.innerWidth)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
    });

    // The page itself does not scroll horizontally.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX
    );

    const surfaceRect = surface.getBoundingClientRect();

    // Body scrolls inside the surface (content overflows, body is the scroller).
    const body = within(surface).getByTestId("admin-dialog-body");
    const bodyRect = body.getBoundingClientRect();
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await expect(bodyRect.top).toBeGreaterThanOrEqual(surfaceRect.top - VIEWPORT_EDGE_TOLERANCE_PX);
    await expect(bodyRect.bottom).toBeLessThanOrEqual(
      surfaceRect.bottom + VIEWPORT_EDGE_TOLERANCE_PX
    );

    // Footer actions are visible and pinned below the body, inside the surface.
    const actions = within(surface).getByTestId("admin-dialog-actions");
    await expect(actions).toBeVisible();
    const actionsRect = actions.getBoundingClientRect();
    await expect(actionsRect.width).toBeGreaterThan(0);
    await expect(actionsRect.top).toBeGreaterThanOrEqual(bodyRect.top - VIEWPORT_EDGE_TOLERANCE_PX);
    await expect(actionsRect.bottom).toBeLessThanOrEqual(
      surfaceRect.bottom + VIEWPORT_EDGE_TOLERANCE_PX
    );

    // The shared header's close sits inside the surface on the title's first
    // line, anchored top-right, clear of the body and the title.
    const header = surface.querySelector<HTMLElement>(
      '[data-component="SheetHeader"][data-slot="root"]'
    );
    await expect(header).not.toBeNull();
    if (!header) return;
    const closeRect = within(header).getByRole("button", { name: "Close" }).getBoundingClientRect();
    const title = within(surface).getByRole("heading", { name: /mobile bottom sheet/i });
    const titleRect = title.getBoundingClientRect();
    const firstLineMiddle =
      titleRect.top + Number.parseFloat(getComputedStyle(title).lineHeight) / 2;
    await expect(closeRect.top).toBeLessThanOrEqual(firstLineMiddle);
    await expect(closeRect.bottom).toBeGreaterThanOrEqual(firstLineMiddle);
    await expect(closeRect.right).toBeLessThanOrEqual(
      surfaceRect.right + VIEWPORT_EDGE_TOLERANCE_PX
    );
    await expect(surfaceRect.right - closeRect.right).toBeLessThan(24);
    await expect(closeRect.bottom).toBeLessThanOrEqual(bodyRect.top + VIEWPORT_EDGE_TOLERANCE_PX);
    await expect(titleRect.right).toBeLessThanOrEqual(closeRect.left + VIEWPORT_EDGE_TOLERANCE_PX);
    // The cockpit keeps its 22px dialog title in the shared header.
    await expect(getComputedStyle(title).fontSize).toBe("22px");

    // The grip tops the surface, centred above the title, and marks the sheet
    // without a gesture.
    const grip = surface.querySelector<HTMLElement>(
      '[data-component="SheetGrip"][data-slot="grip"]'
    );
    await expect(grip).not.toBeNull();
    if (!grip) return;
    const gripRect = grip.getBoundingClientRect();
    const surfaceMiddle = (surfaceRect.left + surfaceRect.right) / 2;
    await expect(
      Math.abs((gripRect.left + gripRect.right) / 2 - surfaceMiddle)
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
    await expect(gripRect.bottom).toBeLessThanOrEqual(titleRect.top);
    await expect(grip.parentElement).not.toHaveAttribute("data-drag-region");

    // The shared sheet material: white in light, rounded on top only.
    const surfaceStyle = getComputedStyle(surface);
    await expect(surfaceStyle.backgroundColor).toBe("rgb(255, 255, 255)");
    await expect(surfaceStyle.borderTopLeftRadius).toBe("16px");
    await expect(surfaceStyle.borderBottomLeftRadius).toBe("0px");
  },
};

/**
 * A flow keeps its own header on a phone, under the shared grip: the dialog's
 * close moves down with it, on the flow's title row and clear of the grip.
 */
export const MobileFlowSheetGeometry: Story = {
  tags: ["storybook-ci"],
  parameters: { viewport: { options: ADMIN_MOBILE_390_VIEWPORT } },
  globals: { viewport: { value: "adminMobile390x844" } },
  render: () => <FlowSheet />,
  play: async () => {
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);
    const surface = await within(document.body).findByRole("dialog", { name: "Submit Work" });
    await waitForDialogSettled(surface);
    const handle = surface.querySelector<HTMLElement>(
      '[data-component="SheetGrip"][data-slot="drag-handle"]'
    );
    const close = surface.querySelector<HTMLElement>(':scope > [data-slot="close"]');
    await expect(handle).not.toBeNull();
    await expect(close).not.toBeNull();
    if (!handle || !close) return;
    const closeRect = close.getBoundingClientRect();
    const title = within(surface).getByRole("heading", { name: "Submit Work", level: 1 });
    const titleRect = title.getBoundingClientRect();
    await expect(closeRect.top).toBeGreaterThanOrEqual(
      handle.getBoundingClientRect().bottom - VIEWPORT_EDGE_TOLERANCE_PX
    );
    await expect(closeRect.top).toBeLessThanOrEqual(titleRect.bottom);
    await expect(closeRect.bottom).toBeGreaterThanOrEqual(titleRect.top);
    await expect(titleRect.right).toBeLessThanOrEqual(closeRect.left + VIEWPORT_EDGE_TOLERANCE_PX);
  },
};

// Compact content still uses the same edge-to-edge mobile sheet geometry.
export const MobileConfirmWidth: Story = {
  tags: ["storybook-ci"],
  parameters: { viewport: { options: ADMIN_MOBILE_390_VIEWPORT } },
  globals: { viewport: { value: "adminMobile390x844" } },
  render: () => (
    <AdminDialog open onOpenChange={() => undefined} title="Confirm" variant="confirm">
      <p>Confirm this change?</p>
    </AdminDialog>
  ),
  play: async () => {
    const surface = await within(document.body).findByRole("dialog");
    await waitForDialogSettled(surface);
    const rect = surface.getBoundingClientRect();
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);
    await expect(Math.abs(rect.left)).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
    await expect(Math.abs(rect.right - document.documentElement.clientWidth)).toBeLessThanOrEqual(
      VIEWPORT_EDGE_TOLERANCE_PX
    );
    await expect(Math.abs(rect.bottom - document.documentElement.clientHeight)).toBeLessThanOrEqual(
      VIEWPORT_EDGE_TOLERANCE_PX
    );
  },
};

export const MobilePaletteWidth: Story = {
  ...MobileConfirmWidth,
  render: () => (
    <AdminDialog open onOpenChange={() => undefined} title="Command palette" variant="palette">
      <input aria-label="Search commands" />
    </AdminDialog>
  ),
};

/**
 * Long-content geometry. Verifies prose wraps (no horizontal overflow inside
 * the body), the body scrolls within the surface, the surface stays within the
 * viewport, and the footer remains visible — guarding the "text overflow" and
 * "footer/action visibility" defects.
 */
export const LongContentGeometry: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <OpenGeometryDialog
      title="Long content scroll"
      description="A long supporting message; the body scrolls inside the surface."
      body={LONG_DIALOG_BODY}
    />
  ),
  play: async () => {
    const surface = await within(document.body).findByRole("dialog", {
      name: /long content scroll/i,
    });

    // Settle the enter animation before measuring scroll/footer geometry.
    await waitForDialogSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      // Surface stays within the viewport instead of growing past it.
      await expect(rect.height).toBeLessThanOrEqual(
        window.innerHeight + VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(rect.bottom).toBeLessThanOrEqual(
        window.innerHeight + VIEWPORT_EDGE_TOLERANCE_PX
      );
    });

    const body = within(surface).getByTestId("admin-dialog-body");
    // Text wraps: no horizontal scroll inside the body.
    await expect(body.scrollWidth).toBeLessThanOrEqual(
      body.clientWidth + VIEWPORT_EDGE_TOLERANCE_PX
    );
    // Long content scrolls vertically inside the body, not the page.
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

    // Footer stays visible below the scrollable body.
    const actions = within(surface).getByTestId("admin-dialog-actions");
    await expect(actions).toBeVisible();
    await expect(actions.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      surface.getBoundingClientRect().bottom + VIEWPORT_EDGE_TOLERANCE_PX
    );
  },
};

/**
 * Reduced-motion contract. Proves two things deterministically (no media
 * emulation needed, so it is stable under the CI runner's `isolate: false`):
 * (1) the enter animation is real (driven by an admin dialog keyframe, not the
 * removed dead Tailwind classes), and (2) a `prefers-reduced-motion: reduce`
 * rule is loaded that zeroes the AdminDialog animation duration — mirroring the
 * shared dialog block in utilities.css. Verified by stylesheet introspection.
 */
export const ReducedMotionContract: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <OpenGeometryDialog
      title="Reduced motion contract"
      description="The dialog animation is real, and reduced motion disables it."
      body="Reduced motion zeroes the enter/exit animation duration."
    />
  ),
  play: async () => {
    const surface = await within(document.body).findByRole("dialog", {
      name: /reduced motion contract/i,
    });

    // (1) The animation contract is real, not the old dead Tailwind classes.
    await waitFor(async () => {
      await expect(getComputedStyle(surface).animationName).toMatch(/adminDialog(Sheet|Modal)In/);
    });

    // (2) A loaded prefers-reduced-motion rule zeroes the AdminDialog duration.
    const reducedMotionRuleFound = Array.from(document.styleSheets).some((sheet) => {
      let rules: CSSRule[];
      try {
        rules = Array.from(sheet.cssRules ?? []);
      } catch {
        return false; // cross-origin stylesheet — not introspectable
      }
      return rules.some(
        (rule) =>
          rule instanceof CSSMediaRule &&
          rule.conditionText.includes("prefers-reduced-motion") &&
          rule.cssText.includes('[data-component="AdminDialog"]') &&
          /animation-duration:\s*0/.test(rule.cssText)
      );
    });
    await expect(reducedMotionRuleFound).toBe(true);
  },
};

/** Tone matrix - same dialog inside each `[data-tone]` scope. */
export const ToneMatrix: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div key={tone} data-tone={tone}>
          <div className="mb-2 type-label-sm font-semibold uppercase tracking-[0.06em] text-text-soft">
            {`[data-tone="${tone}"]`}
          </div>
          <DialogPreview
            title="Confirm deposit"
            description="Deposit 250 DAI into the cookie jar."
            body="Funds will be available after confirmation."
            confirmLabel="Deposit"
          />
        </div>
      ))}
    </div>
  ),
};

const PREVIEW_STAGE =
  "flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6";

/**
 * Closes the open dialog with a gesture and checks the page comes back whole:
 * no dialog, no scroll or pointer lock, and focus on the opener.
 */
async function closeAndExpectFocusOn(opener: HTMLElement, close: () => Promise<void>) {
  await close();
  await waitFor(() => {
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).toBeNull();
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    expect(document.body.style.pointerEvents).toBe("");
    expect(opener).toHaveFocus();
  });
}

function FormDialogPreview() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("North Meadow");
  const [summary, setSummary] = useState("");
  return (
    <div className={PREVIEW_STAGE}>
      <Button type="button" emphasis="primary" size="sm" onClick={() => setOpen(true)}>
        Edit garden
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Garden"
        description="Change the name and summary members see."
        tone="garden"
        actions={
          <>
            <Button type="button" emphasis="tertiary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" emphasis="primary" size="sm" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <AdminTextField
            label="Garden name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <AdminTextField
            label="Summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>
      </AdminDialog>
    </div>
  );
}

/** A form dialog: typing stays inside it, Escape and Cancel close it, and focus comes home. */
export const FormDialog: Story = {
  tags: ["storybook-ci"],
  render: () => <FormDialogPreview />,
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    const opener = within(canvasElement).getByRole("button", { name: "Edit garden" });

    await userEvent.click(opener);
    const dialog = await body.findByRole("dialog", { name: "Edit Garden" });
    await waitForDialogSettled(dialog);
    const summary = within(dialog).getByRole("textbox", { name: /summary/i });
    await userEvent.type(summary, "Food forest");
    await expect(summary).toHaveValue("Food forest");
    await closeAndExpectFocusOn(opener, async () => {
      await userEvent.keyboard("{Escape}");
    });

    await userEvent.click(opener);
    const again = await body.findByRole("dialog", { name: "Edit Garden" });
    await waitForDialogSettled(again);
    await closeAndExpectFocusOn(opener, () =>
      userEvent.click(within(again).getByRole("button", { name: "Cancel" }))
    );
  },
};

function ConfirmPreview() {
  const [open, setOpen] = useState(false);
  return (
    <div className={PREVIEW_STAGE}>
      <Button type="button" emphasis="primary" size="sm" onClick={() => setOpen(true)}>
        Pause vault
      </Button>
      <AdminConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title="Emergency pause"
        description="Pause deposits and withdrawals for this vault?"
        confirmLabel="Pause"
        variant="danger"
      />
    </div>
  );
}

/**
 * The confirm family: an alertdialog whose Cancel and confirm are the shared
 * action bar. Escape and Cancel close it, and focus comes home.
 */
export const ConfirmFocusReturn: Story = {
  tags: ["storybook-ci"],
  render: () => <ConfirmPreview />,
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    const opener = within(canvasElement).getByRole("button", { name: "Pause vault" });

    await userEvent.click(opener);
    const dialog = await body.findByRole("alertdialog", { name: "Emergency pause" });
    await waitForDialogSettled(dialog);
    await expect(dialog.querySelector('[data-component="SheetActions"]')).not.toBeNull();
    await expect(within(dialog).getByRole("button", { name: "Pause" })).toHaveAttribute(
      "data-action",
      "primary"
    );
    await closeAndExpectFocusOn(opener, async () => {
      await userEvent.keyboard("{Escape}");
    });

    await userEvent.click(opener);
    const again = await body.findByRole("alertdialog", { name: "Emergency pause" });
    await waitForDialogSettled(again);
    await closeAndExpectFocusOn(opener, () =>
      userEvent.click(within(again).getByRole("button", { name: "Cancel" }))
    );
  },
};

function NestedPreview() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={PREVIEW_STAGE}>
      <Button type="button" emphasis="primary" size="sm" onClick={() => setOpen(true)}>
        Manage member
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title="Manage Member"
        description="Rosa Lima gardens in North Meadow."
        tone="community"
        actions={
          <Button type="button" emphasis="tertiary" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <Button type="button" emphasis="secondary" size="sm" onClick={() => setConfirming(true)}>
          Remove member
        </Button>
        <AdminConfirmDialog
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => setConfirming(false)}
          title="Remove member?"
          description="Rosa Lima loses access to North Meadow."
          confirmLabel="Remove"
          variant="danger"
          tone="community"
        />
      </AdminDialog>
    </div>
  );
}

/**
 * A confirm opened from inside a dialog: Escape closes only the topmost one,
 * and focus steps back a level at a time, to the button that opened each.
 */
export const NestedDialogs: Story = {
  tags: ["storybook-ci"],
  render: () => <NestedPreview />,
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    const opener = within(canvasElement).getByRole("button", { name: "Manage member" });

    await userEvent.click(opener);
    const outer = await body.findByRole("dialog", { name: "Manage Member" });
    await waitForDialogSettled(outer);
    const removeMember = within(outer).getByRole("button", { name: "Remove member" });
    await userEvent.click(removeMember);
    const inner = await body.findByRole("alertdialog", { name: "Remove member?" });
    await waitForDialogSettled(inner);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(body.queryByRole("alertdialog")).toBeNull();
      expect(body.getByRole("dialog", { name: "Manage Member" })).toBeVisible();
      expect(removeMember).toHaveFocus();
    });

    await closeAndExpectFocusOn(opener, async () => {
      await userEvent.keyboard("{Escape}");
    });
  },
};
