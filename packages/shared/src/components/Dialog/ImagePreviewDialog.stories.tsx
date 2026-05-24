import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_EDU,
  FIXTURE_IMAGE_SOLAR,
} from "../../../.storybook/fixtures";
import { ImagePreviewDialog, type ImagePreviewDialogProps } from "./ImagePreviewDialog";

const meta: Meta<typeof ImagePreviewDialog> = {
  title: "Shared/Feedback/ImagePreviewDialog",
  component: ImagePreviewDialog,
  tags: ["autodocs", "storybook-ci"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Whether the dialog is open",
    },
    onClose: {
      description: "Callback when the dialog is closed",
    },
    images: {
      control: "object",
      description: "Array of image URLs to preview",
    },
    initialIndex: {
      control: "number",
      description: "Index of the image to show initially",
    },
    className: {
      control: "text",
      description: "Additional class names for the overlay",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ImagePreviewDialog>;

const sampleImages = [FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_SOLAR, FIXTURE_IMAGE_EDU];

const VIEWPORT_EDGE_TOLERANCE_PX = 1;
const MIN_TOUCH_TARGET_PX = 44;

function ImagePreviewDialogHarness(args: ImagePreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(args.isOpen);

  return (
    <ImagePreviewDialog
      {...args}
      isOpen={isOpen}
      onClose={() => {
        args.onClose();
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

async function closeImagePreviewDialog() {
  const dialog = within(document.body);
  await userEvent.click(dialog.getByTestId("image-preview-close"));
  await waitFor(async () => {
    await expect(dialog.queryByTestId("image-preview-dialog")).not.toBeInTheDocument();
  });
}

async function expectRealEnterAnimation(surface: HTMLElement, keyframe: RegExp) {
  const style = getComputedStyle(surface);
  await expect(style.animationName).toMatch(keyframe);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await expect(style.animationDuration).not.toBe("0s");
  }
}

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function expectEffectiveTouchTarget(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const after = getComputedStyle(element, "::after");
  const effectiveWidth =
    rect.width + Math.max(0, -parsePx(after.left)) + Math.max(0, -parsePx(after.right));
  const effectiveHeight =
    rect.height + Math.max(0, -parsePx(after.top)) + Math.max(0, -parsePx(after.bottom));

  await expect(effectiveWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  await expect(effectiveHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
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
    onClose: fn(),
    images: sampleImages,
    initialIndex: 0,
  },
  // storybook-quality-allow state-harness: renders the real ImagePreviewDialog while allowing play to close the controlled Radix portal.
  render: (args) => <ImagePreviewDialogHarness {...args} />,
  play: async ({ args }) => {
    const dialog = within(document.body);
    const overlay = await dialog.findByTestId("image-preview-dialog");
    const surface = await dialog.findByRole("dialog", { name: /image preview/i });
    const imageViewport = await dialog.findByRole("application");
    const downloadButton = dialog.getByTestId("image-preview-download");
    const closeButton = dialog.getByTestId("image-preview-close");

    await expectRealEnterAnimation(overlay, /scrimFadeIn/);
    await waitForSurfaceSettled(overlay);

    await waitFor(async () => {
      const overlayRect = overlay.getBoundingClientRect();
      await expect(overlayRect.left).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(overlayRect.top).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(overlayRect.right).toBeGreaterThanOrEqual(
        window.innerWidth - VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(overlayRect.bottom).toBeGreaterThanOrEqual(
        window.innerHeight - VIEWPORT_EDGE_TOLERANCE_PX
      );

      const imageRect = imageViewport.getBoundingClientRect();
      await expect(imageRect.width).toBeGreaterThan(0);
      await expect(imageRect.height).toBeGreaterThan(0);
      await expect(imageRect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(imageRect.right).toBeLessThanOrEqual(
        window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(imageRect.top).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(imageRect.bottom).toBeLessThanOrEqual(
        window.innerHeight + VIEWPORT_EDGE_TOLERANCE_PX
      );
    });

    await expect(surface).toBeVisible();
    await expect(downloadButton).toBeVisible();
    await expect(closeButton).toBeVisible();
    await expectEffectiveTouchTarget(downloadButton);
    await expectEffectiveTouchTarget(closeButton);
    await expect(hasReducedMotionRule("ImagePreviewDialog")).toBe(true);

    await closeImagePreviewDialog();
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const SingleImage: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    images: [FIXTURE_IMAGE_AGROFORESTRY],
    initialIndex: 0,
  },
  // storybook-quality-allow state-harness: renders the real ImagePreviewDialog while allowing play to close the controlled Radix portal.
  render: (args) => <ImagePreviewDialogHarness {...args} />,
  play: async () => {
    await within(document.body).findByRole("dialog", { name: /image preview/i });
    await closeImagePreviewDialog();
  },
};

export const StartAtSecondImage: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    images: sampleImages,
    initialIndex: 1,
  },
  // storybook-quality-allow state-harness: renders the real ImagePreviewDialog while allowing play to close the controlled Radix portal.
  render: (args) => <ImagePreviewDialogHarness {...args} />,
  play: async () => {
    await within(document.body).findByRole("dialog", { name: /image preview/i });
    await closeImagePreviewDialog();
  },
};

export const StateCatalog: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    images: sampleImages,
    initialIndex: 0,
  },
  // storybook-quality-allow state-harness: renders the real ImagePreviewDialog while allowing play to close the controlled Radix portal.
  render: (args) => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        The ImagePreviewDialog is a full-screen overlay. Each story above shows a different
        configuration (single image, multiple images, starting at a specific index). Open them
        individually to interact.
      </p>
      {/* storybook-quality-allow state-harness: renders the real ImagePreviewDialog while allowing play to close the controlled Radix portal. */}
      <ImagePreviewDialogHarness {...args} />
    </div>
  ),
  play: async () => {
    await within(document.body).findByRole("dialog", { name: /image preview/i });
    await closeImagePreviewDialog();
  },
};
