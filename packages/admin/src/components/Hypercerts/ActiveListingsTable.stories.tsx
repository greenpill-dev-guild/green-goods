import {
  type Address,
  DEFAULT_CHAIN_ID,
  queryKeys,
  type RegisteredOrderView,
} from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { daysAgo, daysFromNow } from "../../../../shared/.storybook/fixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { ActiveListingsTable } from "./ActiveListingsTable";

const GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;
const OPERATOR = "0x04D60647836bcA09c37B379550038BdaaFD82503" as Address;

const ACTIVE_LISTINGS: RegisteredOrderView[] = [
  {
    orderId: 1,
    hypercertId: 123_456_789n,
    seller: OPERATOR,
    currency: "0x0000000000000000000000000000000000000000" as Address,
    pricePerUnit: 10_000_000_000_000n,
    minUnitAmount: 1n,
    maxUnitAmount: 1_000_000n,
    // 30 days after the fixed Storybook clock (`installFrozenClock()`),
    // so `ActiveListingsTable.getListingStatus` evaluates this as active.
    endTime: daysFromNow(30),
    active: true,
  },
  {
    orderId: 2,
    hypercertId: 987_654_321n,
    seller: OPERATOR,
    currency: "0x0000000000000000000000000000000000000000" as Address,
    pricePerUnit: 5_000_000_000_000n,
    minUnitAmount: 1n,
    maxUnitAmount: 500_000n,
    endTime: daysAgo(1), // expired yesterday
    active: false,
  },
];

const listingsKey = queryKeys.marketplace.orders(GARDEN_ADDRESS, DEFAULT_CHAIN_ID);

const meta: Meta<typeof ActiveListingsTable> = {
  title: "Admin/Workflows/Hypercerts/ActiveListingsTable",
  component: ActiveListingsTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Real `ActiveListingsTable`. `useHypercertListings` returns the seeded React Query data; `useCancelListing` is wired but inert against the mock wagmi transport.",
      },
    },
  },
  args: {
    gardenAddress: GARDEN_ADDRESS,
    onCreateListing: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ActiveListingsTable>;

export const WithData: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[listingsKey, ACTIVE_LISTINGS]])],
};

export const Empty: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[listingsKey, []]])],
};

export const ActiveOnly: Story = {
  decorators: [
    withAdminIdentity,
    withSeededQueryClient([[listingsKey, ACTIVE_LISTINGS.slice(0, 1)]]),
  ],
};

export const ExpiredOnly: Story = {
  decorators: [withAdminIdentity, withSeededQueryClient([[listingsKey, ACTIVE_LISTINGS.slice(1)]])],
};
