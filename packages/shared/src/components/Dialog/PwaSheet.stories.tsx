import type { Meta, StoryObj } from "@storybook/react";
import { RiCloseLine } from "@remixicon/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PwaSheet, type PwaSheetProps } from "./PwaSheet";

type PwaSheetStoryArgs = Omit<PwaSheetProps, "children"> & {
  eyebrow: string;
  title: string;
  description: string;
  sections?: string[];
};

const DEFAULT_SHEET_SECTIONS = ["Photo evidence", "Garden context", "Draft notes"];
const LONG_SHEET_SECTIONS = Array.from({ length: 14 }, (_, index) => `Review section ${index + 1}`);

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

/** Computed color a CSS color value resolves to inside the same theme scope as `element`. */
function resolveBackground(element: HTMLElement, cssColor: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = cssColor;
  (element.parentElement ?? document.body).appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
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

function SheetBody({
  eyebrow,
  title,
  description,
  sections = DEFAULT_SHEET_SECTIONS,
  onClose,
}: Pick<PwaSheetStoryArgs, "eyebrow" | "title" | "description" | "sections" | "onClose">) {
  return (
    <>
      <header className="border-b border-stroke-soft-200 px-5 pb-4 pt-2">
        <p className="text-label-sm font-semibold uppercase text-text-soft-400">{eyebrow}</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-title-lg font-semibold text-text-strong-950">{title}</h2>
            <p className="mt-1 text-body-sm text-text-sub-600">{description}</p>
          </div>
          <button
            type="button"
            data-testid="pwa-sheet-close"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-soft-200 text-text-sub-600 transition-colors hover:bg-bg-sub-300 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
            aria-label="Close sheet"
          >
            <RiCloseLine className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>
      <div
        data-testid="pwa-sheet-body"
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
      >
        {sections.map((label) => (
          <div
            key={label}
            className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-4"
          >
            <p className="text-label-md font-medium text-text-strong-950">{label}</p>
            <p className="mt-1 text-body-sm text-text-sub-600">
              Review this section without leaving the active field workflow.
            </p>
          </div>
        ))}
      </div>
      <footer data-testid="pwa-sheet-footer" className="border-t border-stroke-soft-200 px-5 py-4">
        <button
          type="button"
          className="h-11 w-full rounded-full bg-primary-action px-4 text-label-lg font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
        >
          Keep editing
        </button>
      </footer>
    </>
  );
}

/**
 * Consumer-owned chrome: the fixture composes its own header inside the sheet,
 * so the story's `title` / `description` feed `SheetBody`, never the sheet's
 * shared header (the `SharedHeader` story covers that mode).
 */
function PwaSheetFixture({
  eyebrow,
  title,
  description,
  sections,
  ...sheetProps
}: PwaSheetStoryArgs) {
  return (
    <div className="min-h-[720px] bg-bg-white-0 text-text-strong-950">
      <div className="mx-auto flex min-h-[720px] max-w-[430px] items-center justify-center px-6 text-center">
        <p className="text-body-sm text-text-sub-600">
          The sheet is fixed to the viewport bottom, matching the installed PWA runtime.
        </p>
      </div>
      <PwaSheet {...sheetProps}>
        <SheetBody
          eyebrow={eyebrow}
          title={title}
          description={description}
          sections={sections}
          onClose={sheetProps.onClose}
        />
      </PwaSheet>
    </div>
  );
}

const meta = {
  title: "Shared/Feedback/PwaSheet",
  component: PwaSheetFixture,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Gesture-capable bottom sheet for installed PWA flows. Uses shared dialog keyframes, safe-area padding, focus trapping, Escape close, overlay click, and optional drag-to-dismiss. Pass `title` for the shared header that ConfirmDialog, DialogShell, and DraftSheet render through below 640px; the layout is attribute-driven CSS because Tailwind does not scan packages/shared.",
      },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    ariaLabel: "Work draft sheet",
    eyebrow: "Draft work",
    title: "Finish documenting this work",
    description: "Use this bottom sheet for focused PWA tasks without changing route context.",
    showDragHandle: true,
    dragToDismiss: true,
    size: "compact",
  },
  argTypes: {
    open: { control: "boolean" },
    size: {
      control: "select",
      options: ["compact", "half", "tall", "full"],
      description:
        "Height tier (DL-014): compact sizes to its content up to the half height; half, tall, and full hold 50%, 70%, and 85% of the viewport.",
    },
    showDragHandle: { control: "boolean" },
    dragToDismiss: { control: "boolean" },
    ariaLabel: { control: "text" },
    panelClassName: { control: false },
    panelStyle: { control: false },
    overlayClassName: { control: false },
    sections: { control: false },
    onClose: { action: "onClose" },
  },
} satisfies Meta<typeof PwaSheetFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args }) => {
    const canvas = within(document.body);
    const dialog = canvas.getByRole("dialog", { name: "Work draft sheet" });
    const surface = canvas.getByTestId("pwa-sheet");
    const scrim = document.body.querySelector<HTMLElement>(
      '[data-component="PwaSheet"][data-slot="scrim"]'
    );

    await expect(dialog).toBeVisible();
    await expect(surface).toHaveAttribute("data-state", "open");
    await expect(canvas.getByTestId("pwa-sheet-overlay")).toHaveAttribute("data-state", "open");
    await expect(canvas.getByTestId("pwa-sheet-drag-handle")).toBeVisible();
    await expect(scrim).not.toBeNull();
    await expect(scrim?.getAttribute("style")).toContain("--color-scrim");
    await expectRealEnterAnimation(surface, /dialogSlideInFromBottom/);
    await waitForSurfaceSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThan(0);
      await expect(rect.height).toBeGreaterThan(0);
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
    });

    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX
    );
    await expectTouchTarget(canvas.getByRole("button", { name: "Close sheet" }));

    await userEvent.click(canvas.getByRole("button", { name: "Close sheet" }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

// storybook-quality-allow dark-mode: verifies dark token inheritance for the fixed sheet surface.
// The sheet renders into <body>, so the theme is set on the document root, as the app does.
export const DarkMode: Story = {
  globals: { theme: "dark" },
  play: async () => {
    const canvas = within(document.body);
    const surface = await canvas.findByTestId("pwa-sheet");

    await expect(surface).toHaveAttribute("data-state", "open");
    await expect(getComputedStyle(surface).backgroundColor).toBe(
      resolveBackground(surface, "var(--color-material-solid)")
    );
  },
};

export const LongContentGeometry: Story = {
  args: {
    title: "Review a long work draft",
    description: "Long mobile sheet content stays inside the fixed surface.",
    sections: LONG_SHEET_SECTIONS,
    size: "full",
  },
  play: async () => {
    const canvas = within(document.body);
    const surface = await canvas.findByTestId("pwa-sheet");
    await waitForSurfaceSettled(surface);

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(rect.height).toBeLessThanOrEqual(
        window.innerHeight + VIEWPORT_EDGE_TOLERANCE_PX
      );
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(rect.left).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + VIEWPORT_EDGE_TOLERANCE_PX);
    });

    const body = canvas.getByTestId("pwa-sheet-body");
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await expect(body.scrollWidth).toBeLessThanOrEqual(
      body.clientWidth + VIEWPORT_EDGE_TOLERANCE_PX
    );

    const footer = canvas.getByTestId("pwa-sheet-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      surface.getBoundingClientRect().bottom + VIEWPORT_EDGE_TOLERANCE_PX
    );
  },
};

export const ReducedMotionContract: Story = {
  play: async () => {
    const canvas = within(document.body);
    const surface = await canvas.findByTestId("pwa-sheet");

    await waitFor(async () => {
      await expect(getComputedStyle(surface).animationName).toMatch(/dialogSlideInFromBottom/);
    });
    await expect(hasReducedMotionRule("PwaSheet")).toBe(true);
  },
};

export const WithoutDragDismiss: Story = {
  args: {
    showDragHandle: false,
    dragToDismiss: false,
    title: "Review sync settings",
    description: "Use this variant when accidental drag dismissal would interrupt a critical flow.",
  },
  play: async () => {
    const canvas = within(document.body);
    await expect(canvas.getByRole("dialog", { name: "Work draft sheet" })).toBeVisible();
    expect(canvas.queryByTestId("pwa-sheet-drag-handle")).not.toBeInTheDocument();
  },
};

export const SharedHeader: Story = {
  args: {
    title: "Delete Draft?",
    description: "This permanently deletes your draft and all associated images.",
  },
  render: (args) => (
    <div className="min-h-[720px] bg-bg-white-0 text-text-strong-950">
      <PwaSheet
        open={args.open}
        onClose={args.onClose}
        title={args.title}
        description={args.description}
        closeLabel="Close"
        role="alertdialog"
        showDragHandle={args.showDragHandle}
        dragToDismiss={args.dragToDismiss}
      >
        <button
          type="button"
          className="min-h-11 w-full rounded-lg bg-error-base px-4 py-3 text-sm font-medium text-static-white"
        >
          Delete
        </button>
        <button
          type="button"
          className="min-h-11 w-full rounded-lg bg-bg-weak-50 px-4 py-3 text-sm font-medium text-text-strong-950"
        >
          Cancel
        </button>
      </PwaSheet>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The shared header every confirm-style sheet uses: drag handle, title, description, 44px close button, and a content-sized body that stays anchored to the viewport bottom.",
      },
    },
  },
  play: async ({ args }) => {
    const canvas = within(document.body);
    const dialog = canvas.getByRole("alertdialog", { name: "Delete Draft?" });
    await expect(dialog).toHaveAccessibleDescription(
      "This permanently deletes your draft and all associated images."
    );
    const surface = canvas.getByTestId("pwa-sheet");
    await expectRealEnterAnimation(surface, /dialogSlideInFromBottom/);
    await waitForSurfaceSettled(surface);

    const closeButton = canvas.getByTestId("pwa-sheet-close");
    await expectTouchTarget(closeButton);
    const grip = surface.querySelector<HTMLElement>('[data-slot="grip"]');
    await expect(grip).not.toBeNull();
    await expect(getComputedStyle(grip as HTMLElement).backgroundColor).not.toBe(
      resolveBackground(surface, "transparent")
    );

    await waitFor(async () => {
      const rect = surface.getBoundingClientRect();
      await expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(
        CENTER_TOLERANCE_PX
      );
      await expect(rect.height).toBeLessThan(window.innerHeight * 0.6);
      await expect(rect.left).toBeLessThanOrEqual(VIEWPORT_EDGE_TOLERANCE_PX);
      await expect(rect.right).toBeGreaterThanOrEqual(
        window.innerWidth - VIEWPORT_EDGE_TOLERANCE_PX
      );
    });

    await userEvent.click(closeButton);
    await expect(args.onClose).toHaveBeenCalled();
  },
};
