import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Textarea } from "../Form/ControlPrimitives";
import { SheetHeader } from "./SheetHeader";
import { SheetHeading } from "./SheetHeading";

/**
 * The one heading style inside a sheet body (DL-028): section headings, group labels over lists,
 * and empty, error, and success state titles render 14px semibold on a 20px line in the strong
 * text colour, in sentence case. The sheet's own title and description stay in `SheetHeader`.
 */
const meta: Meta<typeof SheetHeading> = {
  title: "Shared/Feedback/SheetHeading",
  component: SheetHeading,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "padded" },
  args: { children: "Domains" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[390px] rounded-t-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0">
        <SheetHeader
          title="Filter Gardens"
          description="Search, narrow, and sort the garden list."
          closeLabel="Close"
          onClose={() => undefined}
        />
        <div className="flex flex-col gap-3 px-4 pb-4">
          <Story />
          <p className="text-sm text-text-sub-600">Solar, Agroforestry, Education, Waste</p>
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", { level: 3, name: "Domains" });
    const style = getComputedStyle(heading);
    await expect(style.fontSize).toBe("14px");
    await expect(style.fontWeight).toBe("600");
    await expect(style.lineHeight).toBe("20px");
    await expect(style.textTransform).toBe("none");
  },
};

export const GroupLabelOverList: Story = {
  args: { as: "h4", className: "truncate", title: "Green Goods Community Garden" },
  render: (args) => <SheetHeading {...args}>Green Goods Community Garden</SheetHeading>,
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", { level: 4 });
    await expect(getComputedStyle(heading).fontSize).toBe("14px");
    await expect(heading).toHaveAttribute("title", "Green Goods Community Garden");
  },
};

export const FieldGroupLabel: Story = {
  args: { as: "label", htmlFor: "sheet-heading-note", className: "block" },
  render: (args) => (
    <div className="space-y-2">
      <SheetHeading {...args}>Note</SheetHeading>
      <Textarea id="sheet-heading-note" rows={2} defaultValue="Thanks for the ride." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const note = within(canvasElement).getByRole("textbox", { name: "Note" });
    await expect(note).toBeInTheDocument();
  },
};
