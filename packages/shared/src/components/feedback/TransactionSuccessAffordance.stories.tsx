import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { TransactionSuccessAffordance } from "./TransactionSuccessAffordance";

const meta: Meta<typeof TransactionSuccessAffordance> = {
  title: "Shared/Feedback/TransactionSuccessAffordance",
  component: TransactionSuccessAffordance,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One success affordance for the funding flows. `screen`/`receipt` render the flow's own visuals inside a polite status region; `toast` fires a single success toast through the two-tier toast service on the rising edge of `show` and renders nothing; `none` opts out. Display-only — each flow keeps its own reset callback and mutation wiring.",
      },
    },
  },
  argTypes: {
    mode: {
      control: "select",
      options: ["screen", "toast", "receipt", "none"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TransactionSuccessAffordance>;

/** Screen mode hosting a flow's own success visuals (endow/donate card). */
export const Screen: Story = {
  args: {
    mode: "screen",
    show: true,
    title: "Endowment received",
    children: (
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-6 text-center">
        <p className="text-sm font-medium text-text-strong-950">Endowed 1.5 WETH to Rio Garden</p>
        <p className="text-xs text-text-sub-600">The principal stays; yield supports the work.</p>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("status", { name: "Endowment received" });
    await expect(region).toHaveAttribute("data-mode", "screen");
    await expect(region).toHaveTextContent("Endowed 1.5 WETH to Rio Garden");
  },
};

/** Hidden until the transaction succeeds. */
export const Hidden: Story = {
  args: {
    mode: "screen",
    show: false,
    title: "Endowment received",
    children: <p>not visible</p>,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("status")).not.toBeInTheDocument();
  },
};

/** Receipt mode — semantic alias for flows that show a persistent record. */
export const Receipt: Story = {
  args: {
    mode: "receipt",
    show: true,
    title: "Donation recorded",
    children: (
      <dl className="max-w-sm rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-text-sub-600">Amount</dt>
          <dd className="text-text-strong-950">25 USDGLO</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-sub-600">Garden</dt>
          <dd className="text-text-strong-950">Muizenberg</dd>
        </div>
      </dl>
    ),
  },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole("status", { name: "Donation recorded" });
    await expect(region).toHaveAttribute("data-mode", "receipt");
  },
};
