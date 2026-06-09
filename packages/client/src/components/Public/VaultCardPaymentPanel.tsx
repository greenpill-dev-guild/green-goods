import {
  getOctantVaultAssetDisplayPolicy,
  type OctantVaultCampaignManifest,
  type OctantVaultCardEndowFallbackPlan,
} from "@green-goods/shared";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Bridge, type ThirdwebClient } from "thirdweb";
import { formatUnits } from "viem";
import {
  CHECKOUT_FIELD_LABEL,
  CHECKOUT_GHOST_BUTTON,
  CHECKOUT_PRIMARY_BUTTON,
  CheckoutScreen,
  CheckoutStageHeader,
  CheckoutSummary,
  type CheckoutSummaryItem,
} from "./vaultCheckoutShell";

/**
 * Onramp providers tried in order. Stripe is the primary card route; Coinbase is a
 * controlled fallback when Stripe `prepare` fails so a transient provider outage
 * does not strand the donor. Provider names never appear in primary donor copy.
 */
const ONRAMP_PROVIDERS = ["stripe", "coinbase"] as const;

/**
 * Pre-open a blank checkout tab directly from the click gesture, then redirect it
 * after Bridge prepares the provider session. If the browser blocks it, the
 * prepared session still renders a native fallback link in this panel.
 */
function openPendingCheckoutWindow(): Window | null {
  const checkoutWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
  if (!checkoutWindow) return null;

  try {
    checkoutWindow.opener = null;
  } catch {
    // Some browsers lock opener assignment. The in-panel link still uses noopener.
  }

  return checkoutWindow;
}

function redirectCheckoutWindow(checkoutWindow: Window | null, link: string): boolean {
  if (!checkoutWindow) return false;
  try {
    checkoutWindow.location.href = link;
    return true;
  } catch {
    return false;
  }
}

function closePendingCheckoutWindow(checkoutWindow: Window | null): void {
  if (!checkoutWindow) return;
  try {
    if (!checkoutWindow.closed) checkoutWindow.close();
  } catch {
    // Best effort only. The donor remains on the recoverable in-panel error path.
  }
}

export interface VaultCardPaymentPanelProps {
  client: ThirdwebClient;
  /** Ready fallback plan — supplies the card-funding tuple and receipt expectation. */
  plan: OctantVaultCardEndowFallbackPlan;
  campaign: OctantVaultCampaignManifest;
  /** Decisions already made (amount, method, email, position holder) summary strip. */
  summaryItems: CheckoutSummaryItem[];
  /** Starts the vault deposit batch once the card payment is confirmed COMPLETED. */
  onCardFundingSuccess: () => void;
  cardFundingComplete: boolean;
  statusBlock: ReactNode;
  fallbackButton?: ReactNode;
  /** Parent connect/flow error surface, rendered for continuity. */
  errorNotes?: ReactNode;
}

type PanelPhase = "ready" | "opened";
type PanelBusy = "idle" | "preparing" | "checking";
/** Non-terminal status outcomes shown in place; COMPLETED advances out of the panel. */
type PanelStatusOutcome = "pending" | "failed" | "error" | null;

/**
 * VaultCardPaymentPanel — Green Goods-owned Step 3 of the /vaults Card Endow flow.
 *
 * Replaces the embedded Thirdweb `BuyWidget` with a headless `Bridge.Onramp` flow
 * the donor never sees as a provider surface: a Green Goods CTA opens secure card
 * checkout in a new tab, then the donor returns and checks payment status. Only a
 * COMPLETED status starts the Step 3 `approve -> deposit -> balanceOf` proof
 * path (owned by the parent). PENDING/CREATED keep the donor here in plain copy;
 * FAILED is recoverable with a retry. No vault position is treated as complete
 * until the donor returns and finishes confirmation.
 */
export default function VaultCardPaymentPanel({
  client,
  plan,
  campaign,
  summaryItems,
  onCardFundingSuccess,
  cardFundingComplete,
  statusBlock,
  fallbackButton,
  errorNotes,
}: VaultCardPaymentPanelProps) {
  const { formatMessage } = useIntl();
  const [phase, setPhase] = useState<PanelPhase>("ready");
  const [busy, setBusy] = useState<PanelBusy>("idle");
  const [session, setSession] = useState<{ id: string; link: string } | null>(null);
  const [statusOutcome, setStatusOutcome] = useState<PanelStatusOutcome>(null);
  const [error, setError] = useState<string | null>(null);
  const statusCheckInFlightRef = useRef(false);
  const prepareFailedMessage = formatMessage({
    id: "public.vaults.cardEndow.panel.prepareFailed",
    defaultMessage: "We couldn't open card checkout. Please try again.",
  });
  const statusFailedMessage = formatMessage({
    id: "public.vaults.cardEndow.panel.statusFailed",
    defaultMessage: "We couldn't check your payment yet. Please try again.",
  });

  const assetDisplay = getOctantVaultAssetDisplayPolicy(plan.cardFunding.tokenSymbol);
  const contributionAmount = useMemo(
    () => formatUnits(BigInt(plan.cardFunding.amount), plan.cardFunding.tokenDecimals),
    [plan.cardFunding.amount, plan.cardFunding.tokenDecimals]
  );

  // Tuple metadata mirrors the funding-intent proof so the provider session and the
  // later `/public/funding-intents/proof` record describe the same endowment.
  const purchaseData = useMemo(
    () => ({
      intent: "octant_vault_card_endow" as const,
      route: "/vaults" as const,
      campaignSlug: campaign.slug,
      vaultAddress: plan.receiptExpectation.expectedVaultAddress,
      tokenAddress: plan.receiptExpectation.expectedTokenAddress,
      receiverAddress: plan.receiptExpectation.receiverAddress,
      amount: plan.receiptExpectation.expectedAmount,
    }),
    [
      campaign.slug,
      plan.receiptExpectation.expectedVaultAddress,
      plan.receiptExpectation.expectedTokenAddress,
      plan.receiptExpectation.receiverAddress,
      plan.receiptExpectation.expectedAmount,
    ]
  );

  const handleOpenCheckout = useCallback(async () => {
    if (busy !== "idle") return;
    setBusy("preparing");
    setError(null);
    setStatusOutcome(null);

    const checkoutWindow = openPendingCheckoutWindow();
    const amount = BigInt(plan.cardFunding.amount);
    for (const onramp of ONRAMP_PROVIDERS) {
      try {
        const prepared = await Bridge.Onramp.prepare({
          client,
          onramp,
          chainId: plan.cardFunding.chainId,
          tokenAddress: plan.cardFunding.tokenAddress,
          receiver: plan.cardFunding.receiverAddress,
          amount,
          purchaseData,
        });
        setSession({ id: prepared.id, link: prepared.link });
        setPhase("opened");
        setBusy("idle");
        redirectCheckoutWindow(checkoutWindow, prepared.link);
        return;
      } catch {
        // Try the next configured provider without surfacing provider internals.
      }
    }

    closePendingCheckoutWindow(checkoutWindow);
    setBusy("idle");
    setError(prepareFailedMessage);
  }, [busy, client, plan.cardFunding, purchaseData, prepareFailedMessage]);

  const handleCheckStatus = useCallback(async () => {
    if (busy !== "idle" || !session || cardFundingComplete || statusCheckInFlightRef.current) {
      return;
    }
    statusCheckInFlightRef.current = true;
    setBusy("checking");
    setError(null);
    setStatusOutcome(null);

    try {
      const result = await Bridge.Onramp.status({ id: session.id, client });
      // Clear the in-flight lock before branching so no outcome can strand the button.
      setBusy("idle");
      if (result.status === "COMPLETED") {
        // Terminal forward: the parent starts the Step 3 deposit work.
        onCardFundingSuccess();
        return;
      }
      if (result.status === "FAILED") {
        setSession(null);
        setPhase("ready");
        setStatusOutcome("failed");
        return;
      }
      setStatusOutcome("pending");
    } catch {
      setBusy("idle");
      setStatusOutcome("error");
      setError(statusFailedMessage);
    } finally {
      statusCheckInFlightRef.current = false;
    }
  }, [busy, cardFundingComplete, session, client, onCardFundingSuccess, statusFailedMessage]);

  useEffect(() => {
    if (!session || cardFundingComplete || statusOutcome === "error") return;
    const delay = statusOutcome === "pending" ? 5_000 : 0;
    const timeout = window.setTimeout(() => {
      void handleCheckStatus();
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [cardFundingComplete, handleCheckStatus, session, statusOutcome]);

  const footer =
    phase === "ready" ? (
      <button
        type="button"
        disabled={busy !== "idle"}
        onClick={handleOpenCheckout}
        className={CHECKOUT_PRIMARY_BUTTON}
      >
        {busy === "preparing"
          ? formatMessage({
              id: "public.vaults.cardEndow.panel.preparing",
              defaultMessage: "Opening secure checkout...",
            })
          : formatMessage({
              id: "public.vaults.cardEndow.panel.openCheckout",
              defaultMessage: "Open secure card checkout",
            })}
      </button>
    ) : cardFundingComplete ? null : (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy !== "idle"}
          onClick={handleCheckStatus}
          className={CHECKOUT_PRIMARY_BUTTON}
        >
          {busy === "checking"
            ? formatMessage({
                id: "public.vaults.cardEndow.panel.checking",
                defaultMessage: "Checking payment...",
              })
            : formatMessage({
                id: "public.vaults.cardEndow.panel.checkStatus",
                defaultMessage: "Check payment status",
              })}
        </button>
      </div>
    );

  return (
    <CheckoutScreen footer={footer}>
      <div className="flex flex-col gap-5" data-testid="vault-card-endow-flow">
        <CheckoutStageHeader
          eyebrow={formatMessage({
            id: "public.vaults.cardEndow.stage.fund.eyebrow",
            defaultMessage: "Step 3 of 3",
          })}
          title={formatMessage({
            id: "public.vaults.cardEndow.stage.fund.title",
            defaultMessage: "Pay and deposit",
          })}
          description={formatMessage({
            id: "public.vaults.cardEndow.stage.fund.description",
            defaultMessage:
              "Complete card funding, then the verified email wallet deposits into the vault.",
          })}
        />
        <CheckoutSummary items={summaryItems} />

        <section
          className="flex flex-col gap-4"
          aria-label={formatMessage({
            id: "public.vaults.cardEndow.cardFundingRegion",
            defaultMessage: "Card payment",
          })}
          data-testid="vault-card-payment-panel"
        >
          <div className="flex flex-col gap-1">
            <span className={CHECKOUT_FIELD_LABEL}>
              {formatMessage({
                id: "public.vaults.cardEndow.tupleCampaign",
                defaultMessage: "Campaign",
              })}
            </span>
            <span className="text-sm text-text-strong-950">{campaign.displayName}</span>
            <span className="text-sm text-text-sub-600">
              {formatMessage(
                {
                  id: "public.vaults.cardEndow.panel.contribution",
                  defaultMessage:
                    "{amount} {donorSymbol} settles into the Octant vault as {settlementSymbol}",
                },
                {
                  amount: contributionAmount,
                  donorSymbol: assetDisplay.donorSymbol,
                  settlementSymbol: assetDisplay.settlementSymbol,
                }
              )}
            </span>
          </div>

          <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-3">
            {phase === "opened" && !cardFundingComplete ? (
              <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
                {formatMessage({
                  id: "public.vaults.cardEndow.panel.opened",
                  defaultMessage:
                    "Card checkout is ready. If a new tab did not open, use the secure checkout link below, then return here to confirm your vault position.",
                })}
              </p>
            ) : null}

            {statusOutcome === "pending" && !cardFundingComplete ? (
              <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.panel.pending",
                  defaultMessage:
                    "Your card payment is still processing. Finish it in the checkout tab, then check the status again.",
                })}
              </p>
            ) : null}
          </div>

          {statusOutcome === "failed" ? (
            <p
              role="alert"
              className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base"
            >
              {formatMessage({
                id: "public.vaults.cardEndow.panel.failed",
                defaultMessage:
                  "That card payment didn't go through. You can open checkout again to try once more.",
              })}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base"
            >
              {error}
            </p>
          ) : null}

          {statusBlock}

          {session ? (
            <a
              href={session.link}
              target="_blank"
              rel="noopener noreferrer"
              className={CHECKOUT_GHOST_BUTTON}
            >
              {formatMessage({
                id: "public.vaults.cardEndow.panel.openCheckoutLink",
                defaultMessage: "Open secure checkout link",
              })}
            </a>
          ) : null}

          {fallbackButton ? <div className="flex flex-col gap-2">{fallbackButton}</div> : null}

          {session ? (
            <details className="border-t border-stroke-soft-200 pt-4">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                {formatMessage({
                  id: "public.vaults.cardEndow.panel.detailsSummary",
                  defaultMessage: "Payment details",
                })}
              </summary>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-text-strong-950">
                    {formatMessage({
                      id: "public.vaults.cardEndow.panel.providerLabel",
                      defaultMessage: "Provider",
                    })}
                  </dt>
                  <dd className="text-text-sub-600">
                    {formatMessage({
                      id: "public.vaults.cardEndow.panel.providerValue",
                      defaultMessage: "Secure card checkout",
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-text-strong-950">
                    {formatMessage({
                      id: "public.vaults.cardEndow.panel.sessionLabel",
                      defaultMessage: "Checkout session",
                    })}
                  </dt>
                  <dd className="break-all font-mono text-xs text-text-sub-600">{session.id}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text-strong-950">
                    {formatMessage({
                      id: "public.vaults.cardEndow.panel.executionLabel",
                      defaultMessage: "Deposit execution",
                    })}
                  </dt>
                  <dd className="text-text-sub-600">
                    {formatMessage({
                      id: "public.vaults.cardEndow.panel.executionValue",
                      defaultMessage:
                        "EIP-7702 batch when supported; approve and deposit fallback if not.",
                    })}
                  </dd>
                </div>
              </dl>
            </details>
          ) : null}
        </section>

        {errorNotes}
      </div>
    </CheckoutScreen>
  );
}
