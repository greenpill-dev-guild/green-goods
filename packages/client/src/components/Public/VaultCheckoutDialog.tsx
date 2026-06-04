import {
  prepareOctantVaultWalletEndow,
  type OctantVaultCampaignManifest,
  useAuth,
  useOctantVaultWalletEndow,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import {
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { EditorialKicker } from "@/components/Public/atoms";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";

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

type CheckoutMethod = "card" | "wallet";
export interface VaultCheckoutGuardState {
  inputsLocked: boolean;
  closeLocked: boolean;
}

const UNLOCKED_CHECKOUT_GUARD: VaultCheckoutGuardState = {
  inputsLocked: false,
  closeLocked: false,
};

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
 * VaultCheckoutDialog — single guided checkout for one Octant vault campaign,
 * mirroring the /fund PublicFundingCard anatomy (overlay, mono kicker, editorial
 * serif heading, amount-first, method picker as visual cards). Amount is entered
 * once and shared by both payment paths; the Card path only appears for the
 * production campaign and only after a valid amount.
 */
export function VaultCheckoutDialog({ campaign, onClose }: VaultCheckoutDialogProps) {
  const { formatMessage } = useIntl();
  const titleId = useId();
  const amountInputId = useId();
  const amountHelpId = useId();
  const amountErrorId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountInput, setAmountInput] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod | null>(null);
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

  // Card stays gated to the production campaign; every other complete manifest
  // offers Wallet only, so an un-reviewed vault never surfaces a card affordance.
  const availableMethods: CheckoutMethod[] = isProductionCardEndowCampaign(campaign)
    ? ["card", "wallet"]
    : ["wallet"];
  // The method picker is the explicit commit point — neither Thirdweb nor AppKit
  // mounts until the user picks. It appears only after a valid amount.
  const showMethodPicker = hasReadyAmount;

  // Amount-first: focus the amount field on open (avoids the autoFocus a11y rule).
  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  // Escape closes the checkout (mirrors PublicFundingCard).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !checkoutGuard.closeLocked) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [checkoutGuard.closeLocked, onClose]);

  const activeMethod = hasReadyAmount ? selectedMethod : null;
  const closeLabel = formatMessage({ id: "public.fund.dialog.close", defaultMessage: "Close" });
  const handleClose = useCallback(() => {
    if (!checkoutGuard.closeLocked) onClose();
  }, [checkoutGuard.closeLocked, onClose]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-static-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0"
        onClick={handleClose}
        disabled={checkoutGuard.closeLocked}
      />
      <div
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto bg-bg-white-0 p-6 shadow-[var(--shadow-editorial-panel)] sm:max-w-md sm:p-8"
        data-component="VaultCheckoutDialog"
        data-step={activeMethod ?? (showMethodPicker ? "method" : "amount")}
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <EditorialKicker>
              {`§ ${formatMessage({ id: "public.vaults.endow.kicker", defaultMessage: "Endow" }).toUpperCase()}`}
            </EditorialKicker>
            <h2
              id={titleId}
              className="font-serif text-xl font-normal leading-[1.1] text-text-strong-950 md:text-2xl"
            >
              {formatMessage({ id: "public.vaults.checkout.title", defaultMessage: "Endow to" })}
              <br />
              <span className="text-text-sub-600">{campaign.displayName}</span>
            </h2>
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={handleClose}
            disabled={checkoutGuard.closeLocked}
            className="rounded-full p-1 text-text-sub-600 transition-colors hover:bg-bg-weak-50"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={amountInputId}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
            >
              {formatMessage({
                id: "public.vaults.walletEndow.amountLabel",
                defaultMessage: "Amount",
              })}
            </label>
            <div className="flex items-center gap-2 border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 transition-colors focus-within:border-primary-action">
              <input
                ref={amountRef}
                id={amountInputId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountInput}
                aria-describedby={amountError ? `${amountHelpId} ${amountErrorId}` : amountHelpId}
                aria-invalid={Boolean(amountError)}
                disabled={checkoutGuard.inputsLocked}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent font-serif text-2xl text-text-strong-950 outline-none placeholder:text-text-soft-400 disabled:cursor-not-allowed disabled:text-text-soft-400"
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

          {showMethodPicker ? (
            <MethodPicker
              methods={availableMethods}
              selected={selectedMethod}
              onSelect={setSelectedMethod}
              disabled={checkoutGuard.inputsLocked}
            />
          ) : null}

          {activeMethod === "wallet" && parsedAmount ? (
            <WalletEndowPath
              campaign={campaign}
              amount={parsedAmount}
              onCheckoutGuardChange={setCheckoutGuard}
            />
          ) : null}

          {activeMethod === "card" && parsedAmount ? (
            <Suspense
              fallback={
                <p className="rounded-2xl bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                  {formatMessage({
                    id: "public.vaults.cardEndow.loading",
                    defaultMessage: "Loading Card Endow...",
                  })}
                </p>
              }
            >
              <VaultCardEndowFlow
                campaign={campaign}
                amount={parsedAmount}
                onCheckoutGuardChange={setCheckoutGuard}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MethodPicker({
  methods,
  selected,
  onSelect,
  disabled,
}: {
  methods: readonly CheckoutMethod[];
  selected: CheckoutMethod | null;
  onSelect: (method: CheckoutMethod) => void;
  disabled: boolean;
}) {
  const { formatMessage } = useIntl();
  const copy: Record<CheckoutMethod, { label: string; subtitle: string }> = {
    card: {
      label: formatMessage({ id: "public.vaults.checkout.method.card", defaultMessage: "Card" }),
      subtitle: formatMessage({
        id: "public.vaults.checkout.method.cardSubtitle",
        defaultMessage: "Debit or credit",
      }),
    },
    wallet: {
      label: formatMessage({
        id: "public.vaults.checkout.method.wallet",
        defaultMessage: "Wallet",
      }),
      subtitle: formatMessage({
        id: "public.vaults.checkout.method.walletSubtitle",
        defaultMessage: "Connect a wallet",
      }),
    },
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {formatMessage({
          id: "public.vaults.checkout.method.legend",
          defaultMessage: "How would you like to pay?",
        })}
      </legend>
      <div
        className={`grid gap-2 ${methods.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        role="group"
      >
        {methods.map((method) => {
          const isSelected = selected === method;
          return (
            <button
              key={method}
              type="button"
              data-testid={`vault-checkout-method-${method}`}
              onClick={() => onSelect(method)}
              aria-pressed={isSelected}
              disabled={disabled}
              className={`flex flex-col items-start gap-0.5 border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-primary-action bg-editorial-warm"
                  : "border-stroke-soft-200 bg-bg-white-0 hover:bg-editorial-warm/40"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="font-serif text-base text-text-strong-950">
                {copy[method].label}
              </span>
              <span className="text-[11px] text-text-soft-400">{copy[method].subtitle}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function WalletEndowPath({
  campaign,
  amount,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  return (
    <WalletRuntimeProviders>
      <WalletEndowPathContent
        campaign={campaign}
        amount={amount}
        onCheckoutGuardChange={onCheckoutGuardChange}
      />
    </WalletRuntimeProviders>
  );
}

function WalletEndowPathContent({
  campaign,
  amount,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
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
  const decimals = campaign.vault?.asset?.decimals ?? 18;
  const symbol =
    campaign.vault?.asset?.symbol ??
    formatMessage({ id: "public.vaults.walletEndow.assetFallback", defaultMessage: "tokens" });
  const formattedAmount = formatUnits(amount, decimals);
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

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

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
    },
    [amount, campaign, loginWithWallet, primaryWalletAddress, walletEndow, walletFlowKey]
  );

  const actionLabel = primaryWalletAddress
    ? formatMessage({
        id: "public.vaults.walletEndow.confirm",
        defaultMessage: "Confirm Wallet Endow",
      })
    : formatMessage({ id: "public.vaults.walletEndow.connect", defaultMessage: "Connect Wallet" });

  return (
    <form
      className="flex flex-col gap-4 border-t border-stroke-soft-200 pt-5"
      onSubmit={handleSubmit}
      data-testid="vault-wallet-endow-path"
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({
              id: "public.vaults.checkout.review.amount",
              defaultMessage: "Amount",
            })}
          </dt>
          <dd className="mt-1 font-medium text-text-strong-950">
            {formatMessage(
              {
                id: "public.vaults.walletEndow.confirmAmount",
                defaultMessage: "{amount} {symbol}",
              },
              { amount: formattedAmount, symbol }
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({
              id: "public.vaults.checkout.review.campaign",
              defaultMessage: "Campaign",
            })}
          </dt>
          <dd className="mt-1 text-text-sub-600">{campaign.displayName}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({
              id: "public.vaults.checkout.review.receiver",
              defaultMessage: "Receiver wallet",
            })}
          </dt>
          <dd className="mt-1 break-all font-mono text-xs text-text-sub-600">
            {primaryWalletAddress ??
              formatMessage({
                id: "public.vaults.checkout.review.receiverPending",
                defaultMessage: "Set when you connect a wallet",
              })}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
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
      </dl>

      <details className="rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-4">
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
              {formatMessage({ id: "public.vaults.cardEndow.tupleVault", defaultMessage: "Vault" })}
            </dt>
            <dd className="break-all font-mono text-xs text-text-sub-600">
              {campaign.vault?.vaultAddress ?? ""}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({ id: "public.vaults.cardEndow.tupleToken", defaultMessage: "Token" })}
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

      <button
        type="submit"
        disabled={walletBusy}
        className="min-h-12 w-full rounded-full bg-text-strong-950 px-6 py-3 text-sm font-semibold text-static-white transition-colors disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400"
      >
        {walletBusy
          ? formatMessage({
              id: "public.vaults.walletEndow.submitting",
              defaultMessage: "Submitting...",
            })
          : actionLabel}
      </button>

      {status === "success" ? (
        <p className="rounded-2xl bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
          {formatMessage({
            id: "public.vaults.walletEndow.success",
            defaultMessage:
              "Wallet Endow was submitted. Route-local receipt and management proof continue in the next gates.",
          })}
        </p>
      ) : null}
      {walletEndow.error ? (
        <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {formatMessage({
            id: "public.vaults.walletEndow.error",
            defaultMessage:
              "Wallet Endow could not be submitted. Review the wallet error and retry.",
          })}
        </p>
      ) : null}
    </form>
  );
}
