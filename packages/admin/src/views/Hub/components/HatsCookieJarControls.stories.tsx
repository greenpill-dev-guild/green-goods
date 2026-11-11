import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { HatsCookieJarControls } from "./HatsCookieJarControls";

const meta: Meta<typeof HatsCookieJarControls> = {
  title: "Admin/Workflows/Hub/HatsCookieJarControls",
  component: HatsCookieJarControls,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="max-w-md p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
  args: {
    jar: {
      jarAddress: "0x1111111111111111111111111111111111111111",
      gardenAddress: "0x2222222222222222222222222222222222222222",
      assetAddress: "0x3333333333333333333333333333333333333333",
      currency: "0x3333333333333333333333333333333333333333",
      balance: 25_000_000n,
      decimals: 6,
      maxWithdrawal: 10_000_000n,
      withdrawalInterval: 86_400n,
      minDeposit: 0n,
      isPaused: true,
      emergencyWithdrawalEnabled: true,
    },
    symbol: "USDC",
    admin: {
      kind: "hats",
      policy: {
        maxClaimCeiling: 20_000_000n,
        minCooldown: 86_400n,
        dailyBudget: 100_000_000n,
        recoveryRecipient: "0x4444444444444444444444444444444444444444",
      },
      pending: undefined,
      canOperate: true,
      canGovern: true,
      mutation: { mutate: fn(), isPending: false },
    },
  },
};

export default meta;
type Story = StoryObj<typeof HatsCookieJarControls>;

export const OwnerRecovery: Story = {
  tags: ["storybook-ci"],

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByText("Recover funds from the paused jar", { selector: "summary" })
    );
    await userEvent.type(canvas.getByRole("textbox", { name: "Amount to recover" }), "1.25");
    await userEvent.click(canvas.getByRole("button", { name: "Recover payout funds" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("alertdialog"));
    await waitFor(async () => {
      await expect(dialog.getByText("1.25 USDC")).toBeVisible();
      await expect(dialog.getByText("Recovery recipient")).toBeVisible();
    });
  },
};

export const Steward: Story = {
  tags: ["storybook-ci"],

  args: { admin: { ...meta.args!.admin!, canGovern: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Update payout limits", { selector: "summary" })).toBeVisible();
    await expect(canvas.queryByText("Propose payout policy")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Recover funds from the paused jar")).not.toBeInTheDocument();
  },
};
