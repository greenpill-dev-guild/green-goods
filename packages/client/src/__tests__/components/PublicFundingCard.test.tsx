/**
 * PublicFundingCard interaction regressions.
 *
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type Dispatch, type SetStateAction } from "react";
import { IntlProvider } from "react-intl";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const TEST_DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const TEST_COOKIE_JAR = "0x2222222222222222222222222222222222222222" as Address;
const TEST_VAULT = "0x3333333333333333333333333333333333333333" as Address;
const TEST_OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

const {
  mockCookieJarMutate,
  mockCookieJarReset,
  mockVaultMutate,
  mockVaultReset,
  mockLoginWithWallet,
  authState,
} = vi.hoisted(() => ({
  mockCookieJarMutate: vi.fn(),
  mockCookieJarReset: vi.fn(),
  mockVaultMutate: vi.fn(),
  mockVaultReset: vi.fn(),
  mockLoginWithWallet: vi.fn(),
  authState: {
    primaryAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as string | null,
  },
}));

type MockMutationOptions = {
  onError?: (error: Error) => void;
};

function rejectMutation(
  message: string,
  setError: Dispatch<SetStateAction<Error | null>>,
  spy: ReturnType<typeof vi.fn>,
  params: unknown,
  options?: MockMutationOptions
) {
  const error = new Error(message);
  spy(params, options);
  setError(error);
  options?.onError?.(error);
}

vi.mock("@green-goods/shared", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    classifyTxError: (error: Error | null) => ({
      severity: "error",
      rawMessage: error?.message ?? "",
      messageKey: "public.fund.card.error.generic",
      titleKey: "public.fund.card.error.title",
    }),
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
    formatTokenAmount: (value: bigint) => String(Number(value) / 1e18),
    formatUsdCents: (value: bigint) => `$${(Number(value) / 100).toFixed(2)}`,
    formatUsdPrice: () => "$3,000.00",
    getVaultAssetSymbol: () => "DAI",
    isMeaningfulTxErrorMessage: (message?: string) => Boolean(message),
    parseUsdToCents: (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? BigInt(Math.round(parsed * 100)) : null;
    },
    truncateAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
    useAppKit: () => ({ open: vi.fn() }),
    useAuth: () => ({ loginWithWallet: mockLoginWithWallet }),
    useCookieJarDeposit: () => {
      const [error, setError] = React.useState<Error | null>(null);
      return {
        mutate: (params: unknown, options?: MockMutationOptions) =>
          rejectMutation(
            "Wallet rejected the donation",
            setError,
            mockCookieJarMutate,
            params,
            options
          ),
        reset: () => {
          mockCookieJarReset();
          setError(null);
        },
        error,
      };
    },
    useEthUsdPrice: () => ({
      hasFeed: true,
      isStale: false,
      priceAnswer: 300000000000n,
      updatedAt: 0,
    }),
    useGardenCookieJars: () => ({
      isLoading: false,
      jars: [
        {
          assetAddress: TEST_DAI,
          decimals: 18,
          jarAddress: TEST_COOKIE_JAR,
          minDeposit: 0n,
        },
      ],
    }),
    useGardenVaults: () => ({
      isLoading: false,
      vaults: [
        {
          asset: TEST_DAI,
          chainId: 42161,
          vaultAddress: TEST_VAULT,
        },
      ],
    }),
    useUser: () => ({ primaryAddress: authState.primaryAddress }),
    useVaultDeposit: () => {
      const [error, setError] = React.useState<Error | null>(null);
      return {
        mutate: (params: unknown, options?: MockMutationOptions) =>
          rejectMutation(
            "Wallet rejected the endowment",
            setError,
            mockVaultMutate,
            params,
            options
          ),
        reset: () => {
          mockVaultReset();
          setError(null);
        },
        error,
      };
    },
    usdCentsToWei: (cents: bigint) => cents * 10n ** 16n,
  };
});

import { PublicFundingCard } from "../../components/Public/PublicFundingCard";

const garden = {
  id: TEST_GARDEN,
  address: TEST_GARDEN,
  name: "Solar Community Garden",
  slug: "solar-community-garden",
  description: "A solar-powered community garden",
  location: "Austin, TX",
  bannerImage: "",
  contributorCount: 2,
  actionCount: 1,
  lastActivityAt: 1700000000,
  operators: [],
  evaluators: [],
};

function createCard(intent: "donate" | "endow") {
  return createElement(
    IntlProvider,
    { locale: "en", messages: {} },
    createElement(PublicFundingCard, {
      open: true,
      garden,
      intent,
      onClose: vi.fn(),
    })
  );
}

function renderCard(intent: "donate" | "endow") {
  return render(createCard(intent));
}

describe("PublicFundingCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.primaryAddress = TEST_OWNER;
  });

  it("connects via wallet auth (loginWithWallet), not the bare AppKit modal, when no wallet is connected (PRD-497)", async () => {
    authState.primaryAddress = null;
    const user = userEvent.setup();
    renderCard("endow");

    const connect = await screen.findByRole("button", { name: "Connect Wallet" });
    await user.click(connect);

    expect(mockLoginWithWallet).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["donate", "Donate $5.00 in DAI", "Wallet rejected the donation", mockCookieJarReset],
    ["endow", "Endow $5.00 in DAI", "Wallet rejected the endowment", mockVaultReset],
  ] as const)("keeps %s inline transaction errors visible until the amount or token changes", async (intent, buttonName, errorMessage, resetMutation) => {
    const user = userEvent.setup();
    renderCard(intent);

    await user.type(await screen.findByLabelText("Amount"), "5");
    await user.click(screen.getByRole("button", { name: buttonName }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Transaction failed");
    expect(alert).toHaveTextContent(errorMessage);
    expect(resetMutation).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Amount"), "1");

    await waitFor(() => {
      expect(resetMutation).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
