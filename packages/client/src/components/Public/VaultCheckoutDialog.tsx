import {
  cn,
  formatAddress,
  formatTokenAmount,
  formatUsdCents,
  getOctantVaultAssetDisplayPolicy,
  getOctantVaultCampaignTransactionState,
  isLocalArbitrumForkMode,
  LOCAL_ARBITRUM_FORK_CHAIN_ID,
  normalizeDecimalInput,
  parseUsdToCents,
  prepareOctantVaultWalletEndow,
  type Address,
  type OctantVaultCampaignManifest,
  usdCentsToWei,
  useAuth,
  useEnsName,
  useEthUsdPrice,
  useOctantVaultWalletBalances,
  useOctantVaultWalletEndow,
  useTimeout,
  useUser,
  useWrapEthToWeth,
  VaultDepositStageError,
} from "@green-goods/shared";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import {
  CHECKOUT_FIELD_LABEL,
  CHECKOUT_GHOST_BUTTON,
  CHECKOUT_PRIMARY_BUTTON,
  CheckoutScreen,
  CheckoutStageHeader,
  CheckoutSummary,
  CheckoutSurface,
  getAddressExplorerUrl,
  getEthereumNetworkLabel,
  getTxExplorerUrl,
} from "./vaultCheckoutShell";

const ETH_SYMBOL = "ETH";
/**
 * Conservative combined gas units for the wrap + ERC20 approve + vault deposit
 * sequence that follows an in-checkout wrap. Used to reserve ETH so a wrap never
 * strands a near-empty-ETH wallet before it can finish the deposit.
 */
const WRAP_FLOW_GAS_UNITS = 500_000n;

export interface VaultCheckoutGuardState {
  inputsLocked: boolean;
  closeLocked: boolean;
}

const UNLOCKED_CHECKOUT_GUARD: VaultCheckoutGuardState = {
  inputsLocked: false,
  closeLocked: false,
};

function usdCentsToStableTokenUnits(cents: bigint, decimals: number): bigint {
  if (cents <= 0n) return 0n;
  if (decimals >= 2) return cents * 10n ** BigInt(decimals - 2);
  return cents / 10n ** BigInt(2 - decimals);
}

function getAmountErrorMessage(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  amountInput: string,
  usdCents: bigint | null
) {
  if (amountInput.trim() && (usdCents === null || usdCents <= 0n)) {
    return formatMessage({
      id: "public.vaults.walletEndow.amount.invalid",
      defaultMessage: "Enter a valid dollar amount.",
    });
  }

  return null;
}

function maxBigint(left: bigint, right: bigint) {
  return left > right ? left : right;
}

function ConnectedWalletValue({
  address,
  pendingLabel,
}: {
  address: Address | null;
  pendingLabel: string;
}) {
  const { data: ensName } = useEnsName(address, { enabled: Boolean(address) });

  if (!address) return <span>{pendingLabel}</span>;

  const display = formatAddress(address, { ensName, variant: "long" });
  const fallbackAddress = formatAddress(address, { variant: "long" });

  return (
    <span className="inline-flex min-w-0 flex-col gap-0.5">
      <span className={ensName ? "truncate" : "break-all font-mono text-xs"}>{display}</span>
      {ensName ? (
        <span className="break-all font-mono text-[10px] text-text-soft-400">
          {fallbackAddress}
        </span>
      ) : null}
    </span>
  );
}

export interface VaultCheckoutDialogProps {
  campaign: OctantVaultCampaignManifest;
  onClose: () => void;
  /** Hand off to the route-local `/vaults?manage=positions` surface after success. */
  onManagePositions?: () => void;
}

export function VaultCheckoutDialog(props: VaultCheckoutDialogProps) {
  return (
    <WalletRuntimeProviders>
      <VaultCheckoutDialogContent {...props} />
    </WalletRuntimeProviders>
  );
}

/**
 * One-screen Wallet Endow checkout for an Octant vault campaign. The page stays
 * wallet-runtime-free until this sheet opens; once open, amount entry, vault
 * context, connected-wallet context, balances, wrap, and submit all live on the
 * same stable surface.
 */
function VaultCheckoutDialogContent({
  campaign,
  onClose,
  onManagePositions,
}: VaultCheckoutDialogProps) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const { loginWithWallet } = useAuth();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const pricingStatusId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountInput, setAmountInput] = useState("");
  // Freeze the base-unit amount when the wallet action starts so a live ETH/USD
  // tick cannot change an in-flight endowment.
  const [committedAmount, setCommittedAmount] = useState<bigint | null>(null);
  const [checkoutGuard, setCheckoutGuard] =
    useState<VaultCheckoutGuardState>(UNLOCKED_CHECKOUT_GUARD);
  const checkoutGuardRef = useRef<VaultCheckoutGuardState>(UNLOCKED_CHECKOUT_GUARD);

  const walletEndow = useOctantVaultWalletEndow({ errorMode: "inline", toastMode: "auto" });
  const wrapEthToWeth = useWrapEthToWeth({ errorMode: "inline" });
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [pendingSubmissionKey, setPendingSubmissionKey] = useState<string | null>(null);
  const [walletConnectRequested, setWalletConnectRequested] = useState(false);
  const walletConnectRequestedRef = useRef(false);
  const { set: scheduleSlow, clear: clearSlow } = useTimeout();
  const { set: scheduleWalletConnectFallback, clear: clearWalletConnectFallback } = useTimeout();

  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const assetDisplay = getOctantVaultAssetDisplayPolicy(symbol);
  const isEthSettlement = assetDisplay.donorSymbol === ETH_SYMBOL;
  const ethUsd = useEthUsdPrice({
    enabled: isEthSettlement,
    chainId: campaign.vault?.chainId,
  });
  const usdCents = useMemo(() => parseUsdToCents(amountInput), [amountInput]);
  const { parsedAmount, conversionUnavailable } = useMemo(() => {
    if (usdCents === null || usdCents <= 0n) {
      return { parsedAmount: null, conversionUnavailable: false };
    }
    if (isEthSettlement) {
      if (!ethUsd.hasFeed || ethUsd.priceAnswer <= 0n) {
        return { parsedAmount: null, conversionUnavailable: true };
      }
      return {
        parsedAmount: usdCentsToWei(usdCents, ethUsd.priceAnswer, decimals),
        conversionUnavailable: false,
      };
    }
    return {
      parsedAmount: usdCentsToStableTokenUnits(usdCents, decimals),
      conversionUnavailable: false,
    };
  }, [decimals, ethUsd.hasFeed, ethUsd.priceAnswer, isEthSettlement, usdCents]);
  const amountError = getAmountErrorMessage(formatMessage, amountInput, usdCents);
  const pricingStatusMessage = conversionUnavailable
    ? formatMessage({
        id: "public.vaults.walletEndow.amount.pricingUnavailable",
        defaultMessage:
          "ETH pricing is temporarily unavailable. Keep this amount and try again in a moment.",
      })
    : null;
  const amountFeedbackMessage = amountError ?? pricingStatusMessage;

  const effectiveAmount = committedAmount ?? parsedAmount;
  const hasReadyAmount =
    typeof effectiveAmount === "bigint" &&
    effectiveAmount > 0n &&
    !amountError &&
    !conversionUnavailable;
  const amountKey = effectiveAmount?.toString() ?? "";

  const transactionState = useMemo(
    () => getOctantVaultCampaignTransactionState(campaign),
    [campaign]
  );

  // Only a wallet-mode session is a valid Wallet Endow receiver. Restored passkey
  // / embedded sessions must still connect a wallet.
  const primaryWalletAddress = authMode === "wallet" ? (primaryAddress as Address | null) : null;
  const chainId = campaign.vault?.chainId ?? 1;
  const localForkBlocksWalletEndow =
    isLocalArbitrumForkMode() && chainId !== LOCAL_ARBITRUM_FORK_CHAIN_ID;
  const assetAddress = campaign.vault?.asset?.address as Address | undefined;
  const assetDecimals = campaign.vault?.asset?.decimals ?? 18;
  const isWethAsset = assetDisplay.technicalSymbol === "WETH" && Boolean(assetAddress);
  const walletBalances = useOctantVaultWalletBalances({
    owner: primaryWalletAddress,
    chainId,
    assetAddress: assetAddress ?? null,
    enabled: Boolean(primaryWalletAddress && assetAddress),
  });
  const walletFlowKey = `${campaign.slug}:${amountKey}:${primaryWalletAddress ?? ""}`;
  const wrapFlowKey = `${walletFlowKey}:${assetAddress ?? ""}`;
  const walletFlowKeyRef = useRef(walletFlowKey);
  walletFlowKeyRef.current = walletFlowKey;
  const [wrapCompletedKey, setWrapCompletedKey] = useState<string | null>(null);
  const hasCompletedWrapForAmount = wrapCompletedKey === wrapFlowKey;
  const assetBalance = walletBalances.assetBalance;
  const nativeBalance = walletBalances.nativeBalance;
  const wrapShortfall =
    typeof effectiveAmount === "bigint" &&
    typeof assetBalance === "bigint" &&
    assetBalance < effectiveAmount
      ? effectiveAmount - assetBalance
      : 0n;
  const assetInsufficient = wrapShortfall > 0n;
  const gasReserve =
    typeof walletBalances.gasPrice === "bigint"
      ? walletBalances.gasPrice * WRAP_FLOW_GAS_UNITS
      : 0n;
  const ethNeededForWrap = wrapShortfall + gasReserve;
  const ethSufficientForWrap =
    wrapShortfall > 0n && typeof nativeBalance === "bigint" && nativeBalance >= ethNeededForWrap;
  const ethShortForGasOnly =
    wrapShortfall > 0n &&
    typeof nativeBalance === "bigint" &&
    nativeBalance >= wrapShortfall &&
    nativeBalance < ethNeededForWrap;
  const missingEthForWrap =
    wrapShortfall > 0n && typeof nativeBalance === "bigint"
      ? maxBigint(ethNeededForWrap - nativeBalance, 0n)
      : 0n;
  const walletBalanceDecisionPending =
    Boolean(primaryWalletAddress && isWethAsset && hasReadyAmount && !hasCompletedWrapForAmount) &&
    !walletBalances.isError &&
    (walletBalances.isLoading ||
      walletBalances.isFetching ||
      typeof assetBalance !== "bigint" ||
      typeof nativeBalance !== "bigint");
  const shouldWrapBeforeDeposit =
    Boolean(primaryWalletAddress && isWethAsset) &&
    assetInsufficient &&
    ethSufficientForWrap &&
    !hasCompletedWrapForAmount;
  const insufficientWethBlocksSubmit =
    Boolean(primaryWalletAddress && isWethAsset) &&
    assetInsufficient &&
    !shouldWrapBeforeDeposit &&
    !hasCompletedWrapForAmount;
  const walletBusy =
    walletEndow.isPending || wrapEthToWeth.isPending || pendingSubmissionKey !== null;
  const resetWalletEndow = walletEndow.reset;
  const resetWrapEthToWeth = wrapEthToWeth.reset;
  const updateWalletConnectRequested = useCallback((requested: boolean) => {
    walletConnectRequestedRef.current = requested;
    setWalletConnectRequested(requested);
  }, []);

  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(min-width: 640px)").matches
    ) {
      return;
    }
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    setStatus("idle");
    setSuccessTxHash(null);
    setSlow(false);
    setPendingSubmissionKey(null);
    setWrapCompletedKey(null);
    clearWalletConnectFallback();
    updateWalletConnectRequested(false);
    resetWalletEndow();
    resetWrapEthToWeth();
  }, [
    amountKey,
    campaign.slug,
    primaryWalletAddress,
    clearWalletConnectFallback,
    resetWalletEndow,
    resetWrapEthToWeth,
    updateWalletConnectRequested,
  ]);

  useEffect(() => {
    if (!walletBusy) {
      clearSlow();
      setSlow(false);
      return;
    }
    return scheduleSlow(() => setSlow(true), 30_000);
  }, [walletBusy, scheduleSlow, clearSlow]);

  useEffect(() => {
    const guard = walletBusy
      ? { inputsLocked: true, closeLocked: true }
      : walletConnectRequested
        ? { inputsLocked: false, closeLocked: true }
        : UNLOCKED_CHECKOUT_GUARD;
    checkoutGuardRef.current = guard;
    setCheckoutGuard(guard);
  }, [walletBusy, walletConnectRequested, slow]);

  useEffect(() => {
    if (primaryWalletAddress) {
      clearWalletConnectFallback();
      updateWalletConnectRequested(false);
    }
  }, [clearWalletConnectFallback, primaryWalletAddress, updateWalletConnectRequested]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!walletConnectRequestedRef.current || event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !checkoutGuardRef.current.closeLocked) onClose();
    },
    [onClose]
  );

  const handleAmountChange = useCallback((value: string) => {
    if (checkoutGuardRef.current.inputsLocked) return;
    setAmountInput(value);
    setCommittedAmount(null);
  }, []);

  const normalizeAmountInput = useCallback(() => {
    setAmountInput((current) => normalizeDecimalInput(current));
  }, []);

  const handleSubmit = useCallback(() => {
    if (status === "success" || !hasReadyAmount || !effectiveAmount) return;
    if (!transactionState.walletEndowEnabled || conversionUnavailable) return;
    if (localForkBlocksWalletEndow) return;

    setAmountInput((current) => normalizeDecimalInput(current));
    setCommittedAmount(effectiveAmount);

    if (!primaryWalletAddress) {
      updateWalletConnectRequested(true);
      checkoutGuardRef.current = { inputsLocked: false, closeLocked: true };
      setCheckoutGuard({ inputsLocked: false, closeLocked: true });
      const cancelWalletConnectFallback = scheduleWalletConnectFallback(() => {
        if (walletFlowKeyRef.current === walletFlowKey) {
          updateWalletConnectRequested(false);
          checkoutGuardRef.current = UNLOCKED_CHECKOUT_GUARD;
          setCheckoutGuard(UNLOCKED_CHECKOUT_GUARD);
        }
      }, 15_000);
      void Promise.resolve(loginWithWallet()).catch(() => {
        cancelWalletConnectFallback();
        if (walletFlowKeyRef.current === walletFlowKey) {
          updateWalletConnectRequested(false);
          checkoutGuardRef.current = UNLOCKED_CHECKOUT_GUARD;
          setCheckoutGuard(UNLOCKED_CHECKOUT_GUARD);
        }
      });
      return;
    }

    if (walletBalanceDecisionPending || insufficientWethBlocksSubmit) return;

    if (shouldWrapBeforeDeposit && assetAddress) {
      const submissionKey = wrapFlowKey;
      wrapEthToWeth.mutate(
        { chainId, wethAddress: assetAddress, amount: wrapShortfall },
        {
          onError: () => {
            if (walletFlowKeyRef.current === walletFlowKey) setWrapCompletedKey(null);
          },
          onSuccess: () => {
            if (walletFlowKeyRef.current === walletFlowKey) {
              setWrapCompletedKey(submissionKey);
              void walletBalances.refetch();
            }
          },
        }
      );
      return;
    }

    const prepared = prepareOctantVaultWalletEndow({
      campaign,
      amount: effectiveAmount,
      receiverAddress: primaryWalletAddress,
    });

    if (prepared.status !== "ready" || !prepared.transaction) return;

    const submissionKey = walletFlowKey;
    setPendingSubmissionKey(submissionKey);
    walletEndow.mutate(prepared.transaction, {
      onError: () => {
        setPendingSubmissionKey((current) => (current === submissionKey ? null : current));
        if (walletFlowKeyRef.current === submissionKey) setStatus("idle");
      },
      onSuccess: (txHash) => {
        setPendingSubmissionKey((current) => (current === submissionKey ? null : current));
        if (walletFlowKeyRef.current === submissionKey) {
          setSuccessTxHash(typeof txHash === "string" ? txHash : null);
          setStatus("success");
        }
      },
    });
  }, [
    assetAddress,
    campaign,
    chainId,
    conversionUnavailable,
    effectiveAmount,
    hasReadyAmount,
    insufficientWethBlocksSubmit,
    loginWithWallet,
    localForkBlocksWalletEndow,
    primaryWalletAddress,
    scheduleWalletConnectFallback,
    shouldWrapBeforeDeposit,
    status,
    transactionState.walletEndowEnabled,
    updateWalletConnectRequested,
    walletBalanceDecisionPending,
    walletBalances,
    walletEndow,
    walletFlowKey,
    wrapEthToWeth,
    wrapFlowKey,
    wrapShortfall,
  ]);

  const formattedUsdAmount = usdCents !== null && usdCents > 0n ? formatUsdCents(usdCents) : "";
  const formattedSettlementAmount = effectiveAmount
    ? formatTokenAmount(effectiveAmount, decimals, isEthSettlement ? 6 : 4, undefined, true)
    : "";
  const settlementDetail =
    formattedSettlementAmount && assetDisplay.settlementSymbol
      ? formatMessage(
          {
            id: "public.vaults.checkout.review.settlement",
            defaultMessage: "Settles into the Octant vault as {amount} {symbol}",
          },
          { amount: formattedSettlementAmount, symbol: assetDisplay.settlementSymbol }
        )
      : "";
  const summaryItems = [
    {
      label: formatMessage({
        id:
          assetDisplay.donorSymbol === ETH_SYMBOL
            ? "public.vaults.checkout.review.ethContribution"
            : "public.vaults.checkout.review.amount",
        defaultMessage:
          assetDisplay.donorSymbol === ETH_SYMBOL ? "ETH contribution" : "Donation amount",
      }),
      value: (
        <span className="inline-flex flex-col gap-0.5">
          <span>
            {formattedUsdAmount ||
              formatMessage({
                id: "public.vaults.checkout.amountPending",
                defaultMessage: "Enter an amount",
              })}
          </span>
          <span
            data-testid="vault-checkout-summary-settlement"
            aria-hidden={settlementDetail ? undefined : true}
            className={cn(
              "min-h-[1.125rem] text-xs text-text-soft-400",
              settlementDetail ? null : "invisible"
            )}
          >
            {settlementDetail || "\u00a0"}
          </span>
        </span>
      ),
    },
  ];

  const titleText = formatMessage(
    { id: "public.vaults.checkout.titleWithCampaign", defaultMessage: "Endow to {campaign}" },
    { campaign: campaign.displayName }
  );
  const titleNode = (
    <span className="font-serif text-lg font-normal text-text-strong-950">
      {formatMessage(
        { id: "public.vaults.checkout.title", defaultMessage: "Endow to" },
        { campaign: campaign.displayName }
      )}{" "}
      <span className="text-text-sub-600">{campaign.displayName}</span>
    </span>
  );
  const receiverPendingLabel = formatMessage({
    id: "public.vaults.checkout.review.receiverPending",
    defaultMessage: "Set when you connect a wallet",
  });
  const formattedWrapAmount = formatTokenAmount(
    wrapShortfall > 0n ? wrapShortfall : (effectiveAmount ?? 0n),
    assetDecimals,
    6,
    undefined,
    true
  );
  const formattedMissingEth = formatTokenAmount(missingEthForWrap, 18, 6, undefined, true);
  const insufficientFundsMessage =
    insufficientWethBlocksSubmit && wrapShortfall > 0n
      ? formatMessage(
          {
            id: "public.vaults.walletEndow.balances.shortfall",
            defaultMessage:
              "This wallet is short {weth} WETH. Add WETH, or add at least {eth} ETH to wrap here.",
          },
          { weth: formattedWrapAmount, eth: formattedMissingEth }
        )
      : null;
  const localForkBlockedMessage =
    localForkBlocksWalletEndow && hasReadyAmount
      ? formatMessage({
          id: "public.vaults.walletEndow.localForkBlocked",
          defaultMessage:
            "Wallet Endow is disabled in local Arbitrum fork mode because this Octant vault settles on Ethereum mainnet. Open a non-fork dev surface or production before sending a real endowment.",
        })
      : null;
  const balanceFeedback = shouldWrapBeforeDeposit
    ? {
        tone: "primary" as const,
        message: formatMessage(
          {
            id: "public.vaults.walletEndow.balances.wrapPrompt",
            defaultMessage:
              "Your wallet has enough ETH. Wrap {amount} ETH into WETH before confirming the vault deposit.",
          },
          { amount: formattedWrapAmount }
        ),
      }
    : ethShortForGasOnly
      ? {
          tone: "warning" as const,
          message: formatMessage({
            id: "public.vaults.walletEndow.balances.gasReserveWarning",
            defaultMessage:
              "You have enough ETH to wrap, but not enough left for network fees on the approve and deposit steps. Add a little more ETH, then try again.",
          }),
        }
      : insufficientFundsMessage
        ? {
            tone: "error" as const,
            message: insufficientFundsMessage,
          }
        : hasCompletedWrapForAmount
          ? {
              tone: "primary" as const,
              message: formatMessage({
                id: "public.vaults.walletEndow.balances.wrapComplete",
                defaultMessage: "ETH was wrapped. Continue to confirm the WETH vault deposit.",
              }),
            }
          : null;
  const vaultExplorerUrl = getAddressExplorerUrl(
    campaign.vault?.explorerLink,
    campaign.vault?.vaultAddress
  );
  const tokenExplorerUrl = getAddressExplorerUrl(campaign.vault?.explorerLink, assetAddress);

  let actionLabel = formatMessage({
    id: "public.vaults.walletEndow.enterAmount",
    defaultMessage: "Enter an amount",
  });
  if (wrapEthToWeth.isPending) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.wrapping",
      defaultMessage: "Wrapping...",
    });
  } else if (walletBusy) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.submitting",
      defaultMessage: "Submitting...",
    });
  } else if (walletBalanceDecisionPending) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.balances.loading",
      defaultMessage: "Loading balances...",
    });
  } else if (hasReadyAmount && localForkBlocksWalletEndow) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.localForkUnavailable",
      defaultMessage: "Unavailable in local fork",
    });
  } else if (insufficientWethBlocksSubmit) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.insufficientFunds",
      defaultMessage: "Insufficient funds",
    });
  } else if (hasReadyAmount && primaryWalletAddress && shouldWrapBeforeDeposit) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.wrap",
      defaultMessage: "Wrap ETH to WETH",
    });
  } else if (hasReadyAmount && primaryWalletAddress) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.confirm",
      defaultMessage: "Confirm endowment",
    });
  } else if (hasReadyAmount) {
    actionLabel = formatMessage({
      id: "public.vaults.walletEndow.connect",
      defaultMessage: "Connect wallet",
    });
  }

  const actionDisabled =
    walletBusy ||
    walletBalanceDecisionPending ||
    localForkBlocksWalletEndow ||
    insufficientWethBlocksSubmit ||
    !hasReadyAmount ||
    !transactionState.walletEndowEnabled;

  if (status === "success") {
    const explorerUrl = getTxExplorerUrl(campaign.vault?.explorerLink, successTxHash);
    return (
      <CheckoutSurface
        open
        onOpenChange={handleOpenChange}
        ariaLabel={titleText}
        title={titleNode}
        description={formatMessage({
          id: "public.vaults.checkout.description",
          defaultMessage:
            "Enter an amount, review the Octant vault context, then connect the wallet that should receive these vault shares.",
        })}
        preventClose={checkoutGuard.closeLocked}
        hideCloseButton={checkoutGuard.closeLocked}
      >
        <CheckoutScreen
          footer={
            <div className="flex flex-col gap-2">
              {onManagePositions ? (
                <button
                  type="button"
                  onClick={onManagePositions}
                  className={CHECKOUT_PRIMARY_BUTTON}
                >
                  {formatMessage({
                    id: "public.vaults.checkout.manageEndowments",
                    defaultMessage: "Manage Endowments",
                  })}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className={onManagePositions ? CHECKOUT_GHOST_BUTTON : CHECKOUT_PRIMARY_BUTTON}
              >
                {formatMessage({ id: "public.vaults.checkout.done", defaultMessage: "Done" })}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-5" data-testid="vault-wallet-endow-success">
            <CheckoutStageHeader
              eyebrow={formatMessage({
                id: "public.vaults.walletEndow.done.eyebrow",
                defaultMessage: "Complete",
              })}
              title={formatMessage({
                id: "public.vaults.walletEndow.done.title",
                defaultMessage: "Endowment submitted",
              })}
              description={formatMessage({
                id: "public.vaults.walletEndow.done.description",
                defaultMessage: "Your wallet now holds vault shares for this campaign.",
              })}
            />
            <CheckoutSummary items={summaryItems} />
            <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
              {formatMessage({
                id: "public.vaults.walletEndow.success",
                defaultMessage:
                  "Endowment submitted. Manage these WETH vault shares any time from /vaults.",
              })}
            </p>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
              >
                {formatMessage({
                  id: "public.vaults.checkout.viewTransaction",
                  defaultMessage: "View transaction",
                })}
              </a>
            ) : null}
          </div>
        </CheckoutScreen>
      </CheckoutSurface>
    );
  }

  return (
    <CheckoutSurface
      open
      onOpenChange={handleOpenChange}
      ariaLabel={titleText}
      title={titleNode}
      description={formatMessage({
        id: "public.vaults.checkout.description",
        defaultMessage:
          "Enter an amount, review the Octant vault context, then connect the wallet that should receive these vault shares.",
      })}
      preventClose={checkoutGuard.closeLocked}
      hideCloseButton={checkoutGuard.closeLocked}
    >
      <CheckoutScreen
        footer={
          <button
            type="button"
            onClick={handleSubmit}
            disabled={actionDisabled}
            className={CHECKOUT_PRIMARY_BUTTON}
          >
            {actionLabel}
          </button>
        }
      >
        <div className="flex flex-col gap-5" data-testid="vault-wallet-endow-path">
          <CheckoutStageHeader
            eyebrow={formatMessage({
              id: "public.vaults.walletEndow.stageEyebrow",
              defaultMessage: "Wallet",
            })}
            title={formatMessage({
              id: "public.vaults.walletEndow.stageTitle",
              defaultMessage: "Review wallet endowment",
            })}
            description={formatMessage({
              id: "public.vaults.walletEndow.stageDescription",
              defaultMessage:
                "Enter an amount, review the Octant vault context, then connect the wallet that should receive these vault shares.",
            })}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor={amountInputId} className={CHECKOUT_FIELD_LABEL}>
              {formatMessage({
                id: "public.vaults.walletEndow.amountLabel",
                defaultMessage: "Amount to endow",
              })}
            </label>
            <div className="flex items-center gap-2 rounded-none border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 transition-colors focus-within:border-primary-action">
              <span className="font-serif text-2xl text-text-soft-400" aria-hidden>
                $
              </span>
              <input
                ref={amountRef}
                id={amountInputId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountInput}
                disabled={checkoutGuard.inputsLocked}
                aria-describedby={[
                  amountHelpId,
                  amountError ? amountErrorId : null,
                  pricingStatusMessage ? pricingStatusId : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-invalid={Boolean(amountError)}
                onChange={(event) => handleAmountChange(event.target.value)}
                onBlur={normalizeAmountInput}
                placeholder="0.00"
                className="flex-1 bg-transparent font-serif text-2xl text-text-strong-950 outline-none placeholder:text-text-soft-400 disabled:cursor-not-allowed disabled:text-text-soft-400"
              />
            </div>
            <p id={amountHelpId} className="text-xs leading-[1.5] text-text-soft-400">
              {formatMessage(
                {
                  id: "public.vaults.walletEndow.amountHelp",
                  defaultMessage:
                    "We'll estimate the {donorSymbol} needed and send it into the Octant vault as {settlementSymbol}.",
                },
                {
                  donorSymbol: assetDisplay.donorSymbol,
                  settlementSymbol: assetDisplay.settlementSymbol,
                }
              )}
            </p>
            <div
              data-testid="vault-checkout-amount-feedback"
              data-state={amountFeedbackMessage ? "visible" : "empty"}
              aria-hidden={amountFeedbackMessage ? undefined : true}
              className={cn(
                "min-h-12 max-h-20 overflow-y-auto break-words rounded-none p-3 text-xs leading-[1.5] transition-colors",
                amountError
                  ? "bg-error-lighter/20 text-error-base"
                  : pricingStatusMessage
                    ? "bg-bg-weak-50 text-text-sub-600"
                    : "invisible bg-bg-weak-50 text-text-sub-600"
              )}
            >
              {amountError ? (
                <p id={amountErrorId}>{amountError}</p>
              ) : pricingStatusMessage ? (
                <p id={pricingStatusId} role="status">
                  {pricingStatusMessage}
                </p>
              ) : null}
            </div>
          </div>

          <CheckoutSummary items={summaryItems} />

          {localForkBlocksWalletEndow ? (
            <div
              data-testid="vault-checkout-availability-feedback"
              data-state={localForkBlockedMessage ? "visible" : "empty"}
              aria-hidden={localForkBlockedMessage ? undefined : true}
              className={cn(
                "min-h-28 max-h-32 overflow-y-auto break-words rounded-none p-4 text-sm leading-[1.55] transition-colors",
                localForkBlockedMessage
                  ? "bg-warning-lighter/40 text-text-sub-600"
                  : "invisible bg-warning-lighter/40 text-text-sub-600"
              )}
            >
              {localForkBlockedMessage ? <p>{localForkBlockedMessage}</p> : null}
            </div>
          ) : null}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.checkout.review.route",
                  defaultMessage: "Vault destination",
                })}
              </dt>
              <dd className="mt-1 text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.checkout.review.routeValue",
                  defaultMessage: "Octant vault on Ethereum",
                })}
              </dd>
            </div>
            <div>
              <dt className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.checkout.review.receiver",
                  defaultMessage: "Receiver wallet",
                })}
              </dt>
              <dd className="mt-1 text-sm text-text-sub-600">
                <ConnectedWalletValue
                  address={primaryWalletAddress}
                  pendingLabel={receiverPendingLabel}
                />
              </dd>
            </div>
          </dl>

          {primaryWalletAddress && isWethAsset ? (
            <section
              className="rounded-none border border-stroke-soft-200 bg-bg-weak-50 p-4"
              aria-labelledby="vault-wallet-balances-title"
            >
              <h4
                id="vault-wallet-balances-title"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
              >
                {formatMessage({
                  id: "public.vaults.walletEndow.balances.title",
                  defaultMessage: "Ethereum Mainnet balances",
                })}
              </h4>
              {walletBalances.isLoading ? (
                <p className="mt-3 text-sm text-text-sub-600">
                  {formatMessage({
                    id: "public.vaults.walletEndow.balances.loading",
                    defaultMessage: "Loading balances...",
                  })}
                </p>
              ) : (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-text-strong-950">
                      {formatMessage({
                        id: "public.vaults.walletEndow.balances.eth",
                        defaultMessage: "ETH balance",
                      })}
                    </dt>
                    <dd className="mt-1 text-text-sub-600">
                      {formatTokenAmount(nativeBalance ?? 0n, 18, 6, undefined, true)} ETH
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-text-strong-950">
                      {formatMessage({
                        id: "public.vaults.walletEndow.balances.weth",
                        defaultMessage: "WETH balance",
                      })}
                    </dt>
                    <dd className="mt-1 text-text-sub-600">
                      {formatTokenAmount(assetBalance ?? 0n, assetDecimals, 6, undefined, true)}{" "}
                      WETH
                    </dd>
                  </div>
                </dl>
              )}
              <div
                data-testid="vault-checkout-balance-feedback"
                data-state={balanceFeedback ? "visible" : "empty"}
                aria-hidden={balanceFeedback ? undefined : true}
                className={cn(
                  "mt-4 min-h-20 max-h-32 overflow-y-auto break-words rounded-none p-3 text-sm leading-[1.55] transition-colors",
                  balanceFeedback?.tone === "primary"
                    ? "bg-primary-action/10 text-primary-base"
                    : balanceFeedback?.tone === "warning"
                      ? "bg-warning-lighter/40 text-text-sub-600"
                      : balanceFeedback?.tone === "error"
                        ? "bg-error-lighter/30 text-error-base"
                        : "invisible bg-bg-weak-50 text-text-sub-600"
                )}
              >
                {balanceFeedback ? <p>{balanceFeedback.message}</p> : null}
              </div>
            </section>
          ) : null}

          <details className="border-t border-stroke-soft-200 pt-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
              {formatMessage({
                id: "public.vaults.checkout.technicalDetails",
                defaultMessage: "Technical WETH details",
              })}
            </summary>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-text-strong-950">
                  {formatMessage({
                    id: "public.vaults.checkout.technical.network",
                    defaultMessage: "Ethereum network",
                  })}
                </dt>
                <dd className="text-text-sub-600">
                  {getEthereumNetworkLabel(campaign.vault?.chainId ?? 1, formatMessage)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-text-strong-950">
                  {formatMessage({
                    id: "public.vaults.checkout.technical.vault",
                    defaultMessage: "Octant vault",
                  })}
                </dt>
                <dd className="break-all font-mono text-xs text-text-sub-600">
                  {vaultExplorerUrl ? (
                    <a
                      href={vaultExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
                    >
                      {campaign.vault?.vaultAddress ?? ""}
                    </a>
                  ) : (
                    (campaign.vault?.vaultAddress ?? "")
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-text-strong-950">
                  {formatMessage({
                    id: "public.vaults.checkout.technical.token",
                    defaultMessage: "WETH token",
                  })}
                </dt>
                <dd className="break-all text-text-sub-600">
                  {assetDisplay.technicalSymbol} ·{" "}
                  {tokenExplorerUrl ? (
                    <a
                      href={tokenExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
                    >
                      {assetAddress ?? ""}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{assetAddress ?? ""}</span>
                  )}
                </dd>
              </div>
            </dl>
          </details>

          {slow ? (
            <div className="flex flex-col gap-2 rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
              <p>
                {formatMessage({
                  id: "public.vaults.checkout.slow",
                  defaultMessage:
                    "Taking longer than expected. Your transaction may still be processing. Wait a moment before retrying; your endowment will appear under Manage Endowments once it settles.",
                })}
              </p>
            </div>
          ) : null}
          {walletEndow.error ? (
            <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
              {walletEndow.error instanceof VaultDepositStageError &&
              walletEndow.error.reason === "insufficientBalance"
                ? formatMessage({
                    id: "public.vaults.walletEndow.insufficientWeth",
                    defaultMessage:
                      "This wallet doesn't have enough WETH for this endowment. Wrap ETH to WETH first, then try again.",
                  })
                : formatMessage({
                    id: "public.vaults.walletEndow.error",
                    defaultMessage:
                      "Wallet Endow could not be submitted. Review the wallet error and retry.",
                  })}
            </p>
          ) : null}
        </div>
      </CheckoutScreen>
    </CheckoutSurface>
  );
}
