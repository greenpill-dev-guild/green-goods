import { logger, useApp, useInstallGuidance, usePublicInstallHandler } from "@green-goods/shared";
import type {
  PublicFundingReceipt as PublicFundingReceiptShape,
  ReadFundingIntentReceiptResponse,
} from "@green-goods/shared/public-contracts";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import {
  RECEIPT_TOKEN_SESSION_KEY,
  scrubReceiptTokenFragmentFromLocation,
} from "@/routes/receipt-token";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export interface PublicFundingReceiptProps {
  intentId: string;
}

type State =
  | { status: "loading" }
  | { status: "ready"; receipt: PublicFundingReceiptShape }
  | { status: "error"; messageId: string };

/**
 * PublicFundingReceipt — reads `?intent=<id>` plus the in-memory receipt
 * token (already moved out of the URL fragment by the root pre-pageview
 * scrub) and fetches the public-safe receipt.
 *
 * Renders only redacted public fields. Never logs or surfaces the raw token.
 */
export function PublicFundingReceipt({ intentId }: PublicFundingReceiptProps) {
  const { formatMessage } = useIntl();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return;
    // Defensive: re-run scrub in case the receipt view mounts after a hash
    // has been added by a downstream router transition.
    scrubReceiptTokenFragmentFromLocation(window);
    const token = window.sessionStorage.getItem(RECEIPT_TOKEN_SESSION_KEY);
    if (!token) {
      setState({ status: "error", messageId: "public.fund.receipt.error.missingToken" });
      return;
    }
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/public/funding-intents/${encodeURIComponent(intentId)}`,
          {
            method: "GET",
            headers: { "X-GG-Receipt-Token": token },
          }
        );
        const json = (await response.json()) as ReadFundingIntentReceiptResponse;
        if (cancelled) return;
        if (response.ok && "ok" in json && json.ok) {
          setState({ status: "ready", receipt: json.publicReceipt });
        } else {
          const code = json && "errorCode" in json ? json.errorCode : "internal_error";
          setState({ status: "error", messageId: `public.fund.receipt.error.${code}` });
        }
      } catch (error) {
        if (cancelled) return;
        logger.warn("[PublicFundingReceipt] fetch failed", { error });
        setState({ status: "error", messageId: "public.fund.receipt.error.network" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  const formatStatus = useCallback(
    (status: PublicFundingReceiptShape["status"]) =>
      formatMessage({
        id: `public.fund.receipt.status.${status}`,
        defaultMessage: status,
      }),
    [formatMessage]
  );

  if (state.status === "loading") {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-stroke-soft-200 bg-bg-white-0 p-8 shadow-sm">
        <p className="text-sm text-text-sub-600">
          {formatMessage({
            id: "public.fund.receipt.loading",
            defaultMessage: "Loading your receipt…",
          })}
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-stroke-soft-200 bg-bg-white-0 p-8 shadow-sm">
        <h2 className="font-serif text-2xl text-text-strong-950">
          {formatMessage({
            id: "public.fund.receipt.errorTitle",
            defaultMessage: "We couldn't load this receipt",
          })}
        </h2>
        <p className="mt-3 text-sm text-text-sub-600">
          {formatMessage({
            id: state.messageId,
            defaultMessage: "Please try opening the link from your email again.",
          })}
        </p>
        <Link
          to="/fund"
          className="mt-6 inline-flex rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-2.5 text-sm font-medium text-text-strong-950 hover:bg-bg-weak-50"
        >
          {formatMessage({
            id: "public.fund.receipt.backToFund",
            defaultMessage: "Back to Fund",
          })}
        </Link>
      </section>
    );
  }

  const { receipt } = state;
  const showAppCta = receipt.appManagementCta !== undefined && receipt.appManagementCta !== null;
  return <ReceiptBody receipt={receipt} showAppCta={showAppCta} />;
}

function ReceiptBody({
  receipt,
  showAppCta,
}: {
  receipt: PublicFundingReceiptShape;
  showAppCta: boolean;
}) {
  const { formatMessage } = useIntl();
  const { isMobile, platform, isInstalled, wasInstalled, deferredPrompt, promptInstall } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );
  const handleInstallClick = usePublicInstallHandler(guidance, promptInstall);

  return (
    <section
      className="mx-auto max-w-2xl rounded-3xl border border-stroke-soft-200 bg-bg-white-0 p-8 shadow-sm"
      aria-labelledby="public-fund-receipt-title"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
        {formatMessage({ id: "public.fund.receipt.label", defaultMessage: "Funding receipt" })}
      </p>
      <h2
        id="public-fund-receipt-title"
        className="mt-2 font-serif text-2xl text-text-strong-950 md:text-3xl"
      >
        {receipt.garden.name}
      </h2>
      {receipt.garden.location ? (
        <p className="mt-1 text-sm text-text-soft-400">{receipt.garden.location}</p>
      ) : null}

      <dl className="mt-6 grid gap-4 text-sm">
        <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 pb-3">
          <dt className="text-text-sub-600">
            {formatMessage({ id: "public.fund.receipt.intent", defaultMessage: "Intent" })}
          </dt>
          <dd className="text-right font-medium text-text-strong-950">
            {formatMessage({
              id: `public.fund.receipt.intent.${receipt.fundingIntent}`,
              defaultMessage: receipt.fundingIntent,
            })}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 pb-3">
          <dt className="text-text-sub-600">
            {formatMessage({ id: "public.fund.receipt.amount", defaultMessage: "Amount" })}
          </dt>
          <dd className="text-right font-medium text-text-strong-950">
            {receipt.amount.amountUsd} USD
            {receipt.amount.fundedAssetAmount ? (
              <span className="block text-xs text-text-soft-400">
                {receipt.amount.fundedAssetAmount}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 pb-3">
          <dt className="text-text-sub-600">
            {formatMessage({ id: "public.fund.receipt.status", defaultMessage: "Status" })}
          </dt>
          <dd className="text-right font-medium text-text-strong-950">
            {formatStatus(receipt.status)}
          </dd>
        </div>
        {receipt.fundingTxHash ? (
          <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 pb-3">
            <dt className="text-text-sub-600">
              {formatMessage({
                id: "public.fund.receipt.txHash",
                defaultMessage: "Transaction",
              })}
            </dt>
            <dd className="break-all text-right font-mono text-xs text-text-strong-950">
              {receipt.fundingTxHash}
            </dd>
          </div>
        ) : null}
        {receipt.receiverAddress && receipt.fundingIntent === "endow" ? (
          <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 pb-3">
            <dt className="text-text-sub-600">
              {formatMessage({
                id: "public.fund.receipt.receiver",
                defaultMessage: "Receiver wallet",
              })}
            </dt>
            <dd className="break-all text-right font-mono text-xs text-text-strong-950">
              {receipt.receiverAddress}
            </dd>
          </div>
        ) : null}
      </dl>

      {receipt.fundingIntent === "endow" ? (
        <p className="mt-6 rounded-2xl bg-bg-weak-50 p-4 text-xs text-text-sub-600">
          {formatMessage({
            id: "public.fund.receipt.endowRecovery",
            defaultMessage:
              "Your Endow position lives in a recoverable wallet. Install the app to manage Vault shares and recovery options.",
          })}
        </p>
      ) : null}

      {showAppCta ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#install"
            onClick={handleInstallClick}
            data-app-cta={receipt.appManagementCta}
            data-install-action={guidance.primaryAction.type}
            className="rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground hover:bg-primary-action-hover"
          >
            {formatMessage({
              id:
                receipt.appManagementCta === "open_app"
                  ? "public.nav.openApp"
                  : "public.nav.installApp",
              defaultMessage: receipt.appManagementCta === "open_app" ? "Open App" : "Install App",
            })}
          </a>
        </div>
      ) : null}
    </section>
  );
}
