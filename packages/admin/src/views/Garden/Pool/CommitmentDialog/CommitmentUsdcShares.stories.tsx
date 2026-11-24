import type {
  RewardSafePaymentRead,
  RewardShareState,
} from "@green-goods/shared/commitment-pooling";
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

const SAFE = "0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe" as const;
const STEWARD = "0xf401f34378384713222d1d21f63359cc4e8a858a" as const;
const CO_STEWARD = "0x3333333333333333333333333333333333333333" as const;
const owed = [
  share("0x1111111111111111111111111111111111111111", 12_000_000n, null),
  share("0x2222222222222222222222222222222222222222", 8_000_000n, null),
];

/** The Safe's payment of the owed shares, as the Hub reads it: two owners must approve. */
const payment = (approvedBy: `0x${string}`[], threshold = 2): RewardSafePaymentRead => ({
  status: "ready",
  transaction: {
    safe: SAFE,
    to: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
    data: "0x",
    operation: 1,
    nonce: 0n,
    hash: `0x${"ab".repeat(32)}`,
  },
  owners: [STEWARD, CO_STEWARD],
  threshold,
  approvedBy,
  total: 20_000_000n,
  shareIds: owed.map((entry) => entry.shareId),
});

const meta: Meta<typeof CommitmentUsdcShares> = {
  title: "Admin/Pool/CommitmentUsdcShares",
  component: CommitmentUsdcShares,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "The USDC part of a kept promise's reward, split like the G$ payout and paid once per share from the garden's Safe (PRD-1556). The Safe's owners approve the one payment from their own accounts, and the owner whose approval completes the threshold runs it.",
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
    owed,
    symbol: "USDC",
    decimals: 6,
    payerAvailable: true,
    safe: SAFE,
    beneficiarySafeMissing: false,
    splitFixed: true,
    payment: payment([]),
    paymentReading: false,
    paymentReadFailed: false,
    viewer: STEWARD,
    isOnline: true,
    readFailed: false,
    isPaying: false,
    onPay: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentUsdcShares>;

/** The first owner approves; the payment runs once a second owner approves too. */
export const Owed: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12 USDC, not paid yet")).toBeVisible();
    await expect(canvas.getByText("0 of 2 Safe owners have approved this payment.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Approve Payment of 20 USDC" }));
    await expect(args.onPay).toHaveBeenCalledTimes(1);
  },
};

/** Another owner approved, so this owner's call runs the payment. */
export const CompletesTheApprovals: Story = {
  args: { payment: payment([CO_STEWARD]) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 of 2 Safe owners have approved this payment.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Pay 20 USDC" }));
    await expect(args.onPay).toHaveBeenCalledTimes(1);
  },
};

/** This owner approved; nothing more to ask of them until another owner approves. */
export const ApprovedWaitingOnAnotherOwner: Story = {
  args: { payment: payment([STEWARD]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("You've approved. It pays once enough of the Safe's owners approve.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** A steward who is not one of the Safe's owners sees the shares and nothing to press. */
export const NotAnOwnerOfTheSafe: Story = {
  args: { viewer: "0x4444444444444444444444444444444444444444" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Only an owner of this garden's Safe can approve this payment.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const PartlyPaid: Story = {
  args: {
    shares: [owed[0]!, { ...owed[1]!, paidBy: SAFE }],
    owed: [owed[0]!],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("8 USDC, paid by the garden")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Approve Payment of 12 USDC" })).toBeVisible();
  },
};

export const AllPaid: Story = {
  args: { shares: owed.map((entry) => ({ ...entry, paidBy: SAFE })), owed: [], payment: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Paid")).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** The Safe holds less than the owed total, so it asks for USDC before any signature. */
export const SafeHoldsTooLittle: Story = {
  args: { payment: { status: "refused", refusal: "insufficient-balance" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        "The garden's Safe holds less than 20 USDC. Add USDC to the Safe before paying."
      )
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** While the Safe's approvals read, Pay waits: busy, and a press does nothing. */
export const WhileTheApprovalsRead: Story = {
  args: { payment: null, paymentReading: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    await expect(args.onPay).not.toHaveBeenCalled();
  },
};

/** A garden with no Safe recorded on this network pays no USDC from the app. */
export const GardenHasNoSafe: Story = {
  args: { safe: null, payment: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("This garden has no Safe on this network to pay USDC from yet.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** A Request taken up by a garden with no Safe here has nowhere to receive its USDC yet. */
export const TakingGardenHasNoSafe: Story = {
  args: { shares: [], owed: [], payment: null, beneficiarySafeMissing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        "The garden that took this up has no Safe on this network to receive USDC yet."
      )
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const WaitsForTheGoodDollarPlan: Story = {
  args: { shares: [], owed: [], payment: null, splitFixed: false },
};

/** Until the settlement read answers, the section doesn't ask for a plan that may already exist. */
export const WhileThePlanReads: Story = {
  args: { shares: [], owed: [], payment: null, splitFixed: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Create and finalize the G\$ payout plan/)).toBeNull();
    await expect(canvas.queryByText(/gives no one a share/)).toBeNull();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** A plan that gives no one a share leaves nothing to pay, and says so. */
export const NobodyToPay: Story = {
  args: { shares: [], owed: [], payment: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "The G$ payout plan gives no one a share, so there's nothing to pay in this part."
      )
    ).toBeVisible();
  },
};

/** Before the reward payer is deployed, the section says so and offers nothing to pay. */
export const PayerNotDeployed: Story = {
  args: { shares: [], owed: [], payment: null, payerAvailable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Paying this part from the app isn't available on this network yet.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};
