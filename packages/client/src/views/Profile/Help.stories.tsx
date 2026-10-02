import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { withAppPage } from "../../../../shared/.storybook/decorators";
import { ProfileHelp } from "./Help";

/**
 * Profile › Help: where to get in touch, then the questions by category. Promises
 * have their own category, where How Promises Work in the Offer or Request sheet
 * leads.
 */
const meta: Meta<typeof ProfileHelp> = {
  title: "Client/Profile/Help",
  component: ProfileHelp,
  parameters: { layout: "fullscreen" },
  decorators: [
    // The profile's content column: the app's `padded` gutter is 16px on a phone.
    (Story) => (
      <div className="mx-4 flex flex-col gap-4 py-4">
        <Story />
      </div>
    ),
    withAppPage,
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileHelp>;

/** The Promises category, with its first question open. */
export const Promises: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Promises" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "What are promises?" }));
    await expect(canvas.getByTestId("faq-content-whatArePromises")).toBeVisible();
    // Promises moved out of Funds and Wallet: no question there says "pool" any more.
    await expect(canvas.queryByText(/What are pools\?/)).toBeNull();
  },
};
