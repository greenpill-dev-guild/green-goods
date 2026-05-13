import type { Meta, StoryObj } from "@storybook/react";
import { RiCloseLine } from "@remixicon/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { PwaSheet, type PwaSheetProps } from "./PwaSheet";

type PwaSheetStoryArgs = Omit<PwaSheetProps, "children"> & {
  eyebrow: string;
  title: string;
  description: string;
};

function SheetBody({
  eyebrow,
  title,
  description,
  onClose,
}: Pick<PwaSheetStoryArgs, "eyebrow" | "title" | "description" | "onClose">) {
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-soft-200 text-text-sub-600 transition-colors hover:bg-bg-sub-300 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
            aria-label="Close sheet"
          >
            <RiCloseLine className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {["Photo evidence", "Garden context", "Draft notes"].map((label) => (
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
      <footer className="border-t border-stroke-soft-200 px-5 py-4">
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

function PwaSheetFixture(args: PwaSheetStoryArgs) {
  return (
    <div className="min-h-[720px] bg-bg-white-0 text-text-strong-950">
      <div className="mx-auto flex min-h-[720px] max-w-[430px] items-center justify-center px-6 text-center">
        <p className="text-body-sm text-text-sub-600">
          The sheet is fixed to the viewport bottom, matching the installed PWA runtime.
        </p>
      </div>
      <PwaSheet {...args}>
        <SheetBody
          eyebrow={args.eyebrow}
          title={args.title}
          description={args.description}
          onClose={args.onClose}
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
          "Gesture-capable bottom sheet for installed PWA flows. Uses shared dialog keyframes, safe-area padding, focus trapping, Escape close, overlay click, and optional drag-to-dismiss.",
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
  },
  argTypes: {
    open: { control: "boolean" },
    showDragHandle: { control: "boolean" },
    dragToDismiss: { control: "boolean" },
    ariaLabel: { control: "text" },
    panelClassName: { control: false },
    panelStyle: { control: false },
    overlayClassName: { control: false },
    onClose: { action: "onClose" },
  },
} satisfies Meta<typeof PwaSheetFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole("dialog", { name: "Work draft sheet" });
    const surface = canvas.getByTestId("pwa-sheet");
    const scrim = canvasElement.querySelector<HTMLElement>(
      '[data-component="PwaSheet"][data-slot="scrim"]'
    );

    await expect(dialog).toBeVisible();
    await expect(surface).toHaveAttribute("data-state", "open");
    await expect(canvas.getByTestId("pwa-sheet-overlay")).toHaveAttribute("data-state", "open");
    await expect(canvas.getByTestId("pwa-sheet-drag-handle")).toBeVisible();
    await expect(scrim).not.toBeNull();
    await expect(scrim?.getAttribute("style")).toContain("--color-scrim");

    const rect = surface.getBoundingClientRect();
    await expect(rect.bottom).toBeGreaterThanOrEqual(window.innerHeight - 2);
    await expect(rect.width).toBeLessThanOrEqual(window.innerWidth);

    await userEvent.click(canvas.getByRole("button", { name: "Close sheet" }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = await canvas.findByTestId("pwa-sheet");

    await expect(surface).toHaveAttribute("data-state", "open");
    await expect(surface.className).toContain("bg-[var(--color-material-solid)]");
  },
};

export const WithoutDragDismiss: Story = {
  args: {
    showDragHandle: false,
    dragToDismiss: false,
    title: "Review sync settings",
    description: "Use this variant when accidental drag dismissal would interrupt a critical flow.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("dialog", { name: "Work draft sheet" })).toBeVisible();
    expect(canvas.queryByTestId("pwa-sheet-drag-handle")).not.toBeInTheDocument();
  },
};
