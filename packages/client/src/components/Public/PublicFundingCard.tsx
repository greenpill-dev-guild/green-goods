import {
  type Address,
  classifyTxError,
  formatTokenAmount,
  formatUsdCents,
  formatUsdPrice,
  getVaultAssetSymbol,
  isMeaningfulTxErrorMessage,
  parseUsdToCents,
  type PublicGardenSummary,
  truncateAddress,
  useAppKit,
  useAuth,
  useCookieJarDeposit,
  useEthUsdPrice,
  useGardenCookieJars,
  useGardenVaults,
  useUser,
  useVaultDeposit,
  usdCentsToWei,
} from "@green-goods/shared";
import type { PublicFundingIntentKind } from "@green-goods/shared/public-contracts";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { EditorialGhostButton, EditorialKicker, EditorialPrimaryButton } from "./atoms";

const DAI_SYMBOL = "DAI";
const WETH_SYMBOL = "WETH";

interface PublicFundingCardProps {
  open: boolean;
  garden: PublicGardenSummary;
  intent: PublicFundingIntentKind;
  onClose: () => void;
}

interface FundingOption {
  /** Display symbol resolved from the token registry. */
  symbol: string;
  /** ERC-20 token address. */
  assetAddress: Address;
  /** Token decimals (18 for DAI/WETH). */
  decimals: number;
  /** Address of the destination contract (jar for donate, vault for endow). */
  destinationAddress: Address;
  /** Chain id (only meaningful for vaults). */
  chainId?: number;
  /** Donate-only: minimum deposit in token units. */
  minDeposit?: bigint;
}

type Status = "loading" | "idle" | "submitting" | "success" | "error";

/**
 * PublicFundingCard — single editorial-styled card that handles the entire
 * donate or endow flow for one garden. Replaces the old multi-step modal +
 * admin-styled deposit dialogs.
 *
 * Design intent:
 *   - Amount-first: $-prefixed input is the first focus.
 *   - Token choice as visual radio cards (not a dropdown), only when 2+ exist.
 *   - Wallet connect folds into the submit button — no separate screen.
 *   - WETH amounts are converted live via Chainlink ETH/USD on Arbitrum;
 *     stable assets (DAI) map 1:1 to USD with no oracle dependency.
 *   - Single card, three real states (loading | idle | success), error renders
 *     inline within idle.
 */
export function PublicFundingCard({ open, garden, intent, onClose }: PublicFundingCardProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  // Public funding connect must establish wallet auth (sets "wallet" intent so
  // the auth machine logs in), not just open the AppKit modal. Opening the modal
  // alone only tracks EXTERNAL_WALLET_CONNECTED, leaving primaryAddress null and
  // the CTA stuck on "Connect Wallet" (PRD-497).
  const { loginWithWallet } = useAuth();

  const isDonate = intent === "donate";

  const { jars, isLoading: isLoadingJars } = useGardenCookieJars(garden.id, {
    enabled: open && isDonate,
  });
  const { vaults, isLoading: isLoadingVaults } = useGardenVaults(garden.id as Address, {
    enabled: open && !isDonate,
  });

  const cookieJarMutation = useCookieJarDeposit(garden.id as Address, { errorMode: "inline" });
  const vaultMutation = useVaultDeposit({ errorMode: "inline" });
  const activeMutation = isDonate ? cookieJarMutation : vaultMutation;
  const activeMutationError = activeMutation.error;
  const resetActiveMutation = activeMutation.reset;
  const activeMutationErrorRef = useRef(activeMutationError);
  const resetActiveMutationRef = useRef(resetActiveMutation);

  // Normalize the two data shapes (CookieJar vs GardenVault) into a single
  // FundingOption[] so the rendering code doesn't branch on intent.
  const options: FundingOption[] = useMemo(() => {
    if (isDonate) {
      return jars.map<FundingOption>((jar) => ({
        symbol: getVaultAssetSymbol(jar.assetAddress),
        assetAddress: jar.assetAddress,
        decimals: jar.decimals,
        destinationAddress: jar.jarAddress,
        minDeposit: jar.minDeposit,
      }));
    }
    return vaults.map<FundingOption>((v) => ({
      symbol: getVaultAssetSymbol(v.asset, v.chainId),
      assetAddress: v.asset,
      decimals: 18,
      destinationAddress: v.vaultAddress,
      chainId: v.chainId,
    }));
  }, [isDonate, jars, vaults]);

  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [usdInput, setUsdInput] = useState("");
  const [status, setStatus] = useState<Status>("loading");

  const isLoadingOptions = isDonate ? isLoadingJars : isLoadingVaults;

  // Default selection: prefer DAI (stablecoin) over WETH so the $-presentation
  // works without needing the price oracle for the common case.
  useEffect(() => {
    if (!open) return;
    if (isLoadingOptions) {
      setStatus("loading");
      return;
    }
    setStatus("idle");
    if (!selectedAddress && options.length > 0) {
      const dai = options.find((o) => o.symbol === DAI_SYMBOL);
      setSelectedAddress((dai ?? options[0]).assetAddress);
    }
  }, [open, isLoadingOptions, options, selectedAddress]);

  // Reset card state on each open so a previously-submitted card doesn't
  // resurface in success state when reopened.
  useEffect(() => {
    if (open) return;
    setUsdInput("");
    setSelectedAddress("");
    activeMutation.reset();
  }, [open, activeMutation]);

  // Escape closes (mirrors PublicFundingMethodSelector behaviour).
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status !== "submitting") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, status, onClose]);

  const selected = useMemo(
    () => options.find((o) => o.assetAddress.toLowerCase() === selectedAddress.toLowerCase()),
    [options, selectedAddress]
  );

  const isWethSelected = selected?.symbol === WETH_SYMBOL;
  const ethUsd = useEthUsdPrice({
    enabled: open && isWethSelected,
    chainId: selected?.chainId,
  });

  // Convert USD input → token wei. DAI uses 1:1 mapping (cents * 10^16); WETH
  // requires the live oracle. Returns 0n when input is invalid or the oracle
  // is unavailable for WETH.
  const { tokenAmountWei, conversionUnavailable } = useMemo(() => {
    if (!selected) return { tokenAmountWei: 0n, conversionUnavailable: false };
    const cents = parseUsdToCents(usdInput);
    if (cents === null || cents <= 0n) {
      return { tokenAmountWei: 0n, conversionUnavailable: false };
    }
    if (isWethSelected) {
      if (!ethUsd.hasFeed || ethUsd.priceAnswer <= 0n) {
        return { tokenAmountWei: 0n, conversionUnavailable: true };
      }
      return {
        tokenAmountWei: usdCentsToWei(cents, ethUsd.priceAnswer, selected.decimals),
        conversionUnavailable: false,
      };
    }
    // Stable: $1 = 1 token. cents * 10^(decimals-2).
    return {
      tokenAmountWei: cents * 10n ** BigInt(selected.decimals - 2),
      conversionUnavailable: false,
    };
  }, [usdInput, selected, isWethSelected, ethUsd.hasFeed, ethUsd.priceAnswer]);

  const belowMin =
    isDonate && selected?.minDeposit && tokenAmountWei > 0n && tokenAmountWei < selected.minDeposit;

  useEffect(() => {
    activeMutationErrorRef.current = activeMutationError;
    resetActiveMutationRef.current = resetActiveMutation;
  }, [activeMutationError, resetActiveMutation]);

  // Clear an existing error only when the user changes the amount or token.
  // `activeMutation` is a wrapper object and can change identity between
  // renders; depending on it here clears fresh inline errors before users can
  // read why a transaction did not reach their wallet.
  useEffect(() => {
    if (activeMutationErrorRef.current) resetActiveMutationRef.current();
  }, [usdInput, selectedAddress]);

  const txErrorView = useMemo(() => classifyTxError(activeMutation.error), [activeMutation.error]);

  const handleSubmit = useCallback(() => {
    if (!primaryAddress) {
      loginWithWallet();
      return;
    }
    if (!selected || tokenAmountWei <= 0n || belowMin || conversionUnavailable) return;
    setStatus("submitting");
    if (isDonate) {
      cookieJarMutation.mutate(
        {
          jarAddress: selected.destinationAddress,
          amount: tokenAmountWei,
          assetAddress: selected.assetAddress,
        },
        {
          onSuccess: () => setStatus("success"),
          onError: () => setStatus("idle"),
        }
      );
      return;
    }
    vaultMutation.mutate(
      {
        gardenAddress: garden.id as Address,
        assetAddress: selected.assetAddress,
        vaultAddress: selected.destinationAddress,
        amount: tokenAmountWei,
        receiver: primaryAddress as Address,
      },
      {
        onSuccess: () => setStatus("success"),
        onError: () => setStatus("idle"),
      }
    );
  }, [
    primaryAddress,
    loginWithWallet,
    selected,
    tokenAmountWei,
    belowMin,
    conversionUnavailable,
    isDonate,
    cookieJarMutation,
    vaultMutation,
    garden.id,
  ]);

  const handleDonateAgain = useCallback(() => {
    setStatus("idle");
    setUsdInput("");
    activeMutation.reset();
  }, [activeMutation]);

  if (!open) return null;

  const kickerText = isDonate
    ? formatMessage({ id: "public.fund.dialog.donate.title", defaultMessage: "Donate" })
    : formatMessage({ id: "public.fund.dialog.endow.title", defaultMessage: "Endow" });
  const titleText = formatMessage(
    { id: "public.fund.card.title", defaultMessage: "{intent} to" },
    { intent: kickerText }
  );

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-static-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-funding-card-title"
    >
      <button
        type="button"
        aria-label={formatMessage({ id: "public.fund.dialog.close", defaultMessage: "Close" })}
        className="absolute inset-0"
        onClick={status === "submitting" ? undefined : onClose}
      />
      <div
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto bg-bg-white-0 p-6 shadow-[var(--shadow-editorial-panel)] sm:max-w-md sm:p-8"
        data-component="PublicFundingCard"
        data-status={status}
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <EditorialKicker>{`§ ${kickerText.toUpperCase()}`}</EditorialKicker>
            <h2
              id="public-funding-card-title"
              className="font-serif text-xl font-normal leading-[1.1] text-text-strong-950 md:text-2xl"
            >
              {titleText}
              <br />
              <span className="text-text-sub-600">{garden.name}</span>
            </h2>
          </div>
          <button
            type="button"
            aria-label={formatMessage({ id: "public.fund.dialog.close", defaultMessage: "Close" })}
            onClick={status === "submitting" ? undefined : onClose}
            disabled={status === "submitting"}
            className="rounded-full p-1 text-text-sub-600 transition-colors hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>

        {status === "loading" ? (
          <LoadingBody />
        ) : status === "success" ? (
          <SuccessBody
            usdInput={usdInput}
            gardenName={garden.name}
            onDonateAgain={handleDonateAgain}
            onClose={onClose}
            isDonate={isDonate}
          />
        ) : options.length === 0 ? (
          <UnavailableBody isDonate={isDonate} />
        ) : (
          <IdleBody
            isDonate={isDonate}
            usdInput={usdInput}
            onUsdChange={setUsdInput}
            options={options}
            selected={selected}
            selectedAddress={selectedAddress}
            onSelectAddress={setSelectedAddress}
            primaryAddress={primaryAddress}
            tokenAmountWei={tokenAmountWei}
            conversionUnavailable={conversionUnavailable}
            belowMin={Boolean(belowMin)}
            ethUsd={ethUsd}
            isSubmitting={status === "submitting"}
            txError={
              activeMutation.error
                ? {
                    severity: txErrorView.severity,
                    message: isMeaningfulTxErrorMessage(txErrorView.rawMessage)
                      ? txErrorView.rawMessage
                      : formatMessage({
                          id: txErrorView.messageKey,
                          defaultMessage: "Something went wrong. Please try again.",
                        }),
                    title: formatMessage({
                      id: txErrorView.titleKey,
                      defaultMessage:
                        txErrorView.severity === "warning"
                          ? "Transaction cancelled"
                          : "Transaction failed",
                    }),
                  }
                : null
            }
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body sub-components
// ─────────────────────────────────────────────────────────────────────────────

export function LoadingBody() {
  return (
    <div className="flex flex-col gap-4 py-6" aria-hidden="true">
      <div className="h-3 w-1/3 animate-pulse bg-stroke-soft-200/60" />
      <div className="h-12 w-full animate-pulse bg-editorial-warm" />
      <div className="h-3 w-1/2 animate-pulse bg-stroke-soft-200/40" />
      <div className="mt-2 h-12 w-full animate-pulse bg-stroke-soft-200/60" />
    </div>
  );
}

export function UnavailableBody({ isDonate }: { isDonate: boolean }) {
  const { formatMessage } = useIntl();
  return (
    <p className="py-6 text-sm leading-[1.6] text-text-sub-600">
      {isDonate
        ? formatMessage({
            id: "public.fund.card.unavailable.donate",
            defaultMessage: "This Garden hasn't enabled donations yet.",
          })
        : formatMessage({
            id: "public.fund.card.unavailable.endow",
            defaultMessage: "This Garden hasn't enabled endowments yet.",
          })}
    </p>
  );
}

export function SuccessBody({
  usdInput,
  gardenName,
  onDonateAgain,
  onClose,
  isDonate,
}: {
  usdInput: string;
  gardenName: string;
  onDonateAgain: () => void;
  onClose: () => void;
  isDonate: boolean;
}) {
  const { formatMessage } = useIntl();
  const cents = parseUsdToCents(usdInput) ?? 0n;
  const usdLabel = cents > 0n ? formatUsdCents(cents) : "";
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-action/15 text-primary-action">
        <RiCheckLine className="h-7 w-7" />
      </div>
      <p className="font-serif text-lg leading-[1.3] text-text-strong-950">
        {isDonate
          ? formatMessage(
              {
                id: "public.fund.card.successDonate",
                defaultMessage: "Donated {amount} to {garden}",
              },
              { amount: usdLabel, garden: gardenName }
            )
          : formatMessage(
              {
                id: "public.fund.card.successEndow",
                defaultMessage: "Endowed {amount} to {garden}",
              },
              { amount: usdLabel, garden: gardenName }
            )}
      </p>
      <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <EditorialPrimaryButton onClick={onDonateAgain} className="px-5 py-2.5 text-sm">
          {isDonate
            ? formatMessage({
                id: "public.fund.card.donateAgain",
                defaultMessage: "Donate again",
              })
            : formatMessage({
                id: "public.fund.card.endowAgain",
                defaultMessage: "Endow again",
              })}
        </EditorialPrimaryButton>
        <EditorialGhostButton onClick={onClose} className="px-5 py-2.5 text-sm">
          {formatMessage({ id: "public.fund.dialog.close", defaultMessage: "Close" })}
        </EditorialGhostButton>
      </div>
    </div>
  );
}

interface IdleBodyProps {
  isDonate: boolean;
  usdInput: string;
  onUsdChange: (next: string) => void;
  options: FundingOption[];
  selected: FundingOption | undefined;
  selectedAddress: string;
  onSelectAddress: (next: string) => void;
  primaryAddress: string | undefined;
  tokenAmountWei: bigint;
  conversionUnavailable: boolean;
  belowMin: boolean;
  ethUsd: ReturnType<typeof useEthUsdPrice>;
  isSubmitting: boolean;
  txError: { severity: string; title: string; message: string } | null;
  onSubmit: () => void;
}

function IdleBody(props: IdleBodyProps) {
  const {
    isDonate,
    usdInput,
    onUsdChange,
    options,
    selected,
    selectedAddress,
    onSelectAddress,
    primaryAddress,
    tokenAmountWei,
    conversionUnavailable,
    belowMin,
    ethUsd,
    isSubmitting,
    txError,
    onSubmit,
  } = props;
  const { formatMessage } = useIntl();
  const { open: openWalletModal } = useAppKit();
  const isWeth = selected?.symbol === WETH_SYMBOL;

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return formatMessage({
        id: "public.fund.card.submitting",
        defaultMessage: "Sending…",
      });
    }
    if (!primaryAddress) {
      return formatMessage({
        id: "public.fund.card.connectWallet",
        defaultMessage: "Connect Wallet",
      });
    }
    const cents = parseUsdToCents(usdInput);
    if (!cents || cents <= 0n) {
      return formatMessage({
        id: "public.fund.card.enterAmount",
        defaultMessage: "Enter an amount",
      });
    }
    if (conversionUnavailable) {
      return formatMessage({
        id: "public.fund.card.conversionUnavailable",
        defaultMessage: "ETH price unavailable",
      });
    }
    if (belowMin && selected?.minDeposit) {
      return formatMessage(
        {
          id: "public.fund.card.belowMin",
          defaultMessage: "Minimum {amount} {asset}",
        },
        {
          amount: formatTokenAmount(selected.minDeposit, selected.decimals),
          asset: selected.symbol,
        }
      );
    }
    return isDonate
      ? formatMessage(
          {
            id: "public.fund.card.donateCta",
            defaultMessage: "Donate {amount} in {asset}",
          },
          { amount: formatUsdCents(cents), asset: selected?.symbol ?? "" }
        )
      : formatMessage(
          {
            id: "public.fund.card.endowCta",
            defaultMessage: "Endow {amount} in {asset}",
          },
          { amount: formatUsdCents(cents), asset: selected?.symbol ?? "" }
        );
  }, [
    isSubmitting,
    primaryAddress,
    usdInput,
    conversionUnavailable,
    belowMin,
    selected,
    isDonate,
    formatMessage,
  ]);

  const submitDisabled =
    isSubmitting ||
    Boolean(primaryAddress && (tokenAmountWei <= 0n || belowMin || conversionUnavailable));

  return (
    <div className="flex flex-col gap-5">
      <AmountInput
        usdInput={usdInput}
        onChange={onUsdChange}
        disabled={isSubmitting}
        symbol={selected?.symbol ?? ""}
        wethSubtitle={
          isWeth && tokenAmountWei > 0n
            ? formatMessage(
                {
                  id: "public.fund.card.wethEstimate",
                  defaultMessage: "≈ {amount} WETH at {price}/ETH",
                },
                {
                  amount: formatTokenAmount(tokenAmountWei, selected?.decimals ?? 18, 6),
                  price: formatUsdPrice(ethUsd.priceAnswer),
                }
              )
            : undefined
        }
        wethStaleSubtitle={
          isWeth && ethUsd.isStale && ethUsd.updatedAt > 0
            ? formatMessage(
                {
                  id: "public.fund.card.wethStale",
                  defaultMessage: "Price last updated {minutes} minutes ago",
                },
                {
                  minutes: Math.round((Math.floor(Date.now() / 1000) - ethUsd.updatedAt) / 60),
                }
              )
            : undefined
        }
        wethUnavailable={isWeth && conversionUnavailable}
      />

      {options.length > 1 ? (
        <TokenPicker
          options={options}
          selectedAddress={selectedAddress}
          onSelect={onSelectAddress}
          disabled={isSubmitting}
        />
      ) : null}

      {txError ? <InlineErrorBlock title={txError.title} message={txError.message} /> : null}

      <EditorialPrimaryButton
        onClick={onSubmit}
        disabled={submitDisabled}
        className="w-full px-6 py-3 text-sm"
      >
        {submitLabel}
      </EditorialPrimaryButton>

      {primaryAddress ? (
        <p className="text-center text-[11px] text-text-soft-400">
          {formatMessage(
            {
              id: "public.fund.card.walletFooter",
              defaultMessage: "Wallet {address} · {disconnect}",
            },
            {
              address: truncateAddress(primaryAddress),
              disconnect: (
                <button
                  type="button"
                  onClick={() => openWalletModal()}
                  className="underline transition-colors hover:text-text-sub-600"
                >
                  {formatMessage({
                    id: "public.fund.card.disconnect",
                    defaultMessage: "Manage",
                  })}
                </button>
              ),
            }
          )}
        </p>
      ) : null}
    </div>
  );
}

interface AmountInputProps {
  usdInput: string;
  onChange: (next: string) => void;
  disabled: boolean;
  symbol: string;
  wethSubtitle?: string;
  wethStaleSubtitle?: string;
  wethUnavailable?: boolean;
}

export function AmountInput({
  usdInput,
  onChange,
  disabled,
  wethSubtitle,
  wethStaleSubtitle,
  wethUnavailable,
}: AmountInputProps) {
  const { formatMessage } = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Mount focus mirrors the amount-first intent. Avoid `autoFocus` attribute
    // (eslint-plugin-jsx-a11y/no-autofocus) by focusing imperatively here.
    inputRef.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="public-fund-amount"
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
      >
        {formatMessage({ id: "public.fund.card.amountLabel", defaultMessage: "Amount" })}
      </label>
      <div className="flex items-center gap-2 border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 transition-colors focus-within:border-primary-action">
        <span className="font-serif text-2xl text-text-soft-400">$</span>
        <input
          ref={inputRef}
          id="public-fund-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={usdInput}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className="flex-1 bg-transparent font-serif text-2xl text-text-strong-950 outline-none placeholder:text-text-soft-400 disabled:opacity-60"
        />
      </div>
      <div className="flex min-h-[1rem] flex-col gap-1">
        {wethSubtitle ? (
          <p className="text-xs text-text-sub-600" data-testid="weth-estimate">
            {wethSubtitle}
          </p>
        ) : null}
        {wethStaleSubtitle ? (
          <p className="text-xs text-text-soft-400 italic" data-testid="weth-stale">
            {wethStaleSubtitle}
          </p>
        ) : null}
        {wethUnavailable ? (
          <p className="text-xs text-text-soft-400 italic" data-testid="weth-unavailable">
            {formatMessage({
              id: "public.fund.card.wethUnavailable",
              defaultMessage:
                "ETH price feed unavailable on this network. Pick DAI or check back later.",
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface TokenPickerProps {
  options: FundingOption[];
  selectedAddress: string;
  onSelect: (next: string) => void;
  disabled: boolean;
}

export function TokenPicker({ options, selectedAddress, onSelect, disabled }: TokenPickerProps) {
  const { formatMessage } = useIntl();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({ id: "public.fund.card.payWithLabel", defaultMessage: "Pay with" })}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = option.assetAddress.toLowerCase() === selectedAddress.toLowerCase();
          const subtitle =
            option.symbol === DAI_SYMBOL
              ? formatMessage({
                  id: "public.fund.card.tokenSubtitle.dai",
                  defaultMessage: "Stablecoin",
                })
              : option.symbol === WETH_SYMBOL
                ? formatMessage({
                    id: "public.fund.card.tokenSubtitle.weth",
                    defaultMessage: "Wrapped Ether",
                  })
                : option.symbol;
          return (
            <button
              key={option.assetAddress}
              type="button"
              onClick={() => onSelect(option.assetAddress)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`flex flex-col items-start gap-0.5 border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-primary-action bg-editorial-warm"
                  : "border-stroke-soft-200 bg-bg-white-0 hover:bg-editorial-warm/40"
              }`}
            >
              <span className="font-serif text-base text-text-strong-950">{option.symbol}</span>
              <span className="text-[11px] text-text-soft-400">{subtitle}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function InlineErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="border border-editorial-deep/15 bg-editorial-warm px-4 py-3 text-sm text-text-strong-950"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-text-sub-600">{message}</p>
    </div>
  );
}
