import type {
  ServiceAccessSnapshot,
  ServiceVoucherSetup,
  VoucherIssuer,
} from "@green-goods/shared/commitment-pooling";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { IntlShape } from "react-intl";
import { bookingFacts, bookingSentence } from "./serviceBookingCopy";
import {
  bookingConfirm,
  bookingDelivery,
  bookingDetails,
  bookingPhases,
  bookingTransfers,
} from "./serviceBookingSteps";
import type {
  BookingContext,
  ServiceAct,
  ServiceActKind,
  ServiceBandTone,
  ServiceBookingInput,
  ServiceBookingStage,
  ServiceBookingView,
  ServiceProfile,
} from "./serviceBookingTypes";

/**
 * One voucher string in the reader's language. English writes the possessive of a name ending
 * in s with the apostrophe alone, so "Green Goods' reserve", never "Green Goods's".
 */
export function formatVoucherMessage(
  intl: Pick<IntlShape, "formatMessage" | "locale">,
  id: string,
  values: Record<string, string | number> = {}
): string {
  const text = intl.formatMessage({ id: `app.voucher.${id}` }, values);
  const issuer = typeof values.issuer === "string" ? values.issuer : "";
  return intl.locale.startsWith("en") && issuer.endsWith("s")
    ? text.replaceAll(`${issuer}'s`, `${issuer}'`)
    : text;
}

/** Decision 3: the acceptance deadline defaults to seven days from agreeing. */
export const SERVICE_ACCEPTANCE_WINDOW_SECONDS = 7n * 86_400n;

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The offer's unit label names the pilot's service until its terms carry a kind. */
function serviceProfile(unitLabel: string | null | undefined): ServiceProfile {
  const unit = unitLabel?.trim().toLocaleLowerCase() ?? "";
  if (unit.includes("hub")) return "hubDay";
  if (["day", "days", "día", "días", "dia", "dias"].includes(unit)) return "access";
  if (["minute", "minutes", "minuto", "minutos"].includes(unit)) return "minutes";
  return "generic";
}

export function currentVoucherSetup(s: ServiceAccessSnapshot): ServiceVoucherSetup | null {
  return s.voucherSetups.find((row) => row.setupId === s.currentVoucherSetupId) ?? null;
}

/**
 * Whose vouchers the page speaks of: the issuer and asset a booking froze, which a later offer
 * revision can't change, else the offer's voucher or a request's reward. Issuer and token go
 * together, since two issuers may share a token.
 */
export function bookingVoucherIssuer(
  s: ServiceAccessSnapshot | null,
  issuers: readonly VoucherIssuer[] | undefined
): VoucherIssuer | null {
  const setup = s ? currentVoucherSetup(s) : null;
  const voucher = s?.offer?.voucher;
  const reward = s?.pilot?.reward?.voucher;
  const pair = setup
    ? { token: setup.asset.token, account: setup.authorization.issuer }
    : voucher
      ? { token: voucher.asset.token, account: voucher.issuer }
      : reward
        ? { token: reward.asset.token, account: reward.funder }
        : null;
  return (
    issuers?.find(
      (entry) => same(entry.asset.token, pair?.token) && same(entry.account, pair?.account)
    ) ?? null
  );
}

/** A promise its service's own acts govern: the generic take-up and claims step aside. */
export function isServiceAccessPromise(s: ServiceAccessSnapshot | null | undefined): boolean {
  return s?.knownService === true || s?.acceptancePolicy.blockGenericMemberAcceptance === true;
}

/**
 * Whether the page can tell a service offer from an ordinary promise yet. Until the service read
 * answers, or when it failed, a promise may still be a service offer, which refuses the generic
 * take-up. A read with no one to read for never runs, so it decides nothing.
 */
export function serviceReadOutcome(read: {
  data?: ServiceAccessSnapshot | null;
  isError?: boolean;
  status?: string;
  fetchStatus?: string;
}): "service" | "ordinary" | "unresolved" | "failed" {
  if (read.data) return isServiceAccessPromise(read.data) ? "service" : "ordinary";
  if (read.isError) return "failed";
  return read.status === "pending" && read.fetchStatus !== "idle" ? "unresolved" : "ordinary";
}

/** The stage a voucher booking is in; null when the promise has no voucher route. */
function serviceBookingStage(
  input: Pick<ServiceBookingInput, "snapshot" | "coreState" | "held">
): ServiceBookingStage | null {
  const { snapshot: s, coreState } = input;
  const voucher = s.offer?.route === "voucher" ? s.offer.voucher : null;
  const setup = currentVoucherSetup(s);
  if (!voucher && !setup) return null;
  const d = setup?.destination;
  const final = d?.finalAllocation ?? null;
  // A failed transfer keeps its Retry Transfer, even after the member reported a problem.
  if (final && (final.release.state === "failed" || final.refund.state === "failed"))
    return "returnFailed";
  if (coreState === "DISPUTED") return "problemReported";
  if (!setup)
    return input.held !== null && voucher && input.held < voucher.units ? "notEnough" : "open";
  if (final) return final.financiallyClosed ? "closed" : "transfersPending";
  // A recorded cancellation stays under way until it is sent to the escrow, which may hold vouchers.
  if (setup.source.decision === "abort" || d?.result.decision === "abort")
    return d?.result.phase === "aborted" || (!d && setup.source.decisionDispatched)
      ? "canceled"
      : "canceling";
  const a = setup.authorization;
  const accepted = setup.source.acceptedEver !== null;
  if (
    !accepted &&
    s.offer &&
    (s.offer.revision !== a.termsRevision || !same(s.offer.termsHash, a.termsHash))
  )
    return "termsChanged";
  if (d?.result.phase === "active") {
    // The issuer's Propose Return raises the most that can come back; nothing moves yet.
    if (d.issuerReturnCeiling !== null && d.issuerReturnCeiling > 0n) return "returnProposed";
    if (coreState === "READY_FOR_CONFIRMATION" || coreState === "EVIDENCE_SUBMITTED")
      return "readyToClose";
    return d.holderAbortRequested ? "acceptedFirst" : "inProgress";
  }
  // Accepted but not started: Start the Booking records the activation and sends it. A
  // cancellation that lost the race says so once the booking has started.
  if (accepted) return "starting";
  if (!d || d.result.phase === "none" || d.result.phase === "authorized")
    return d?.result.issuerApproved ? "readyToDeposit" : "waitingApproval";
  return setup.source.setupResult?.depositedUnits === a.voucherUnits
    ? "waitingAcceptance"
    : "confirmingDeposit";
}

const NEEDS_YOU = new Set<ServiceBookingStage>([
  "readyToDeposit",
  "readyToClose",
  "returnProposed",
  "termsChanged",
  "returnFailed",
]);
const WAITING = new Set<ServiceBookingStage>([
  "open",
  "notEnough",
  "waitingApproval",
  "confirmingDeposit",
  "waitingAcceptance",
  "transfersPending",
  "canceling",
]);
/** The page's acts per stage: one primary and at most one secondary. */
const ACTS: Partial<Record<ServiceBookingStage, [ServiceActKind | null, ServiceActKind | null]>> = {
  open: ["redeem", null],
  waitingApproval: [null, "cancel"],
  readyToDeposit: ["deposit", "cancel"],
  confirmingDeposit: [null, "cancel"],
  waitingAcceptance: [null, "cancel"],
  starting: ["activate", null],
  inProgress: [null, "report"],
  readyToClose: ["close", "report"],
  returnProposed: ["review", "report"],
  returnFailed: ["retry", null],
  acceptedFirst: [null, "report"],
  termsChanged: ["cancelChanged", null],
};

/**
 * A step only some bookings at a stage still need from the reader: a transfer the split fixed
 * that nobody sent (its prompt was declined), a deposit's confirmation that didn't reach the
 * source, or a recorded cancellation not yet sent to the escrow.
 */
function recoveryAct(
  stage: ServiceBookingStage,
  setup: ServiceVoucherSetup | null
): ServiceActKind | null {
  const final = setup?.destination?.finalAllocation;
  if (
    stage === "transfersPending" &&
    final &&
    [final.refund, final.release].some((leg) => leg.state === "pending" && leg.attempts === 0n)
  )
    return "send";
  if (stage === "confirmingDeposit" && setup?.acknowledgments.setup.pending) return "retryConfirm";
  if (stage === "canceling" && setup && !setup.source.decisionDispatched) return "cancel";
  return null;
}

/** Where each stage sits on the booking's way, for the steps' done and now. */
const POSITION: Record<ServiceBookingStage, number> = {
  open: -1,
  notEnough: -1,
  waitingApproval: 0,
  readyToDeposit: 1,
  confirmingDeposit: 2,
  waitingAcceptance: 3,
  termsChanged: 3,
  canceling: 3,
  canceled: 3,
  starting: 4,
  inProgress: 5,
  acceptedFirst: 5,
  problemReported: 5,
  readyToClose: 6,
  returnProposed: 6,
  transfersPending: 7,
  returnFailed: 7,
  closed: 8,
};

/** Everything the promise page draws for one voucher offer or booking. */
export function serviceBookingView(
  input: ServiceBookingInput,
  intl: Pick<IntlShape, "formatMessage" | "formatDate" | "locale">
): ServiceBookingView | null {
  const stage = serviceBookingStage(input);
  if (!stage) return null;
  const { snapshot: s, coreState } = input;
  const setup = currentVoucherSetup(s);
  const offer = s.offer;
  const asset = setup?.asset ?? offer?.voucher?.asset ?? null;
  const decimals = asset?.decimals ?? 0;
  const units = setup?.authorization.voucherUnits ?? offer?.voucher?.units ?? 0n;
  const serviceUnits = setup?.authorization.serviceUnits ?? offer?.serviceUnits ?? 1n;
  // A booking keeps the terms it was set up on, even after the offer changes them.
  const revision = setup?.authorization.termsRevision ?? offer?.revision ?? null;
  const profile = serviceProfile(offer?.unitLabel);
  const member = input.issuer?.kind === "individual";
  const issuer = input.issuer?.name ?? asset?.symbol ?? "";
  const gender = input.issuer?.gender ?? "other";
  const t = (id: string, values: Record<string, string | number> = {}) =>
    formatVoucherMessage(intl, id, { issuer, gender, ...values });
  const count = (value: bigint) => formatTokenAmount(value, decimals, decimals, intl.locale);
  const isOne = (value: bigint) => value === 10n ** BigInt(decimals);
  const unit = (value: bigint) => t("unit", { count: isOne(value) ? 1 : 2 });
  const date = (seconds: number | bigint) =>
    intl.formatDate(Number(seconds) * 1000, { month: "short", day: "numeric" });
  const d = setup?.destination ?? null;
  const final = d?.finalAllocation ?? null;
  const deadline = setup?.authorization.acceptanceDeadline ?? null;
  // The split the holder can approve: the issuer's return limit comes back, the rest is released.
  const ceiling = d?.issuerReturnCeiling ?? 0n;
  const refund = final
    ? final.allocation.refundVoucherUnits
    : stage === "returnProposed"
      ? ceiling < units
        ? ceiling
        : units
      : 0n;
  const release = final ? final.allocation.releaseVoucherUnits : units - refund;
  // Whatever is released pays for some service, so a partial one-unit delivery counts as one,
  // never zero: the final split refuses a release with no delivered unit.
  const proportional = units > 0n ? (serviceUnits * release) / units : 0n;
  const delivered = final
    ? final.allocation.approvedDeliveredServiceUnits
    : release > 0n && proportional === 0n
      ? 1n
      : proportional;
  const reported =
    final !== null || stage === "returnProposed" || stage === "readyToClose" || stage === "closed";
  const accessDays = profile === "access" ? Number(serviceUnits) : 0;
  const daysDone = reported ? Number(delivered) : (input.schedule?.accessDay ?? null);
  const kept = stage === "closed" && (coreState === "FULFILLED" || coreState === "RECONCILED");
  const endedEarly = stage === "closed" && coreState === "CANCELLED";
  const n = count(units);
  const ctx: BookingContext = {
    input,
    stage,
    profile,
    member,
    setup,
    t,
    count,
    unit,
    isOne,
    date,
    units,
    one: isOne(units),
    n,
    serviceUnits,
    accessDays,
    refund,
    release,
    delivered,
    reported,
    daysDone,
    deadline,
    sigs:
      input.approval?.kind === "safe"
        ? t("c.sigs", { threshold: input.approval.threshold, owners: input.approval.owners })
        : null,
    kept,
    endedEarly,
    pos: POSITION[stage],
    values: {
      n,
      back: count(refund),
      rel: count(release),
      d1: deadline !== null ? date(deadline) : "",
      done: daysDone ?? 0,
      of: accessDays,
    },
  };
  // A stage that waits on others still needs the reader when an act of theirs stopped partway.
  const recovery = recoveryAct(stage, setup);
  const needsYou = NEEDS_YOU.has(stage) || recovery !== null;
  const tone: ServiceBandTone = needsYou
    ? "attention"
    : kept
      ? "kept"
      : WAITING.has(stage)
        ? "waiting"
        : "neutral";
  const act = (kind: ServiceActKind): ServiceAct => ({
    kind,
    label:
      kind === "redeem"
        ? t("of.cta.redeem")
        : kind === "deposit"
          ? ctx.one
            ? t("pay.m.deposit")
            : t("rd.a.deposit", { n })
          : kind === "exchange"
            ? t("of.a.exchange")
            : // Sending a transfer nobody sent finishes the act that closes the booking.
              t(`rd.a.${kind === "send" ? "close" : kind}`),
  });
  const [stageKind, secondaryKind] = ACTS[stage] ?? [null, null];
  const primaryKind = recovery ?? stageKind;
  const held = input.held ?? 0n;
  const phases = bookingPhases(ctx);
  return {
    stage,
    profile,
    setup,
    band: {
      tone,
      sentence: bookingSentence(ctx),
      needsYou,
      pillId: endedEarly ? "app.voucher.pp.st.endedEarly" : null,
    },
    facts: bookingFacts(ctx),
    termsVersion: revision !== null ? t("pp.version", { v: revision.toString() }) : null,
    phases,
    transfers: bookingTransfers(ctx),
    details: bookingDetails(ctx),
    delivery: bookingDelivery(ctx),
    primary: primaryKind ? act(primaryKind) : null,
    secondary: secondaryKind ? act(secondaryKind) : null,
    door:
      stage === "notEnough"
        ? {
            title: t("of.r.shortV.t", { have: count(held), unit: unit(held) }),
            body: t(
              profile === "access"
                ? "of.r.shortV.bc"
                : profile === "hubDay"
                  ? "of.r.shortV.bs"
                  : "of.r.shortV.bm",
              { n }
            ),
            act: act("exchange"),
          }
        : null,
    issuerPaused: stage === "open" && input.issuer?.standing.bookings === "paused",
    // History keeps what happened; the step under way shows in the booking's steps.
    events: phases
      .flatMap((p) => p.steps)
      .filter((entry) => entry.state !== "todo" && entry.state !== "now")
      .reverse(),
    split:
      stage === "readyToClose" || stage === "returnProposed"
        ? { delivered, release, refund }
        : null,
    confirm: bookingConfirm(ctx),
    words: {
      issuer,
      count,
      unit,
      units,
      one: ctx.one,
      n,
      vouchers: `${n} ${unit(units)}`,
      get:
        profile === "hubDay"
          ? t("pay.s.get")
          : profile === "access"
            ? t("pay.c.get")
            : `${serviceUnits.toString()} ${offer?.unitLabel ?? ""}`.trim(),
      revision,
      serviceUnits,
      accessDays,
      deadline: deadline !== null ? date(deadline) : null,
      sigs: ctx.sigs,
      member,
    },
  };
}
