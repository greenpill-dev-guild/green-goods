import {
  type Address,
  classifyTxError,
  formatTokenAmount,
  formatUsdCents,
  formatUsdPrice,
  getVaultAssetSymbol,
  isMeaningfulTxErrorMessage,
  normalizeDecimalInput,
  parseUsdToCents,
  type PublicGardenSummary,
  TransactionSuccessAffordance,
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
  weiToUsdCents,
} from "@green-goods/shared";
import type { PublicFundingIntentKind } from "@green-goods/shared/public-contracts";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { EditorialGhostButton, EditorialKicker, EditorialPrimaryButton } from "./atoms";

const DAI_SYMBOL = "DAI";
const WETH_SYMBOL = "WETH";

type Denomination = "usd" | "weth";

/**
 * Parse a user-typed token amount (WETH denomination) into wei. Mirrors the
 * tolerant input handling used across the public vault panels: normalize a bare
 * leading dot, tolerate an in-progress trailing dot ("1." while typing "1.5")
 * so the CTA/estimate don't flicker back to the empty state between keystrokes,
 * and fall back to 0n on anything viem cannot parse so the CTA stays in its
 * "enter an amount" state instead of throwing.
 */
function parseTokenInputToWei(input: string, decimals: number): bigint {
  const normalized = normalizeDecimalInput(input);
  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return 0n;
  const canonical = normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
  try {
    return canonical ? parseUnits(canonical, decimals) : 0n;
  } catch {
    return 0n;
  }
}

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
 *   - Amount-first: the prefixed amount input is the first focus.
 *   - Token choice as visual radio cards (not a dropdown), only when 2+ exist.
 *   - Wallet connect folds into the submit button — no separate screen.
 *   - WETH supporters may enter the amount in USD (converted live via Chainlink
 *     ETH/USD) or directly in WETH via the denomination toggle (PRD-519),
 *     defaulting to USD for accessibility; stable assets (DAI) map 1:1 to USD
 *     with no oracle dependency and never show the toggle.
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
  const { loginWithWallet, isAuthenticating } = useAuth();

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
  // Separate per-unit entry buffers so toggling denomination preserves whatever
  // the supporter typed in each unit (no lossy round-trip conversion). Only one
  // is "active" at a time, decided by `denomination`.
  const [usdInput, setUsdInput] = useState("");
  const [wethInput, setWethInput] = useState("");
  const [denominationMode, setDenominationMode] = useState<Denomination>("usd");
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
    setWethInput("");
    setDenominationMode("usd");
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
  // The toggle only applies to WETH; for stable assets the effective entry unit
  // is always USD regardless of any lingering mode from a prior WETH selection.
  const denomination: Denomination = isWethSelected ? denominationMode : "usd";
  const ethUsd = useEthUsdPrice({
    enabled: open && isWethSelected,
    chainId: selected?.chainId,
  });

  // Selecting a non-WETH asset returns entry to the USD default, so coming back
  // to WETH always starts in the accessible USD mode rather than a stale unit.
  useEffect(() => {
    if (!isWethSelected) setDenominationMode("usd");
  }, [isWethSelected]);

  // Resolve the deposit amount in token wei + its USD-cents equivalent for both
  // entry modes. USD entry converts dollars → wei (WETH needs the live oracle;
  // stable assets map 1:1). WETH entry takes the typed token amount directly, so
  // it still works when the price feed is stale — the oracle is then only needed
  // for the informational USD estimate. `conversionUnavailable` is the
  // USD-entry-into-WETH-without-a-feed dead end; it never blocks WETH entry.
  const { tokenAmountWei, usdCents, conversionUnavailable } = useMemo(() => {
    if (!selected) return { tokenAmountWei: 0n, usdCents: 0n, conversionUnavailable: false };
    if (denomination === "weth") {
      const wei = parseTokenInputToWei(wethInput, selected.decimals);
      const cents =
        ethUsd.hasFeed && ethUsd.priceAnswer > 0n
          ? weiToUsdCents(wei, ethUsd.priceAnswer, selected.decimals)
          : 0n;
      return { tokenAmountWei: wei, usdCents: cents, conversionUnavailable: false };
    }
    const cents = parseUsdToCents(usdInput);
    if (cents === null || cents <= 0n) {
      return { tokenAmountWei: 0n, usdCents: 0n, conversionUnavailable: false };
    }
    if (isWethSelected) {
      if (!ethUsd.hasFeed || ethUsd.priceAnswer <= 0n) {
        return { tokenAmountWei: 0n, usdCents: cents, conversionUnavailable: true };
      }
      return {
        tokenAmountWei: usdCentsToWei(cents, ethUsd.priceAnswer, selected.decimals),
        usdCents: cents,
        conversionUnavailable: false,
      };
    }
    // Stable: $1 = 1 token. cents * 10^(decimals-2).
    return {
      tokenAmountWei: cents * 10n ** BigInt(selected.decimals - 2),
      usdCents: cents,
      conversionUnavailable: false,
    };
  }, [
    denomination,
    usdInput,
    wethInput,
    selected,
    isWethSelected,
    ethUsd.hasFeed,
    ethUsd.priceAnswer,
  ]);

  const belowMin =
    isDonate && selected?.minDeposit && tokenAmountWei > 0n && tokenAmountWei < selected.minDeposit;

  // Active entry buffer + its setter, chosen by the effective denomination.
  const amountInput = denomination === "weth" ? wethInput : usdInput;
  const handleAmountChange = useCallback(
    (next: string) => {
      if (denomination === "weth") setWethInput(next);
      else setUsdInput(next);
    },
    [denomination]
  );

  useEffect(() => {
    activeMutationErrorRef.current = activeMutationError;
    resetActiveMutationRef.current = resetActiveMutation;
  }, [activeMutationError, resetActiveMutation]);

  // Clear an existing error only when the user changes the amount, unit, or
  // token. `activeMutation` is a wrapper object and can change identity between
  // renders; depending on it here clears fresh inline errors before users can
  // read why a transaction did not reach their wallet.
  useEffect(() => {
    if (activeMutationErrorRef.current) resetActiveMutationRef.current();
  }, [usdInput, wethInput, denomination, selectedAddress]);

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
    setWethInput("");
    setDenominationMode("usd");
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
  const pathText = isDonate
    ? formatMessage({
        id: "public.fund.card.donatePath",
        defaultMessage: "Shared fund support",
      })
    : formatMessage({
        id: "public.fund.card.endowPath",
        defaultMessage: "Garden Vault endowment",
      });

  // Success summary mirrors the unit the supporter funded in: a dollar figure in
  // USD mode, the token amount in WETH mode.
  const successAmountLabel =
    denomination === "weth"
      ? `${formatTokenAmount(tokenAmountWei, selected?.decimals ?? 18, 6)} ${selected?.symbol ?? ""}`.trim()
      : usdCents > 0n
        ? formatUsdCents(usdCents)
        : "";

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
            <p className="text-xs leading-[1.45] text-text-soft-400">{pathText}</p>
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
          <TransactionSuccessAffordance mode="screen" show>
            <SuccessBody
              amountLabel={successAmountLabel}
              gardenName={garden.name}
              onDonateAgain={handleDonateAgain}
              onClose={onClose}
              isDonate={isDonate}
            />
          </TransactionSuccessAffordance>
        ) : options.length === 0 ? (
          <UnavailableBody isDonate={isDonate} />
        ) : (
          <IdleBody
            isDonate={isDonate}
            denomination={denomination}
            onDenominationChange={setDenominationMode}
            showDenominationToggle={isWethSelected}
            amountInput={amountInput}
            onAmountChange={handleAmountChange}
            options={options}
            selected={selected}
            selectedAddress={selectedAddress}
            onSelectAddress={setSelectedAddress}
            primaryAddress={primaryAddress}
            tokenAmountWei={tokenAmountWei}
            usdCents={usdCents}
            conversionUnavailable={conversionUnavailable}
            belowMin={Boolean(belowMin)}
            ethUsd={ethUsd}
            isSubmitting={status === "submitting"}
            isConnecting={isAuthenticating}
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
  amountLabel,
  gardenName,
  onDonateAgain,
  onClose,
  isDonate,
}: {
  amountLabel: string;
  gardenName: string;
  onDonateAgain: () => void;
  onClose: () => void;
  isDonate: boolean;
}) {
  const { formatMessage } = useIntl();
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
              { amount: amountLabel, garden: gardenName }
            )
          : formatMessage(
              {
                id: "public.fund.card.successEndow",
                defaultMessage: "Endowed {amount} to {garden}",
              },
              { amount: amountLabel, garden: gardenName }
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
  denomination: Denomination;
  onDenominationChange: (next: Denomination) => void;
  showDenominationToggle: boolean;
  amountInput: string;
  onAmountChange: (next: string) => void;
  options: FundingOption[];
  selected: FundingOption | undefined;
  selectedAddress: string;
  onSelectAddress: (next: string) => void;
  primaryAddress: string | undefined;
  tokenAmountWei: bigint;
  usdCents: bigint;
  conversionUnavailable: boolean;
  belowMin: boolean;
  ethUsd: ReturnType<typeof useEthUsdPrice>;
  isSubmitting: boolean;
  /** Wallet login in flight — the submit shows a consistent connect-loading state. */
  isConnecting: boolean;
  txError: { severity: string; title: string; message: string } | null;
  onSubmit: () => void;
}

function IdleBody(props: IdleBodyProps) {
  const {
    isDonate,
    denomination,
    onDenominationChange,
    showDenominationToggle,
    amountInput,
    onAmountChange,
    options,
    selected,
    selectedAddress,
    onSelectAddress,
    primaryAddress,
    tokenAmountWei,
    usdCents,
    conversionUnavailable,
    belowMin,
    ethUsd,
    isSubmitting,
    isConnecting,
    txError,
    onSubmit,
  } = props;
  const { formatMessage } = useIntl();
  const { open: openWalletModal } = useAppKit();
  const isWeth = selected?.symbol === WETH_SYMBOL;
  const isWethDenomination = denomination === "weth";

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return formatMessage({
        id: "public.fund.card.submitting",
        defaultMessage: "Sending…",
      });
    }
    if (!primaryAddress) {
      return isConnecting
        ? formatMessage({
            id: "public.fund.card.connecting",
            defaultMessage: "Opening your wallet…",
          })
        : formatMessage({
            id: "public.fund.card.connectWallet",
            defaultMessage: "Connect Wallet",
          });
    }
    // "Entered an amount" is unit-specific: WETH entry trusts the parsed wei
    // (oracle-independent), USD entry trusts the parsed cents.
    const hasAmount = isWethDenomination ? tokenAmountWei > 0n : usdCents > 0n;
    if (!hasAmount) {
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
    const amountLabel = isWethDenomination
      ? formatTokenAmount(tokenAmountWei, selected?.decimals ?? 18, 6)
      : formatUsdCents(usdCents);
    return isDonate
      ? formatMessage(
          {
            id: "public.fund.card.donateCta",
            defaultMessage: "Donate {amount} in {asset}",
          },
          { amount: amountLabel, asset: selected?.symbol ?? "" }
        )
      : formatMessage(
          {
            id: "public.fund.card.endowCta",
            defaultMessage: "Endow {amount} in {asset}",
          },
          { amount: amountLabel, asset: selected?.symbol ?? "" }
        );
  }, [
    isSubmitting,
    isConnecting,
    primaryAddress,
    isWethDenomination,
    tokenAmountWei,
    usdCents,
    conversionUnavailable,
    belowMin,
    selected,
    isDonate,
    formatMessage,
  ]);

  const submitDisabled =
    isSubmitting ||
    (!primaryAddress && isConnecting) ||
    Boolean(primaryAddress && (tokenAmountWei <= 0n || belowMin || conversionUnavailable));

  return (
    <div className="flex flex-col gap-5">
      <AmountInput
        amountInput={amountInput}
        onChange={onAmountChange}
        disabled={isSubmitting}
        denomination={denomination}
        symbol={selected?.symbol ?? ""}
        showDenominationToggle={showDenominationToggle}
        onDenominationChange={onDenominationChange}
        usdSubtitle={
          isWethDenomination && tokenAmountWei > 0n && ethUsd.hasFeed && ethUsd.priceAnswer > 0n
            ? formatMessage(
                {
                  id: "public.fund.card.usdEstimate",
                  defaultMessage: "≈ {amount} at {price}/ETH",
                },
                {
                  amount: formatUsdCents(usdCents),
                  price: formatUsdPrice(ethUsd.priceAnswer),
                }
              )
            : undefined
        }
        wethSubtitle={
          !isWethDenomination && isWeth && tokenAmountWei > 0n
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
        wethUnavailable={!isWethDenomination && isWeth && conversionUnavailable}
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

interface DenominationToggleProps {
  denomination: Denomination;
  /** Token symbol shown as the non-USD option label (e.g. "WETH"). */
  tokenSymbol: string;
  onChange: (next: Denomination) => void;
  disabled: boolean;
}

/**
 * Compact USD ⇄ token denomination switch for the amount field. Shown only when
 * the selected asset is WETH, where the dollar value and the token amount
 * diverge (PRD-519). Mirrors TokenPicker's aria-pressed button treatment so it
 * reads as a native segmented control; the visually-hidden legend names the
 * group for assistive tech.
 */
export function DenominationToggle({
  denomination,
  tokenSymbol,
  onChange,
  disabled,
}: DenominationToggleProps) {
  const { formatMessage } = useIntl();
  const choices: { value: Denomination; label: string }[] = [
    { value: "usd", label: "USD" },
    { value: "weth", label: tokenSymbol },
  ];
  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">
        {formatMessage({
          id: "public.fund.card.denominationLegend",
          defaultMessage: "Enter amount in",
        })}
      </legend>
      {choices.map((choice) => {
        const isSelected = denomination === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(choice.value)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isSelected
                ? "border-primary-action bg-editorial-warm text-text-strong-950"
                : "border-stroke-soft-200 bg-bg-white-0 text-text-soft-400 hover:bg-editorial-warm/40"
            }`}
          >
            {choice.label}
          </button>
        );
      })}
    </fieldset>
  );
}

interface AmountInputProps {
  amountInput: string;
  onChange: (next: string) => void;
  disabled: boolean;
  symbol: string;
  denomination?: Denomination;
  showDenominationToggle?: boolean;
  onDenominationChange?: (next: Denomination) => void;
  /** WETH-mode estimate ("≈ $20.00 at $3,000.00/ETH"). */
  usdSubtitle?: string;
  /** USD-mode estimate ("≈ 0.0066 WETH at $3,000.00/ETH"). */
  wethSubtitle?: string;
  wethStaleSubtitle?: string;
  wethUnavailable?: boolean;
}

export function AmountInput({
  amountInput,
  onChange,
  disabled,
  symbol,
  denomination = "usd",
  showDenominationToggle = false,
  onDenominationChange,
  usdSubtitle,
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
  const isWethDenomination = denomination === "weth";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="public-fund-amount"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({ id: "public.fund.card.amountLabel", defaultMessage: "Amount" })}
        </label>
        {showDenominationToggle && onDenominationChange ? (
          <DenominationToggle
            denomination={denomination}
            tokenSymbol={symbol}
            onChange={onDenominationChange}
            disabled={disabled}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2 border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 transition-colors focus-within:border-primary-action">
        {isWethDenomination ? (
          <span className="font-mono text-sm uppercase tracking-[0.08em] text-text-soft-400">
            {symbol}
          </span>
        ) : (
          <span className="font-serif text-2xl text-text-soft-400">$</span>
        )}
        <input
          ref={inputRef}
          id="public-fund-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amountInput}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isWethDenomination ? "0.0" : "0.00"}
          disabled={disabled}
          className="flex-1 bg-transparent font-serif text-2xl text-text-strong-950 outline-none placeholder:text-text-soft-400 disabled:opacity-60"
        />
      </div>
      <div className="flex min-h-[1rem] flex-col gap-1">
        {usdSubtitle ? (
          <p className="text-xs text-text-sub-600" data-testid="usd-estimate">
            {usdSubtitle}
          </p>
        ) : null}
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
