import type {
  ServiceAccessSnapshot,
  ServiceVoucherSetup,
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
  return "generic";
}

export function currentVoucherSetup(s: ServiceAccessSnapshot): ServiceVoucherSetup | null {
  return s.voucherSetups.find((row) => row.setupId === s.currentVoucherSetupId) ?? null;
}

/** A promise its service's own acts govern: the generic take-up and claims step aside. */
export function isServiceAccessPromise(s: ServiceAccessSnapshot | null | undefined): boolean {
  return s?.knownService === true || s?.acceptancePolicy.blockGenericMemberAcceptance === true;
}

/** The stage a voucher booking is in; null when the promise has no voucher route. */
function serviceBookingStage(
  input: Pick<ServiceBookingInput, "snapshot" | "coreState" | "held">
): ServiceBookingStage | null {
  const { snapshot: s, coreState } = input;
  const voucher = s.offer?.route === "voucher" ? s.offer.voucher : null;
  const setup = currentVoucherSetup(s);
  if (!voucher && !setup) return null;
  if (coreState === "DISPUTED") return "problemReported";
  if (!setup)
    return input.held !== null && voucher && input.held < voucher.units ? "notEnough" : "open";
  const d = setup.destination;
  const final = d?.finalAllocation ?? null;
  if (final) {
    if (final.release.state === "failed" || final.refund.state === "failed") return "returnFailed";
    return final.financiallyClosed ? "closed" : "transfersPending";
  }
  if (setup.source.decision === "abort" || d?.result.decision === "abort")
    return d?.result.phase === "aborted" || !d ? "canceled" : "canceling";
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
  if (accepted) return d?.holderAbortRequested ? "acceptedFirst" : "starting";
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
  inProgress: [null, "report"],
  readyToClose: ["close", "report"],
  returnProposed: ["review", "report"],
  returnFailed: ["retry", null],
  acceptedFirst: [null, "report"],
  termsChanged: ["cancelChanged", null],
};
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
  const profile = serviceProfile(offer?.unitLabel);
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
  const delivered = final
    ? final.allocation.approvedDeliveredServiceUnits
    : units > 0n
      ? (serviceUnits * release) / units
      : 0n;
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
  const needsYou = NEEDS_YOU.has(stage);
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
            : t(`rd.a.${kind}`),
  });
  const [primaryKind, secondaryKind] = ACTS[stage] ?? [null, null];
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
    termsVersion: offer ? t("pp.version", { v: offer.revision.toString() }) : null,
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
            body: t(profile === "access" ? "of.r.shortV.bc" : "of.r.shortV.bs", { n }),
            act: act("exchange"),
          }
        : null,
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
      revision: offer?.revision ?? null,
      accessDays,
      deadline: deadline !== null ? date(deadline) : null,
      sigs: ctx.sigs,
    },
  };
}
