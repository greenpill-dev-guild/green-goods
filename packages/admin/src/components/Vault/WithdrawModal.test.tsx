/**
 * WithdrawModal Tests
 * @vitest-environment jsdom
 */

import { renderWithProviders as render, screen } from "../../__tests__/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as const;
const TEST_VAULT = "0x2222222222222222222222222222222222222222" as const;
const TEST_ASSET = "0x3333333333333333333333333333333333333333" as const;
const TEST_USER = "0x4444444444444444444444444444444444444444" as const;

const mockWithdrawMutate = vi.fn();
const mockUseReadContract = vi.fn();

const testVault = {
  id: "vault-usdc",
  chainId: 11155111,
  garden: TEST_GARDEN,
  asset: TEST_ASSET,
  vaultAddress: TEST_VAULT,
  totalDeposited: 1000000n,
  totalWithdrawn: 0n,
  totalHarvestCount: 0,
  donationAddress: null,
  depositorCount: 1,
  paused: false,
  createdAt: 1,
};

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    AssetSelector: ({ selectedAsset }: { selectedAsset: string }) => (
      <div data-testid="asset-selector">{selectedAsset}</div>
    ),
    getVaultAssetSymbol: () => "USDC",
    useDebouncedValue: <T,>(value: T) => value,
    useUser: () => ({ primaryAddress: TEST_USER }),
    useVaultDeposits: () => ({
      deposits: [
        {
          id: "deposit-1",
          chainId: 11155111,
          garden: TEST_GARDEN,
          asset: TEST_ASSET,
          vaultAddress: TEST_VAULT,
          depositor: TEST_USER,
          shares: 123456n,
          totalDeposited: 123456n,
          totalWithdrawn: 0n,
        },
      ],
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    }),
    useVaultPreview: ({ shares }: { shares?: bigint }) => ({
      preview: shares
        ? {
            previewAssets: 123456n,
            previewShares: 0n,
            maxDeposit: 0n,
            shareBalance: 123456n,
            totalAssets: 123456n,
          }
        : undefined,
    }),
    useVaultWithdraw: () => ({
      mutate: mockWithdrawMutate,
      isPending: false,
    }),
  };
});

import { WithdrawModal } from "./WithdrawModal";

describe("WithdrawModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContract.mockImplementation((args: { functionName: string }) => {
      if (args.functionName === "decimals") return { data: 6 };
      if (args.functionName === "previewWithdraw") return { data: 123456n };
      return { data: undefined };
    });
  });

  it("uses vault decimals and previewWithdraw when burning shares for a withdrawal", async () => {
    const user = userEvent.setup();

    render(
      <WithdrawModal
        isOpen
        onClose={vi.fn()}
        gardenAddress={TEST_GARDEN}
        vaults={[testVault]}
        defaultAsset={TEST_ASSET}
      />
    );

    await user.type(screen.getByRole("textbox", { name: /Amount/i }), "0.123456");

    expect(screen.getAllByText("0.123456 shares")).toHaveLength(2);

    const submitButton = screen.getAllByRole("button", { name: "Withdraw" }).at(-1);
    if (!submitButton) throw new Error("Missing withdraw submit button");

    await user.click(submitButton);

    expect(mockWithdrawMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        shares: 123456n,
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
