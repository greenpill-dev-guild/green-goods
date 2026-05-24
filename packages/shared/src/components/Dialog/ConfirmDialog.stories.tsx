import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { IntlProvider } from "react-intl";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ConfirmDialog, type ConfirmDialogProps, DialogShell } from "./ConfirmDialog";

const DIALOG_MESSAGES = {
  "app.common.cancel": "Cancel",
  "app.common.close": "Close",
  "app.common.confirm": "Confirm",
};

const meta: Meta<typeof ConfirmDialog> = {
  title: "Shared/Feedback/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Accessible confirmation dialog using Radix Dialog. Centered on desktop, slides up from bottom on mobile. Replaces window.confirm() for consistent UX.",
      },
    },
  },
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Whether the dialog is open",
    },
    title: {
      control: "text",
      description: "Dialog title",
    },
    description: {
      control: "text",
      description: "Optional description below the title",
    },
    variant: {
      control: "select",
      options: ["default", "warning", "danger"],
      description: "Visual variant — warning/danger shows an alert icon and colored confirm button",
    },
    confirmLabel: {
      control: "text",
      description: "Custom confirm button label (defaults to i18n 'Confirm')",
    },
    cancelLabel: {
      control: "text",
      description: "Custom cancel button label (defaults to i18n 'Cancel')",
    },
    isLoading: {
      control: "boolean",
      description: "Shows spinner on confirm button and prevents closing",
    },
    onClose: { action: "onClose" },
    onConfirm: { action: "onConfirm" },
    onCancel: { action: "onCancel" },
    onError: { action: "onError" },
  },
  args: {
    onClose: fn(),
    onConfirm: fn(),
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
type Story = StoryObj<typeof ConfirmDialog>;

const CONFIRM_MOBILE_VIEWPORT = {
  confirmMobile390x844: {
    name: "Confirm mobile 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

const SM_BREAKPOINT_PX = 640;
const CENTER_TOLERANCE_PX = 2;
const VIEWPORT_EDGE_TOLERANCE_PX = 1;
const MIN_TOUCH_TARGET_PX = 44;

type ConfirmDialogHarnessProps = Omit<ConfirmDialogProps, "isOpen" | "onClose"> & {
  onClose?: () => void;
};

function ConfirmDialogHarness({ onClose, ...props }: ConfirmDialogHarnessProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <ConfirmDialog
      {...props}
      isOpen={isOpen}
      onClose={() => {
        onClose?.();
        setIsOpen(false);
      }}
    />
  );
}

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

async function expectViewportCoveringElement(element: HTMLElement | null) {
  await expect(element).not.toBeNull();
  if (!element) return;
  const rect = element.getBoundingClientRect();
  await expect(rect.left).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
  await expect(rect.top).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
  await expect(rect.right).toBeGreaterThanOrEqual(window.innerWidth - VIEWPORT_EDGE_TOLERANCE_PX);
  await expect(rect.bottom).toBeGreaterThanOrEqual(window.innerHeight - VIEWPORT_EDGE_TOLERANCE_PX);
}

async function expectTouchTarget(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  await expect(rect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  await expect(rect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
}

function hasReducedMotionRule(componentName: string): boolean {
  return Array.from(document.styleSheets).some((sheet) => {
    let rules: CSSRule[];
    try {
      rules = Array.from(sheet.cssRules ?? []);
    } catch {
      return false;
    }
    return rules.some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes("prefers-reduced-motion") &&
        rule.cssText.includes(`[data-component="${componentName}"]`) &&
        /animation-duration:\s*0/.test(rule.cssText)
    );
  });
}

export const Default: Story = {
  args: {
    isOpen: true,
    title: "Confirm Action",
    description: "Are you sure you want to proceed with this action?",
  },
};

export const Destructive: Story = {
  args: {
    isOpen: true,
    title: "Remove Member",
    description:
      "This will revoke their garden access and remove all pending work submissions. This action cannot be undone.",
    variant: "danger",
    confirmLabel: "Remove",
  },
};

export const Warning: Story = {
  args: {
    isOpen: true,
    title: "Unsaved Changes",
    description: "You have unsaved changes that will be lost if you leave this page.",
    variant: "warning",
    confirmLabel: "Leave Page",
    cancelLabel: "Stay",
  },
};

export const Loading: Story = {
  args: {
    isOpen: true,
    title: "Processing Transaction",
    description: "Please wait while the transaction is confirmed on-chain.",
    isLoading: true,
    confirmLabel: "Confirming...",
  },
};

export const NoDescription: Story = {
  args: {
    isOpen: true,
    title: "Delete this item?",
    variant: "danger",
    confirmLabel: "Delete",
  },
};

// storybook-quality-allow dark-mode: verifies component-specific dark token contrast inside the real dialog chrome.
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white p-4 min-h-[400px]">
        <Story />
      </div>
    ),
  ],
  args: {
    isOpen: true,
    title: "Dark Mode Dialog",
    description:
      "Verify text contrast in dark mode. The dialog uses bg-bg-white (dark in dark mode) with text-text-strong (light in dark mode) for WCAG AA compliance.",
    variant: "danger",
    confirmLabel: "Delete Garden",
  },
};

export const StateCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-sm font-semibold text-text-sub-600 mb-2">Default Variant</h3>
        <ConfirmDialog
          isOpen={true}
          onClose={fn()}
          onConfirm={fn()}
          title="Confirm Action"
          description="Are you sure you want to proceed?"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "State catalog shows one dialog at a time since Radix Portal renders overlapping overlays. Use individual stories to see each variant.",
      },
    },
  },
};

export const DesktopGeometry: Story = {
  tags: ["storybook-ci"],
  // storybook-quality-allow state-harness: renders the real ConfirmDialog while allowing play to close the controlled Radix portal.
  render: () => (
    <ConfirmDialogHarness
      onClose={fn()}
      onConfirm={fn()}
      title="Centered desktop confirmation"
      description="Desktop centers this confirmation dialog in the viewport."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
    />
  ),
  play: async () => {
    await expect(window.innerWidth).toBeGreaterThanOrEqual(SM_BREAKPOINT_PX);

    const dialog = within(document.body);
    const surface = await dialog.findByRole(
      "dialog",
      {
        name: /centered desktop confirmation/i,
      },
      { timeout: 5_000 }
    );
    const scrim = document.body.querySelector<HTMLElement>(
      '[data-component="ConfirmDialog"][data-slot="overlay"]'
    );

    await expectViewportCoveringElement(scrim);
    await expectRealEnterAnimation(surface, /dialogZoomIn/);
    await waitForSurfaceSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);

      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;
      await expect(Math.abs(centerX - window.innerWidth / 2)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(Math.abs(centerY - window.innerHeight / 2)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );

      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.top).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.bottom).toBeLessThanOrEqual(
        window.innerHeight + VIEWPORT_EDGE_TOLERANCE_PX
      );
    });

    const closeButton = dialog.getByTestId("confirm-dialog-close");
    await expectTouchTarget(closeButton);
    await userEvent.click(closeButton);
    await waitFor(async () => {
      await expect(dialog.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  },
};

export const MobileSheetGeometry: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: {
      defaultViewport: "confirmMobile390x844",
      viewports: CONFIRM_MOBILE_VIEWPORT,
    },
  },
  // storybook-quality-allow state-harness: renders the real ConfirmDialog while allowing play to close the controlled Radix portal.
  render: () => (
    <ConfirmDialogHarness
      onClose={fn()}
      onConfirm={fn()}
      title="Mobile confirmation sheet"
      description="Mobile anchors this confirmation dialog to the viewport bottom."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
    />
  ),
  play: async () => {
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);

    const dialog = within(document.body);
    const surface = await dialog.findByRole(
      "dialog",
      {
        name: /mobile confirmation sheet/i,
      },
      { timeout: 5_000 }
    );
    const scrim = document.body.querySelector<HTMLElement>(
      '[data-component="ConfirmDialog"][data-slot="overlay"]'
    );

    await expectViewportCoveringElement(scrim);
    await expectRealEnterAnimation(surface, /dialogSlideInFromBottom/);
    await waitForSurfaceSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );

      const centerX = (rect.left + rect.right) / 2;
      await expect(Math.abs(centerX - window.innerWidth / 2)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
    });

    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX
    );
    const closeButton = dialog.getByTestId("confirm-dialog-close");
    await expectTouchTarget(closeButton);
    await userEvent.click(closeButton);
    await waitFor(async () => {
      await expect(dialog.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  },
};

export const ReducedMotionContract: Story = {
  tags: ["storybook-ci"],
  // storybook-quality-allow state-harness: renders the real ConfirmDialog while allowing play to close the controlled Radix portal.
  render: () => (
    <ConfirmDialogHarness
      onClose={fn()}
      onConfirm={fn()}
      title="Confirm reduced motion contract"
      description="Reduced motion zeroes shared dialog animation duration."
    />
  ),
  play: async () => {
    const surface = await within(document.body).findByRole(
      "dialog",
      {
        name: /confirm reduced motion contract/i,
      },
      { timeout: 5_000 }
    );

    await waitFor(async () => {
      await expect(getComputedStyle(surface).animationName).toMatch(
        /dialog(SlideInFromBottom|ZoomIn)/
      );
    });
    await expect(hasReducedMotionRule("ConfirmDialog")).toBe(true);
    await userEvent.click(within(document.body).getByTestId("confirm-dialog-close"));
    await waitFor(async () => {
      await expect(within(document.body).queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  },
};

export const Interactive: Story = {
  args: {
    isOpen: true,
    title: "Confirm Withdrawal",
    description: "Withdraw 1.5 ETH from the garden vault?",
    confirmLabel: "Withdraw",
    cancelLabel: "Keep Funds",
    onConfirm: fn(),
    onClose: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    // The dialog renders in a portal, so query from the document body
    const dialog = within(document.body);

    // Verify the dialog is rendered
    const dialogElement = await dialog.findByTestId("confirm-dialog");
    await expect(dialogElement).toBeInTheDocument();

    // Verify title is shown
    const title = await dialog.findByText("Confirm Withdrawal");
    await expect(title).toBeInTheDocument();

    // Verify description is shown
    const description = await dialog.findByText("Withdraw 1.5 ETH from the garden vault?");
    await expect(description).toBeInTheDocument();

    // Click the confirm button
    const confirmButton = await dialog.findByText("Withdraw");
    await userEvent.click(confirmButton);
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const InteractiveCancel: Story = {
  args: {
    isOpen: true,
    title: "Remove Member",
    description: "Remove this gardener from the team?",
    variant: "danger",
    confirmLabel: "Remove",
    cancelLabel: "Keep",
    onConfirm: fn(),
    onClose: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    const dialog = within(document.body);

    // Verify the dialog is rendered
    await dialog.findByTestId("confirm-dialog");

    // Click the cancel button
    const cancelButton = await dialog.findByText("Keep");
    await userEvent.click(cancelButton);
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

export const InteractiveClose: Story = {
  args: {
    isOpen: true,
    title: "Confirm Action",
    description: "Test closing via the X button",
    onConfirm: fn(),
    onClose: fn(),
  },
  play: async ({ args }) => {
    const dialog = within(document.body);

    // Click the close (X) button
    const closeButton = await dialog.findByTestId("confirm-dialog-close");
    await userEvent.click(closeButton);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

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
      title="Remove member"
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
