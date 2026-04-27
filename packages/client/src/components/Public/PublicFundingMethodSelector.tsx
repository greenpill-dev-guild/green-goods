import { type PublicGardenSummary, useAppKit, useUser } from "@green-goods/shared";
import {
  type PublicFundingAvailability,
  type PublicFundingIntentKind,
  publicProviderProofRegistry,
} from "@green-goods/shared/public-contracts";
import { RiCloseLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";

export interface PublicFundingMethodSelectorProps {
  open: boolean;
  garden: PublicGardenSummary;
  onClose: () => void;
  onWalletSelected: (intent: PublicFundingIntentKind) => void;
  onCardSelected: (
    intent: PublicFundingIntentKind,
    availability: PublicFundingAvailability
  ) => void;
}

const PROVIDER = "thirdweb" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * PublicFundingMethodSelector — two-step funding choice dialog.
 *
 * Step 1: visitor intent — `Donate` (Cookie Jar) or `Endow` (Vault).
 * Step 2: payment method — `Wallet` (Reown/wagmi, always available) or `Card`
 * (thirdweb, hidden unless the provider proof registry marks the exact tuple
 * `live`).
 *
 * Wallet connect is intentionally deferred to the wallet-required step — only
 * then does this dialog open AppKit. Donate copy stays support-only and avoids
 * tax-deductibility / charitable / nonprofit / legal-receipt claims; Endow
 * copy uses "designed to preserve" language with explicit risk.
 */
export function PublicFundingMethodSelector({
  open,
  garden,
  onClose,
  onWalletSelected,
  onCardSelected,
}: PublicFundingMethodSelectorProps) {
  const { formatMessage } = useIntl();
  const { open: openWalletModal } = useAppKit();
  const { primaryAddress } = useUser();
  const [step, setStep] = useState<"intent" | "method">("intent");
  const [intent, setIntent] = useState<PublicFundingIntentKind | null>(null);

  useEffect(() => {
    if (open) {
      setStep("intent");
      setIntent(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const cardAvailability = useMemo(() => {
    if (!intent) return null;
    // The exact destination tuple comes from indexer-backed reads when the
    // card flow lights up. Until the provider proof registry has a `live`
    // entry for the exact (garden, destination, intent, method, chain, token,
    // provider) tuple, this resolve returns `hidden`. The lookup uses the
    // garden's primary address as a destination placeholder — the registry is
    // keyed on the exact destination, so unproven tuples remain hidden.
    return publicProviderProofRegistry.resolve({
      gardenKey: garden.id,
      destinationType: intent === "donate" ? "cookieJar" : "vault",
      destinationAddress: ZERO_ADDRESS,
      fundingIntent: intent,
      paymentMethod: "card",
      chainId: 0,
      token: ZERO_ADDRESS,
      provider: PROVIDER,
    });
  }, [garden, intent]);

  const handlePickIntent = useCallback((kind: PublicFundingIntentKind) => {
    setIntent(kind);
    setStep("method");
  }, []);

  const handleWalletConfirm = useCallback(() => {
    if (!intent) return;
    if (!primaryAddress) {
      openWalletModal();
      return;
    }
    onWalletSelected(intent);
    onClose();
  }, [intent, primaryAddress, openWalletModal, onWalletSelected, onClose]);

  const handleCardConfirm = useCallback(() => {
    if (!intent || !cardAvailability || cardAvailability.state !== "live") return;
    onCardSelected(intent, cardAvailability);
    onClose();
  }, [intent, cardAvailability, onCardSelected, onClose]);

  if (!open) return null;

  const title =
    step === "intent"
      ? formatMessage(
          { id: "public.fund.dialog.intentTitle", defaultMessage: "Support {garden}" },
          { garden: garden.name }
        )
      : formatMessage({
          id: "public.fund.dialog.methodTitle",
          defaultMessage: "Choose how to pay",
        });

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-static-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-fund-dialog-title"
    >
      <button
        type="button"
        aria-label={formatMessage({ id: "public.fund.dialog.close", defaultMessage: "Close" })}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-t-3xl bg-bg-white-0 p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
        <header className="mb-5 flex items-start justify-between gap-3">
          <h2
            id="public-fund-dialog-title"
            className="font-serif text-xl text-text-strong-950 md:text-2xl"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label={formatMessage({ id: "public.fund.dialog.close", defaultMessage: "Close" })}
            onClick={onClose}
            className="rounded-full p-1 text-text-sub-600 transition-colors hover:bg-bg-weak-50"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>

        {step === "intent" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handlePickIntent("donate")}
              className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 text-left transition-colors hover:border-primary-base hover:bg-bg-weak-50"
            >
              <div className="text-base font-semibold text-text-strong-950">
                {formatMessage({ id: "public.fund.dialog.donate.title", defaultMessage: "Donate" })}
              </div>
              <p className="mt-1 text-sm text-text-sub-600">
                {formatMessage({
                  id: "public.fund.dialog.donate.description",
                  defaultMessage:
                    "Direct support through this Garden's Cookie Jar to fund verified Work.",
                })}
              </p>
            </button>

            <button
              type="button"
              onClick={() => handlePickIntent("endow")}
              className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 text-left transition-colors hover:border-primary-base hover:bg-bg-weak-50"
            >
              <div className="text-base font-semibold text-text-strong-950">
                {formatMessage({ id: "public.fund.dialog.endow.title", defaultMessage: "Endow" })}
              </div>
              <p className="mt-1 text-sm text-text-sub-600">
                {formatMessage({
                  id: "public.fund.dialog.endow.description",
                  defaultMessage:
                    "A Vault deposit designed to preserve your principal while yield supports the Garden.",
                })}
              </p>
              <p className="mt-2 text-xs text-text-soft-400">
                {formatMessage({
                  id: "public.fund.dialog.endow.risk",
                  defaultMessage:
                    "Risk: smart contract, token, yield, provider, and wallet recovery risks apply.",
                })}
              </p>
            </button>

            <p className="mt-2 text-xs text-text-soft-400">
              {formatMessage({
                id: "public.fund.dialog.taxDisclaimer",
                defaultMessage:
                  "Donate and Endow support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured.",
              })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleWalletConfirm}
              className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 text-left transition-colors hover:border-primary-base hover:bg-bg-weak-50"
            >
              <div className="text-base font-semibold text-text-strong-950">
                {formatMessage({ id: "public.fund.dialog.wallet.title", defaultMessage: "Wallet" })}
              </div>
              <p className="mt-1 text-sm text-text-sub-600">
                {formatMessage({
                  id: primaryAddress
                    ? "public.fund.dialog.wallet.descriptionConnected"
                    : "public.fund.dialog.wallet.descriptionDisconnected",
                  defaultMessage: primaryAddress
                    ? "Sign a transaction with your connected wallet."
                    : "Connect a wallet at the next step.",
                })}
              </p>
            </button>

            {cardAvailability && cardAvailability.state === "live" ? (
              <button
                type="button"
                onClick={handleCardConfirm}
                className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 text-left transition-colors hover:border-primary-base hover:bg-bg-weak-50"
              >
                <div className="text-base font-semibold text-text-strong-950">
                  {formatMessage({ id: "public.fund.dialog.card.title", defaultMessage: "Card" })}
                </div>
                <p className="mt-1 text-sm text-text-sub-600">
                  {formatMessage({
                    id: "public.fund.dialog.card.description",
                    defaultMessage: "Pay by credit card; provider settles into the Garden onchain.",
                  })}
                </p>
                {intent === "endow" ? (
                  <p className="mt-2 text-xs text-text-soft-400">
                    {formatMessage({
                      id: "public.fund.dialog.card.endowNote",
                      defaultMessage:
                        "Card Endow creates or recovers an embedded wallet that holds your Vault shares.",
                    })}
                  </p>
                ) : null}
              </button>
            ) : cardAvailability && cardAvailability.state === "comingSoon" ? (
              <div className="rounded-2xl border border-dashed border-stroke-soft-200 bg-bg-weak-50 p-5">
                <div className="text-base font-semibold text-text-soft-400">
                  {formatMessage({
                    id: "public.fund.dialog.card.comingSoon",
                    defaultMessage: "Card payments coming soon",
                  })}
                </div>
                <p className="mt-1 text-xs text-text-soft-400">
                  {formatMessage({
                    id: "public.fund.dialog.card.comingSoonDescription",
                    defaultMessage:
                      "We're proving the card flow for this Garden's funding path before enabling it publicly.",
                  })}
                </p>
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("intent")}
                className="rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2 text-sm font-medium text-text-strong-950 transition-colors hover:bg-bg-weak-50"
              >
                {formatMessage({ id: "public.fund.dialog.back", defaultMessage: "Back" })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
