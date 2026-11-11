import {
  liveVoucherIssuerName,
  type ServiceAccessSnapshot,
  type VoucherIssuer,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import type { IntlShape } from "react-intl";
import { bookingFacts, bookingSentence } from "./serviceBookingCopy";
import {
  ACTS,
  CHIP,
  currentVoucherSetup,
  NEEDS_YOU,
  POSITION,
  recoveryAct,
  same,
  serviceBookingStage,
  WAITING,
} from "./serviceBookingStage";
import {
  bookingConfirm,
  bookingDelivery,
  bookingDetails,
  bookingPhases,
  bookingTransfers,
} from "./serviceBookingSteps";
import type {
  BookingContext,
  OwnServiceOfferView,
  ServiceAct,
  ServiceActKind,
  ServiceBandTone,
  ServiceBookingInput,
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

/**
 * Voucher strings and amounts, with the issuer's name and grammatical gender already in them. The
 * name is the wallet's or the catalog's (`catalogVoucherIssuer`); an asset in no catalog has only
 * its symbol, and with neither the unit reads plainly ("10 vouchers").
 */
function voucherWords(
  intl: Pick<IntlShape, "formatMessage" | "locale">,
  named: ServiceBookingInput["issuer"],
  asset: { symbol: string | null; decimals: number | null } | null
) {
  const decimals = asset?.decimals ?? 0;
  const issuer = named?.name ?? asset?.symbol ?? "";
  const gender = named?.gender ?? "other";
  const t = (id: string, values: Record<string, string | number> = {}) =>
    formatVoucherMessage(intl, id, { issuer, gender, ...values });
  const count = (value: bigint) => formatTokenAmount(value, decimals, decimals, intl.locale);
  const isOne = (value: bigint) => value === 10n ** BigInt(decimals);
  const unit = (value: bigint) => t(issuer ? "unit" : "unitPlain", { count: isOne(value) ? 1 : 2 });
  return { issuer, t, count, isOne, unit };
}

/** The standing a catalog-named issuer is given until the wallet reads it: nothing is paused. */
const UNREAD_STANDING: VoucherIssuer["standing"] = { bookings: "open", exchange: "unavailable" };

/**
 * An issuer named from the live route catalog alone, for a page whose wallet read hasn't matched
 * it yet or failed: the same name the wallet would give, so the page never swaps names as the
 * read lands. Null for an asset the catalog doesn't know.
 */
export function catalogVoucherIssuer(
  pair: { token: Address; account: Address } | null
): ServiceBookingInput["issuer"] {
  const name = pair ? liveVoucherIssuerName(pair.token, pair.account) : null;
  return name ? { name, gender: null, kind: "collective", standing: UNREAD_STANDING } : null;
}

/** Decision 3: the acceptance deadline defaults to seven days from agreeing. */
export const SERVICE_ACCEPTANCE_WINDOW_SECONDS = 7n * 86_400n;

/** The offer's unit label names the pilot's service until its terms carry a kind. */
function serviceProfile(unitLabel: string | null | undefined): ServiceProfile {
  const unit = unitLabel?.trim().toLocaleLowerCase() ?? "";
  if (unit.includes("hub")) return "hubDay";
  if (["day", "days", "día", "días", "dia", "dias"].includes(unit)) return "access";
  if (["minute", "minutes", "minuto", "minutos"].includes(unit)) return "minutes";
  return "generic";
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
  const pair = bookingVoucherPair(s);
  return (
    issuers?.find(
      (entry) => same(entry.asset.token, pair?.token) && same(entry.account, pair?.account)
    ) ?? null
  );
}

/** The token and account the page's voucher words are about (see `bookingVoucherIssuer`). */
export function bookingVoucherPair(
  s: ServiceAccessSnapshot | null
): { token: Address; account: Address } | null {
  const setup = s ? currentVoucherSetup(s) : null;
  const voucher = s?.offer?.voucher;
  const reward = s?.pilot?.reward?.voucher;
  // A live request's reward names its issuer in the terms it binds.
  const earned = s?.acceptancePolicy.earned.terms;
  return setup
    ? { token: setup.asset.token, account: setup.authorization.issuer }
    : voucher
      ? { token: voucher.asset.token, account: voucher.issuer }
      : reward
        ? { token: reward.asset.token, account: reward.funder }
        : earned
          ? { token: earned.asset.token, account: earned.issuer }
          : null;
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

/**
 * A voucher offer as the person who made it reads it; null when it has no voucher route. The chain
 * refuses their own take-up (SelfCounterparty), so nothing on a buyer's path applies to them.
 */
export function ownServiceOfferView(
  input: Pick<ServiceBookingInput, "snapshot" | "coreState" | "issuer"> & {
    /** Nobody can start a booking right now, whatever they hold. */
    paused: boolean;
  },
  intl: Pick<IntlShape, "formatMessage" | "locale">
): OwnServiceOfferView | null {
  const offer = input.snapshot.offer;
  const voucher = offer?.route === "voucher" ? offer.voucher : null;
  if (!voucher) return null;
  const { t, count, unit } = voucherWords(intl, input.issuer, voucher.asset);
  return {
    takes: t("of.v.give", { n: count(voucher.units), unit: unit(voucher.units) }),
    band:
      input.paused && input.coreState === "OFFERED"
        ? { tone: "waiting", sentence: t("pp.band.ownPaused"), needsYou: false }
        : null,
  };
}

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
  const units = setup?.authorization.voucherUnits ?? offer?.voucher?.units ?? 0n;
  const serviceUnits = setup?.authorization.serviceUnits ?? offer?.serviceUnits ?? 1n;
  // A booking keeps the terms it was set up on, even after the offer changes them.
  const revision = setup?.authorization.termsRevision ?? offer?.revision ?? null;
  const profile = serviceProfile(offer?.unitLabel);
  const member = input.issuer?.kind === "individual";
  const { issuer, t, count, isOne, unit } = voucherWords(intl, input.issuer, asset);
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
      // Deadline sentences supply their own stop; fact rows keep the localized abbreviation.
      d1: deadline !== null ? date(deadline).replace(/\.$/u, "") : "",
      done: daysDone ?? 0,
      of: accessDays,
    },
  };
  // A stage that waits on others still needs the reader when an act of theirs stopped partway.
  const recovery = recoveryAct(stage, setup);
  const needsYou = stage === "requestNotSent" || NEEDS_YOU.has(stage) || recovery !== null;
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
        ? t(
            stage === "requestNotSent"
              ? "wait.sendRequest"
              : stage === "notEnough"
                ? "of.cta.reviewTerms"
                : "of.cta.redeem"
          )
        : kind === "deposit"
          ? ctx.one
            ? t("pay.m.deposit")
            : t("rd.a.deposit", { n })
          : kind === "exchange"
            ? t("of.a.exchange")
            : t(`rd.a.${kind}`),
  });
  const held = input.held ?? 0n;
  // Approved, but the reader holds less than the deposit takes: the deposit would be refused, so
  // the page offers what they can do (exchange, or cancel) and says why, as the open offer does.
  const depositShort = stage === "readyToDeposit" && input.held !== null && input.held < units;
  const [stageKind, secondaryKind] = depositShort
    ? (["exchange", "cancel"] as const)
    : (ACTS[stage] ?? [null, null]);
  const primaryKind = recovery ?? stageKind;
  const phases = bookingPhases(ctx);
  // Before any booking, a paused issuer stops a new one whatever the reader holds.
  const issuerPaused =
    (stage === "open" || stage === "notEnough") && input.issuer?.standing.bookings === "paused";
  // A paused offer the reader can't afford has no act: nothing to exchange into, nothing to book.
  const actsPaused = issuerPaused && stage === "notEnough";
  const pillId = endedEarly
    ? "app.voucher.pp.st.endedEarly"
    : stage === "requestInTransit" || stage === "activationInTransit"
      ? "app.voucher.wait.messagePending"
      : null;
  const chipTone = CHIP[stage];
  const shortDoor = () => ({
    title: t("of.r.shortV.t", { have: count(held), unit: unit(held) }),
    body: t(
      profile === "access"
        ? "of.r.shortV.bc"
        : profile === "hubDay"
          ? "of.r.shortV.bs"
          : "of.r.shortV.bm",
      { n }
    ),
    // The page's one action bar carries Exchange Vouchers; the card only explains.
    act: null,
  });
  return {
    stage,
    profile,
    setup,
    band: {
      tone,
      sentence: bookingSentence(ctx),
      needsYou,
      pillId,
      chip:
        chipTone && !pillId ? { labelId: `app.voucher.pp.chip.${stage}`, tone: chipTone } : null,
    },
    facts: bookingFacts(ctx),
    termsVersion: revision !== null ? t("pp.version", { v: revision.toString() }) : null,
    phases,
    transfers: bookingTransfers(ctx),
    details: bookingDetails(ctx),
    messageLinks: [
      { id: setup?.source.authorizationMessageId, label: t("wait.trackRequest") },
      { id: setup?.source.decisionMessageId, label: t("wait.trackDecision") },
    ].flatMap(({ id, label }) =>
      id ? [{ label, href: `https://ccip.chain.link/msg/${id}` }] : []
    ),
    delivery: bookingDelivery(ctx),
    primary: primaryKind && !actsPaused ? act(primaryKind) : null,
    secondary: secondaryKind && !actsPaused ? act(secondaryKind) : null,
    door:
      stage === "notEnough" && issuerPaused
        ? { title: t("of.r.paused.t"), body: t("of.r.paused.b"), act: null }
        : stage === "notEnough" || depositShort
          ? shortDoor()
          : null,
    issuerPaused,
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
