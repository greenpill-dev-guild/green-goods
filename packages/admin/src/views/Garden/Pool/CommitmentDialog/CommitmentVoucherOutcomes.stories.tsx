import type {
  CommitmentRewardOutcome,
  CommitmentVoucherOutcomes as Outcomes,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { CommitmentVoucherOutcomes } from "./CommitmentVoucherOutcomes";

const meta: Meta<typeof CommitmentVoucherOutcomes> = {
  title: "Admin/Pool/CommitmentVoucherOutcomes",
  component: CommitmentVoucherOutcomes,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A promise's voucher outcomes in its inspector: a request's rewards, each with its own state and receipt, or an offer's voucher payment. Fictional accounts and receipts only.",
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
};

export default meta;
type Story = StoryObj<typeof CommitmentVoucherOutcomes>;

// The vouchers live on Gnosis with six decimals; the G$ reward is paid on Celo.
const asset = (symbol: string, token: string) => ({
  chainId: 100,
  token: token as Address,
  symbol,
  decimals: 6,
});
const GREEN_GOODS = { name: "Green Goods", gender: "masculine" as const };
const TECH_AND_SUN = { name: "Tech and Sun", gender: "feminine" as const };
const RECEIPT = "0x7f3a51c0d2e94b8a6c1f0e3d5b7a9c2e4f6081a3b5c7d9e1f2a4b6c8d0e2f4a6";

const voucher = (over: Partial<CommitmentRewardOutcome> = {}): CommitmentRewardOutcome => ({
  id: "0x0a",
  kind: "voucher",
  asset: asset("GG", "0x000000000000000000000000000000000000fa01"),
  amount: 2_000_000n,
  funder: "0x5afe00000000000000000000000000000000c3d4",
  status: "on-the-way",
  shortOf: null,
  receipt: null,
  attempts: 0n,
  issuer: GREEN_GOODS,
  ...over,
});
const gd = (over: Partial<CommitmentRewardOutcome> = {}): CommitmentRewardOutcome => ({
  id: "0x0b",
  kind: "gd",
  asset: {
    chainId: 42220,
    token: "0x000000000000000000000000000000000000fd01",
    symbol: "G$",
    decimals: 18,
  },
  amount: 100n * 10n ** 18n,
  funder: "0x000000000000000000000000000000000000fd02",
  status: "on-the-way",
  shortOf: null,
  receipt: null,
  attempts: 0n,
  issuer: null,
  ...over,
});
const request = (rewards: CommitmentRewardOutcome[], workFulfilled = true): Outcomes => ({
  rewards,
  workFulfilled,
  payment: null,
});

/** Accepted, before the work is confirmed: nothing is set aside yet. */
export const BothAfterWork: Story = {
  args: {
    outcomes: request([voucher({ status: "after-work" }), gd({ status: "after-work" })], false),
  },
};

/** One reward received beside one still on its way reads as normal. */
export const OneReceived: Story = {
  args: {
    outcomes: request([
      voucher({ status: "received", receipt: RECEIPT, attempts: 1n }),
      gd({ status: "on-the-way" }),
    ]),
  },
};

/** The garden's allowance at the issuer is too small: the issuer raises it. */
export const VoucherWaitingOnAllowance: Story = {
  args: {
    outcomes: request([
      voucher({ status: "waiting", shortOf: "allowance" }),
      gd({ status: "received", receipt: RECEIPT, attempts: 1n }),
    ]),
  },
};

/** The issuer's reserve is short: the issuer tops it up. The reward isn't lost. */
export const VoucherWaitingOnReserve: Story = {
  args: {
    outcomes: request([
      voucher({ status: "waiting", shortOf: "reserve" }),
      gd({ status: "received", receipt: RECEIPT, attempts: 1n }),
    ]),
  },
};

/** The payout failed and paid nothing; G$ Payout keeps the retry. */
export const PayoutDelayed: Story = {
  args: {
    outcomes: request([
      voucher({ status: "received", receipt: RECEIPT, attempts: 1n }),
      gd({ status: "delayed", attempts: 1n }),
    ]),
  },
};

export const BothReceived: Story = {
  args: {
    outcomes: request([
      voucher({ status: "received", receipt: RECEIPT, attempts: 1n }),
      gd({ status: "received", receipt: `${RECEIPT.slice(0, -4)}9c1d`, attempts: 1n }),
    ]),
  },
};

/** A request that pays only vouchers, from Tech and Sun's reserve. */
export const VoucherOnly: Story = {
  args: {
    outcomes: request([
      voucher({
        asset: asset("TS", "0x000000000000000000000000000000000000fb01"),
        amount: 1_000_000n,
        funder: "0x5afe00000000000000000000000000000000a1b2",
        issuer: TECH_AND_SUN,
      }),
    ]),
  },
};

/** An offer takes vouchers as payment: what one booking takes, under the offer's terms. */
export const OfferPayment: Story = {
  args: {
    outcomes: {
      rewards: [],
      workFulfilled: false,
      payment: {
        asset: asset("TS", "0x000000000000000000000000000000000000fb01"),
        issuer: TECH_AND_SUN,
        issuerAccount: "0x5afe00000000000000000000000000000000a1b2",
        units: 1_000_000n,
        revision: 2n,
      },
    },
  },
};
