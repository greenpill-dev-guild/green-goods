import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, waitFor, within } from "storybook/test";
import { DialogShell } from "./DialogShell";

const DIALOG_MESSAGES = {
  "app.common.cancel": "Cancel",
  "app.common.close": "Close",
  "app.common.confirm": "Confirm",
};

const SHELL_MOBILE_VIEWPORT = {
  shellMobile390x844: {
    name: "Shell mobile 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

const SM_BREAKPOINT_PX = 640;
const CENTER_TOLERANCE_PX = 2;
const VIEWPORT_EDGE_TOLERANCE_PX = 1;
const MIN_TOUCH_TARGET_PX = 44;

async function waitForSurfaceSettled(surface: HTMLElement) {
  await Promise.all(
    (surface.getAnimations?.() ?? []).map((animation) => animation.finished.catch(() => undefined))
  );
}

async function expectRealEnterAnimation(surface: HTMLElement, keyframe: RegExp) {
  const style = getComputedStyle(surface);
  await expect(style.animationName).toMatch(keyframe);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await expect(style.animationDuration).not.toBe("0s");
  }
}

async function expectTouchTarget(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  await expect(rect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  await expect(rect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
}

const meta: Meta<typeof DialogShell> = {
  title: "Shared/Feedback/DialogShell",
  component: DialogShell,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Reusable shell for client and shared dialogs: the centered Radix surface at 640px and wider, the shared PwaSheet bottom sheet below. Prefer it over rebuilding overlay, header, sizing, and sheet behavior.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
  decorators: [
    (Story) => (
      <IntlProvider locale="en" messages={DIALOG_MESSAGES}>
        <Story />
      </IntlProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DialogShell>;

export const ShellPattern: Story = {
  render: () => (
    <DialogShell
      open={true}
      onOpenChange={fn()}
      title="Garden Profile"
      description="Shared dialog shell for admin workbench and detail flows."
      size="xl"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">
          Primary content block
        </div>
        <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">
          Secondary content block
        </div>
      </div>
    </DialogShell>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Reusable shell for admin dialogs. Prefer extending this for domain-specific modal content instead of rebuilding Radix overlay, header, sizing, and mobile sheet behavior repeatedly.",
      },
    },
  },
};

export const ShellSizeMd: Story = {
  render: () => (
    <DialogShell
      open={true}
      onOpenChange={fn()}
      title="Remove Member"
      description="Confirm before revoking access — size=md"
      size="md"
    >
      <p className="text-body-sm text-text-sub-600">
        Medium shell (max-w-md). Use for simple confirmations that do not need form layout.
      </p>
    </DialogShell>
  ),
  parameters: {
    docs: {
      description: {
        story: "`size='md'` — default for small confirmations and single-field edits.",
      },
    },
  },
};

export const ShellSizeLg: Story = {
  render: () => (
    <DialogShell
      open={true}
      onOpenChange={fn()}
      title="Edit garden profile"
      description="Multi-field edit — size=lg"
      size="lg"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">Name field</div>
        <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">Domain field</div>
        <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4 sm:col-span-2">
          Description field
        </div>
      </div>
    </DialogShell>
  ),
  parameters: {
    docs: {
      description: {
        story: "`size='lg'` — use when content is a 2-column form or a medium detail view.",
      },
    },
  },
};

export const ShellSize2xl: Story = {
  render: () => (
    <DialogShell
      open={true}
      onOpenChange={fn()}
      title="Hypercert minting preview"
      description="Full-size shell for multi-section flows — size=2xl"
      size="2xl"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">
          <div className="text-label-sm text-text-sub-600">Summary</div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">
            Attestation selector
          </div>
          <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">
            Distribution config
          </div>
          <div className="rounded-lg border border-stroke-soft bg-bg-weak p-4">Metadata editor</div>
        </div>
      </div>
    </DialogShell>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "`size='2xl'` — reserved for multi-section workflows like hypercert minting, wizards, or data-dense previews.",
      },
    },
  },
};

export const ShellMobileSheet: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <DialogShell
      open={true}
      onOpenChange={fn()}
      title="Withdraw offer"
      description="Narrow viewports render the shell as the shared bottom sheet."
      size="md"
      actions={{
        primary: { label: "Withdraw This Offer", tone: "danger", onClick: fn() },
        secondary: { label: "Keep It Open", onClick: fn() },
      }}
    >
      <p className="text-body-sm text-text-sub-600">Reason field placeholder</p>
    </DialogShell>
  ),
  parameters: {
    viewport: {
      defaultViewport: "shellMobile390x844",
      viewports: SHELL_MOBILE_VIEWPORT,
    },
    docs: {
      description: {
        story:
          "Below 640px DialogShell renders the same PwaSheet as ConfirmDialog and DraftSheet: drag handle, shared header, a content-sized body, and the shared action bar (DL-016) stacked with the primary on top, anchored to the viewport bottom.",
      },
    },
  },
  play: async () => {
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);

    const dialog = within(document.body);
    const surface = await dialog.findByRole(
      "dialog",
      {
        name: /withdraw offer/i,
      },
      { timeout: 5_000 }
    );

    await expect(surface).toHaveAttribute("data-component", "PwaSheet");
    await expect(dialog.getByTestId("dialog-shell-drag-handle")).toBeVisible();
    await expectRealEnterAnimation(surface, /dialogSlideInFromBottom/);
    await waitForSurfaceSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
    });

    await expectTouchTarget(dialog.getByTestId("pwa-sheet-close"));

    const withdraw = dialog.getByRole("button", { name: "Withdraw This Offer" });
    const keep = dialog.getByRole("button", { name: "Keep It Open" });
    await expect(withdraw.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      keep.getBoundingClientRect().top
    );
    await expect(
      Math.abs(keep.getBoundingClientRect().bottom - surface.getBoundingClientRect().bottom)
    ).toBeLessThan(40);
  },
};
