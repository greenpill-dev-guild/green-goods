import { type Address, type FunderLeaderboardEntry, formatTokenAmount } from "@green-goods/shared";
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FunderRow } from "./FunderRow";

// ⚠ VISUAL HARNESS — not the real ImpactFunders.
// Same constraint as GardenSupporters: `useFunderLeaderboard` terminates
// in wagmi `useReadContracts`, which isn't seedable in Storybook. This
// harness accepts the funder list directly so every list/expand state
// is reviewable. Treat as a design-system surface, NOT a real-component
// behavior test.

const DEFAULT_VISIBLE = 3;

interface ImpactFundersHarnessProps {
  funders: FunderLeaderboardEntry[];
  totalProtocolYield: bigint;
  isLoading: boolean;
}

function ImpactFundersHarness({
  funders,
  totalProtocolYield,
  isLoading,
}: ImpactFundersHarnessProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (funders.length === 0) return null;

  const visibleFunders = expanded ? funders : funders.slice(0, DEFAULT_VISIBLE);
  const hasMore = funders.length > DEFAULT_VISIBLE;
  const maxYield = funders[0]?.totalYieldGenerated ?? 0n;

  return (
    <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text-strong">Impact funders</h2>
          <p className="text-sm text-text-sub">
            Supporters contributing yield across the protocol.
          </p>
        </div>
        {totalProtocolYield > 0n && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2.5 py-1 text-xs font-semibold text-success-dark">
            {formatTokenAmount(totalProtocolYield)} generated
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {visibleFunders.map((f) => (
          <FunderRow key={f.address} funder={f} maxYield={maxYield} />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-stroke-soft py-2 text-xs font-medium text-text-sub transition-colors hover:bg-bg-weak"
        >
          {expanded ? "Collapse" : `View all ${funders.length}`}
          {expanded ? (
            <RiArrowUpSLine className="h-3.5 w-3.5" />
          ) : (
            <RiArrowDownSLine className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      <p className="mt-3 text-xs text-text-sub">
        Contextual copy about how impact funding works, protocol-wide.
      </p>
    </section>
  );
}

function funder(addr: string, yieldGenerated: bigint, gardenCount: number): FunderLeaderboardEntry {
  return {
    address: addr as Address,
    totalYieldGenerated: yieldGenerated,
    gardenCount,
  } as unknown as FunderLeaderboardEntry;
}

const MANY_FUNDERS = [
  funder("0x1111111111111111111111111111111111111111", 20_000_000_000_000_000_000n, 5),
  funder("0x2222222222222222222222222222222222222222", 12_500_000_000_000_000_000n, 3),
  funder("0x3333333333333333333333333333333333333333", 8_200_000_000_000_000_000n, 4),
  funder("0x4444444444444444444444444444444444444444", 3_100_000_000_000_000_000n, 2),
  funder("0x5555555555555555555555555555555555555555", 1_400_000_000_000_000_000n, 1),
];

const meta: Meta<typeof ImpactFundersHarness> = {
  title: "Admin/Workflows/Vault/ImpactFunders",
  component: ImpactFundersHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `ImpactFunders`. Protocol-wide supporter leaderboard with expand/collapse. Same constraint as GardenSupporters: the leaderboard chain terminates in wagmi reads, so this renders a visual-only fixture.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ImpactFundersHarness>;

export const TopFunders: Story = {
  args: {
    funders: MANY_FUNDERS.slice(0, 3),
    totalProtocolYield: 40_700_000_000_000_000_000n,
    isLoading: false,
  },
};

export const WithExpandControl: Story = {
  args: {
    funders: MANY_FUNDERS,
    totalProtocolYield: 45_200_000_000_000_000_000n,
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    funders: [],
    totalProtocolYield: 0n,
    isLoading: true,
  },
};
