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
    viewer: STEWARD,
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

/** A steward the split also pays keeps their own share and pays the others. */
export const StewardAlsoAContributor: Story = {
  args: { shares: [...owed, share(STEWARD, 5_000_000n, null)] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("5 USDC, your own share, nothing to send")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Pay 20 USDC" })).toBeVisible();
  },
};

/**
 * A co-steward opens the promise after the other steward paid everyone else: that steward's
 * own share is settled, so it is never offered to pay again.
 */
export const ACoStewardAfterTheOtherPaid: Story = {
  args: {
    shares: [
      share(STEWARD, 5_000_000n, null),
      ...owed.map((entry) => ({ ...entry, paidBy: STEWARD })),
    ],
    viewer: "0x3333333333333333333333333333333333333333",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("5 USDC, kept by the steward who paid the others")).toBeVisible();
    await expect(canvas.getByText("Paid")).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/**
 * Another steward paid everyone else and left this steward's own share unpaid. It is still theirs
 * to keep, but nobody has settled it, so the part doesn't read as paid.
 */
export const AnotherStewardPaidTheOthers: Story = {
  args: {
    shares: [
      share(STEWARD, 5_000_000n, null),
      ...owed.map((entry) => ({
        ...entry,
        paidBy: "0x3333333333333333333333333333333333333333" as const,
      })),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("5 USDC, your own share, nothing to send")).toBeVisible();
    await expect(canvas.queryByText("Paid")).toBeNull();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** Until the settlement read answers, the section doesn't ask for a plan that may already exist. */
export const WhileThePlanReads: Story = {
  args: { shares: [], splitFixed: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Create and finalize the G\$ payout plan/)).toBeNull();
    await expect(canvas.queryByText(/gives no one a share/)).toBeNull();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** A plan that gives no one a share leaves nothing to pay, and says so. */
export const NobodyToPay: Story = {
  args: { shares: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "The G$ payout plan gives no one a share, so there's nothing to pay in this part."
      )
    ).toBeVisible();
  },
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
