/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/react";
import { renderWithProviders as render, screen } from "../test-utils";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { GardenVault, VaultDeposit } from "@green-goods/shared/types/vaults";

const mocks = vi.hoisted(() => ({
  online: true,
  pending: false,
  maxWithdraw: 100000n,
  withdraw: vi.fn(),
  preview: vi.fn(),
}));
const garden = "0x1111111111111111111111111111111111111111" as const;
const account = "0x2222222222222222222222222222222222222222" as const;
const asset = "0x3333333333333333333333333333333333333333" as const;
const vaultAddress = "0x4444444444444444444444444444444444444444" as const;
const vault: GardenVault = {
  id: vaultAddress,
  chainId: 42161,
  garden,
  asset,
  vaultAddress,
  totalDeposited: 200000n,
  totalWithdrawn: 0n,
  totalHarvestCount: 0,
  donationAddress: null,
  depositorCount: 1,
  paused: false,
  createdAt: 1,
};
const deposit: VaultDeposit = {
  id: "deposit",
  chainId: 42161,
  garden,
  asset,
  vaultAddress,
  depositor: account,
  shares: 100000n,
  totalDeposited: 200000n,
  totalWithdrawn: 0n,
};
const jar: CookieJar = {
  jarAddress: vaultAddress,
  gardenAddress: garden,
  assetAddress: asset,
  balance: 50000n,
  currency: asset,
  decimals: 6,
  maxWithdrawal: 100000n,
  withdrawalInterval: 3600n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: false,
};

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.online,
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: account }),
}));
vi.mock("@green-goods/shared/hooks/utils/useDebouncedValue", () => ({
  useDebouncedValue: (value: bigint) => value,
}));
vi.mock("@green-goods/shared/hooks/vault/useVaultPreview", () => ({
  useVaultPreview: (input: unknown) => {
    mocks.preview(input);
    return { preview: { maxWithdraw: mocks.maxWithdraw } };
  },
}));
vi.mock("@green-goods/shared/hooks/vault/useVaultWithdraw", () => ({
  useVaultWithdraw: () => ({ mutate: mocks.withdraw, isPending: mocks.pending }),
}));
vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw", () => ({
  useCookieJarWithdraw: () => ({ mutate: mocks.withdraw, isPending: mocks.pending }),
}));
vi.mock("@green-goods/shared/utils/blockchain/vaults", async (importOriginal) => ({
  ...(await importOriginal()),
  getVaultAssetDecimals: () => 6,
  getVaultAssetSymbol: () => "USDC",
}));

import { MyDepositRow } from "../../components/Dialogs/TreasuryDrawer/MyDepositRow";
import { CookieJarCard } from "../../components/Dialogs/TreasuryDrawer/CookieJarCard";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.online = true;
  mocks.pending = false;
  mocks.maxWithdraw = 100000n;
});

describe("Treasury amount controls", () => {
  it("associates a vault precision error with the input and prevents a withdrawal", async () => {
    const user = userEvent.setup();
    render(<MyDepositRow deposit={deposit} vault={vault} gardenAddress={garden} />);
    const input = screen.getByRole("textbox", { name: /Amount to withdraw/i });
    await user.type(input, "0.1234567");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(screen.getByRole("button", { name: /^Withdraw$/i })).toBeDisabled();
    expect(mocks.preview).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 0n }));
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it("uses the vault preview limit and submits the parsed amount only after confirmation", async () => {
    const user = userEvent.setup();
    render(<MyDepositRow deposit={deposit} vault={vault} gardenAddress={garden} />);
    const input = screen.getByRole("textbox", { name: /Amount to withdraw/i });
    await user.type(input, "0.100001");
    expect(screen.getByRole("button", { name: /^Withdraw$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^max$/i }));
    expect(input).toHaveValue("0.1");
    await user.click(screen.getByRole("button", { name: /^Withdraw$/i }));
    expect(mocks.withdraw).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /Confirm Withdrawal/i })
    );
    expect(mocks.withdraw).toHaveBeenCalledWith(
      {
        gardenAddress: garden,
        assetAddress: asset,
        vaultAddress,
        amount: 100000n,
        owner: account,
        receiver: account,
      },
      expect.any(Object)
    );
  });

  it("keeps the jar balance, purpose, precision and confirmation requirements", async () => {
    const user = userEvent.setup();
    render(<CookieJarCard jar={jar} gardenAddress={garden} gardenName="Garden Alpha" />);
    await user.click(screen.getByRole("button", { name: /USDC/i }));
    const input = screen.getByRole("textbox", { name: /^How much$/i });
    const withdraw = screen.getByRole("button", { name: /^Claim$/i });
    await user.type(input, "0.1234567");
    expect(input).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(withdraw).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^max$/i }));
    expect(input).toHaveValue("0.05");
    expect(withdraw).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /^Purpose$/i }), "Garden tools");
    await user.clear(input);
    await user.type(input, "0.06");
    expect(withdraw).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^max$/i }));
    await user.click(withdraw);
    expect(mocks.withdraw).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Claim$/i })
    );
    expect(mocks.withdraw).toHaveBeenCalledWith(
      { jarAddress: vaultAddress, amount: 50000n, purpose: "Garden tools" },
      expect.any(Object)
    );
  });

  it("caps a jar at the per-withdrawal limit when its balance is larger", async () => {
    const user = userEvent.setup();
    render(
      <CookieJarCard
        jar={{ ...jar, balance: 200000n }}
        gardenAddress={garden}
        gardenName="Garden Alpha"
      />
    );
    await user.click(screen.getByRole("button", { name: /USDC/i }));
    await user.click(screen.getByRole("button", { name: /^max$/i }));
    expect(screen.getByRole("textbox", { name: /^How much$/i })).toHaveValue("0.1");
  });

  it.each(["offline", "pending"])("keeps vault withdrawal disabled when %s", async (state) => {
    mocks.online = state !== "offline";
    mocks.pending = state === "pending";
    const user = userEvent.setup();
    render(<MyDepositRow deposit={deposit} vault={vault} gardenAddress={garden} />);
    await user.click(screen.getByRole("button", { name: /^max$/i }));
    expect(screen.getByRole("button", { name: /^Withdraw$/i })).toBeDisabled();
  });

  it("keeps paused jars closed to withdrawals", async () => {
    const user = userEvent.setup();
    render(
      <CookieJarCard
        jar={{ ...jar, isPaused: true }}
        gardenAddress={garden}
        gardenName="Garden Alpha"
      />
    );
    await user.click(screen.getByRole("button", { name: /USDC/i }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });
});
