import { useAppKit } from "@green-goods/shared/providers/AppKitProvider";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, mocked, screen, userEvent } from "storybook/test";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useEthUsdPrice } from "@green-goods/shared/hooks/blockchain/useEthUsdPrice";
import { useCookieJarDeposit } from "@green-goods/shared/hooks/cookie-jar/useCookieJarDeposit";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposit } from "@green-goods/shared/hooks/vault/useVaultDeposit";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import { useVaultWithdraw } from "@green-goods/shared/hooks/vault/useVaultWithdraw";
import { usePublicEndowmentPositions } from "@green-goods/shared/hooks/public/usePublicEndowmentPositions";
import type { PublicEndowmentPosition } from "@green-goods/shared/hooks/public/usePublicEndowmentPositions";
import type { PublicGardenSummary } from "@green-goods/shared/hooks/public/usePublicGardens";
import type { Address } from "@green-goods/shared/types/domain";
import {
  JOURNEY_GARDEN,
  JOURNEY_VIEWER,
} from "../../../../shared/.storybook/clientJourneyFixtures";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { PublicFundingCard } from "./PublicFundingCard";
import { PublicEndowmentPanel } from "./PublicEndowmentPanel";

const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as Address;
const DESTINATION = "0x5eed0000000000000000000000000000000000d4" as Address;
const GARDEN = {
  id: JOURNEY_GARDEN,
  name: "Riverside Commons Garden",
  location: "Riverside District",
} as PublicGardenSummary;
const POSITION: PublicEndowmentPosition = {
  id: "documentation-position",
  chainId: 42161,
  gardenAddress: JOURNEY_GARDEN,
  gardenName: GARDEN.name,
  gardenLocation: "Riverside District",
  vaultAddress: DESTINATION,
  asset: DAI,
  assetSymbol: "DAI",
  decimals: 18,
  shares: 250n * 10n ** 18n,
  totalEndowed: 250n * 10n ** 18n,
  netEndowed: 250n * 10n ** 18n,
  hasGardenMetadata: true,
  hasVaultMetadata: true,
};

/** Every write is a local stub. This is interface evidence, never a transaction. */
function documentationFunding() {
  mocked(useAppKit).mockReturnValue({ open: fn(), close: fn() });
  mocked(useUser).mockReturnValue({ primaryAddress: JOURNEY_VIEWER } as ReturnType<typeof useUser>);
  mocked(useEthUsdPrice).mockReturnValue({
    price: 2500n * 10n ** 8n,
    decimals: 8,
    isLoading: false,
    isStale: false,
  } as unknown as ReturnType<typeof useEthUsdPrice>);
  mocked(useGardenCookieJars).mockReturnValue({
    jars: [DAI, WETH].map((assetAddress) => ({
      assetAddress,
      jarAddress: DESTINATION,
      decimals: 18,
    })),
    isLoading: false,
    hasNoJar: false,
    refetch: fn(),
  } as unknown as ReturnType<typeof useGardenCookieJars>);
  mocked(useGardenVaults).mockReturnValue({
    vaults: [DAI, WETH].map((asset) => ({ asset, vaultAddress: DESTINATION, chainId: 42161 })),
    isLoading: false,
    refetch: fn(),
  } as unknown as ReturnType<typeof useGardenVaults>);
  const mutation = {
    mutate: fn((_input: unknown, callbacks?: { onSuccess?: () => void }) =>
      callbacks?.onSuccess?.()
    ),
    reset: fn(),
    isPending: false,
    error: null,
  };
  mocked(useCookieJarDeposit).mockReturnValue(
    mutation as unknown as ReturnType<typeof useCookieJarDeposit>
  );
  mocked(useVaultDeposit).mockReturnValue(
    mutation as unknown as ReturnType<typeof useVaultDeposit>
  );
  mocked(useVaultWithdraw).mockReturnValue({ ...mutation, mutate: fn() } as unknown as ReturnType<
    typeof useVaultWithdraw
  >);
  mocked(usePublicEndowmentPositions).mockReturnValue({
    hasPositions: true,
    positions: [POSITION],
    gardenGroups: [
      {
        gardenAddress: JOURNEY_GARDEN,
        gardenName: GARDEN.name,
        gardenLocation: "Riverside District",
        hasGardenMetadata: true,
        positions: [POSITION],
      },
    ],
    assetTotals: [
      {
        chainId: 42161,
        asset: DAI,
        assetSymbol: "DAI",
        decimals: 18,
        totalEndowed: POSITION.totalEndowed,
        netEndowed: POSITION.netEndowed,
        positionCount: 1,
      },
    ],
    gardenCount: 1,
    isLoading: false,
    isError: false,
    refetch: fn(),
  } as unknown as ReturnType<typeof usePublicEndowmentPositions>);
  mocked(useVaultPreview).mockReturnValue({
    preview: {
      maxWithdraw: 249n * 10n ** 18n,
      shareBalance: POSITION.shares,
      previewWithdrawShares: 50n * 10n ** 18n,
    },
    isLoading: false,
    isFetching: false,
    refetch: fn(),
  } as unknown as ReturnType<typeof useVaultPreview>);
  return resetHookMocks(
    useAppKit,
    useUser,
    useEthUsdPrice,
    useGardenCookieJars,
    useGardenVaults,
    useCookieJarDeposit,
    useVaultDeposit,
    useVaultWithdraw,
    usePublicEndowmentPositions,
    useVaultPreview
  );
}

const meta: Meta<typeof PublicFundingCard> = {
  title: "Public/Documentation/Funding",
  component: PublicFundingCard,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  beforeEach: documentationFunding,
  decorators: [withAdminIdentity],
  args: { open: true, garden: GARDEN, intent: "donate", onClose: fn() },
};
export default meta;
type Story = StoryObj<typeof PublicFundingCard>;
const enterAmount = async () => {
  await userEvent.type(await screen.findByRole("textbox"), "50.00");
};
export const Donate: Story = { play: enterAmount };
export const Endow: Story = { args: { intent: "endow" }, play: enterAmount };
export const Donated: Story = {
  play: async () => {
    await enterAmount();
    await userEvent.click(await screen.findByRole("button", { name: /Donate \$50/ }));
  },
};
export const Endowed: Story = {
  args: { intent: "endow" },
  play: async () => {
    await enterAmount();
    await userEvent.click(await screen.findByRole("button", { name: /Endow \$50/ }));
  },
};
export const Positions: Story = { render: () => <PublicEndowmentPanel open onOpenChange={fn()} /> };
export const Withdrawal: Story = {
  render: () => <PublicEndowmentPanel open onOpenChange={fn()} />,
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    await userEvent.type(await screen.findByRole("textbox"), "50");
  },
};
