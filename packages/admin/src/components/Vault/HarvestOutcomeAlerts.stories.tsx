import type { HarvestDistributionResult } from "@green-goods/shared/hooks/yield/useHarvestDistribution";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { HarvestOutcomeAlerts } from "./HarvestOutcomeAlerts";

const DESTINATION = "0x4444444444444444444444444444444444444444" as Address;
const HASH = `0x${"a".repeat(64)}` as const;

const formatAmount = (amount: bigint) => `${Number(amount) / 10 ** 18} USDC`;

const AMOUNTS = {
  cookieJarAmount: 4n * 10n ** 18n,
  fractionsAmount: 4n * 10n ** 18n,
  treasuryAmount: 2n * 10n ** 18n,
  totalAmount: 10n * 10n ** 18n,
};

const meta: Meta<typeof HarvestOutcomeAlerts> = {
  title: "Admin/Workflows/Vault/HarvestOutcomeAlerts",
  component: HarvestOutcomeAlerts,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Terminal-outcome alerts for the harvest & distribute workflow. Terminal outcomes are dismissible; unresolved outcomes (Safe submissions, unverified splits) only clear through the Check status reconciliation action, and a failed shares registration deliberately offers no retry.",
      },
    },
  },
  args: {
    destinationAddress: DESTINATION,
    isRetryPending: false,
    formatAmount,
    onRetry: fn(),
    onDismiss: fn(),
    onReconcile: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HarvestOutcomeAlerts>;

const result = (value: HarvestDistributionResult): { result: HarvestDistributionResult } => ({
  result: value,
});

export const Distributed: Story = {
  args: result({ status: "distributed", hash: HASH, amounts: AMOUNTS }),
};

export const WaitingBelowThreshold: Story = {
  args: result({
    status: "waiting",
    availableAmount: 2n * 10n ** 18n,
    threshold: 7n * 10n ** 18n,
    harvested: true,
  }),
};

export const DistributionPending: Story = {
  args: result({ status: "distribution_pending", harvested: true, errorCategory: "blockchain" }),
};

export const HarvestSubmitted: Story = {
  args: result({ status: "harvest_submitted", hash: HASH }),
};

export const DistributionSubmitted: Story = {
  args: result({ status: "distribution_submitted", hash: HASH }),
};

export const SplitUnverified: Story = {
  args: result({ status: "split_unverified", hash: HASH, harvested: true }),
};

export const HarvestReportFailed: Story = {
  args: result({ status: "harvest_incomplete", hash: HASH, failure: "report_failed" }),
};

export const HarvestRegistrationFailed: Story = {
  args: result({ status: "harvest_incomplete", hash: HASH, failure: "registration_failed" }),
};

export const HarvestReverted: Story = {
  args: result({ status: "harvest_incomplete", hash: HASH, failure: "reverted" }),
};

export const HarvestUnverifiable: Story = {
  args: result({ status: "harvest_incomplete", hash: HASH, failure: "unverifiable" }),
};
