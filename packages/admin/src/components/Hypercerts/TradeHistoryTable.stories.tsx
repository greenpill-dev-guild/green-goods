import { type Address, DEFAULT_CHAIN_ID, type FractionTrade, queryKeys } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { daysAgo } from "../../../../shared/.storybook/fixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { TradeHistoryTable } from "./TradeHistoryTable";

const HYPERCERT_ID = 123_456_789n;
const tradesKey = queryKeys.marketplace.tradeHistory(HYPERCERT_ID.toString(), DEFAULT_CHAIN_ID);

const ZERO_CURRENCY = "0x0000000000000000000000000000000000000000" as Address;

function trade(id: number, units: bigint, payment: bigint, daysAgoCount: number): FractionTrade {
  return {
    orderId: id,
    hypercertId: HYPERCERT_ID,
    recipient: `0x${id.toString().padStart(40, "0")}` as Address,
    units,
    payment,
    currency: ZERO_CURRENCY,
    timestamp: daysAgo(daysAgoCount),
    txHash: `0x${id.toString().padStart(64, "0")}` as `0x${string}`,
  };
}

const TRADES: FractionTrade[] = [
  trade(1, 5_000n, 50_000_000_000_000_000n, 1),
  trade(2, 12_500n, 125_000_000_000_000_000n, 3),
  trade(3, 1_200_000n, 12_000_000_000_000_000n, 7),
  trade(4, 800n, 8_000_000_000_000_000n, 14),
];

const meta: Meta<typeof TradeHistoryTable> = {
  title: "Admin/Workflows/Hypercerts/TradeHistoryTable",
  component: TradeHistoryTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Real `TradeHistoryTable`. Seeds `useTradeHistory` via React Query so the table renders with fixture data; no network calls are made.",
      },
    },
  },
  args: {
    hypercertId: HYPERCERT_ID,
  },
};

export default meta;
type Story = StoryObj<typeof TradeHistoryTable>;

export const WithData: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[tradesKey, TRADES]])],
};

export const Empty: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[tradesKey, []]])],
};
