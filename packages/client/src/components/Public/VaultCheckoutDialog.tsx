import {
  DialogShell,
  formatTokenAmount,
  formatUsdCents,
  getOctantVaultAssetDisplayPolicy,
  getOctantVaultCampaignTransactionState,
  parseUsdToCents,
  prepareOctantVaultWalletEndow,
  type OctantVaultCampaignManifest,
  usdCentsToWei,
  useAuth,
  useEthUsdPrice,
  useOctantVaultWalletEndow,
  useUser,
} from "@green-goods/shared";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import {
  CHECKOUT_FIELD_LABEL,
  CHECKOUT_GHOST_BUTTON,
  CHECKOUT_PRIMARY_BUTTON,
  type CheckoutMethod,
  CheckoutMethodTile,
  CheckoutScreen,
  CheckoutSummary,
} from "./vaultCheckoutShell";

/**
 * The only campaign vetted for production Card Endow. Other complete manifests
 * collapse to Wallet-only — the card path stays gated behind this allowlist so
 * an un-reviewed vault can never surface a live card payment affordance.
 */
const CARD_ENDOW_PRODUCTION_CAMPAIGN_SLUG = "greenpill-nyc";
const ETH_SYMBOL = "ETH";

function isProductionCardEndowCampaign(campaign: OctantVaultCampaignManifest): boolean {
  return campaign.slug === CARD_ENDOW_PRODUCTION_CAMPAIGN_SLUG;
}

// Thirdweb (BuyWidget + in-app wallet) is heavy and only the Card path needs it.
// Keep it behind a lazy boundary so the modal shell, amount step, and Wallet path
// never pull it into the main chunk.
const VaultCardEndowFlow = lazy(() => import("./VaultCardEndowFlow"));

export interface VaultCheckoutGuardState {
  inputsLocked: boolean;
  closeLocked: boolean;
}

const UNLOCKED_CHECKOUT_GUARD: VaultCheckoutGuardState = {
  inputsLocked: false,
  closeLocked: false,
};

type VaultCheckoutPhase = "setup" | "pay";

function usdCentsToStableTokenUnits(cents: bigint, decimals: number): bigint {
  if (cents <= 0n) return 0n;
  if (decimals >= 2) return cents * 10n ** BigInt(decimals - 2);
  return cents / 10n ** BigInt(2 - decimals);
}

function getAmountErrorMessage(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  amountInput: string,
  usdCents: bigint | null,
  conversionUnavailable: boolean
) {
  if (amountInput.trim() && (usdCents === null || usdCents <= 0n)) {
    return formatMessage({
      id: "public.vaults.walletEndow.amount.invalid",
      defaultMessage: "Enter a valid dollar amount.",
    });
  }

  if (conversionUnavailable) {
    return formatMessage({
      id: "public.vaults.walletEndow.amount.conversionUnavailable",
      defaultMessage: "ETH pricing is not available right now. Try again in a moment.",
    });
  }

  return null;
}

export interface VaultCheckoutDialogProps {
  campaign: OctantVaultCampaignManifest;
  onClose: () => void;
}

export function VaultCheckoutDialog(props: VaultCheckoutDialogProps) {
  return (
    <WalletRuntimeProviders>
      <VaultCheckoutDialogContent {...props} />
    </WalletRuntimeProviders>
  );
}

/**
 * VaultCheckoutDialog — a fixed-height checkout sheet (shared `DialogShell`) for
 * one Octant vault campaign. It keeps amount and method choice together in the
 * editable setup step, then moves to the selected wallet or card path.
 * The Card path only appears for the production campaign when the manifest is
 * transaction-ready.
 * Payment-path components own their own authoritative state and report a lock
 * guard up so the sheet can prevent edits and close while a transaction is in
 * flight.
 */
function VaultCheckoutDialogContent({ campaign, onClose }: VaultCheckoutDialogProps) {
  const { formatMessage } = useIntl();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountInput, setAmountInput] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod | null>(null);
  const [phase, setPhase] = useState<VaultCheckoutPhase>("setup");
  const [checkoutGuard, setCheckoutGuard] =
    useState<VaultCheckoutGuardState>(UNLOCKED_CHECKOUT_GUARD);
  const checkoutGuardRef = useRef<VaultCheckoutGuardState>(UNLOCKED_CHECKOUT_GUARD);

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
  const amountError = getAmountErrorMessage(
    formatMessage,
    amountInput,
    usdCents,
    conversionUnavailable
  );
  const hasReadyAmount = typeof parsedAmount === "bigint" && parsedAmount > 0n;

  const transactionState = useMemo(
    () => getOctantVaultCampaignTransactionState(campaign),
    [campaign]
  );
  const cardMethodAvailable =
    transactionState.walletEndowEnabled && isProductionCardEndowCampaign(campaign);
  const availableMethods = useMemo<CheckoutMethod[]>(() => {
    if (!transactionState.walletEndowEnabled) return [];
    return cardMethodAvailable ? ["card", "wallet"] : ["wallet"];
  }, [cardMethodAvailable, transactionState.walletEndowEnabled]);
  const hasPaymentMethods = availableMethods.length > 0;
  const canSelectPaymentMethod = hasReadyAmount && !amountError && hasPaymentMethods;

  useEffect(() => {
    if (selectedMethod && !availableMethods.includes(selectedMethod)) {
      setSelectedMethod(null);
    }
  }, [availableMethods, selectedMethod]);

  // On desktop, direct focus to the amount field after DialogShell's open-focus
  // settles. On mobile this can force the visual viewport to scroll and push the
  // fixed checkout footer off-screen.
  useEffect(() => {
    if (phase !== "setup") return;
    if (
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(min-width: 640px)").matches
    ) {
      return;
    }
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !checkoutGuardRef.current.closeLocked) onClose();
    },
    [onClose]
  );

  const updateCheckoutGuard = useCallback((guard: VaultCheckoutGuardState) => {
    checkoutGuardRef.current = guard;
    setCheckoutGuard(guard);
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    setAmountInput(value);
  }, []);

  const handleSetupContinue = useCallback(() => {
    if (hasReadyAmount && selectedMethod) setPhase("pay");
  }, [hasReadyAmount, selectedMethod]);

  const handleBackToSetup = useCallback(() => {
    if (checkoutGuard.inputsLocked) return;
    updateCheckoutGuard(UNLOCKED_CHECKOUT_GUARD);
    setPhase("setup");
  }, [checkoutGuard.inputsLocked, updateCheckoutGuard]);

  const formattedUsdAmount = usdCents !== null && usdCents > 0n ? formatUsdCents(usdCents) : "";
  const formattedSettlementAmount =
    hasReadyAmount && parsedAmount
      ? formatTokenAmount(parsedAmount, decimals, isEthSettlement ? 6 : 4, undefined, true)
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
  const methodLabel =
    selectedMethod === "card"
      ? formatMessage({ id: "public.vaults.checkout.method.card", defaultMessage: "Card" })
      : formatMessage({ id: "public.vaults.checkout.method.wallet", defaultMessage: "Wallet" });

  const amountSummaryItems = [
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
          <span>{formattedUsdAmount}</span>
          {settlementDetail ? (
            <span className="text-xs text-text-soft-400">{settlementDetail}</span>
          ) : null}
        </span>
      ),
    },
  ];

  const summaryItems = [
    ...amountSummaryItems,
    {
      label: formatMessage({
        id: "public.vaults.checkout.review.method",
        defaultMessage: "Payment",
      }),
      value: methodLabel,
    },
  ];

  const titleNode = (
    <span className="font-serif text-lg font-normal text-text-strong-950">
      {formatMessage(
        { id: "public.vaults.checkout.title", defaultMessage: "Endow to" },
        { campaign: campaign.displayName }
      )}{" "}
      <span className="text-text-sub-600">{campaign.displayName}</span>
    </span>
  );

  return (
    <DialogShell
      open
      onOpenChange={handleOpenChange}
      title={titleNode}
      description={formatMessage({
        id: "public.vaults.checkout.description",
        defaultMessage: "Choose an amount and how you'd like to pay.",
      })}
      size="xl"
      preventClose={checkoutGuard.closeLocked}
      hideCloseButton={checkoutGuard.closeLocked}
      className="vault-checkout-surface flex flex-col"
      headerClassName="px-4 py-2 sm:px-5 sm:py-2"
      descriptionClassName="sr-only"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0 sm:!p-0 max-h-none"
    >
      {phase === "setup" ? (
        <CheckoutScreen
          footer={
            <button
              type="button"
              onClick={handleSetupContinue}
              disabled={!hasReadyAmount || !selectedMethod || !hasPaymentMethods}
              className={CHECKOUT_PRIMARY_BUTTON}
            >
              {formatMessage({
                id: "public.vaults.checkout.continue",
                defaultMessage: "Continue",
              })}
            </button>
          }
        >
          <div className="flex flex-col gap-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
              {`§ ${formatMessage({ id: "public.vaults.endow.kicker", defaultMessage: "Endow" }).toUpperCase()}`}
            </p>
            <p className="text-sm leading-[1.55] text-text-sub-600">
              {formatMessage({
                id: "public.vaults.checkout.description",
                defaultMessage: "Choose an amount and how you'd like to pay.",
              })}
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={amountInputId} className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.walletEndow.amountLabel",
                  defaultMessage: "Donation amount",
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
                  aria-describedby={amountError ? `${amountHelpId} ${amountErrorId}` : amountHelpId}
                  aria-invalid={Boolean(amountError)}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent font-serif text-2xl text-text-strong-950 outline-none placeholder:text-text-soft-400"
                />
              </div>
              <p id={amountHelpId} className="text-xs leading-[1.5] text-text-soft-400">
                {formatMessage(
                  {
                    id: "public.vaults.walletEndow.amountHelp",
                    defaultMessage:
                      "Enter dollars first. Checkout estimates an {donorSymbol} contribution and settles into the Octant vault as {settlementSymbol}.",
                  },
                  {
                    donorSymbol: assetDisplay.donorSymbol,
                    settlementSymbol: assetDisplay.settlementSymbol,
                  }
                )}
              </p>
              {amountError ? (
                <p id={amountErrorId} className="text-xs leading-[1.5] text-error-base">
                  {amountError}
                </p>
              ) : null}
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.checkout.method.legend",
                  defaultMessage: "How would you like to pay?",
                })}
              </legend>
              <div
                className={`grid gap-2 ${
                  availableMethods.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                }`}
                role="group"
              >
                {availableMethods.map((method) => (
                  <CheckoutMethodTile
                    key={method}
                    method={method}
                    selected={selectedMethod === method}
                    disabled={!canSelectPaymentMethod}
                    onSelect={(nextMethod) => {
                      if (canSelectPaymentMethod) setSelectedMethod(nextMethod);
                    }}
                    label={
                      method === "card"
                        ? formatMessage({
                            id: "public.vaults.checkout.method.card",
                            defaultMessage: "Card",
                          })
                        : formatMessage({
                            id: "public.vaults.checkout.method.wallet",
                            defaultMessage: "Wallet",
                          })
                    }
                    subtitle={
                      method === "card"
                        ? formatMessage({
                            id: "public.vaults.checkout.method.cardSubtitle",
                            defaultMessage: "Debit or credit card",
                          })
                        : formatMessage({
                            id: "public.vaults.checkout.method.walletSubtitle",
                            defaultMessage: "Connect at the final step",
                          })
                    }
                  />
                ))}
              </div>
              {hasPaymentMethods && !canSelectPaymentMethod ? (
                <p className="text-xs leading-[1.5] text-text-soft-400">
                  {formatMessage({
                    id: "public.vaults.checkout.method.amountRequired",
                    defaultMessage: "Enter a dollar amount first to choose a payment method.",
                  })}
                </p>
              ) : null}
            </fieldset>
          </div>
        </CheckoutScreen>
      ) : selectedMethod === "wallet" && parsedAmount ? (
        <WalletEndowPath
          campaign={campaign}
          amount={parsedAmount}
          summaryItems={summaryItems}
          canEdit={!checkoutGuard.inputsLocked}
          onBack={handleBackToSetup}
          onCheckoutGuardChange={updateCheckoutGuard}
        />
      ) : selectedMethod === "card" && parsedAmount ? (
        <Suspense
          fallback={
            <CheckoutScreen
              footer={
                <button type="button" onClick={handleBackToSetup} className={CHECKOUT_GHOST_BUTTON}>
                  {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
                </button>
              }
            >
              <div className="flex flex-col gap-5">
                <CheckoutSummary items={summaryItems} onEdit={handleBackToSetup} />
                <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                  {formatMessage({
                    id: "public.vaults.cardEndow.loading",
                    defaultMessage: "Loading Card Endow...",
                  })}
                </p>
              </div>
            </CheckoutScreen>
          }
        >
          <VaultCardEndowFlow
            campaign={campaign}
            amount={parsedAmount}
            summaryItems={summaryItems}
            onBack={handleBackToSetup}
            onCheckoutGuardChange={updateCheckoutGuard}
          />
        </Suspense>
      ) : null}
    </DialogShell>
  );
}

function WalletEndowPath({
  campaign,
  amount,
  summaryItems,
  canEdit,
  onBack,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  summaryItems: { label: string; value: React.ReactNode }[];
  canEdit: boolean;
  onBack: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  return (
    <WalletEndowPathContent
      campaign={campaign}
      amount={amount}
      summaryItems={summaryItems}
      canEdit={canEdit}
      onBack={onBack}
      onCheckoutGuardChange={onCheckoutGuardChange}
    />
  );
}

function WalletEndowPathContent({
  campaign,
  amount,
  summaryItems,
  canEdit,
  onBack,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  summaryItems: { label: string; value: React.ReactNode }[];
  canEdit: boolean;
  onBack: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const { loginWithWallet } = useAuth();
  const walletEndow = useOctantVaultWalletEndow({ errorMode: "inline", toastMode: "silent" });
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [pendingSubmissionKey, setPendingSubmissionKey] = useState<string | null>(null);
  const [walletConnectRequested, setWalletConnectRequested] = useState(false);
  const walletConnectRequestedRef = useRef(false);

  // Only a wallet-mode session is a valid Wallet Endow receiver. Restored passkey
  // / embedded sessions must still connect a wallet (PRD parity with /fund).
  const primaryWalletAddress = authMode === "wallet" ? primaryAddress : null;
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const assetDisplay = getOctantVaultAssetDisplayPolicy(symbol);
  const walletFlowKey = `${campaign.slug}:${amount.toString()}:${primaryWalletAddress ?? ""}`;
  const walletFlowKeyRef = useRef(walletFlowKey);
  walletFlowKeyRef.current = walletFlowKey;
  const walletBusy = walletEndow.isPending || pendingSubmissionKey !== null;
  const resetWalletEndow = walletEndow.reset;
  const updateWalletConnectRequested = useCallback((requested: boolean) => {
    walletConnectRequestedRef.current = requested;
    setWalletConnectRequested(requested);
  }, []);

  useEffect(() => {
    setStatus("idle");
    setPendingSubmissionKey(null);
    updateWalletConnectRequested(false);
    resetWalletEndow();
  }, [amount, campaign.slug, resetWalletEndow, updateWalletConnectRequested]);

  useEffect(() => {
    const guard = walletBusy
      ? { inputsLocked: true, closeLocked: true }
      : walletConnectRequested
        ? { inputsLocked: false, closeLocked: true }
        : UNLOCKED_CHECKOUT_GUARD;
    onCheckoutGuardChange(guard);
  }, [onCheckoutGuardChange, walletBusy, walletConnectRequested]);

  useEffect(() => {
    return () => onCheckoutGuardChange(UNLOCKED_CHECKOUT_GUARD);
  }, [onCheckoutGuardChange]);

  useEffect(() => {
    if (primaryWalletAddress) updateWalletConnectRequested(false);
  }, [primaryWalletAddress, updateWalletConnectRequested]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!walletConnectRequestedRef.current || event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!primaryWalletAddress) {
      updateWalletConnectRequested(true);
      onCheckoutGuardChange({ inputsLocked: false, closeLocked: true });
      loginWithWallet();
      return;
    }

    const prepared = prepareOctantVaultWalletEndow({
      campaign,
      amount,
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
      onSuccess: () => {
        setPendingSubmissionKey((current) => (current === submissionKey ? null : current));
        if (walletFlowKeyRef.current === submissionKey) setStatus("success");
      },
    });
  }, [
    amount,
    campaign,
    loginWithWallet,
    onCheckoutGuardChange,
    primaryWalletAddress,
    updateWalletConnectRequested,
    walletEndow,
    walletFlowKey,
  ]);

  const actionLabel = primaryWalletAddress
    ? formatMessage({
        id: "public.vaults.walletEndow.confirm",
        defaultMessage: "Confirm Wallet Endow",
      })
    : formatMessage({ id: "public.vaults.walletEndow.connect", defaultMessage: "Connect Wallet" });

  const receiverValue =
    primaryWalletAddress ??
    formatMessage({
      id: "public.vaults.checkout.review.receiverPending",
      defaultMessage: "Set when you connect a wallet",
    });

  return (
    <CheckoutScreen
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={walletBusy}
            className={CHECKOUT_PRIMARY_BUTTON}
          >
            {walletBusy
              ? formatMessage({
                  id: "public.vaults.walletEndow.submitting",
                  defaultMessage: "Submitting...",
                })
              : actionLabel}
          </button>
          {canEdit ? (
            <button type="button" onClick={onBack} className={CHECKOUT_GHOST_BUTTON}>
              {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5" data-testid="vault-wallet-endow-path">
        <CheckoutSummary items={summaryItems} onEdit={canEdit ? onBack : undefined} />

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className={CHECKOUT_FIELD_LABEL}>
              {formatMessage({
                id: "public.vaults.checkout.review.route",
                defaultMessage: "Vault route",
              })}
            </dt>
            <dd className="mt-1 text-text-sub-600">
              {formatMessage({
                id: "public.vaults.checkout.review.routeValue",
                defaultMessage: "Octant V2 Ethereum vault",
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
            <dd
              className={
                primaryWalletAddress
                  ? "mt-1 break-all font-mono text-xs text-text-sub-600"
                  : "mt-1 text-sm text-text-sub-600"
              }
            >
              {receiverValue}
            </dd>
          </div>
        </dl>

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
                  id: "public.vaults.cardEndow.tupleChain",
                  defaultMessage: "Ethereum network",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.vaults.cardEndow.chainValue",
                    defaultMessage: "Ethereum chain {chainId}",
                  },
                  { chainId: campaign.vault?.chainId ?? 1 }
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleVault",
                  defaultMessage: "Octant vault",
                })}
              </dt>
              <dd className="break-all font-mono text-xs text-text-sub-600">
                {campaign.vault?.vaultAddress ?? ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleToken",
                  defaultMessage: "WETH token",
                })}
              </dt>
              <dd className="break-all text-text-sub-600">
                {assetDisplay.technicalSymbol} · {campaign.vault?.asset?.address ?? ""}
              </dd>
            </div>
          </dl>
        </details>

        {status === "success" ? (
          <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
            {formatMessage({
              id: "public.vaults.walletEndow.success",
              defaultMessage:
                "Wallet contribution submitted. Keep this window open for the receipt.",
            })}
          </p>
        ) : null}
        {walletEndow.error ? (
          <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
            {formatMessage({
              id: "public.vaults.walletEndow.error",
              defaultMessage:
                "Wallet Endow could not be submitted. Review the wallet error and retry.",
            })}
          </p>
        ) : null}
      </div>
    </CheckoutScreen>
  );
}
