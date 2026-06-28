import { RiErrorWarningLine, RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentType, type ReactNode, useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminButton } from "./AdminButton";
import { AdminConfirmDialog, AdminDialog } from "./AdminDialog";
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
          "**AdminDialog** - M3 basic dialog. 28dp shape, surface-container-high,",
          "elevation-3, 32 percent scrim, optional icon, headline, supporting",
          "text, and action slot.",
          "",
          "**Tone-aware** - focus ring on the close button consumes",
          "`var(--tone-action, var(--m3-primary))` so it tints to the active",
          "workspace.",
          "",
          "**Accessibility**: native `<dialog>` via Radix; Escape closes; focus",
          "trapped while open; focus returns to trigger on close.",
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
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
      Dialog renders open (portaled to the document body).
      <AdminDialog
        open
        onOpenChange={() => undefined}
        title={title}
        description={description}
        actions={
          <>
            <AdminButton variant="text" onClick={() => undefined}>
              Cancel
            </AdminButton>
            <AdminButton variant="filled" onClick={() => undefined}>
              Confirm
            </AdminButton>
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
 * rest. The admin-owned keyframes (admin-m3-overrides.css) animate transform +
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
  icon,
  title,
  description,
  body,
  confirmLabel = "Confirm",
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  body: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-56 items-center justify-center rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-lowest))] p-6">
      <AdminButton variant="filled" leadingIcon={<RiWallet3Line />} onClick={() => setOpen(true)}>
        Open dialog
      </AdminButton>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        icon={icon}
        actions={
          <>
            <AdminButton variant="text" onClick={() => setOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="filled" onClick={() => setOpen(false)}>
              {confirmLabel}
            </AdminButton>
          </>
        }
      >
        <div>{body}</div>
      </AdminDialog>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <DialogPreview
      title="Confirm deposit"
      description="Deposit 250 DAI into North Meadow cookie jar?"
      body="Funds will be available to payout recipients immediately after confirmation."
      confirmLabel="Deposit"
    />
  ),
};

export const WithIcon: Story = {
  render: () => (
    <DialogPreview
      title="Unable to withdraw"
      description="This jar has no available balance."
      body="Recent payouts exhausted the jar. Top up the jar to continue."
      icon={RiErrorWarningLine}
      confirmLabel="Dismiss"
    />
  ),
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
        icon={RiErrorWarningLine}
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
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  render: () => (
    <DialogPreview
      title="Edit domains"
      description="Mobile uses the sheet presentation while desktop remains centered."
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
            className="h-10 flex-1 bg-transparent text-body-lg outline-none"
          />
        </div>
        <div className="p-2">
          <button className="flex w-full rounded-sm px-3 py-2 text-left text-body-md text-text-sub">
            Hub
          </button>
          <button className="flex w-full rounded-sm px-3 py-2 text-left text-body-md text-text-sub">
            Garden
          </button>
        </div>
      </AdminDialog>
    </div>
  ),
};

/**
 * Flow variant — the centered 2xl host for the admin action flows (Submit Work,
 * Create Assessment, Create Hypercert). AdminDialog suppresses its own structured
 * header and zeroes its padding so the consumer owns the chrome through
 * ActionFlowShell: one pinned header (context + title), one scrolling body, one
 * pinned footer. A bounded, centered card with a 32% scrim on desktop; a
 * bottom-sheet on mobile — never a fullscreen takeover. The play test guards the
 * single-header contract: the AdminDialog structured header must stay suppressed.
 */
const FLOW_SECTIONS = ["Action details", "Time & notes", "Evidence photos", "Review"];

export const FlowVariant: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <AdminDialog
      open
      size="2xl"
      variant="flow"
      className="min-h-[90dvh] sm:min-h-0 sm:!max-w-3xl lg:!max-w-3xl"
      onOpenChange={() => undefined}
      title="Submit work"
      description="Capture the action, evidence, and notes for a new contribution."
      bodyClassName="flex min-h-0 flex-col !overflow-hidden"
    >
      <ActionFlowShell
        layout="dialog"
        title="Submit work"
        context="Rio Rainforest Lab"
        footer={
          <>
            <div className="min-w-0 flex-1" aria-live="polite" />
            <div className="flex gap-2">
              <AdminButton variant="text" onClick={() => undefined}>
                Cancel
              </AdminButton>
              <AdminButton variant="filled" onClick={() => undefined}>
                Submit work
              </AdminButton>
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
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-weak text-xs font-semibold text-text-sub">
                  {`0${index + 1}`}
                </span>
                <h2 className="text-base font-semibold text-text-strong">{sectionTitle}</h2>
              </div>
              <div className="h-10 w-full rounded-lg border border-stroke-soft bg-bg-white" />
              <div className="h-20 w-full rounded-lg border border-stroke-soft bg-bg-white" />
            </section>
          ))}
        </div>
      </ActionFlowShell>
    </AdminDialog>
  ),
  play: async () => {
    const surface = document.querySelector<HTMLElement>(
      '[data-component="AdminDialog"][data-slot="surface"]'
    );
    await waitFor(() => expect(surface).not.toBeNull());
    // Bounded, centered 2xl card driven by the flow variant — not a fullscreen takeover.
    await expect(surface).toHaveAttribute("data-variant", "flow");
    await expect(surface).toHaveAttribute("data-size", "2xl");
    // Single header: the flow variant suppresses AdminDialog's structured header
    // (data-slot="header"), so ActionFlowShell's header is the only title bar.
    await expect(surface?.querySelector('[data-slot="header"]')).toBeNull();
    await expect(surface?.querySelector('[data-region="action-flow-header"]')).not.toBeNull();
    // ActionFlowShell pins its footer through the shared SheetFooter.
    await expect(surface?.querySelector('[data-component="SheetFooter"]')).not.toBeNull();
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

/**
 * Close-button geometry guard. Runs in addon-vitest browser mode, where the real
 * `@layer` cascade applies (jsdom has none), so `getComputedStyle().position` is
 * meaningful. Regression test for the defect where the unlayered
 * `.m3-state-layer { position: relative }` overrode Tailwind's layered `.absolute`,
 * dropping the close button into normal flow at the top-left, over the headline.
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
          <AdminButton variant="filled" onClick={() => undefined}>
            Done
          </AdminButton>
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
    await waitFor(async () => {
      const closeBtn = surface.querySelector<HTMLElement>('[data-slot="close"]');
      await expect(closeBtn).not.toBeNull();
      if (!closeBtn) return;
      // `relative` means the unlayered state-layer rule is overriding `.absolute`
      // again and the button has fallen into flow over the title.
      await expect(getComputedStyle(closeBtn).position).toBe("absolute");
      const surfaceRect = surface.getBoundingClientRect();
      const closeRect = closeBtn.getBoundingClientRect();
      // Anchored to the surface top-right (~16px inset), not floating over the headline.
      await expect(surfaceRect.right - closeRect.right).toBeLessThan(24);
      await expect(closeRect.left).toBeGreaterThan(surfaceRect.left + surfaceRect.width / 2);
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
 * Mobile bottom-sheet geometry at a real 390x844 viewport. Regression-guards
 * mobile sheet overflow, off-bottom sheets, hidden/floating footers, and the
 * close-button overlap defect.
 */
export const MobileSheetGeometry: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: {
      defaultViewport: "adminMobile390x844",
      viewports: ADMIN_MOBILE_390_VIEWPORT,
    },
  },
  render: () => (
    <OpenGeometryDialog
      title="Mobile bottom sheet"
      description="Mobile presents the dialog as a bottom-anchored sheet."
      body={LONG_DIALOG_BODY}
    />
  ),
  play: async () => {
    // Mobile regime: viewport is below the `sm` (640px) breakpoint, so the
    // bottom-sheet layout is active. Assert the breakpoint boundary, not an
    // exact pixel width — robust to viewport-definition / device-pixel-ratio
    // changes while still proving the desktop centered layout is NOT in play.
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
      // Horizontally centered (left-1/2 -translate-x-1/2 applies at every width).
      const centerX = (rect.left + rect.right) / 2;
      await expect(Math.abs(centerX - window.innerWidth / 2)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      // No horizontal overflow off either edge.
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
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

    // Close button sits inside the surface, anchored top-right, clear of body
    // and headline. `position: absolute` is the direct guard for the cascade
    // defect where the unlayered `.m3-state-layer { position: relative }`
    // overrode Tailwind's `.absolute`.
    const closeBtn = surface.querySelector<HTMLElement>('[data-slot="close"]');
    await expect(closeBtn).not.toBeNull();
    if (closeBtn) {
      await expect(getComputedStyle(closeBtn).position).toBe("absolute");
      const closeRect = closeBtn.getBoundingClientRect();
      await expect(closeRect.left).toBeGreaterThanOrEqual(
        surfaceRect.left - VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(closeRect.right).toBeLessThanOrEqual(
        surfaceRect.right + VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(closeRect.top).toBeGreaterThanOrEqual(
        surfaceRect.top - VIEWPORT_EDGE_TOLERANCE_PX
      );
      // Anchored to the right (~16px inset), not floating over the headline.
      await expect(surfaceRect.right - closeRect.right).toBeLessThan(24);
      await expect(closeRect.left).toBeGreaterThan(surfaceRect.left + surfaceRect.width / 2);
      // Sits above the scrollable body — does not overlap content.
      await expect(closeRect.bottom).toBeLessThanOrEqual(bodyRect.top + VIEWPORT_EDGE_TOLERANCE_PX);
      // Headline reserves right padding so its text never runs under the button.
      const title = within(surface).getByRole("heading", { name: /mobile bottom sheet/i });
      await expect(Number.parseFloat(getComputedStyle(title).paddingRight)).toBeGreaterThanOrEqual(
        36
      );
    }
  },
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
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
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
