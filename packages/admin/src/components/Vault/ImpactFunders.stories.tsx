import { Button } from "@green-goods/shared/components/Button";
import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Address } from "@green-goods/shared/types/domain";
import type { FunderLeaderboardEntry } from "@green-goods/shared/types/vaults";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { mocked } from "storybook/test";
import { AdminCard } from "@/components/AdminCard";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
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
      <AdminCard className="sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 flex flex-col gap-(--gg-list-gap)">
          {[0, 1, 2].map((i) => (
            <ItemRowSkeleton key={i} lead="avatar" />
          ))}
        </div>
      </AdminCard>
    );
  }

  if (funders.length === 0) return null;

  const visibleFunders = expanded ? funders : funders.slice(0, DEFAULT_VISIBLE);
  const hasMore = funders.length > DEFAULT_VISIBLE;
  return (
    <AdminCard className="sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading type-title-md font-semibold text-text-strong">
            Impact funders
          </h2>
          <p className="type-body text-text-sub">
            Supporters contributing yield across the protocol.
          </p>
        </div>
        {totalProtocolYield > 0n && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2.5 py-1 type-meta font-semibold text-success-dark">
            {formatTokenAmount(totalProtocolYield)} generated
          </span>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-(--gg-list-gap)">
        {visibleFunders.map((f) => (
          <li key={f.address}>
            <FunderRow funder={f} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button
          type="button"
          emphasis="secondary"
          size="compact"
          className="mt-3 w-full"
          onClick={() => setExpanded((v) => !v)}
          leadingIcon={
            expanded ? (
              <RiArrowUpSLine className="h-4 w-4" aria-hidden="true" />
            ) : (
              <RiArrowDownSLine className="h-4 w-4" aria-hidden="true" />
            )
          }
        >
          {expanded ? "Collapse" : `View all ${funders.length}`}
        </Button>
      )}
      <p className="mt-3 type-meta text-text-sub">
        Contextual copy about how impact funding works, protocol-wide.
      </p>
    </AdminCard>
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
          "⚠ **Visual harness** — not the real `ImpactFunders`. Protocol-wide ranked supporter view with expand/collapse. Same constraint as GardenSupporters: the ranked supporter data chain terminates in wagmi reads, so this renders a visual-only fixture.",
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
  // Each row reads its funder's profile photo; these funders have none.
  beforeEach: () => {
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: null,
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(useResolvedProfileAvatar);
  },
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
