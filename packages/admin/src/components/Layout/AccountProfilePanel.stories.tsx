import { RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";

interface MockAccountProfilePanelProps {
  role: "deployer" | "operator" | "user";
  displayName?: string;
  wallet?: string;
}

function MockAccountProfilePanel({
  role,
  displayName = "garden.eth",
  wallet = "0x2aa6...35e",
}: MockAccountProfilePanelProps) {
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex max-w-md flex-col gap-4">
      <section className="space-y-4 rounded-xl bg-bg-white p-4 shadow-[var(--edge-rest),var(--elevation-1)]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-alpha-10 text-sm font-semibold tracking-[0.08em] text-primary-dark">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-soft">
              Profile
            </p>
            <p className="text-base font-semibold capitalize text-text-strong">{role}</p>
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

const meta: Meta<typeof MockAccountProfilePanel> = {
  title: "Admin/Shell/AccountProfilePanel",
  component: MockAccountProfilePanel,
  tags: ["autodocs"],
  args: {
    role: "operator",
    displayName: "garden.eth",
    wallet: "0x2aa6...35e",
  },
  argTypes: {
    role: {
      control: "select",
      options: ["deployer", "operator", "user"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MockAccountProfilePanel>;

export const Operator: Story = {};

export const Deployer: Story = {
  args: {
    role: "deployer",
    displayName: "deployer.eth",
  },
};

export const NoEnsName: Story = {
  args: {
    role: "user",
    displayName: "Wallet",
    wallet: "0x04D6...2503",
  },
};
