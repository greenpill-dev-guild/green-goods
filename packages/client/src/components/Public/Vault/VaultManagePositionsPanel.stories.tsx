import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useWalletConnectDismissGuard } from "@green-goods/shared/hooks/auth/useWalletModalOpen";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import {
  type OctantVaultPosition,
  useOctantVaultPositions,
} from "@green-goods/shared/hooks/vault/useOctantVaultPositions";
import { useOctantVaultRedeem } from "@green-goods/shared/hooks/vault/useOctantVaultWithdraw";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { VaultManagePositionsPanel } from "./VaultManagePositionsPanel";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;
const ONE = 10n ** 18n;

const position: OctantVaultPosition = {
  campaignSlug: "greenpill-nyc",
  displayName: "Greenpill NYC",
  communityName: "Greenpill NYC",
  vaultAddress: VAULT,
  chainId: 1,
  assetAddress: WETH,
  assetSymbol: "WETH",
  assetDecimals: 18,
  shareDecimals: 18,
  shares: ONE,
  positionValue: (ONE * 12n) / 10n,
  redeemableShares: ONE,
  estimatedRedeemAssets: (ONE * 12n) / 10n,
  explorerLink: `https://etherscan.io/address/${VAULT}`,
};

function withWallet({ connected = true, positions = [position] as OctantVaultPosition[] } = {}) {
  return () => {
    mocked(WalletRuntimeProviders).mockImplementation(({ children }: { children: ReactNode }) => (
      <>{children}</>
    ));
    mocked(useUser).mockReturnValue({
      authMode: connected ? "wallet" : null,
      primaryAddress: connected ? OWNER : undefined,
    } as unknown as ReturnType<typeof useUser>);
    mocked(useWalletConnectDismissGuard).mockReturnValue({
      markConnecting: fn(),
      shouldBlockDismiss: () => false,
    } as unknown as ReturnType<typeof useWalletConnectDismissGuard>);
    mocked(useEnsName).mockReturnValue({ data: "vault-owner.eth" } as ReturnType<
      typeof useEnsName
    >);
    mocked(useOctantVaultPositions).mockReturnValue({
      positions,
      hasPositions: positions.length > 0,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: fn(async () => undefined),
    } as unknown as ReturnType<typeof useOctantVaultPositions>);
    mocked(useOctantVaultRedeem).mockReturnValue({
      mutateAsync: fn(async () => "0xhash"),
      mutate: fn(),
      reset: fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useOctantVaultRedeem>);
    return resetHookMocks(
      WalletRuntimeProviders,
      useUser,
      useWalletConnectDismissGuard,
      useEnsName,
      useOctantVaultPositions,
      useOctantVaultRedeem
    );
  };
}

const panel = async () => within(await screen.findByTestId("vault-manage-positions-panel"));

/**
 * Manage Endowments on the public vaults page: the connected wallet's campaign vault positions, each
 * with its value and a Redeem form capped at what is redeemable now. The wallet runtime, account,
 * position reads, and redeem mutation are mocked, so the panel opens without a wallet.
 */
const meta: Meta<typeof VaultManagePositionsPanel> = {
  title: "Client/Public/Vault/VaultManagePositionsPanel",
  component: VaultManagePositionsPanel,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: { open: true, onOpenChange: fn(), onEndow: fn() },
  // The mock wallet and dev auth provider supply the login the connect prompt calls.
  decorators: [withAdminIdentity],
};

export default meta;
type Story = StoryObj<typeof VaultManagePositionsPanel>;

export const Positions: Story = {
  beforeEach: withWallet(),
  play: async () => {
    const manage = await panel();
    await expect(manage.getByText("Connected wallet")).toBeVisible();
    await expect(manage.getByText("vault-owner.eth")).toBeVisible();
    await expect(manage.getByTestId("vault-manage-position-greenpill-nyc")).toBeVisible();
  },
};

export const RedeemForm: Story = {
  beforeEach: withWallet(),
  play: async () => {
    const row = within((await panel()).getByTestId("vault-manage-position-greenpill-nyc"));
    await userEvent.click(row.getByRole("button", { name: "Redeem" }));
    const amount = row.getByLabelText("Amount to redeem");
    await userEvent.type(amount, "2");
    await expect(row.getByText(/no higher than what is redeemable now/i)).toBeVisible();
    await expect(row.getByRole("button", { name: /^Redeem / })).toBeDisabled();
    await userEvent.clear(amount);
    await userEvent.type(amount, "0.5");
    await expect(row.getByRole("button", { name: /^Redeem .*0\.6 WETH/ })).toBeEnabled();
  },
};

export const NoEndowments: Story = {
  beforeEach: withWallet({ positions: [] }),
  play: async () => {
    const manage = await panel();
    await expect(manage.getByText("No endowments for this wallet yet")).toBeVisible();
    await expect(manage.getByRole("button", { name: "Endow a Campaign" })).toBeVisible();
  },
};

export const NotConnected: Story = {
  beforeEach: withWallet({ connected: false, positions: [] }),
  play: async () => {
    const manage = await panel();
    await expect(manage.getByText("Connect to see your endowments")).toBeVisible();
    await expect(manage.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  },
};
