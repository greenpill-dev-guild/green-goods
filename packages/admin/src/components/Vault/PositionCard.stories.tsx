import { Alert } from "@green-goods/shared/components/Alert";
import { Card } from "@green-goods/shared/components/Cards/CardBase";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AdminButton } from "@/components/AdminButton";

// ⚠ VISUAL HARNESS — not the real PositionCard.
// The real component wires `useUser`, `useVaultPreview`, `useYieldStatus`,
// `useHarvestDistribution`,
// `useEmergencyPause`, `useEnableAutoAllocate`, and wagmi
// `useReadContracts` reads for the shutdown / deposit-limit diagnostic.
// All of those are driven by wagmi's internal query cache, which we
// cannot seed without intercepting wagmi internals. This harness
// mirrors the visual structure with plain props so the steward states
// (harvesting, paused, legacy misconfiguration, read-only) are all
// reviewable. Treat as a design-system surface, NOT as a
// real-component behavior test.

interface PositionCardHarnessProps {
  symbol: string;
  netDeposited: bigint;
  unharvestedYield: bigint;
  depositorCount: number;
  harvestCount: number;
  vaultAcceptingDeposits?: boolean;
  isLegacyMisconfiguration?: boolean;
  canManage?: boolean;
  canEmergencyPause?: boolean;
  isModuleOwner?: boolean;
  isHarvesting?: boolean;
  isPausing?: boolean;
  isEnablingAutoAllocate?: boolean;
  distributionState?: "empty" | "ready" | "waiting" | "submitted" | "pending" | "complete";
}

function PositionCardHarness({
  symbol,
  netDeposited,
  unharvestedYield,
  depositorCount,
  harvestCount,
  vaultAcceptingDeposits = true,
  isLegacyMisconfiguration = false,
  canManage = true,
  canEmergencyPause = true,
  isModuleOwner = false,
  isHarvesting = false,
  isPausing = false,
  isEnablingAutoAllocate = false,
  distributionState = "empty",
}: PositionCardHarnessProps) {
  return (
    <Card padding="compact" className="sm:p-5">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-strong sm:text-lg">{symbol}</h3>
          {!vaultAcceptingDeposits && (
            <span className="rounded-full bg-warning-lighter px-2 py-1 text-xs font-medium text-warning-dark">
              Deposits disabled
            </span>
          )}
        </div>
        <button
          type="button"
          className="mt-1 inline-block text-left text-xs text-primary-base hover:underline"
          onClick={() => {}}
        >
          View vault: 0xAaaa…aaa1
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">Net deposited</p>
          <p className="mt-1 font-semibold text-text-strong">
            {formatTokenAmount(netDeposited, 18)} {symbol}
          </p>
        </div>
        <div
          className={`rounded-md border p-3 ${unharvestedYield > 0n ? "border-success-light bg-success-lighter" : "border-stroke-soft bg-bg-weak"}`}
        >
          <p className="text-xs text-text-soft">Current yield</p>
          <p
            className={`mt-1 font-semibold ${unharvestedYield > 0n ? "text-success-dark" : "text-text-strong"}`}
          >
            {formatTokenAmount(unharvestedYield, 18)} {symbol}
            {unharvestedYield > 0n && <span className="ml-1 text-xs font-normal">accruing</span>}
          </p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">Depositors</p>
          <p className="mt-1 font-semibold text-text-strong">{depositorCount}</p>
        </div>
        <div className="rounded-md border border-stroke-soft bg-bg-weak p-3">
          <p className="text-xs text-text-soft">Harvests</p>
          <p className="mt-1 font-semibold text-text-strong">{harvestCount}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-sub">
        Depositor share value is expected to stay near flat by design. Harvested yield is routed
        to garden impact, not compounded into depositor returns.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <AdminButton variant="filled" size="sm" onClick={fn()} disabled={!vaultAcceptingDeposits}>
          Deposit
        </AdminButton>
        <AdminButton variant="outlined" size="sm" onClick={fn()}>
          Withdraw
        </AdminButton>
      </div>

      {isLegacyMisconfiguration && isModuleOwner && (
        <div className="mt-2">
          <AdminButton
            variant="outlined"
            size="sm"
            className="w-full border-warning-base bg-warning-lighter text-warning-dark hover:bg-warning-light"
            onClick={fn()}
            disabled={isEnablingAutoAllocate}
            loading={isEnablingAutoAllocate}
          >
            Enable auto-allocate
          </AdminButton>
        </div>
      )}

      {canManage && (
        <div className="mt-3 space-y-3">
          {distributionState === "waiting" && (
            <Alert variant="info" className="p-3">
              2 {symbol} is waiting until the 7 {symbol} minimum is reached.
            </Alert>
          )}
          {distributionState === "submitted" && (
            <Alert variant="info" className="p-3">
              Harvest was submitted for execution. Distribution will become available after the
              harvest is confirmed.
            </Alert>
          )}
          {distributionState === "pending" && (
            <Alert
              variant="warning"
              className="p-3"
              action={
                <AdminButton variant="outlined" size="sm" onClick={fn()}>
                  Retry distribution
                </AdminButton>
              }
            >
              Harvest confirmed, but distribution is still pending. The harvested funds remain in
              the Yield Resolver.
            </Alert>
          )}
          {distributionState === "complete" && (
            <Alert variant="success" className="p-3">
              4 {symbol} reached the Cookie Jar. 4 {symbol} went to hypercert funding. 2 {symbol}
              {" "}went to the protocol treasury.
            </Alert>
          )}
          {(unharvestedYield > 0n || distributionState === "ready") &&
            distributionState !== "pending" &&
            distributionState !== "complete" &&
            distributionState !== "submitted" && (
              <div className="flex justify-end">
                <AdminButton
                  variant="filled"
                  size="sm"
                  onClick={fn()}
                  disabled={isHarvesting}
                  loading={isHarvesting}
                >
                  {unharvestedYield > 0n ? "Harvest & distribute" : "Distribute yield"}
                </AdminButton>
              </div>
            )}
          <div className="flex justify-end border-t border-stroke-soft pt-3">
            <AdminButton
              variant="danger"
              size="sm"
              onClick={fn()}
              disabled={!canEmergencyPause || isPausing}
              loading={isPausing}
            >
              Emergency pause
            </AdminButton>
          </div>
        </div>
      )}
    </Card>
  );
}

const meta: Meta<typeof PositionCardHarness> = {
  title: "Admin/Workflows/Vault/PositionCard",
  component: PositionCardHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `PositionCard`. Renders the same per-asset card (net deposited, accruing yield, depositor/harvest counts, deposit/withdraw/harvest/pause controls) with plain props so every steward state is reviewable. The real component reads from half a dozen wagmi + React Query hooks; those reactive paths are not exercised here.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    symbol: "WETH",
    netDeposited: 12_000_000_000_000_000_000n,
    unharvestedYield: 850_000_000_000_000_000n,
    depositorCount: 8,
    harvestCount: 12,
    canManage: true,
    canEmergencyPause: true,
  },
};

export default meta;
type Story = StoryObj<typeof PositionCardHarness>;

export const Accruing: Story = {};

export const NoYield: Story = {
  args: { unharvestedYield: 0n },
};

export const DepositsDisabled: Story = {
  args: { vaultAcceptingDeposits: false },
};

export const LegacyMisconfiguration: Story = {
  args: {
    vaultAcceptingDeposits: false,
    isLegacyMisconfiguration: true,
    isModuleOwner: true,
  },
};

export const Harvesting: Story = {
  args: { isHarvesting: true },
};

export const ReadyToDistribute: Story = {
  args: { unharvestedYield: 0n, distributionState: "ready" },
};

export const WaitingForMinimum: Story = {
  args: { unharvestedYield: 0n, distributionState: "waiting" },
};

export const HarvestSubmitted: Story = {
  args: { unharvestedYield: 0n, distributionState: "submitted" },
};

export const DistributionPending: Story = {
  args: { unharvestedYield: 0n, distributionState: "pending" },
};

export const DistributionComplete: Story = {
  args: { unharvestedYield: 0n, distributionState: "complete" },
};

export const ReadOnly: Story = {
  args: { canManage: false },
};
