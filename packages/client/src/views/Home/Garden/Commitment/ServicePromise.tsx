import {
  type CommitmentDerivedState,
  isDemoPoolingActive,
  type ServiceAccessAction,
  type ServiceAccessKey,
  type ServiceAccessSnapshot,
  useServiceAccessMutation,
  useVoucherIssuerApproval,
  useVoucherWallet,
} from "@green-goods/shared/commitment-pooling";
import { RiExchangeLine, RiQuestionLine } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/config/pwaRouting";
import { CommitmentActionBar } from "./CommitmentActionBar";
import type { CommitmentIdentityProps } from "./CommitmentIdentity";
import { JoinToActDoor } from "./JoinToAct";
import { ServiceAccessPanel } from "./ServiceAccessPanel";
import { ServiceAccessSection } from "./ServiceAccessSection";
import {
  activateStep,
  agreeStep,
  cancelStep,
  depositStep,
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
import { ServiceBookingSheets, type ServiceSheet } from "./ServiceBookingSheets";
import type { ServiceActKind, ServiceBookingView } from "./serviceBookingTypes";
import {
  exchangeAvailable,
  exchangeQuoteFromPilot,
  exchangeStep,
  smallerExchangeInput,
} from "./serviceExchange";
import type { ServiceRedeemOutcome } from "./ServiceRedeemSheet";
import { ServiceRewardsSection } from "./ServiceRewardsSection";
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
  children,
}: ServicePromiseProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const mutation = useServiceAccessMutation(serviceKey);
  const snapshot = access.data ?? null;
  const walletChain = snapshot?.key.sourceChainId;
  const walletModule = snapshot?.key.coreModule;
  const walletAccount = snapshot?.key.buyer;
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

  const held = issuer
    ? (wallet?.holdings.find((entry) => entry.issuer.account === issuer.account)?.available ?? null)
    : null;
  const booking = snapshot
    ? serviceBookingView({ snapshot, coreState, issuer, approval, held }, intl)
    : null;
  const rewards =
    snapshot && !booking
      ? serviceRewardsView({ snapshot, coreState, issuer, garden: gardenName }, intl)
      : null;
  const text = (id: string) =>
    formatVoucherMessage(intl, id, { issuer: booking?.words.issuer ?? "" });
  const offline = snapshot?.capabilities.reasons.includes("offline") ?? false;
  const paused = Boolean(snapshot && Object.values(snapshot.pause).some((p) => p === true));
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
  const bar = primary ? (
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
  ) : null;
  // A service promise with neither a voucher booking nor rewards keeps the service panel.
  const showPanel = isServiceAccessPromise(snapshot) || (snapshot?.voucherSetups.length ?? 0) > 0;

  return children({
    band: booking?.band ?? rewards?.band ?? null,
    body:
      booking || rewards ? (
        <>
          {booking?.door ? (
            <JoinToActDoor
              title={booking.door.title}
              line={booking.door.body}
              door={
                snapshot && exchangeAvailable(snapshot)
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
      ) : snapshot && showPanel ? (
        <ServiceAccessPanel
          key={`${serviceKey?.sourceChainId}:${serviceKey?.coreModule}:${serviceKey?.commitmentId}:${serviceKey?.buyer}`}
          snapshot={snapshot}
          isPending={mutation.isPending}
          onAction={mutation.mutateAsync}
          onRefresh={() => void access.refetch()}
        />
      ) : null,
    bar,
    delivery: booking?.delivery ?? null,
    bookingLines: booking?.events ?? [],
    confirm: booking?.confirm ?? null,
    sheets:
      booking && snapshot ? (
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
            onAgree: () => void act(agreeStep).then((end) => setOutcome(notice(end))),
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
            quote: wallet
              ? exchangeQuoteFromPilot(snapshot, wallet.issuers, wallet.holdings)
              : null,
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
      ) : null,
  });
}
