import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Address } from "@green-goods/shared/types/domain";
import type { FunderLeaderboardEntry } from "@green-goods/shared/types/vaults";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { Meta, StoryObj } from "@storybook/react";
import { mocked } from "storybook/test";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { AdminCard } from "@/components/AdminCard";
import { FunderRow } from "./FunderRow";

// ⚠ VISUAL HARNESS — not the real GardenSupporters.
// The real component calls `useFunderLeaderboard`, which chains
// `useVaultDeposits` (React Query, seedable) with
// `useBatchConvertToAssets` (wagmi `useReadContracts`, NOT seedable
// without intercepting wagmi internals). Seeding only the deposits
// yields zero-value rows, which isn't useful. This harness accepts a
// funder list directly so all states are reviewable. Treat as a
// design-system surface, NOT a real-component behavior test.

interface GardenSupportersHarnessProps {
  funders: FunderLeaderboardEntry[];
  totalProtocolYield: bigint;
  isLoading: boolean;
}

function GardenSupportersHarness({
  funders,
  totalProtocolYield,
  isLoading,
}: GardenSupportersHarnessProps) {
  if (isLoading) {
    return (
      <AdminCard className="sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 flex flex-col gap-(--gg-list-gap)">
          <ItemRowSkeleton lead="avatar" />
          <ItemRowSkeleton lead="avatar" />
        </div>
      </AdminCard>
    );
  }

  if (funders.length === 0) return null;

  return (
    <AdminCard className="sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading type-title-md font-semibold text-text-strong">
            Garden supporters
          </h2>
          <p className="type-body text-text-sub">Ordered by yield generated for this garden.</p>
        </div>
        {totalProtocolYield > 0n && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2.5 py-1 type-meta font-semibold text-success-dark">
            {formatTokenAmount(totalProtocolYield)} generated
          </span>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-(--gg-list-gap)">
        {funders.map((funder) => (
          <li key={funder.address}>
            <FunderRow funder={funder} />
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

function funder(addr: string, yieldGenerated: bigint, gardenCount = 2): FunderLeaderboardEntry {
  return {
    address: addr as Address,
    totalYieldGenerated: yieldGenerated,
    gardenCount,
  } as unknown as FunderLeaderboardEntry;
}

const MOCK_FUNDERS = [
  funder("0x1111111111111111111111111111111111111111", 10_000_000_000_000_000_000n, 3),
  funder("0x2222222222222222222222222222222222222222", 4_500_000_000_000_000_000n, 2),
  funder("0x3333333333333333333333333333333333333333", 1_200_000_000_000_000_000n, 1),
];

const meta: Meta<typeof GardenSupportersHarness> = {
  title: "Admin/Workflows/Vault/GardenSupporters",
  component: GardenSupportersHarness,
  tags: ["autodocs", "visual-harness"],
  parameters: {
    docs: {
      description: {
        component:
          "⚠ **Visual harness** — not the real `GardenSupporters`. Renders the same ranked supporter layout with plain props so every state is reviewable. The real component resolves yield per funder through a chain that terminates in wagmi `useReadContracts`, which isn't seedable in Storybook.",
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
type Story = StoryObj<typeof GardenSupportersHarness>;

export const WithSupporters: Story = {
  args: {
    funders: MOCK_FUNDERS,
    totalProtocolYield: 15_700_000_000_000_000_000n,
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

export const EmptyHidden: Story = {
  args: {
    funders: [],
    totalProtocolYield: 0n,
    isLoading: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Component returns null when there are no funders. Expect an empty render surface.",
      },
    },
  },
};
