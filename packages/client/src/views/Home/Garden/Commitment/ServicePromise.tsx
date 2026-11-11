import type { ServicePromiseProps } from "./servicePromiseTypes";
import {
  isDemoPoolingActive,
  type ServiceAccessAction,
  serviceVoucherHolder,
  serviceIssuerExchangeChoices,
  useServiceAccessMutation,
  useVoucherIssuerApproval,
  useVoucherWallet,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { RiExchangeLine, RiQuestionLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import type { Hex } from "viem";
import { APP_ROUTES } from "@/config/pwaRouting";
import { CommitmentActionBar } from "./CommitmentActionBar";
import { type EarnedAgreeOutcome, EarnedRewardAgreeSheet } from "./EarnedRewardAgreeSheet";
import { JoinToActDoor } from "./JoinToAct";
import { ServiceLiveExchange } from "./ServiceLiveExchange";
import { ServiceAccessPanel } from "./ServiceAccessPanel";
import { ServiceAccessSection } from "./ServiceAccessSection";
import { ServiceBookingSheets, type ServiceSheet } from "./ServiceBookingSheets";
import { ServiceReadDoors } from "./ServiceReadDoors";
import { ServiceReadStatus } from "./ServiceReadStatus";
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
import { formatVoucherMessage, isServiceAccessPromise } from "./serviceBooking";
import type { ServiceActKind } from "./serviceBookingTypes";
import {
  exchangeAvailable,
  exchangeQuoteFromPilot,
  exchangeStep,
  smallerExchangeInput,
} from "./serviceExchange";
import {
  promiseVoucherIssuer,
  type RetainedVoucherWallet,
  retainedVoucherWallet,
  servicePromiseViews,
} from "./servicePromiseViews";
import { VoucherPilotJourney } from "./VoucherPilotJourney";

/**
 * A voucher booking, or a request's rewards, on the promise page. It reads the voucher wallet
 * and the issuer's approval, keeps the booking's sheets, and runs each member act one write at
 * a time, each only when the shared selector offers it. The page places what it returns.
 */
export function ServicePromise({
  serviceKey,
  access,
  coreState,
  creator,
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
  const walletQuery = useVoucherWallet(walletScope);
  const read = walletQuery.data;
  // A read that answered "unavailable" names nothing and counts nothing: not a wallet to draw from.
  const readUsable = read !== undefined && read.evidence !== "unavailable";
  // The last wallet that did answer, with the route it answered for, kept through a refresh that
  // fails so the issuer's name and the reader's holdings never vanish mid-page; the page says the
  // refresh failed instead. Another route's wallet never stands in, even for the same account.
  const [lastGood, setLastGood] = useState<RetainedVoucherWallet | null>(null);
  useEffect(() => {
    if (readUsable && walletScope) setLastGood({ scope: walletScope, wallet: read });
  }, [read, readUsable, walletScope]);
  const wallet = readUsable ? read : retainedVoucherWallet(lastGood, walletScope);
  const walletUnavailable =
    walletScope !== null && (walletQuery.isError || (read !== undefined && !readUsable));
  const liveExchangeChoices = serviceIssuerExchangeChoices(snapshot, wallet);
  const canExchange = Boolean(
    snapshot && (exchangeAvailable(snapshot) || liveExchangeChoices.length)
  );
  // The wallet names the issuer it matched; until it does, the catalog gives the same name.
  const { matched: matchedIssuer, issuer } = promiseVoucherIssuer(snapshot, wallet);
  const approval = useVoucherIssuerApproval(matchedIssuer).data ?? null;
  const [sheet, setSheet] = useState<ServiceSheet>(null);
  // Keep the chosen checkout visible through wallet refresh so its receipt is not lost on success.
  const [liveCheckout, setLiveCheckout] = useState<{
    choices: ReturnType<typeof serviceIssuerExchangeChoices>;
    account: Address;
  } | null>(null);
  const [outcome, setOutcome] = useState<ServiceRedeemOutcome>(null);
  const [reviewed, setReviewed] = useState<{ revision: bigint; units: bigint } | null>(null);
  const [running, setRunning] = useState(false);
  const [reviewingExchange, setReviewingExchange] = useState(false);
  // The reward terms as the member opened Agree to the Rewards: what they agree to.
  const [agreeing, setAgreeing] = useState<{ revision: bigint; termsHash: Hex } | null>(null);
  const [agreeOutcome, setAgreeOutcome] = useState<EarnedAgreeOutcome>(null);

  // The reader's own offer, their booking, or the request's rewards, worked out once.
  const views = snapshot
    ? servicePromiseViews(
        {
          snapshot,
          coreState,
          creator,
          viewer: serviceKey?.buyer,
          issuer,
          matched: matchedIssuer,
          wallet,
          approval,
          garden: gardenName,
          takeUp: takeUp?.mode ?? null,
        },
        intl
      )
    : null;
  const held = views?.held ?? null;
  const ownOffer = views?.ownOffer ?? null;
  const booking = views?.booking ?? null;
  const rewards = views?.rewards ?? null;
  const blocked = views?.blocked ?? null;
  const text = (id: string) =>
    formatVoucherMessage(intl, id, { issuer: booking?.words.issuer ?? "" });
  const offline = snapshot?.capabilities.reasons.includes("offline") ?? false;
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
    setLiveCheckout(
      liveExchangeChoices.length && walletAccount
        ? { choices: liveExchangeChoices, account: walletAccount }
        : null
    );
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
  // and a paused or offline offer say why an act can't run; any other refusal hides the act. The
  // exchange shows only where a pool can quote or a live route exists, whatever the selector says.
  const shown = (kind: ServiceActKind) =>
    kind === "exchange"
      ? canExchange
      : kind === "deposit" ||
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
  /** Check Status reads the booking and the reader's vouchers again, together. */
  const checkStatus = () => {
    void walletQuery.refetch();
    return access.refetch();
  };
  // Holdings the page can't read leave the terms open to review, not the booking open to make.
  const holdingsUnknown = walletUnavailable && wallet === undefined && booking?.stage === "open";
  const bar = rewardBar ? (
    rewardBar
  ) : primary ? (
    <CommitmentActionBar
      act={{
        kind: "service",
        labelId: "",
        label:
          holdingsUnknown && primary.kind === "redeem" ? text("of.cta.reviewTerms") : primary.label,
        needsNetwork: true,
        emphasis: holdingsUnknown ? "secondary" : undefined,
      }}
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
  ) : !hasCoreAct && !ownOffer && rewards?.vouchersReceived ? (
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
    band: ownOffer ? ownOffer.band : (booking?.band ?? rewards?.band ?? null),
    takes: ownOffer?.takes ?? null,
    body: (
      <>
        {booking || rewards ? (
          <>
            <ServiceReadDoors
              stage={booking?.stage ?? null}
              walletUnavailable={walletUnavailable}
              walletKnown={wallet !== undefined}
              exchangePending={
                snapshot?.pilot?.exchange.status === "unknown" && sheet !== "exchange"
              }
              text={text}
              onCheckWallet={() => void walletQuery.refetch()}
              onCheckExchange={() => void runOnce({ action: "resolvePilotExchange" })}
            />
            {booking?.door ? (
              <JoinToActDoor
                title={booking.door.title}
                line={booking.door.body}
                door={
                  booking.door.act && snapshot && canExchange
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
            {ownOffer ? null : (
              <ServiceReadStatus
                access={{ ...access, refetch: checkStatus }}
                isOnline={isOnline}
                isPending={pending}
              />
            )}
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
        {snapshot && showPanel && !booking && !ownOffer && (snapshot.knownService || !rewards) ? (
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
        {sheet === "exchange" && liveCheckout && liveCheckout.account === walletAccount ? (
          <ServiceLiveExchange
            choices={liveCheckout.choices}
            account={liveCheckout.account}
            onClose={() => setSheet(null)}
            onRefresh={async () => {
              await walletQuery.refetch();
              await access.refetch();
            }}
          />
        ) : null}
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
              available: canExchange,
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
