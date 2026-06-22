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
 * Onramp providers tried in order. Coinbase is the primary card route because it
 * onramps the donor straight to ETH (which Bridge wraps into the vault's WETH) at
 * roughly the same fiat cost, instead of selling a USDC intermediate first; Stripe
 * is the controlled fallback when Coinbase `prepare` fails so a transient provider
 * outage does not strand the donor. Provider names never appear in primary donor
 * copy.
 */
const ONRAMP_PROVIDERS = ["coinbase", "stripe"] as const;

/**
 * EVM native-token placeholder, passed as the onramp intermediate so providers
 * sell ETH (wrapped to the vault's WETH by Bridge) rather than defaulting to a
 * USDC -> WETH swap the donor would see as a stablecoin step. Verified against
 * both providers: the receiver always settles in WETH. Inlined to avoid a brittle
 * minified subpath export from `thirdweb/utils`.
 */
const ONRAMP_INTERMEDIATE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Open the prepared checkout link in a new tab directly from the click gesture.
 * The session is prefetched, so the link is known synchronously — there is no
 * async gap for a popup blocker to catch and no `about:blank` placeholder tab to
 * strand the donor on while a provider session prepares. `noopener` severs the
 * opener for the external provider page; the in-panel link below is the fallback
 * if the browser still blocks the popup.
 */
function openCheckoutTab(link: string): void {
  window.open(link, "_blank", "noopener");
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

  const prepareSession = useCallback(async () => {
    if (busy !== "idle" || session || cardFundingComplete) return;
    setBusy("preparing");
    setError(null);
    setStatusOutcome(null);

    const amount = BigInt(plan.cardFunding.amount);
    let sawQuoteMismatch = false;
    for (const onramp of ONRAMP_PROVIDERS) {
      try {
        const prepared = await Bridge.Onramp.prepare({
          client,
          onramp,
          chainId: plan.cardFunding.chainId,
          tokenAddress: plan.cardFunding.tokenAddress,
          // Onramp to ETH (Bridge wraps it into the vault's WETH) so the donor
          // never sees a USDC step. Coinbase does this at ~parity cost; the Stripe
          // fallback stays on ETH too for a consistent donor experience.
          onrampTokenAddress: ONRAMP_INTERMEDIATE_TOKEN_ADDRESS,
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
        setBusy("idle");
        return;
      } catch (error) {
        // Donor copy stays provider-agnostic; log internals for diagnosis only.
        logger.warn("Card endow onramp prepare failed; trying next provider", { onramp, error });
      }
    }

    setBusy("idle");
    if (sawQuoteMismatch) setStatusOutcome("mismatch");
    setError(sawQuoteMismatch ? quoteMismatchMessage : prepareFailedMessage);
  }, [
    busy,
    session,
    cardFundingComplete,
    client,
    plan.cardFunding,
    purchaseData,
    prepareFailedMessage,
    quoteMismatchMessage,
    routeExpectation,
  ]);

  // Prefetch the onramp session the moment the donor reaches the pay step so the
  // secure checkout link is ready the instant they continue — no blank tab and no
  // wait for `prepare` to round-trip. Preparing a quote is not a payment; the
  // settlement gates still require the donor to open checkout and complete it.
  const prefetchStartedRef = useRef(false);
  useEffect(() => {
    if (prefetchStartedRef.current) return;
    prefetchStartedRef.current = true;
    void prepareSession();
  }, [prepareSession]);

  // The link is already prepared, so opening is synchronous within the click
  // gesture. Entering `opened` is the consent point where a card payment can land,
  // so the parent locks checkout edits from here (never merely from a prefetched
  // session). If a prefetch failed, the same control retries the preparation.
  const handleOpenCheckout = useCallback(() => {
    if (!session) {
      void prepareSession();
      return;
    }
    openCheckoutTab(session.link);
    setPhase("opened");
  }, [session, prepareSession]);

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
    // Only poll once the donor has opened checkout — a prefetched session sits in
    // `ready` with no payment in flight, so polling it then would be premature.
    if (phase !== "opened" || !session || cardFundingComplete || statusOutcome === "error") return;
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
    phase,
    pollTick,
    runStatusCheck,
    schedulePoll,
    session,
    statusOutcome,
  ]);

  // A card payment can only land once the donor has opened checkout, so the parent
  // locks edits from `opened` onward — never merely because a session was
  // prefetched in `ready`. Cleanup unlocks on unmount.
  const paymentSessionActive = phase === "opened";
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

          {session && phase === "opened" ? (
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

          {session && phase === "opened" ? (
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
