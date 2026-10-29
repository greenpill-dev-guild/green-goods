import {
  type CommitmentDerivedState,
  isDemoPoolingActive,
  type ServiceAccessAction,
  type ServiceAccessKey,
  type ServiceAccessSnapshot,
  serviceVoucherHolder,
  useServiceAccessMutation,
  useVoucherIssuerApproval,
  useVoucherWallet,
} from "@green-goods/shared/commitment-pooling";
import { RiExchangeLine, RiQuestionLine } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import type { Hex } from "viem";
import { APP_ROUTES } from "@/config/pwaRouting";
import { CommitmentActionBar } from "./CommitmentActionBar";
import type { CommitmentIdentityProps } from "./CommitmentIdentity";
import { type EarnedAgreeOutcome, EarnedRewardAgreeSheet } from "./EarnedRewardAgreeSheet";
import { JoinToActDoor } from "./JoinToAct";
import { ServiceAccessPanel } from "./ServiceAccessPanel";
import { ServiceAccessSection } from "./ServiceAccessSection";
import { ServiceBookingSheets, type ServiceSheet } from "./ServiceBookingSheets";
import type { ServiceRedeemOutcome } from "./ServiceRedeemSheet";
import { ServiceRewardsSection } from "./ServiceRewardsSection";
import {
  activateStep,
  agreeStep,
  cancelStep,
  depositStep,
  earnedAgreeStep,
  legStep,
  retryConfirmStep,
  runServiceAct,
  type ServiceActEnd,
  type ServiceActStep,
  serviceActOffered,
  splitStep,
  unsentLegStep,
} from "./serviceActs";
import {
  bookingVoucherIssuer,
  formatVoucherMessage,
  isServiceAccessPromise,
  serviceBookingView,
} from "./serviceBooking";
import type { ServiceActKind, ServiceBookingView } from "./serviceBookingTypes";
import {
  exchangeAvailable,
  exchangeQuoteFromPilot,
  exchangeStep,
  smallerExchangeInput,
} from "./serviceExchange";
import { serviceRewardsView } from "./serviceRewards";
import { VoucherPilotJourney } from "./VoucherPilotJourney";

/** What a voucher booking or a request's rewards hand the promise page. */
export interface ServicePromiseParts {
  band: CommitmentIdentityProps["serviceBand"];
  /** The door under the band and the service's section card, in the page's order. */
  body: ReactNode;
  /** The service's own bar, or null when the promise's act leads. */
  bar: ReactNode | null;
  delivery: ServiceBookingView["delivery"];
  bookingLines: ServiceBookingView["events"];
  /** Promise kept? after a booking's split: the strip, the split and its note. */
  confirm: ServiceBookingView["confirm"];
  /** A request's rewards draw in their own section, which leads with the vouchers. */
  rewards: boolean;
  sheets: ReactNode;
}

export interface ServicePromiseProps {
  serviceKey: ServiceAccessKey | null;
  /** The page's read of the service, which also settles its own acts. */
  access: { data?: ServiceAccessSnapshot | null; refetch: () => unknown };
  coreState: CommitmentDerivedState;
  /** The request's garden, whose pool pays any G$. */
  gardenName: string;
  heading: string;
  /** The promise has its own act (Confirm It Was Kept), which leads where the booking has none. */
  hasCoreAct: boolean;
  isOnline: boolean;
  /** Report a Problem raises a dispute, which the chain takes only from some readers. */
  onReport: (() => void) | null;
  /**
   * The reader's take-up of a request, when the page offers one: at once (open) or by asking its
   * stewards. A request's voucher reward is agreed to first, from the reward's own bar.
   */
  takeUp: { mode: "open" | "reviewed"; run: () => void } | null;
  children: (parts: ServicePromiseParts) => ReactNode;
}

/**
 * A voucher booking, or a request's rewards, on the promise page. It reads the voucher wallet
 * and the issuer's approval, keeps the booking's sheets, and runs each member act one write at
 * a time, each only when the shared selector offers it. The page places what it returns.
 */
export function ServicePromise({
  serviceKey,
  access,
  coreState,
  gardenName,
  heading,
  hasCoreAct,
  isOnline,
  onReport,
  takeUp,
  children,
}: ServicePromiseProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const mutation = useServiceAccessMutation(serviceKey);
  const snapshot = access.data ?? null;
  const walletChain = snapshot?.key.sourceChainId;
  const walletModule = snapshot?.key.coreModule;
  // The vouchers are the holder's, who need not be the member who agreed.
  const walletAccount = snapshot ? serviceVoucherHolder(snapshot) : undefined;
  const walletScope = useMemo(
    () =>
      walletChain !== undefined && walletModule && walletAccount
        ? { sourceChainId: walletChain, coreModule: walletModule, account: walletAccount }
        : null,
    [walletChain, walletModule, walletAccount]
  );
  const wallet = useVoucherWallet(walletScope).data;
  const issuer = bookingVoucherIssuer(snapshot, wallet?.issuers);
  const approval = useVoucherIssuerApproval(issuer).data ?? null;
  const [sheet, setSheet] = useState<ServiceSheet>(null);
  const [outcome, setOutcome] = useState<ServiceRedeemOutcome>(null);
  const [reviewed, setReviewed] = useState<{ revision: bigint; units: bigint } | null>(null);
  const [running, setRunning] = useState(false);
  const [reviewingExchange, setReviewingExchange] = useState(false);
  // The reward terms as the member opened Agree to the Rewards: what they agree to.
  const [agreeing, setAgreeing] = useState<{ revision: bigint; termsHash: Hex } | null>(null);
  const [agreeOutcome, setAgreeOutcome] = useState<EarnedAgreeOutcome>(null);

  const held = issuer
    ? (wallet?.holdings.find((entry) => entry.issuer.account === issuer.account)?.available ?? null)
    : null;
  const booking = snapshot
    ? serviceBookingView({ snapshot, coreState, issuer, approval, held }, intl)
    : null;
  const rewards = snapshot
    ? serviceRewardsView(
        {
          snapshot,
          coreState,
          issuer:
            wallet?.issuers.find(
              (entry) =>
                entry.asset.token.toLowerCase() ===
                  snapshot.acceptancePolicy.earned.terms?.asset.token.toLowerCase() &&
                entry.account.toLowerCase() ===
                  snapshot.acceptancePolicy.earned.terms?.issuer.toLowerCase()
            ) ?? (booking ? null : issuer),
          garden: gardenName,
          takeUp: snapshot.knownService ? "service" : (takeUp?.mode ?? null),
        },
        intl
      )
    : null;
  const text = (id: string) =>
    formatVoucherMessage(intl, id, { issuer: booking?.words.issuer ?? "" });
  const offline = snapshot?.capabilities.reasons.includes("offline") ?? false;
  // A paused contract stops every new booking; a paused issuer, its own.
  const paused =
    Boolean(snapshot && Object.values(snapshot.pause).some((p) => p === true)) ||
    booking?.issuerPaused === true;
  const blocked =
    booking?.stage === "open"
      ? paused
        ? text("of.r.paused.b")
        : offline
          ? text("pp.reason.offline")
          : null
      : null;
  const pending = running || mutation.isPending;

  /** One member act through the shared runner; the page only shows that it is running. */
  const act = async (step: ServiceActStep): Promise<ServiceActEnd> => {
    if (!snapshot) return "notOffered";
    setRunning(true);
    try {
      return await runServiceAct(snapshot, step, mutation.mutateAsync);
    } finally {
      setRunning(false);
    }
  };
  // The redeem sheet speaks only when nothing was sent or the result is unknown; otherwise the
  // page already shows where the act stands.
  const notice = (end: ServiceActEnd): ServiceRedeemOutcome =>
    end === "nothingSent" || end === "noResult" ? end : null;
  const runOnce = (action: ServiceAccessAction) =>
    act((current) => (current === snapshot ? action : null));
  const openExchange = () => {
    setReviewingExchange(false);
    setSheet("exchange");
    if (snapshot?.pilot && !snapshot.pilot.exchange.quote)
      void runOnce({ action: "quotePilotExchange" });
  };
  const report = onReport
    ? () => {
        setSheet(null);
        onReport();
      }
    : null;
  const run = (kind: ServiceActKind) => {
    if (!booking || !snapshot) return;
    if (kind === "redeem") {
      const offer = snapshot.offer;
      setReviewed(offer?.voucher ? { revision: offer.revision, units: offer.voucher.units } : null);
      setOutcome(offline ? "offline" : null);
      setSheet("redeem");
    } else if (kind === "deposit") {
      const balance = booking.setup?.destination?.holderBalance ?? held;
      setOutcome(
        offline
          ? "offline"
          : !snapshot.capabilities.canSignHolder
            ? "signingUnavailable"
            : snapshot.pause.destinationVoucher === true
              ? "paused"
              : balance !== null && balance < booking.words.units
                ? "notEnough"
                : null
      );
      setSheet("redeem");
    } else if (kind === "close" || kind === "review") setSheet("split");
    else if (kind === "report") report?.();
    else if (kind === "exchange") openExchange();
    else if (kind === "activate") void act(activateStep);
    else if (kind === "cancel" || kind === "cancelChanged") void act(cancelStep);
    else if (kind === "retry") void act(legStep);
    else if (kind === "send") void act(unsentLegStep);
    else if (kind === "retryConfirm") void act(retryConfirmStep);
  };
  // The bar offers an act only when the shared selector offers its first write. Deposit's sheet
  // and a paused or offline offer say why an act can't run; any other refusal hides the act.
  const shown = (kind: ServiceActKind) =>
    kind === "deposit" ||
    (kind === "redeem" && blocked !== null) ||
    (snapshot !== null && serviceActOffered(kind, snapshot, booking?.split ?? null));
  const primary = booking?.primary && shown(booking.primary.kind) ? booking.primary : null;
  const secondary =
    booking?.secondary &&
    shown(booking.secondary.kind) &&
    (booking.secondary.kind !== "report" || report)
      ? booking.secondary
      : null;
  /** Agree to the Rewards, then the take-up: two prompts, the second only once the first landed. */
  const agree = () => {
    if (!agreeing) return;
    void act(earnedAgreeStep(agreeing)).then((end) => {
      if (end === "done") {
        setAgreeing(null);
        if (!booking) takeUp?.run();
      } else if (end === "notOffered") setAgreeOutcome("changed");
      else if (end === "nothingSent") setAgreeOutcome("nothingSent");
      // An unknown result closes the sheet; the page's own read says where the agreement stands.
      else setAgreeing(null);
    });
  };
  const rewardBar =
    (takeUp || snapshot?.knownService) && rewards?.agree === "offered" && rewards.agreeSheet ? (
      <CommitmentActionBar
        act={{ kind: "service", labelId: "", label: rewards.agreeSheet.cta, needsNetwork: true }}
        isPending={pending}
        isOnline={isOnline}
        onRun={() => {
          const earned = snapshot?.acceptancePolicy.earned;
          if (!earned || earned.revision === null || !earned.termsHash) return;
          setAgreeOutcome(null);
          setAgreeing({ revision: earned.revision, termsHash: earned.termsHash });
        }}
      />
    ) : takeUp && !booking && rewards?.agree === "agreed" ? (
      <CommitmentActionBar
        act={{
          kind: "service",
          labelId: "",
          label: formatVoucherMessage(intl, "rw.a.take"),
          needsNetwork: true,
        }}
        isPending={pending}
        isOnline={isOnline}
        onRun={takeUp.run}
      />
    ) : null;
  const bar = rewardBar ? (
    rewardBar
  ) : primary ? (
    <CommitmentActionBar
      act={{ kind: "service", labelId: "", label: primary.label, needsNetwork: true }}
      isPending={pending}
      isOnline={isOnline}
      blockedReason={blocked}
      secondary={
        secondary ? { labelId: "", label: secondary.label, onRun: () => run(secondary.kind) } : null
      }
      onRun={() => run(primary.kind)}
    />
  ) : !hasCoreAct && secondary ? (
    <CommitmentActionBar
      act={{
        kind: "service",
        labelId: "",
        label: secondary.label,
        needsNetwork: true,
        emphasis: "secondary",
      }}
      isPending={pending}
      isOnline={isOnline}
      onRun={() => run(secondary.kind)}
    />
  ) : !hasCoreAct && rewards?.vouchersReceived ? (
    // Arrived vouchers are the reader's to use: the wallet's Vouchers tab books or exchanges them.
    <CommitmentActionBar
      act={{ kind: "service", labelId: "", label: formatVoucherMessage(intl, "rw.a.wallet") }}
      isPending={false}
      isOnline={isOnline}
      onRun={() => navigate(`${APP_ROUTES.home}?wallet=vouchers`)}
    />
  ) : null;
  // A service promise with neither a voucher booking nor rewards keeps the service panel.
  const showPanel = isServiceAccessPromise(snapshot) || (snapshot?.voucherSetups.length ?? 0) > 0;

  return children({
    band: booking?.band ?? rewards?.band ?? null,
    body: (
      <>
        {booking || rewards ? (
          <>
            {booking?.door ? (
              <JoinToActDoor
                title={booking.door.title}
                line={booking.door.body}
                door={
                  booking.door.act && snapshot && exchangeAvailable(snapshot)
                    ? {
                        label: booking.door.act.label,
                        icon: <RiExchangeLine className="h-4 w-4" aria-hidden="true" />,
                        onAct: openExchange,
                      }
                    : null
                }
              />
            ) : null}
            {rewards?.agreementUnavailable ? (
              <JoinToActDoor
                title={rewards.agreementUnavailable.title}
                line={rewards.agreementUnavailable.body}
                door={{
                  label: rewards.agreementUnavailable.label,
                  icon: <RiQuestionLine className="h-4 w-4" aria-hidden="true" />,
                  // The app's Help, where it says how to reach the Green Goods team.
                  onAct: () => navigate(`${APP_ROUTES.profile}?tab=help`),
                }}
              />
            ) : null}
            {booking ? <ServiceAccessSection view={booking} /> : null}
            {rewards ? <ServiceRewardsSection view={rewards} /> : null}
            {snapshot?.pilot && import.meta.env.DEV && isDemoPoolingActive() ? (
              <VoucherPilotJourney
                snapshot={snapshot}
                busy={pending}
                onAction={async (action) => {
                  await mutation.mutateAsync(action);
                }}
              />
            ) : null}
          </>
        ) : null}
        {snapshot && showPanel && !booking && (snapshot.knownService || !rewards) ? (
          <ServiceAccessPanel
            key={`${serviceKey?.sourceChainId}:${serviceKey?.coreModule}:${serviceKey?.commitmentId}:${serviceKey?.buyer}`}
            snapshot={snapshot}
            isPending={mutation.isPending}
            onAction={mutation.mutateAsync}
            onRefresh={() => void access.refetch()}
          />
        ) : null}
      </>
    ),
    bar,
    delivery: booking?.delivery ?? null,
    bookingLines: booking?.events ?? [],
    confirm: booking?.confirm ?? null,
    rewards: rewards !== null,
    sheets: (
      <>
        {booking && snapshot ? (
          <ServiceBookingSheets
            booking={booking}
            snapshot={snapshot}
            heading={heading}
            sheet={sheet}
            onClose={() => setSheet(null)}
            redeem={{
              reviewed,
              outcome,
              held: booking.setup?.destination?.holderBalance ?? held,
              // The issuer's pause stops a new booking at the write, whenever it was read.
              onAgree: () => {
                if (booking.issuerPaused) return;
                void act(agreeStep).then((end) => setOutcome(notice(end)));
              },
              onDeposit: () => void act(depositStep).then((end) => setOutcome(notice(end))),
              onCheck: () => {
                setOutcome(null);
                void access.refetch();
              },
            }}
            onApproveSplit={() => {
              if (!booking.split) return;
              // The split is fixed once approved, even if a transfer prompt is declined after it.
              void act(splitStep(booking.split)).then((end) => {
                if (end === "done" || end === "stopped") setSheet(null);
              });
            }}
            onReport={report}
            exchange={{
              quote: wallet ? exchangeQuoteFromPilot(snapshot, wallet) : null,
              reviewing: reviewingExchange,
              onOpen: openExchange,
              onReview: () => setReviewingExchange(true),
              onExchange: () => void act(exchangeStep).then(() => setReviewingExchange(false)),
              onCheck: () => void runOnce({ action: "resolvePilotExchange" }),
              onRequote: () => {
                setReviewingExchange(false);
                void runOnce({ action: "quotePilotExchange" });
              },
              // A short pool quotes again for what it can give, not the same amount.
              smaller: smallerExchangeInput(snapshot),
              onSmaller: (input) => {
                setReviewingExchange(false);
                void runOnce({ action: "quotePilotExchange", input });
              },
            }}
            isPending={pending}
          />
        ) : null}
        {rewards?.agreeSheet ? (
          <EarnedRewardAgreeSheet
            sheet={rewards.agreeSheet}
            work={heading}
            open={agreeing !== null}
            outcome={agreeOutcome}
            isPending={pending}
            onOpenChange={(open) => {
              if (!open) setAgreeing(null);
            }}
            onAgree={agree}
          />
        ) : null}
      </>
    ),
  });
}
