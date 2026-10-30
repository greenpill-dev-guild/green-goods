import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiBankLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { PositionCard as RealPositionCard } from "./PositionCard";

// ⚠ VISUAL HARNESS — not the real PositionCard.
// The real component wires `useUser`, `useVaultPreview`, `useYieldStatus`,
// `useHarvestDistribution`,
// `useEmergencyPause`, `useEnableAutoAllocate`, and wagmi
// `useReadContracts` reads for the shutdown / deposit-limit diagnostic.
// All of those are driven by wagmi's internal query cache, which we
// cannot seed without intercepting wagmi internals. This harness
// mirrors the visual structure with plain props, the shared item row and
// the page it opens beneath it, so the steward states (harvesting, paused,
// legacy misconfiguration, read-only) are all reviewable. Treat as a
// design-system surface, NOT as a real-component behavior test.

interface PositionCardHarnessProps {
  symbol: string;
  netDeposited: bigint;
  unharvestedYield: bigint;
  depositorCount: number;
  harvestCount: number;
  /** The position's page, open beneath its row. */
  pageOpen?: boolean;
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
  pageOpen = true,
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
  const { formatMessage } = useIntl();
  return (
    <div className="flex flex-col gap-2">
      <ItemRow
        lead={{ kind: "icon", icon: <RiBankLine /> }}
        title={symbol}
        status={
          vaultAcceptingDeposits ? undefined : { label: "Deposits disabled", tone: "warning" }
        }
        details={[`${depositorCount} depositors`]}
        amount={{
          value: `${formatTokenAmount(netDeposited, 18)} ${symbol}`,
          caption: "Net deposited",
        }}
        onOpen={fn()}
        aria-expanded={pageOpen}
      />

      {pageOpen ? (
        <div className="gg-card gg-item-row-page p-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 type-meta text-primary-dark hover:underline"
            onClick={() => {}}
          >
            View vault: 0xAaaa…aaa1
          </button>

          <dl className="mt-2 divide-y divide-stroke-soft type-body">
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="type-meta-sm text-text-soft">Unharvested impact yield</dt>
              <dd
                className={`font-semibold tabular-nums ${unharvestedYield > 0n ? "text-success-dark" : "text-text-strong"}`}
              >
                {formatTokenAmount(unharvestedYield, 18)} {symbol}
                {unharvestedYield > 0n && (
                  <span className="ml-1 type-meta font-normal">(accruing)</span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="type-meta-sm text-text-soft">Harvest count</dt>
              <dd className="font-semibold tabular-nums text-text-strong">{harvestCount}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              emphasis="primary"
              size="compact"
              onClick={fn()}
              disabled={!vaultAcceptingDeposits}
            >
              Deposit
            </Button>
            <Button type="button" emphasis="secondary" size="compact" onClick={fn()}>
              Withdraw
            </Button>
          </div>

          {isLegacyMisconfiguration && isModuleOwner && (
            <div className="mt-2">
              <Button
                type="button"
                emphasis="secondary"
                size="compact"
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
                    <Button type="button" emphasis="secondary" size="compact" onClick={fn()}>
                      Retry distribution
                    </Button>
                  }
                >
                  Harvest confirmed, but distribution is still pending. The harvested funds remain
                  in the Yield Resolver.
                </Alert>
              )}
              {distributionState === "complete" && (
                <Alert variant="success" className="p-3">
                  4 {symbol} reached the Cookie Jar. 4 {symbol} went to hypercert funding. 2{" "}
                  {symbol} went to the protocol treasury.
                </Alert>
              )}
              {/* Mirrors the shipping component: for a registered vault the action
                  stays available in empty/waiting states too (harvest-first), and
                  split-only appears only when registered yield is ready. */}
              {distributionState !== "pending" &&
                distributionState !== "complete" &&
                distributionState !== "submitted" && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      emphasis="secondary"
                      size="compact"
                      onClick={fn()}
                      disabled={isHarvesting}
                      loading={isHarvesting}
                    >
                      {formatMessage({
                        id:
                          unharvestedYield > 0n || distributionState !== "ready"
                            ? "app.yield.harvestDistribution.action.harvest"
                            : "app.yield.harvestDistribution.action.distribute",
                      })}
                    </Button>
                  </div>
                )}
              <div className="flex justify-end border-t border-stroke-soft pt-3">
                <Button
                  type="button"
                  emphasis="primary"
                  tone="danger"
                  size="compact"
                  onClick={fn()}
                  disabled={!canEmergencyPause || isPausing}
                  loading={isPausing}
                >
                  Emergency pause
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
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
          "⚠ **Visual harness** — not the real `PositionCard`. Renders the same per-asset item row (the asset, its depositors, its net deposits on the right, a pill only when deposits are off) and the page it opens beneath it (the vault link, yield, harvests, deposit/withdraw/harvest/pause controls) with plain props, the page open, so every steward state is reviewable. The real component reads from half a dozen wagmi + React Query hooks; those reactive paths are not exercised here.",
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

/** How the endowment lists its positions: rows, each opening its page, none open yet. */
export const ClosedList: Story = {
  render: (args) => (
    <div className="flex flex-col gap-(--gg-list-gap)">
      <PositionCardHarness {...args} pageOpen={false} />
      <PositionCardHarness
        {...args}
        symbol="DAI"
        netDeposited={250n * 10n ** 18n}
        depositorCount={3}
        vaultAcceptingDeposits={false}
        pageOpen={false}
      />
    </div>
  ),
};

/** Documentation uses the production component rather than the older visual harness. */
export const Documentation: Story = {
  decorators: [withAdminIdentity],
  beforeEach: () => {
    mocked(useVaultPreview).mockReturnValue({
      preview: { totalAssets: 254n * 10n ** 18n, maxDeposit: 1000n * 10n ** 18n },
    } as unknown as ReturnType<typeof useVaultPreview>);
    return resetHookMocks(useVaultPreview);
  },
  render: () => (
    <RealPositionCard
      gardenAddress="0x5eed000000000000000000000000000000000001"
      vault={{
        id: "documentation-vault",
        chainId: 42161,
        vaultAddress: "0x5eed0000000000000000000000000000000000d4",
        asset: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
        totalDeposited: 250n * 10n ** 18n,
        totalWithdrawn: 0n,
        depositorCount: 3,
        totalHarvestCount: 2,
        garden: "0x5eed000000000000000000000000000000000001",
        donationAddress: null,
        paused: false,
        createdAt: 1767225600,
      }}
      canManage={false}
      canEmergencyPause={false}
      isModuleOwner={false}
      onDeposit={fn()}
      onWithdraw={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    // The row carries no act; its page opens beneath it with Deposit and Withdraw.
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Deposit" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await expect(canvas.getByRole("button", { name: "Deposit" })).toBeVisible();
  },
};
