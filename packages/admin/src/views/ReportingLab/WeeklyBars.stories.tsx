import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { WeeklyBars } from "./WeeklyBars";

const weeks = ["Nov 24", "Dec 1", "Dec 8", "Dec 15", "Dec 22", "Dec 29", "Jan 5", "Jan 12"];
const reported = [845, 757, 510, 926, 558, 539, 941, 527];
const approved = [845, 700, 510, 926, 558, 539, 900, 460];

const meta = {
  title: "Admin/Prototypes/Garden Reporting/Components/WeeklyBars",
  component: WeeklyBars,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Proposed chart primitive with no library: nested bars (a total and the approved part of it) or paired bars (two counts side by side). Values print above the bars, each week is a button when it opens records, and Show Table gives the same numbers as a table. Synthetic numbers.",
      },
    },
  },
  decorators: [
    withCanvasFrame({ workspace: "garden", className: "p-4" }),
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Waste sorted (kg)",
    primaryLabel: "Reported",
    secondaryLabel: "Approved",
    points: weeks.map((label, index) => ({
      key: label,
      label,
      primary: reported[index],
      secondary: approved[index],
      running: index === weeks.length - 1,
    })),
    format: (value: number) => value.toLocaleString("en-US"),
    onSelect: fn(),
    summary: "January 2026: 1,604 kg reported, 1,349 kg approved, from 37 records.",
  },
} satisfies Meta<typeof WeeklyBars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Nested: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Dec 8: 510 reported/ }));
    await expect(args.onSelect).toHaveBeenCalledWith(2);
    await userEvent.click(canvas.getByRole("button", { name: "Show Table" }));
    await expect(canvas.getByRole("table")).toBeVisible();
  },
};

export const Paired: Story = {
  args: {
    title: "Submitted and Reviewed, by Week",
    mode: "paired",
    primaryLabel: "Submitted",
    secondaryLabel: "Reviewed",
    points: weeks.map((label, index) => ({
      key: label,
      label,
      primary: [31, 28, 30, 33, 21, 12, 30, 22][index],
      secondary: [30, 29, 30, 31, 9, 0, 41, 18][index],
    })),
    summary: undefined,
    onSelect: undefined,
  },
};

export const WeeksTheReadMissed: Story = {
  args: {
    points: weeks.map((label, index) => ({
      key: label,
      label,
      primary: reported[index],
      secondary: approved[index],
      gap: index < 5 ? "Not loaded" : undefined,
    })),
  },
};
