import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../shared/.storybook/decorators";
import { AdminCodeSignIn } from "./AdminCodeSignIn";

const codeSignIn: AdminLoginController["codeSignIn"] = {
  enabled: true,
  step: "email",
  email: "",
  setEmail: fn(),
  code: "",
  setCode: fn(),
  emailValid: false,
  sending: false,
  signingIn: false,
  error: null,
  sendCode: fn(async () => {}),
  signIn: fn(async () => {}),
  changeEmail: fn(),
  reset: fn(),
};
const controller: AdminLoginController = {
  mode: "otherWays",
  codeSignIn,
  walletReleaseStalled: false,
  changeMode: fn(),
  username: "",
  setUsername: fn(),
  error: null,
  isSigningIn: false,
  isPasskeySigningIn: false,
  canSignInByName: true,
  hasStoredCredential: false,
  storedUsername: null,
  savedAccountName: undefined,
  continueByName: fn(async () => {}),
  createNamedAccount: fn(async () => {}),
  signInWithStoredPasskey: fn(async () => {}),
  beginWalletSignIn: fn(),
};
const meta: Meta<typeof AdminCodeSignIn> = {
  title: "Admin/Identity/AdminCodeSignIn",
  component: AdminCodeSignIn,
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
          "The Hub's other ways to sign in, shown only with email sign-in switched on: email or a wallet, then the email step and the code step, in the passkey screens' slots. The real admin controls render against deterministic controller state; no code is sent and no wallet opens.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AdminCodeSignIn>;

/** With email sign-in on, the wallet moves one screen in, beside email. */
export const OtherWays: Story = {};
/** The email step: a code goes to the typed address. */
export const EmailStep: Story = {
  args: {
    controller: {
      ...controller,
      mode: "code",
      codeSignIn: { ...codeSignIn, email: "steward@example.com", emailValid: true },
    },
  },
};
/** The code step, right after the code was sent. */
export const CodeStep: Story = {
  args: {
    controller: {
      ...controller,
      mode: "code",
      codeSignIn: { ...codeSignIn, step: "code", email: "steward@example.com", emailValid: true },
    },
  },
};
/** The code step after a wrong code: the field keeps the code and the screen says what to do. */
export const CodeRefused: Story = {
  args: {
    controller: {
      ...controller,
      mode: "code",
      codeSignIn: {
        ...codeSignIn,
        step: "code",
        email: "steward@example.com",
        emailValid: true,
        code: "123456",
        error: "That code didn't work. Check it, or send a new one.",
      },
    },
  },
};
