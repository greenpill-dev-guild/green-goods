import type { RewardShareState } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommitmentUsdcShares } from "./CommitmentUsdcShares";

const share = (
  recipient: `0x${string}`,
  amount: bigint,
  paidBy: `0x${string}` | null | undefined
): RewardShareState => ({
  promiseChainId: 42161,
  promiseModule: "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a",
  commitmentId: 19n,
  token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  recipient,
  amount,
  shareId: `0x${recipient.slice(2).padEnd(64, "0")}`,
  paidBy,
});

const STEWARD = "0xf401f34378384713222d1d21f63359cc4e8a858a" as const;
const owed = [
  share("0x1111111111111111111111111111111111111111", 12_000_000n, null),
  share("0x2222222222222222222222222222222222222222", 8_000_000n, null),
];

const meta: Meta<typeof CommitmentUsdcShares> = {
  title: "Admin/Pool/CommitmentUsdcShares",
  component: CommitmentUsdcShares,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "The USDC part of a kept promise's reward, split like the G$ payout and paid once per share from the steward's own wallet (PRD-1556).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
  args: {
    shares: owed,
    symbol: "USDC",
    decimals: 6,
    payerAvailable: true,
    splitFixed: true,
    canPay: true,
    isOnline: true,
    readFailed: false,
    isPaying: false,
    onPay: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentUsdcShares>;

export const Owed: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12 USDC, not paid yet")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Pay 20 USDC" }));
    await expect(args.onPay).toHaveBeenCalledTimes(1);
  },
};

export const PartlyPaid: Story = {
  args: { shares: [owed[0]!, { ...owed[1]!, paidBy: STEWARD }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("8 USDC, paid")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Pay 12 USDC" })).toBeVisible();
  },
};

export const AllPaid: Story = {
  args: { shares: owed.map((entry) => ({ ...entry, paidBy: STEWARD })) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

export const WaitsForTheGoodDollarPlan: Story = {
  args: { shares: [], splitFixed: false },
};

export const NotAStewardOfThePayingGarden: Story = {
  args: { canPay: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

/** Before the reward payer is deployed, the section says so and offers nothing to pay. */
export const PayerNotDeployed: Story = {
  args: { shares: [], payerAvailable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Paying this part from the app isn't available on this network yet.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};
