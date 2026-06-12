import {
  getOctantVaultAssetDisplayPolicy,
  hasRequiredOctantVaultFundingBalance,
  logger,
  validateOctantVaultCardOnrampCompletion,
  validateOctantVaultCardOnrampQuote,
  type OctantVaultCampaignManifest,
  type OctantVaultCardEndowFallbackPlan,
  type OctantVaultCardOnrampCompletionExpectation,
  useTimeout,
} from "@green-goods/shared";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Bridge, getContract, readContract, type ThirdwebClient } from "thirdweb";
import { defineChain, ethereum } from "thirdweb/chains";
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
 *
 * Must NOT pass `noopener`/`noreferrer` in the features string — that makes
 * `window.open` return null, leaving no handle to redirect and stranding the
 * donor on about:blank. The opener is severed manually instead, while the tab
 * is still same-origin.
 */
function openPendingCheckoutWindow(): Window | null {
  const checkoutWindow = window.open("about:blank", "_blank");
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
    // `replace` keeps about:blank out of the new tab's history.
    checkoutWindow.location.replace(link);
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
  /**
   * Starts the Step 3 vault deposit once every payment proof gate passed:
   * exact prepared-quote route, COMPLETED status with a non-contradicting
   * purchase tuple, and a covering WETH `balanceOf(receiver)` read.
   */
  onCardFundingSuccess: () => void;
  /**
   * Fires once per provider session when the payment is provably COMPLETED with
   * a non-contradicting tuple — possibly before the funds are visible on chain.
   * The parent uses it to persist pending-funded recovery metadata so a donor
   * who leaves during fund arrival can still finish the deposit later. It never
   * starts settlement; that stays behind `onCardFundingSuccess`.
   */
  onPaymentCompleted?: () => void;
  cardFundingComplete: boolean;
  statusBlock: ReactNode;
  /** Route facts (technical WETH details) shown alongside the payment CTA. */
  planDetails?: ReactNode;
  /** Escape hatch back to the previous step; rendered only before a session starts. */
  backButton?: ReactNode;
  /**
   * Reports whether a provider session may exist (preparing or prepared), so the
   * parent can lock checkout edits exactly while a live card payment is possible.
   */
  onPaymentSessionActiveChange?: (active: boolean) => void;
  /** Parent connect/flow error surface, rendered for continuity. */
  errorNotes?: ReactNode;
}

type PanelPhase = "ready" | "opened";
type PanelBusy = "idle" | "preparing" | "checking";
/**
 * Non-terminal status outcomes shown in place; a fully-proven COMPLETED advances
 * out of the panel. `mismatch` is the blocked branch when the provider quote or
 * session tuple stops matching this endowment; `funds_pending` is COMPLETED
 * without a covering WETH balance yet — both are recoverable, neither starts
 * approve/deposit.
 */
type PanelStatusOutcome = "pending" | "failed" | "error" | "mismatch" | "funds_pending" | null;

function getPanelThirdwebChain(chainId: number) {
  return chainId === ethereum.id ? ethereum : defineChain(chainId);
}

/**
 * VaultCardPaymentPanel — Green Goods-owned Step 2 of the /vaults Card Endow flow.
 *
 * Replaces the embedded Thirdweb `BuyWidget` with a headless `Bridge.Onramp` flow
 * the donor never sees as a provider surface: a Green Goods CTA opens secure card
 * checkout in a new tab, then the donor returns and checks payment status.
 *
 * Proof gates before the parent may start Step 3 settlement:
 * 1. The prepared quote must match the exact chain, vault asset (WETH),
 *    recovered receiver, and base-unit amount — otherwise the session is never
 *    accepted and no checkout opens.
 * 2. `Bridge.Onramp.status` must be COMPLETED and its echoed purchase tuple
 *    must not contradict the expected route.
 * 3. The recovered wallet's WETH `balanceOf(receiver)` must cover the expected
 *    amount.
 * PENDING/CREATED keep the donor here in plain copy; FAILED and any proof
 * mismatch are recoverable in place. No vault deposit starts from this panel.
 */
export default function VaultCardPaymentPanel({
  client,
  plan,
  campaign,
  summaryItems,
  onCardFundingSuccess,
  onPaymentCompleted,
  cardFundingComplete,
  statusBlock,
  planDetails,
  backButton,
  onPaymentSessionActiveChange,
  errorNotes,
}: VaultCardPaymentPanelProps) {
  const { formatMessage } = useIntl();
  const [phase, setPhase] = useState<PanelPhase>("ready");
  const [busy, setBusy] = useState<PanelBusy>("idle");
  const [session, setSession] = useState<{ id: string; link: string } | null>(null);
  const [statusOutcome, setStatusOutcome] = useState<PanelStatusOutcome>(null);
  const [error, setError] = useState<string | null>(null);
  const statusCheckInFlightRef = useRef(false);
  // The 5s funds_pending poll re-sees COMPLETED on every cycle; notify the
  // parent only once per provider session.
  const paymentCompletedSessionRef = useRef<string | null>(null);
  const prepareFailedMessage = formatMessage({
    id: "public.vaults.cardEndow.panel.prepareFailed",
    defaultMessage: "We couldn't open card checkout. Please try again.",
  });
  const quoteMismatchMessage = formatMessage({
    id: "public.vaults.cardEndow.panel.quoteMismatch",
    defaultMessage:
      "The checkout quote didn't match this endowment, so no card payment was started. Please try again.",
  });
  const sessionMismatchMessage = formatMessage({
    id: "public.vaults.cardEndow.panel.sessionMismatch",
    defaultMessage:
      "That payment session doesn't match this endowment, so the vault deposit was not started.",
  });
  const statusFailedMessage = formatMessage({
    id: "public.vaults.cardEndow.panel.statusFailed",
    defaultMessage: "We couldn't check your payment yet. Please try again.",
  });

  // The exact route this payment must fund. Provider quote and session tuple
  // are both checked against it before any settlement is allowed.
  const routeExpectation = useMemo<OctantVaultCardOnrampCompletionExpectation>(
    () => ({
      chainId: plan.cardFunding.chainId,
      tokenAddress: plan.cardFunding.tokenAddress,
      receiverAddress: plan.cardFunding.receiverAddress,
      amount: plan.cardFunding.amount,
      campaignSlug: campaign.slug,
      vaultAddress: plan.receiptExpectation.expectedVaultAddress,
    }),
    [
      campaign.slug,
      plan.cardFunding.chainId,
      plan.cardFunding.tokenAddress,
      plan.cardFunding.receiverAddress,
      plan.cardFunding.amount,
      plan.receiptExpectation.expectedVaultAddress,
    ]
  );

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
    let sawQuoteMismatch = false;
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

        // Exact-route gate: a quote that does not fund the expected chain,
        // WETH token, recovered receiver, and base-unit amount is never
        // accepted as a session — checkout stays closed for it.
        const quoteValidation = validateOctantVaultCardOnrampQuote(
          {
            chainId: prepared.intent?.chainId,
            tokenAddress: prepared.intent?.tokenAddress,
            receiver: prepared.intent?.receiver,
            amount: prepared.intent?.amount,
            destinationAmount: prepared.destinationAmount,
          },
          routeExpectation
        );
        if (quoteValidation.status !== "valid") {
          sawQuoteMismatch = true;
          logger.warn("Card endow onramp quote mismatched the expected route; blocked", {
            onramp,
            errors: quoteValidation.errors,
          });
          continue;
        }

        setSession({ id: prepared.id, link: prepared.link });
        setPhase("opened");
        setBusy("idle");
        redirectCheckoutWindow(checkoutWindow, prepared.link);
        return;
      } catch (error) {
        // Donor copy stays provider-agnostic; log internals for diagnosis only.
        logger.warn("Card endow onramp prepare failed; trying next provider", { onramp, error });
      }
    }

    closePendingCheckoutWindow(checkoutWindow);
    setBusy("idle");
    if (sawQuoteMismatch) setStatusOutcome("mismatch");
    setError(sawQuoteMismatch ? quoteMismatchMessage : prepareFailedMessage);
  }, [
    busy,
    client,
    plan.cardFunding,
    purchaseData,
    prepareFailedMessage,
    quoteMismatchMessage,
    routeExpectation,
  ]);

  /**
   * Reads the recovered wallet's vault-asset (WETH) balance. Settlement may only
   * start once this covers the expected base-unit amount — a COMPLETED provider
   * status alone is not funding proof.
   */
  const readFundingBalance = useCallback(async (): Promise<bigint> => {
    const tokenContract = getContract({
      client,
      chain: getPanelThirdwebChain(plan.cardFunding.chainId),
      address: plan.cardFunding.tokenAddress,
    });
    const result = await readContract({
      contract: tokenContract,
      method: "function balanceOf(address account) view returns (uint256)",
      params: [plan.cardFunding.receiverAddress],
    });
    return typeof result === "bigint" ? result : BigInt(String(result ?? "0"));
  }, [
    client,
    plan.cardFunding.chainId,
    plan.cardFunding.tokenAddress,
    plan.cardFunding.receiverAddress,
  ]);

  /**
   * Checks the provider session status. Background polls must be visually silent:
   * no busy flip, no upfront outcome/error clearing — only real transitions touch
   * state, so the pending notice never blinks while the 5s loop runs. Manual
   * clicks show the busy label but keep the pending notice mounted.
   */
  const runStatusCheck = useCallback(
    async (mode: "manual" | "background") => {
      if (!session || cardFundingComplete || statusCheckInFlightRef.current) return;
      if (mode === "manual" && busy !== "idle") return;
      statusCheckInFlightRef.current = true;
      if (mode === "manual") {
        setBusy("checking");
        setError(null);
      }

      try {
        const result = await Bridge.Onramp.status({ id: session.id, client });
        // Clear the busy lock before branching so no outcome can strand the button.
        if (mode === "manual") setBusy("idle");
        if (result.status === "COMPLETED") {
          // Gate 2: the echoed purchase/session tuple must not contradict the
          // expected route. A contradiction blocks settlement entirely.
          const completion = validateOctantVaultCardOnrampCompletion(
            { status: result.status, purchaseData: result.purchaseData },
            routeExpectation
          );
          if (completion.status !== "valid") {
            logger.warn("Card endow onramp session tuple contradicted the expected route", {
              errors: completion.errors,
            });
            setSession(null);
            setPhase("ready");
            setStatusOutcome("mismatch");
            setError(sessionMismatchMessage);
            return;
          }

          // The payment itself is now proven (COMPLETED + valid tuple). Let the
          // parent persist pending-funded recovery metadata before the funds
          // gate, so leaving mid-arrival never strands the donor's WETH.
          if (paymentCompletedSessionRef.current !== session.id) {
            paymentCompletedSessionRef.current = session.id;
            onPaymentCompleted?.();
          }

          // Gate 3: the recovered wallet must actually hold the expected WETH.
          const balance = await readFundingBalance();
          if (!hasRequiredOctantVaultFundingBalance(balance, plan.cardFunding.amount)) {
            setStatusOutcome("funds_pending");
            return;
          }

          // Every proof gate passed: the parent starts the deposit work.
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
      } catch (error) {
        logger.warn("Card endow onramp status check failed", { error });
        if (mode === "manual") setBusy("idle");
        setStatusOutcome("error");
        setError(statusFailedMessage);
      } finally {
        statusCheckInFlightRef.current = false;
      }
    },
    [
      busy,
      cardFundingComplete,
      session,
      client,
      onCardFundingSuccess,
      onPaymentCompleted,
      plan.cardFunding.amount,
      readFundingBalance,
      routeExpectation,
      sessionMismatchMessage,
      statusFailedMessage,
    ]
  );

  const handleCheckStatus = useCallback(() => {
    void runStatusCheck("manual");
  }, [runStatusCheck]);

  // Background status loop. `pollTick` re-arms the next poll even when the
  // outcome is unchanged (a PENDING -> PENDING cycle writes no state).
  const { set: schedulePoll, clear: clearPoll } = useTimeout();
  const [pollTick, setPollTick] = useState(0);
  useEffect(() => {
    if (!session || cardFundingComplete || statusOutcome === "error") return;
    const delay = statusOutcome === "pending" || statusOutcome === "funds_pending" ? 5_000 : 0;
    schedulePoll(() => {
      void runStatusCheck("background").finally(() => {
        setPollTick((tick) => tick + 1);
      });
    }, delay);
    return clearPoll;
  }, [
    cardFundingComplete,
    clearPoll,
    pollTick,
    runStatusCheck,
    schedulePoll,
    session,
    statusOutcome,
  ]);

  // Report when a live provider session may exist (preparing counts: a session
  // can be created even if the redirect fails) so the parent locks edits only
  // while a card payment could land. Cleanup unlocks on unmount.
  const paymentSessionActive = Boolean(session) || busy === "preparing";
  useEffect(() => {
    onPaymentSessionActiveChange?.(paymentSessionActive);
    return () => onPaymentSessionActiveChange?.(false);
  }, [onPaymentSessionActiveChange, paymentSessionActive]);

  const footer =
    phase === "ready" ? (
      <div className="flex flex-col gap-2">
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
        {backButton}
      </div>
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
            defaultMessage: "Step 2 of 3",
          })}
          title={formatMessage({
            id: "public.vaults.cardEndow.stage.fund.title",
            defaultMessage: "Secure card payment",
          })}
          description={formatMessage({
            id: "public.vaults.cardEndow.stage.fund.description",
            defaultMessage:
              "Complete card funding for the verified email wallet. The vault deposit is the next step.",
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

            {statusOutcome === "funds_pending" && !cardFundingComplete ? (
              <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.panel.fundsPending",
                  defaultMessage:
                    "Card payment confirmed. Waiting for the funds to arrive in your verified email wallet — the vault deposit starts once they land.",
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

          {planDetails}

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
