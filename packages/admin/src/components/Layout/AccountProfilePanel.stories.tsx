import { RiLogoutBoxLine, RiWallet3Line } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { AccountProfilePanelContainer } from "./AccountProfilePanel";

interface MockAccountProfilePanelProps {
  userRole: "deployer" | "steward" | "user";
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
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-alpha-10 text-sm font-semibold text-primary-dark">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-text-strong">{displayName}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-stroke-soft bg-bg-soft px-2.5 py-0.5 text-xs font-medium capitalize text-text-sub">
              {userRole}
            </span>
            <span className="inline-flex items-center rounded-full border border-stroke-soft bg-bg-soft px-2.5 py-0.5 text-xs font-medium text-text-sub">
              Wallet
            </span>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <RiWallet3Line className="h-4 w-4 text-text-soft" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-strong">Wallet</h2>
        </div>
        <div className="rounded-xl border border-stroke-soft bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-sub">
          {wallet}
        </div>
      </section>

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-full px-4 py-3 text-sm font-medium text-error-base transition-colors hover:bg-error-lighter"
      >
        Disconnect
        <RiLogoutBoxLine className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const meta: Meta<typeof AccountProfilePanelContainer> = {
  title: "Admin/Shell/AccountProfilePanel",
  component: AccountProfilePanelContainer,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter(["/hub"]),
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
          "Real `AccountProfilePanel` (the Account surface) rendered against Storybook auth, wagmi, and deterministic ENS/query seeds: identity headline with role and auth-method chips, one wallet address row with copy + explorer, the gardens this account operates, and sign-out pinned in the footer. Harness stories are tagged separately for static references.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AccountProfilePanelContainer>;

export const Steward: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.querySelector('[data-component="SheetBody"]');
    const footer = canvasElement.querySelector('[data-component="SheetFooter"]');

    await expect(body).not.toBeNull();
    // Identity actions live here: sign-out is the pinned footer.
    await expect(footer).not.toBeNull();
    await expect(await canvas.findByRole("heading", { name: "Wallet" })).toBeVisible();
    await expect(await canvas.findByRole("heading", { name: "Your gardens" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Disconnect/ })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /View on explorer/ })).toBeVisible();
  },
};

export const Deployer: Story = {
  tags: ["visual-harness"],
  render: () => <MockAccountProfilePanel userRole="deployer" displayName="deployer.eth" />,
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the deployer role chip. The default story above renders the real account panel.",
      },
    },
  },
};

export const NoEnsName: Story = {
  tags: ["visual-harness"],
  render: () => (
    <MockAccountProfilePanel userRole="user" displayName="0x04D6...2503" wallet="0x04D6...2503" />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Visual harness for the wallet-only fallback — the truncated address becomes the headline. The default story above renders the real account panel.",
      },
    },
  },
};
