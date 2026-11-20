import { Button } from "@green-goods/shared/components/Button";
import { RiKey2Line, RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { SignInSlots } from "./SignInSlots";

const passkey = (
  <Button
    className="w-full"
    type="button"
    size="lg"
    leadingIcon={<RiKey2Line className="h-[18px] w-[18px]" aria-hidden="true" />}
  >
    Continue with Passkey
  </Button>
);
const wallet = (
  <Button
    className="w-full"
    type="button"
    emphasis="secondary"
    size="lg"
    leadingIcon={<RiWallet3Line className="h-[18px] w-[18px]" aria-hidden="true" />}
  >
    Sign in with a Wallet
  </Button>
);

const meta: Meta<typeof SignInSlots> = {
  title: "Admin/Identity/SignInSlots",
  component: SignInSlots,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex justify-center p-6" data-tone="home">
        <Story />
      </div>
    ),
  ],
  args: { slotOne: passkey, slotTwo: wallet },
  parameters: {
    docs: {
      description: {
        component:
          "The sign-in screen's four fixed slots: the primary action, the second action, one clamped feedback zone and a quiet way elsewhere. The boot screen, drawn before any provider exists, and the Hub's sign-in both fill this frame, so the workspace takes over without a control moving (PRD-1491).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SignInSlots>;

/** The boot screen's fill: a passkey first, a wallet second, nothing below. */
export const Entry: Story = {};

/** A returning steward: the same two slots, a message in the feedback zone and a way to another account. */
export const WithFeedbackAndNavigation: Story = {
  args: {
    feedback: (
      <p role="alert" className="type-body text-error-dark">
        {"Your wallet app didn't open. Try again, or sign in with a passkey."}
      </p>
    ),
    navigation: (
      <Button type="button" emphasis="tertiary" size="lg">
        Use Different Username
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Your wallet app didn't open.");
    await expect(canvas.getByRole("button", { name: "Use Different Username" })).toBeVisible();
  },
};
