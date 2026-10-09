import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { GardenJoinRequestStatus } from "./GardenJoinRequestStatus";

const meta = {
  title: "Client/Sheets/Join Request Status",
  component: GardenJoinRequestStatus,
  tags: ["autodocs", "storybook-ci"],
  args: { activity: null, uncertain: false, hasCheckedStatus: false },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GardenJoinRequestStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Your Introduction");
  },
};
export const Checking: Story = {
  args: { activity: "checking" },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toHaveAttribute("aria-busy", "true");
    await expect(status).toHaveTextContent("Checking for updates…");
  },
};
export const OutcomeUnknown: Story = {
  args: { uncertain: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "Check its status before trying again"
    );
  },
};
export const CheckedEmpty: Story = {
  args: { hasCheckedStatus: true, receipt: { kind: "checked", text: "Checked just now." } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "You do not have a request"
    );
  },
};
