import {
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
  useTimeout,
  useUser,
} from "@green-goods/shared";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { EditorialLinkArrow } from "@/components/Public/atoms";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import {
  CHECKOUT_FIELD_LABEL,
  CHECKOUT_GHOST_BUTTON,
  CHECKOUT_PRIMARY_BUTTON,
  CheckoutStageHeader,
  CheckoutSurface,
  type CheckoutMethod,
  CheckoutMethodTile,
  CheckoutScreen,
  CheckoutSummary,
  getTxExplorerUrl,
} from "./vaultCheckoutShell";

const CARD_ENDOW_PRODUCTION_CAMPAIGN_SLUGS = new Set(["greenpill-nyc", "evmavericks"]);
const ETH_SYMBOL = "ETH";

function isProductionCardEndowCampaign(campaign: OctantVaultCampaignManifest): boolean {
  return CARD_ENDOW_PRODUCTION_CAMPAIGN_SLUGS.has(campaign.slug);
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
 * The Card path appears for production-approved vault campaigns when the
 * transaction tuple is ready.
 * Payment-path components own their own authoritative state and report a lock
 * guard up so the sheet can prevent edits and close while a transaction is in
 * flight.
 */
function VaultCheckoutDialogContent({ campaign, onClose }: VaultCheckoutDialogProps) {
  const { formatMessage } = useIntl();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const pricingStatusId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountInput, setAmountInput] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod | null>(null);
  const [phase, setPhase] = useState<VaultCheckoutPhase>("setup");
  // The WETH/base-unit amount is derived from a live ETH/USD feed; freeze it when
  // the user leaves setup so a mid-transaction price tick cannot change the amount
  // (which would reset progress or strand an in-flight endow). Setup keeps the live
  // estimate; the pay phase uses this committed value.
  const [committedAmount, setCommittedAmount] = useState<bigint | null>(null);
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
  const amountError = getAmountErrorMessage(formatMessage, amountInput, usdCents);
  const pricingStatusMessage = conversionUnavailable
    ? formatMessage({
        id: "public.vaults.walletEndow.amount.pricingUnavailable",
        defaultMessage:
          "ETH pricing is temporarily unavailable. Keep this amount and try again in a moment.",
      })
    : null;
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
  const canSelectPaymentMethod = hasPaymentMethods;

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
    if (hasReadyAmount && parsedAmount && selectedMethod && !conversionUnavailable) {
      setCommittedAmount(parsedAmount);
      setPhase("pay");
    }
  }, [conversionUnavailable, hasReadyAmount, parsedAmount, selectedMethod]);

  const handleBackToSetup = useCallback(() => {
    if (checkoutGuard.inputsLocked) return;
    updateCheckoutGuard(UNLOCKED_CHECKOUT_GUARD);
    setCommittedAmount(null);
    setPhase("setup");
  }, [checkoutGuard.inputsLocked, updateCheckoutGuard]);

  // Pay phase reads the frozen amount so the summary cannot drift with the live feed.
  const effectiveAmount = phase === "pay" ? committedAmount : parsedAmount;
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
  const methodLabel =
    selectedMethod === "card"
      ? formatMessage({ id: "public.vaults.checkout.method.card", defaultMessage: "Card" })
      : formatMessage({ id: "public.vaults.checkout.method.wallet", defaultMessage: "Wallet" });
  const setupContinueLabel =
    selectedMethod === "card"
      ? formatMessage({
          id: "public.vaults.checkout.continueCard",
          defaultMessage: "Continue to Card",
        })
      : selectedMethod === "wallet"
        ? formatMessage({
            id: "public.vaults.checkout.continueWallet",
            defaultMessage: "Continue to Wallet",
          })
        : formatMessage({
            id: "public.vaults.checkout.continue",
            defaultMessage: "Continue",
          });

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

  return (
    <CheckoutSurface
      open
      onOpenChange={handleOpenChange}
      ariaLabel={titleText}
      title={titleNode}
      description={formatMessage({
        id: "public.vaults.checkout.description",
        defaultMessage: "Choose an amount and how you'd like to pay.",
      })}
      preventClose={checkoutGuard.closeLocked}
      hideCloseButton={checkoutGuard.closeLocked}
    >
      {phase === "setup" ? (
        <CheckoutScreen
          footer={
            <button
              type="button"
              onClick={handleSetupContinue}
              disabled={
                !hasReadyAmount || !selectedMethod || !hasPaymentMethods || conversionUnavailable
              }
              className={CHECKOUT_PRIMARY_BUTTON}
            >
              {setupContinueLabel}
            </button>
          }
        >
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-[1.55] text-text-sub-600">
              {formatMessage({
                id: "public.vaults.checkout.setupLede",
                defaultMessage: "Choose the amount to endow, then pick how you want to pay.",
              })}
            </p>

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
                  aria-describedby={[
                    amountHelpId,
                    amountError ? amountErrorId : null,
                    pricingStatusMessage ? pricingStatusId : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
                      "We'll estimate the {donorSymbol} needed and send it into the Octant vault as {settlementSymbol}.",
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
              {pricingStatusMessage ? (
                <p
                  id={pricingStatusId}
                  role="status"
                  className="rounded-none bg-bg-weak-50 p-3 text-xs leading-[1.5] text-text-sub-600"
                >
                  {pricingStatusMessage}
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
            </fieldset>
          </div>
        </CheckoutScreen>
      ) : selectedMethod === "wallet" && committedAmount ? (
        <WalletEndowPath
          campaign={campaign}
          amount={committedAmount}
          summaryItems={summaryItems}
          canEdit={!checkoutGuard.inputsLocked}
          onBack={handleBackToSetup}
          onComplete={onClose}
          onCheckoutGuardChange={updateCheckoutGuard}
        />
      ) : selectedMethod === "card" && committedAmount ? (
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
            amount={committedAmount}
            summaryItems={summaryItems}
            onBack={handleBackToSetup}
            onComplete={onClose}
            onCheckoutGuardChange={updateCheckoutGuard}
          />
        </Suspense>
      ) : null}
    </CheckoutSurface>
  );
}

function WalletEndowPath({
  campaign,
  amount,
  summaryItems,
  canEdit,
  onBack,
  onComplete,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  summaryItems: { label: string; value: React.ReactNode }[];
  canEdit: boolean;
  onBack: () => void;
  onComplete: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  return (
    <WalletEndowPathContent
      campaign={campaign}
      amount={amount}
      summaryItems={summaryItems}
      canEdit={canEdit}
      onBack={onBack}
      onComplete={onComplete}
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
  onComplete,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  summaryItems: { label: string; value: React.ReactNode }[];
  canEdit: boolean;
  onBack: () => void;
  onComplete: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const { loginWithWallet } = useAuth();
  // toastMode "auto" surfaces lifecycle toasts (approving → depositing → success) so
  // the long wallet mutation has progress feedback; errorMode "inline" keeps errors
  // in the sheet (shouldShowErrorToast("inline") is false, so no double error toast).
  const walletEndow = useOctantVaultWalletEndow({ errorMode: "inline", toastMode: "auto" });
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [pendingSubmissionKey, setPendingSubmissionKey] = useState<string | null>(null);
  const [walletConnectRequested, setWalletConnectRequested] = useState(false);
  const walletConnectRequestedRef = useRef(false);
  const { set: scheduleSlow, clear: clearSlow } = useTimeout();

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
    setSuccessTxHash(null);
    setSlow(false);
    setPendingSubmissionKey(null);
    updateWalletConnectRequested(false);
    resetWalletEndow();
  }, [amount, campaign.slug, resetWalletEndow, updateWalletConnectRequested]);

  // Recovery affordance: if the submission is still in flight after a while, surface
  // a "taking longer" note and unlock close so the user is never stranded on a stall.
  useEffect(() => {
    if (!walletBusy) {
      clearSlow();
      setSlow(false);
      return;
    }
    return scheduleSlow(() => setSlow(true), 30_000);
  }, [walletBusy, scheduleSlow, clearSlow]);

  useEffect(() => {
    const guard =
      walletBusy && !slow
        ? { inputsLocked: true, closeLocked: true }
        : walletConnectRequested
          ? { inputsLocked: false, closeLocked: true }
          : UNLOCKED_CHECKOUT_GUARD;
    onCheckoutGuardChange(guard);
  }, [onCheckoutGuardChange, walletBusy, walletConnectRequested, slow]);

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
    // Once submitted successfully, the action becomes Done — never a second deposit.
    if (status === "success") return;
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
      onSuccess: (txHash) => {
        setPendingSubmissionKey((current) => (current === submissionKey ? null : current));
        if (walletFlowKeyRef.current === submissionKey) {
          setSuccessTxHash(typeof txHash === "string" ? txHash : null);
          setStatus("success");
        }
      },
    });
  }, [
    amount,
    campaign,
    loginWithWallet,
    onCheckoutGuardChange,
    primaryWalletAddress,
    status,
    updateWalletConnectRequested,
    walletEndow,
    walletFlowKey,
  ]);

  // Success is a terminal screen: the Confirm button is replaced by Done, so a
  // completed endowment can never be re-submitted from here.
  if (status === "success") {
    const explorerUrl = getTxExplorerUrl(campaign.vault?.explorerLink, successTxHash);
    return (
      <CheckoutScreen
        footer={
          <button type="button" onClick={onComplete} className={CHECKOUT_PRIMARY_BUTTON}>
            {formatMessage({ id: "public.vaults.checkout.done", defaultMessage: "Done" })}
          </button>
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
              defaultMessage: "Your wallet now holds the vault position for this campaign.",
            })}
          />
          <CheckoutSummary items={summaryItems} />
          <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
            {formatMessage({
              id: "public.vaults.walletEndow.success",
              defaultMessage:
                "Endowment submitted. You can review this wallet's endowments from the Fund page.",
            })}
          </p>
          <div className="flex flex-col gap-3">
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
            <EditorialLinkArrow to="/fund">
              {formatMessage({
                id: "public.vaults.checkout.viewOnFund",
                defaultMessage: "View on Fund page",
              })}
            </EditorialLinkArrow>
          </div>
        </div>
      </CheckoutScreen>
    );
  }

  const actionLabel = primaryWalletAddress
    ? formatMessage({
        id: "public.vaults.walletEndow.confirm",
        defaultMessage: "Confirm endowment",
      })
    : formatMessage({ id: "public.vaults.walletEndow.connect", defaultMessage: "Connect wallet" });

  const receiverValue =
    primaryWalletAddress ??
    formatMessage({
      id: "public.vaults.checkout.review.receiverPending",
      defaultMessage: "Set when you connect a wallet",
    });

  return (
    <CheckoutScreen
      footer={
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
              "Connect the wallet that should receive this vault position, then confirm the endowment.",
          })}
        />
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

        {slow ? (
          <div className="flex flex-col gap-2 rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
            <p>
              {formatMessage({
                id: "public.vaults.checkout.slow",
                defaultMessage:
                  "Taking longer than expected — your transaction may still be processing. Check the Fund page before retrying.",
              })}
            </p>
            <EditorialLinkArrow to="/fund">
              {formatMessage({
                id: "public.vaults.checkout.viewOnFund",
                defaultMessage: "View on Fund page",
              })}
            </EditorialLinkArrow>
          </div>
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
