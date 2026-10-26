import {
  type CommitmentDerivedState,
  isDemoPoolingActive,
  type ServiceAccessAction,
  type ServiceAccessKey,
  type ServiceAccessSnapshot,
  selectServiceAccessAction,
  useServiceAccessMutation,
  useVoucherIssuerApproval,
  useVoucherWallet,
} from "@green-goods/shared/commitment-pooling";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { RiExchangeLine } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { CommitmentActionBar } from "./CommitmentActionBar";
import type { CommitmentIdentityProps } from "./CommitmentIdentity";
import { JoinToActDoor } from "./JoinToAct";
import { ServiceAccessPanel } from "./ServiceAccessPanel";
import { ServiceAccessSection } from "./ServiceAccessSection";
import {
  agreeStep,
  cancelStep,
  depositStep,
  legStep,
  type ServiceActStep,
  splitStep,
} from "./serviceActs";
import { formatVoucherMessage, isServiceAccessPromise, serviceBookingView } from "./serviceBooking";
import { ServiceBookingSheets, type ServiceSheet } from "./ServiceBookingSheets";
import type { ServiceActKind, ServiceBookingView } from "./serviceBookingTypes";
import { exchangeQuoteFromPilot, exchangeStep } from "./serviceExchange";
import type { ServiceRedeemOutcome } from "./ServiceRedeemSheet";
import { ServiceRewardsSection } from "./ServiceRewardsSection";
import { serviceRewardsView } from "./serviceRewards";
import { VoucherPilotJourney } from "./VoucherPilotJourney";

/** An approval the reader closed before it finished: nothing was sent. */
const DECLINED = /reject|cancel|denied|user refused/i;

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
  const token =
    snapshot?.offer?.voucher?.asset.token ?? snapshot?.pilot?.reward?.voucher.asset.token;
  const issuer =
    wallet?.issuers.find(
      (entry) => token !== undefined && entry.asset.token.toLowerCase() === token.toLowerCase()
    ) ?? null;
  const approval = useVoucherIssuerApproval(issuer).data ?? null;
  const openWalletSheet = useUIStore((s) => s.openWalletSheet);
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

  /** One member act: each write only when the shared selector offers it, one prompt each. */
  const runSteps = async (step: ServiceActStep): Promise<ServiceRedeemOutcome> => {
    if (!snapshot) return null;
    let current: ServiceAccessSnapshot = snapshot;
    setRunning(true);
    try {
      for (let guard = 0; guard < 6; guard += 1) {
        const action = step(current);
        if (!action || !selectServiceAccessAction(current, action).allowed) return null;
        current = (await mutation.mutateAsync(action)).snapshot;
        // A transfer still on its way shows as pending; one that didn't go through waits for
        // its own Retry Transfer. Neither is sent again from here.
        if (
          action.action === "executeVoucherFinalLeg" &&
          current.voucherSetups.some((row) => {
            const leg = row.destination?.finalAllocation?.[action.leg];
            return leg !== undefined && leg.state !== "succeeded";
          })
        )
          return null;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return DECLINED.test(message) ? "nothingSent" : "noResult";
    } finally {
      setRunning(false);
    }
  };
  const runOnce = (action: ServiceAccessAction) =>
    runSteps((current) => (current === snapshot ? action : null));
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
            : balance !== null && balance < booking.words.units
              ? "notEnough"
              : null
      );
      setSheet("redeem");
    } else if (kind === "close" || kind === "review") setSheet("split");
    else if (kind === "report") report?.();
    else if (kind === "exchange") openExchange();
    else if (kind === "cancel" || kind === "cancelChanged") void runSteps(cancelStep);
    else if (kind === "retry") void runSteps(legStep);
  };
  const secondary =
    booking?.secondary && (booking.secondary.kind !== "report" || report)
      ? booking.secondary
      : null;
  const bar = booking?.primary ? (
    <CommitmentActionBar
      act={{ kind: "service", labelId: "", label: booking.primary.label, needsNetwork: true }}
      isPending={pending}
      isOnline={isOnline}
      blockedReason={blocked}
      secondary={
        secondary ? { labelId: "", label: secondary.label, onRun: () => run(secondary.kind) } : null
      }
      onRun={() => booking.primary && run(booking.primary.kind)}
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
  ) : !hasCoreAct && rewards?.seeVouchers ? (
    <CommitmentActionBar
      act={{ kind: "service", labelId: "", label: rewards.seeVouchers }}
      isPending={false}
      isOnline={isOnline}
      onRun={openWalletSheet}
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
                snapshot?.pilot
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
              door={null}
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
            onAgree: () => void runSteps(agreeStep).then(setOutcome),
            onDeposit: () => void runSteps(depositStep).then(setOutcome),
            onCheck: () => {
              setOutcome(null);
              void access.refetch();
            },
          }}
          onApproveSplit={() => {
            if (!booking.split) return;
            void runSteps(splitStep(booking.split)).then((result) => {
              if (!result) setSheet(null);
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
            onExchange: () => void runSteps(exchangeStep).then(() => setReviewingExchange(false)),
            onCheck: () => void runOnce({ action: "resolvePilotExchange" }),
            onRequote: () => {
              setReviewingExchange(false);
              void runOnce({ action: "quotePilotExchange" });
            },
          }}
          isPending={pending}
        />
      ) : null,
  });
}
