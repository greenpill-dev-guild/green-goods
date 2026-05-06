import { RiLockLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ConnectShell } from "./ConnectShell";

const meta: Meta<typeof ConnectShell> = {
  title: "Admin/Shell/ConnectShell",
  component: ConnectShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    action: (
      <button
        type="button"
        className="rounded-lg bg-primary-base px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--edge-rest)] transition-colors hover:bg-primary-darker"
      >
        Connect Wallet
      </button>
    ),
  },
  argTypes: {
    action: {
      control: false,
      description: "Optional action replacing the default connect button.",
    },
    icon: {
      control: false,
      description: "Optional icon rendered above the prompt.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConnectShell>;

export const Default: Story = {};

export const WalletRequired: Story = {
  args: {
    titleId: "app.admin.auth.walletRequired",
    defaultTitle: "Wallet required",
    descriptionId: "app.admin.auth.walletRequiredPrompt",
    defaultDescription:
      "The admin panel requires a wallet connection. Email and social logins are not supported here.",
    icon: <RiLockLine className="h-7 w-7 text-warning-dark" aria-hidden="true" />,
  },
};
