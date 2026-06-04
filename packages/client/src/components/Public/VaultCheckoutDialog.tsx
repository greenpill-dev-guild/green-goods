import {
  DialogShell,
  getOctantVaultCampaignTransactionState,
  prepareOctantVaultWalletEndow,
  type OctantVaultCampaignManifest,
  useAuth,
  useOctantVaultWalletEndow,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
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

type VaultCheckoutPhase = "amount" | "method" | "pay";

function getAmountErrorMessage(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  validationKey: string | null,
  symbol: string
) {
  if (validationKey === "app.treasury.tooManyDecimals") {
    return formatMessage(
      {
        id: "public.vaults.walletEndow.amount.tooManyDecimals",
        defaultMessage: "Use fewer decimals for {symbol}.",
      },
      { symbol }
    );
  }

  if (validationKey) {
    return formatMessage({
      id: "public.vaults.walletEndow.amount.invalid",
      defaultMessage: "Enter a valid amount.",
    });
  }

  return null;
}

export interface VaultCheckoutDialogProps {
  campaign: OctantVaultCampaignManifest;
  onClose: () => void;
}

/**
 * VaultCheckoutDialog — a fixed-height checkout sheet (shared `DialogShell`) for
 * one Octant vault campaign. It renders one focused step at a time with a pinned
 * footer action and a compact summary of decisions already made:
 *   amount → method → wallet path | card path.
 * Amount-first stays strict (no method before a valid amount); the Card path only
 * appears for the production campaign when the manifest is transaction-ready.
 * Payment-path components own their own authoritative state and report a lock
 * guard up so the sheet can prevent edits and close while a transaction is in
 * flight.
 */
export function VaultCheckoutDialog({ campaign, onClose }: VaultCheckoutDialogProps) {
  const { formatMessage } = useIntl();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountInput, setAmountInput] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod | null>(null);
  const [phase, setPhase] = useState<VaultCheckoutPhase>("amount");
  const [checkoutGuard, setCheckoutGuard] =
    useState<VaultCheckoutGuardState>(UNLOCKED_CHECKOUT_GUARD);

  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const validationKey = validateDecimalInput(amountInput, decimals);
  const amountError = getAmountErrorMessage(formatMessage, validationKey, symbol);
  const parsedAmount = useMemo(() => {
    const trimmed = amountInput.trim();
    if (!trimmed || validationKey) return null;
    try {
      return parseUnits(trimmed, decimals);
    } catch {
      return null;
    }
  }, [amountInput, decimals, validationKey]);
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

  useEffect(() => {
    if (selectedMethod && !availableMethods.includes(selectedMethod)) {
      setSelectedMethod(null);
    }
  }, [availableMethods, selectedMethod]);

  // Amount-first: direct focus to the amount field after DialogShell's open-focus
  // settles (Radix focuses the close button first), so the first checkout action
  // is ready to type. rAF avoids the autoFocus a11y rule and the focus race.
  useEffect(() => {
    if (phase !== "amount") return;
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !checkoutGuard.closeLocked) onClose();
    },
    [checkoutGuard.closeLocked, onClose]
  );

  const handleAmountChange = useCallback((value: string) => {
    setAmountInput(value);
    setSelectedMethod(null);
  }, []);

  const handleAmountContinue = useCallback(() => {
    if (hasReadyAmount && hasPaymentMethods) setPhase("method");
  }, [hasPaymentMethods, hasReadyAmount]);

  const handleMethodContinue = useCallback(() => {
    if (hasReadyAmount && selectedMethod) setPhase("pay");
  }, [hasReadyAmount, selectedMethod]);

  const handleBackToAmount = useCallback(() => {
    if (checkoutGuard.inputsLocked) return;
    setCheckoutGuard(UNLOCKED_CHECKOUT_GUARD);
    setPhase("amount");
  }, [checkoutGuard.inputsLocked]);

  const handleBackToMethod = useCallback(() => {
    if (checkoutGuard.inputsLocked) return;
    setCheckoutGuard(UNLOCKED_CHECKOUT_GUARD);
    setPhase("method");
  }, [checkoutGuard.inputsLocked]);

  const formattedAmount = hasReadyAmount && parsedAmount ? formatUnits(parsedAmount, decimals) : "";
  const methodLabel =
    selectedMethod === "card"
      ? formatMessage({ id: "public.vaults.checkout.method.card", defaultMessage: "Card" })
      : formatMessage({ id: "public.vaults.checkout.method.wallet", defaultMessage: "Wallet" });

  const amountSummaryItems = [
    {
      label: formatMessage({
        id: "public.vaults.checkout.review.amount",
        defaultMessage: "Amount",
      }),
      value: `${formattedAmount} ${symbol}`,
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
      className="vault-checkout-surface flex h-[88vh] flex-col sm:h-[640px]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 max-h-none"
    >
      {phase === "amount" ? (
        <CheckoutScreen
          footer={
            <button
              type="button"
              onClick={handleAmountContinue}
              disabled={!hasReadyAmount || !hasPaymentMethods}
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor={amountInputId} className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.walletEndow.amountLabel",
                  defaultMessage: "Amount",
                })}
              </label>
              <div className="flex items-center gap-2 rounded-none border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 transition-colors focus-within:border-primary-action">
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
                <span className="font-mono text-sm uppercase tracking-[0.12em] text-text-soft-400">
                  {symbol}
                </span>
              </div>
              <p id={amountHelpId} className="text-xs leading-[1.5] text-text-soft-400">
                {formatMessage(
                  {
                    id: "public.vaults.walletEndow.amountHelp",
                    defaultMessage: "Enter an amount in {symbol}.",
                  },
                  { symbol }
                )}
              </p>
              {amountError ? (
                <p id={amountErrorId} className="text-xs leading-[1.5] text-error-base">
                  {amountError}
                </p>
              ) : null}
            </div>
          </div>
        </CheckoutScreen>
      ) : phase === "method" ? (
        <CheckoutScreen
          footer={
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleMethodContinue}
                disabled={!hasReadyAmount || !selectedMethod}
                className={CHECKOUT_PRIMARY_BUTTON}
              >
                {formatMessage({
                  id: "public.vaults.checkout.continue",
                  defaultMessage: "Continue",
                })}
              </button>
              <button type="button" onClick={handleBackToAmount} className={CHECKOUT_GHOST_BUTTON}>
                {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-5">
            <CheckoutSummary items={amountSummaryItems} onEdit={handleBackToAmount} />

            <fieldset className="flex flex-col gap-2">
              <legend className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.checkout.method.legend",
                  defaultMessage: "How would you like to pay?",
                })}
              </legend>
              <div
                className={`grid gap-2 ${availableMethods.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                role="group"
              >
                {availableMethods.map((method) => (
                  <CheckoutMethodTile
                    key={method}
                    method={method}
                    selected={selectedMethod === method}
                    disabled={false}
                    onSelect={setSelectedMethod}
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
                            defaultMessage: "Debit or credit",
                          })
                        : formatMessage({
                            id: "public.vaults.checkout.method.walletSubtitle",
                            defaultMessage: "Connect a wallet",
                          })
                    }
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </CheckoutScreen>
      ) : selectedMethod === "wallet" && parsedAmount ? (
        <WalletEndowPath
          campaign={campaign}
          amount={parsedAmount}
          summaryItems={summaryItems}
          canEdit={!checkoutGuard.inputsLocked}
          onBack={handleBackToMethod}
          onCheckoutGuardChange={setCheckoutGuard}
        />
      ) : selectedMethod === "card" && parsedAmount ? (
        <Suspense
          fallback={
            <CheckoutScreen
              footer={
                <button
                  type="button"
                  onClick={handleBackToMethod}
                  className={CHECKOUT_GHOST_BUTTON}
                >
                  {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
                </button>
              }
            >
              <div className="flex flex-col gap-5">
                <CheckoutSummary items={summaryItems} onEdit={handleBackToMethod} />
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
            onBack={handleBackToMethod}
            onCheckoutGuardChange={setCheckoutGuard}
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
    <WalletRuntimeProviders>
      <WalletEndowPathContent
        campaign={campaign}
        amount={amount}
        summaryItems={summaryItems}
        canEdit={canEdit}
        onBack={onBack}
        onCheckoutGuardChange={onCheckoutGuardChange}
      />
    </WalletRuntimeProviders>
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
  const walletEndow = useOctantVaultWalletEndow({ errorMode: "inline" });
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [pendingSubmissionKey, setPendingSubmissionKey] = useState<string | null>(null);

  // Only a wallet-mode session is a valid Wallet Endow receiver. Restored passkey
  // / embedded sessions must still connect a wallet (PRD parity with /fund).
  const primaryWalletAddress = authMode === "wallet" ? primaryAddress : null;
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const walletFlowKey = `${campaign.slug}:${amount.toString()}:${primaryWalletAddress ?? ""}`;
  const walletFlowKeyRef = useRef(walletFlowKey);
  walletFlowKeyRef.current = walletFlowKey;
  const walletBusy = walletEndow.isPending || pendingSubmissionKey !== null;

  useEffect(() => {
    setStatus("idle");
    setPendingSubmissionKey(null);
    walletEndow.reset();
  }, [amount, campaign.slug, walletEndow]);

  useEffect(() => {
    onCheckoutGuardChange(
      walletBusy ? { inputsLocked: true, closeLocked: true } : UNLOCKED_CHECKOUT_GUARD
    );
    return () => onCheckoutGuardChange(UNLOCKED_CHECKOUT_GUARD);
  }, [onCheckoutGuardChange, walletBusy]);

  const handleSubmit = useCallback(() => {
    if (!primaryWalletAddress) {
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
  }, [amount, campaign, loginWithWallet, primaryWalletAddress, walletEndow, walletFlowKey]);

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
              id: "public.vaults.cardEndow.tupleDetailsSummary",
              defaultMessage: "Full onchain detail",
            })}
          </summary>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleChain",
                  defaultMessage: "Chain",
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
                  defaultMessage: "Vault",
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
                  defaultMessage: "Token",
                })}
              </dt>
              <dd className="break-all text-text-sub-600">
                {symbol} · {campaign.vault?.asset?.address ?? ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.cardEndow.tupleBaseUnits",
                  defaultMessage: "Base units",
                })}
              </dt>
              <dd className="text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.vaults.cardEndow.baseUnitsValue",
                    defaultMessage: "{amount} base units",
                  },
                  { amount: amount.toString() }
                )}
              </dd>
            </div>
          </dl>
        </details>

        {status === "success" ? (
          <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
            {formatMessage({
              id: "public.vaults.walletEndow.success",
              defaultMessage:
                "Wallet Endow was submitted. Route-local receipt and management proof continue in the next gates.",
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
