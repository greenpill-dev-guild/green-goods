import { RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { AccountProfilePanel } from "./AccountProfilePanel";

interface MockAccountProfilePanelProps {
  userRole: "deployer" | "operator" | "user";
  displayName?: string;
  wallet?: string;
}

function MockAccountProfilePanel({
  userRole,
  displayName = "garden.eth",
  wallet = "0x2aa6...35e",
}: MockAccountProfilePanelProps) {
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex max-w-md flex-col gap-4">
      <section className="space-y-4 rounded-xl bg-bg-white p-4 shadow-[var(--edge-rest),var(--elevation-1)]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-alpha-10 text-sm font-semibold text-primary-dark">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-soft">Profile</p>
            <p className="text-base font-semibold capitalize text-text-strong">{userRole}</p>
            <p className="mt-1 text-sm text-text-sub">{displayName}</p>
          </div>
        </div>
        <p className="text-sm text-text-sub">
          Manage canvas identity, appearance, and account preferences.
        </p>
      </section>

      <section className="space-y-3 rounded-xl bg-bg-white p-4 shadow-[var(--edge-rest),var(--elevation-1)]">
        <div className="flex items-center gap-2">
          <RiWallet3Line className="h-4 w-4 text-text-soft" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-strong">Wallet</h2>
        </div>
        <div className="rounded-xl bg-bg-soft px-3 py-2 text-sm font-medium text-text-sub">
          {wallet}
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof AccountProfilePanel> = {
  title: "Admin/Shell/AccountProfilePanel",
  component: AccountProfilePanel,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Real `AccountProfilePanel` rendered against Storybook auth, wagmi, and deterministic ENS/query seeds. Harness stories are tagged separately for role-only static references.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AccountProfilePanel>;

export const Operator: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.querySelector('[data-component="SheetBody"]');

    await expect(body).not.toBeNull();
    await expect(await canvas.findByText("Profile")).toBeVisible();
  },
};

export const Deployer: Story = {
  tags: ["visual-harness"],
  render: () => <MockAccountProfilePanel userRole="deployer" displayName="deployer.eth" />,
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the deployer role label. The default story above renders the real account panel.",
      },
    },
  },
};

export const NoEnsName: Story = {
  tags: ["visual-harness"],
  render: () => (
    <MockAccountProfilePanel userRole="user" displayName="Wallet" wallet="0x04D6...2503" />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the wallet-only fallback. The default story above renders the real account panel.",
      },
    },
  },
};
