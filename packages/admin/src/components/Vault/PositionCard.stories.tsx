import { type Address, Button, Card, formatTokenAmount } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

// ⚠ VISUAL HARNESS — not the real PositionCard.
// The real component wires `useUser`, `useVaultPreview`, `useHarvest`,
// `useEmergencyPause`, `useEnableAutoAllocate`, and wagmi
// `useReadContracts` reads for the shutdown / deposit-limit diagnostic.
// All of those are driven by wagmi's internal query cache, which we
// cannot seed without intercepting wagmi internals. This harness
// mirrors the visual structure with plain props so the operator states
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
        <a
          href="#"
          className="mt-1 inline-block text-xs text-primary-base hover:underline"
          onClick={(e) => e.preventDefault()}
        >
          View vault: 0xAaaa…aaa1
        </a>
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
        Accrued yield automatically compounds until harvested.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={fn()} disabled={!vaultAcceptingDeposits}>
          Deposit
        </Button>
        <Button variant="secondary" size="sm" onClick={fn()}>
          Withdraw
        </Button>
      </div>

      {isLegacyMisconfiguration && isModuleOwner && (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full border-warning-base bg-warning-lighter text-warning-dark hover:bg-warning-light"
            onClick={fn()}
            disabled={isEnablingAutoAllocate}
            loading={isEnablingAutoAllocate}
          >
            Enable auto-allocate
          </Button>
        </div>
      )}

      {canManage && (
        <div className="mt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={fn()} disabled={isHarvesting} loading={isHarvesting}>
              Harvest
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={fn()}
              disabled={!canEmergencyPause || isPausing}
              loading={isPausing}
            >
              Emergency pause
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const meta: Meta<typeof PositionCardHarness> = {
  title: "Admin/Workflows/Vault/PositionCard",
  component: PositionCardHarness,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `PositionCard`. Renders the same per-asset card (net deposited, accruing yield, depositor/harvest counts, deposit/withdraw/harvest/pause controls) with plain props so every operator state is reviewable. The real component reads from half a dozen wagmi + React Query hooks; those reactive paths are not exercised here.",
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

export const ReadOnly: Story = {
  args: { canManage: false },
};
