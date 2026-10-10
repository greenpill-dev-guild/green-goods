import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { SheetHeader } from "./SheetHeader";

/**
 * The one header every sheet and dialog renders (DL-028): an 18px semibold title on a 24px
 * line, an optional 14px description, both wrapping, and a 44px borderless Close on the title's
 * line. No icon and no rule under it; a tab rail can sit directly below with its own rule.
 * `PwaSheet` renders it under the drag handle; the centered dialogs render it standalone.
 */
const meta: Meta<typeof SheetHeader> = {
  title: "Shared/Feedback/SheetHeader",
  component: SheetHeader,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "padded" },
  args: {
    title: "Filter Gardens",
    description: "Search, narrow, and sort the garden list.",
    closeLabel: "Close",
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[390px] rounded-t-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0">
        <Story />
        <div className="px-4 pb-4 pt-2 text-sm text-text-sub-600">Body content</div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SheetHeader>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvasElement.querySelector('[data-component="SheetHeader"][data-slot="title"]');
    await expect(title).toHaveTextContent("Filter Gardens");
    const style = getComputedStyle(title as HTMLElement);
    await expect(style.fontSize).toBe("18px");
    await expect(style.fontWeight).toBe("600");
    await expect(style.lineHeight).toBe("24px");
    const description = canvasElement.querySelector(
      '[data-component="SheetHeader"][data-slot="description"]'
    ) as HTMLElement;
    await expect(getComputedStyle(description).fontSize).toBe("14px");
    const close = canvas.getByRole("button", { name: "Close" });
    await expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(close).toHaveAttribute("data-emphasis", "tertiary");
    await expect(canvasElement.querySelector('[data-slot="icon"]')).toBeNull();
  },
};

export const LongTitleWraps: Story = {
  args: {
    title: "Request to Join This Garden and Introduce Yourself to Its Stewards",
    description:
      "A long title wraps onto a second line instead of clipping; the close button stays on the first line.",
  },
  play: async ({ canvasElement }) => {
    const title = canvasElement.querySelector(
      '[data-component="SheetHeader"][data-slot="title"]'
    ) as HTMLElement;
    await expect(title.getBoundingClientRect().height).toBeGreaterThan(24);
    await expect(getComputedStyle(title).textOverflow).not.toBe("ellipsis");
  },
};

export const WithTabRail: Story = {
  args: { title: "Your Work", description: "Track work submissions and reviews" },
  render: (args) => (
    <SheetHeader {...args}>
      <div role="tablist" className="flex border-b border-stroke-soft-200">
        {["Draft", "Pending", "Completed"].map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === 0}
            className="flex-1 px-3 py-3 text-xs font-medium text-text-sub-600 aria-selected:text-primary"
          >
            {label}
          </button>
        ))}
      </div>
    </SheetHeader>
  ),
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector('[data-component="SheetHeader"][data-slot="rail"]');
    await expect(rail?.previousElementSibling).toHaveAttribute("data-slot", "root");
    await expect(within(rail as HTMLElement).getByRole("tablist")).toBeVisible();
  },
};

export const Standalone: Story = {
  args: { title: "Commitment kept?", description: "Say what you saw.", standalone: true },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-component="SheetHeader"][data-slot="root"]');
    await expect(root).toHaveAttribute("data-standalone");
    await expect(getComputedStyle(root as HTMLElement).paddingTop).toBe("16px");
  },
};
