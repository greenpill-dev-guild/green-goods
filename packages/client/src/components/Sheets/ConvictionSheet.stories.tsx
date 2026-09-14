import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useAllocateHypercertSupport } from "@green-goods/shared/hooks/conviction/useAllocateHypercertSupport";
import { useConvictionStrategies } from "@green-goods/shared/hooks/conviction/useConvictionStrategies";
import { useGardenCommunity } from "@green-goods/shared/hooks/conviction/useGardenCommunity";
import { useHypercertConviction } from "@green-goods/shared/hooks/conviction/useHypercertConviction";
import { useMemberVotingPower } from "@green-goods/shared/hooks/conviction/useMemberVotingPower";
import { useYieldAllocations } from "@green-goods/shared/hooks/yield/useYieldAllocations";
import type { Address } from "@green-goods/shared/types/domain";
import { WeightScheme } from "@green-goods/shared/types/gardens-community";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, waitFor, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../shared/.storybook/fixtures";
import { ConvictionSheet } from "./ConvictionSheet";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";

const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const POOL = "0x5c2c7b1f4d0e3a9b8c7d6e5f4a3b2c1d0e9f8a7b" as Address;
const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const WEI = 10n ** 18n;

function withSignalPool({ eligible = true, weights = true, online = true } = {}) {
  return () => {
    mocked(useUser).mockReturnValue({ primaryAddress: ACCOUNT } as ReturnType<typeof useUser>);
    mocked(useOffline).mockReturnValue({ isOnline: online } as ReturnType<typeof useOffline>);
    mocked(useConvictionStrategies).mockReturnValue({ strategies: [POOL] } as unknown as ReturnType<
      typeof useConvictionStrategies
    >);
    mocked(useHypercertConviction).mockReturnValue({
      weights: weights
        ? [
            { hypercertId: 1204n, weight: 625n },
            { hypercertId: 1188n, weight: 375n },
          ]
        : [],
      isLoading: false,
      isError: false,
      refetch: fn(),
    } as unknown as ReturnType<typeof useHypercertConviction>);
    mocked(useMemberVotingPower).mockReturnValue({
      power: {
        totalStake: 250n * WEI,
        // Points share the 18-decimal scale the sheet formats them with.
        pointsBudget: 100n * WEI,
        isEligible: eligible,
        allocations: eligible ? [{ hypercertId: 1204n, amount: 40n * WEI }] : [],
      },
      isLoading: false,
      isError: false,
      refetch: fn(),
    } as unknown as ReturnType<typeof useMemberVotingPower>);
    mocked(useGardenCommunity).mockReturnValue({
      community: {
        gardenAddress: GARDEN,
        communityAddress: "0x7d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e" as Address,
        goodsTokenAddress: "0x8e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f" as Address,
        weightScheme: WeightScheme.Linear,
        stakeAmount: 50n * WEI,
      },
    } as unknown as ReturnType<typeof useGardenCommunity>);
    mocked(useYieldAllocations).mockReturnValue({
      allocations: [
        {
          gardenAddress: GARDEN,
          assetAddress: DAI,
          cookieJarAmount: 12n * WEI,
          fractionsAmount: 6n * WEI,
          juiceboxAmount: 2n * WEI,
          totalAmount: 20n * WEI,
          timestamp: STORYBOOK_NOW_SECONDS - 86_400 * 3,
          txHash: "0xabc",
        },
      ],
    } as unknown as ReturnType<typeof useYieldAllocations>);
    mocked(useAllocateHypercertSupport).mockReturnValue({
      mutate: fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAllocateHypercertSupport>);
    return resetHookMocks(
      useUser,
      useOffline,
      useConvictionStrategies,
      useHypercertConviction,
      useMemberVotingPower,
      useGardenCommunity,
      useYieldAllocations,
      useAllocateHypercertSupport
    );
  };
}

const sheet = async () => within(await screen.findByTestId("app-sheet"));

/**
 * The garden signal pool sheet: community status and weight scheme, the reader's voting power, and
 * each hypercert's conviction with a Support input for eligible voters. Governance is switched off
 * in the app, so this sheet is only reachable here; its pool, power, community, and yield reads are
 * mocked per story.
 */
const meta: Meta<typeof ConvictionSheet> = {
  title: "Client/Sheets/ConvictionSheet",
  component: ConvictionSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: GARDEN,
    gardenName: "Green Goods Community Garden",
  },
};

export default meta;
type Story = StoryObj<typeof ConvictionSheet>;

export const EligibleVoter: Story = {
  beforeEach: withSignalPool(),
  play: async () => {
    const signal = await sheet();
    await waitFor(() => expect(signal.getByText("Weight: 62.5%")).toBeVisible());
    await expect(signal.getAllByText("Eligible to vote").length).toBeGreaterThan(0);
    await expect(signal.getAllByRole("spinbutton", { name: "Points to allocate" })).toHaveLength(2);
  },
};

export const NotEligible: Story = {
  beforeEach: withSignalPool({ eligible: false }),
  play: async () => {
    const signal = await sheet();
    await waitFor(() => expect(signal.getAllByText("Weight: 62.5%")[0]).toBeVisible());
    await expect(
      signal.queryByRole("spinbutton", { name: "Points to allocate" })
    ).not.toBeInTheDocument();
  },
};

export const NoHypercerts: Story = {
  beforeEach: withSignalPool({ weights: false }),
  play: async () => {
    const signal = await sheet();
    await waitFor(() =>
      expect(signal.getAllByText("No hypercerts registered in this pool")[0]).toBeVisible()
    );
  },
};

export const Offline: Story = {
  beforeEach: withSignalPool({ online: false }),
  play: async () => {
    const signal = await sheet();
    await waitFor(() =>
      expect(
        signal.getByText("You are offline. Conviction voting requires an active connection.")
      ).toBeVisible()
    );
  },
};
