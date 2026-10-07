import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../shared/.storybook/decorators";
import { AdminSignIn } from "./AdminSignIn";

const controller: AdminLoginController = {
  username: "storybook-steward",
  setUsername: fn(),
  error: null,
  isSigningIn: false,
  canSignInByName: true,
  hasStoredCredential: false,
  storedUsername: null,
  signInByName: fn(async () => {}),
  signInWithStoredPasskey: fn(async () => {}),
};
const meta: Meta<typeof AdminSignIn> = {
  title: "Admin/Identity/AdminSignIn",
  component: AdminSignIn,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="flex justify-center p-6">
        <Story />
      </div>
    ),
  ],
  args: { controller },
  parameters: {
    docs: {
      description: {
        component:
          "Existing-account sign-in. The real admin controls render against deterministic controller state; no passkey or wallet ceremony is started.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AdminSignIn>;
export const Default: Story = {};
export const Remembered: Story = {
  args: {
    controller: { ...controller, hasStoredCredential: true, storedUsername: "storybook-steward" },
  },
};
export const SigningIn: Story = { args: { controller: { ...controller, isSigningIn: true } } };
export const Unavailable: Story = {
  args: { controller: { ...controller, error: "Passkey recovery is temporarily unavailable." } },
};
export const WalletOnly: Story = {
  args: { controller: { ...controller, canSignInByName: false } },
};
