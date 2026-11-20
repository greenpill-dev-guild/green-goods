import { bookingDeposited, recoveryAct } from "./serviceBookingStage";
import type { BookingContext, ServiceFact } from "./serviceBookingTypes";

/**
 * The one status message, from the reader's seat, with the title where a value has no read. It
 * speaks plainly: escrow, the final split, the voucher network and a Safe's signatures stay
 * under Booking details. A member's words count the vouchers the booking takes, one or more.
 */
export function bookingSentence(ctx: BookingContext): string {
  const { t, stage, profile, member, values, one, refund, release, unit, units, date } = ctx;
  const { coreState, schedule, problem } = ctx.input;
  const final = ctx.setup?.destination?.finalAllocation ?? null;
  const counted = { ...values, count: one ? 1 : 2 };
  // A deposit's confirmation that never arrived waits on the reader's Retry Confirmation.
  if (stage === "confirmingDeposit" && recoveryAct(stage, ctx.setup) === "retryConfirm")
    return t("rd.n.confirmStuck.b", counted);
  switch (stage) {
    case "open":
    case "notEnough":
      return t("pp.band.openV", { n: ctx.n, unit: unit(units) });
    case "requestNotSent":
      return t("wait.requestNotSent");
    case "requestInTransit":
      return t("wait.requestInTransit");
    case "activationInTransit":
      return t("wait.activationInTransit");
    case "waitingApproval":
      return member ? t("rd.n.approvalM.b", counted) : t("rd.n.approval.b");
    case "readyToDeposit": {
      const held = ctx.input.held;
      // Approved, but the account holds less than the deposit: what to do before the deadline.
      if (held !== null && held < units)
        return t("rd.n.depositShort.b", {
          ...values,
          have: `${ctx.count(held)} ${unit(held)}`,
          need: `${ctx.n} ${unit(units)}`,
        });
      if (member) return t("rd.n.depositM.b", counted);
      return t(one ? "rd.n.deposit1.b" : "rd.n.deposit.b", values);
    }
    // The deposit's confirmation and the acceptance are one wait to the reader.
    case "confirmingDeposit":
    case "waitingAcceptance":
      if (member) return t("rd.n.acceptanceM.b", counted);
      return t(one ? "rd.n.acceptance1.b" : "rd.n.acceptance.b", values);
    case "stewardStarting":
      return t(member ? "rd.n.stewardStartingM.b" : "rd.n.stewardStarting.b");
    case "starting":
      return t(member ? "rd.n.startingM.b" : "rd.n.starting.b");
    case "inProgress":
      if (profile === "hubDay" && schedule?.visitAt && schedule.from && schedule.to)
        return t("rd.n.sessionOn.b", {
          d2: date(schedule.visitAt),
          from: schedule.from,
          to: schedule.to,
        });
      if (profile === "access" && schedule?.accessDay && schedule.accessUntil)
        return t("rd.n.courseOn.b", {
          ...values,
          done: schedule.accessDay,
          d4: date(schedule.accessUntil),
        });
      if (profile === "hubDay") return t("rd.n.sessionOnS.b");
      return t(profile === "access" ? "rd.n.courseOn.t" : "rd.n.sessionOn.t");
    case "readyToClose":
      return t(profile === "hubDay" ? "rd.n.closeS.b" : "rd.n.close.b");
    case "returnProposed":
      if (profile === "hubDay")
        return refund === units ? t("rd.n.proposedS.b") : t("rd.n.proposedSP.b", values);
      if (profile === "minutes")
        return t("rd.n.proposedL.b", {
          ...values,
          done: Number(ctx.delivered),
          of: Number(ctx.serviceUnits),
        });
      return profile === "access" ? t("rd.n.proposed.b", values) : t("rd.n.proposed.t");
    case "transfersPending":
      return refund > 0n ? t("rd.n.legsBack.b", values) : t("rd.n.legsSun.b");
    case "returnFailed":
      return final?.refund.state === "failed"
        ? t("rd.n.legFailed.b", values)
        : t("rd.n.legFailedS.b");
    case "closed":
      if (ctx.kept)
        return profile !== "hubDay"
          ? t("rd.n.kept.t")
          : refund > 0n
            ? t("rd.n.keptBack.b", values)
            : t("rd.n.kept.b");
      // Settled before the promise closes: where the vouchers went, then the one step left.
      if (coreState !== "CANCELLED")
        return refund > 0n
          ? t("rd.n.settledBack.b", values)
          : t("rd.n.settled.b", { ...values, unit: unit(release) });
      return t(member ? "rd.n.closedEarlyM.b" : "rd.n.closedEarly.b", values);
    case "canceling":
      return t(bookingDeposited(ctx.setup) ? "rd.n.canceling.b" : "rd.n.cancelingNone.b");
    case "canceled":
      return one ? t("rd.n.canceledM.b") : t("rd.n.canceled.b", values);
    case "acceptedFirst":
      return t(member ? "rd.n.raceM.b" : "rd.n.race.b");
    case "termsChanged":
      return t(one ? "rd.n.changed1.b" : "rd.n.changed.b", values);
    case "problemReported":
      return problem
        ? t("rd.n.problem.b", { d3: date(problem.at), quote: problem.text })
        : t("rd.n.problem.t");
  }
}

function fact(
  id: ServiceFact["id"],
  label: string,
  value: string,
  detail: string | null
): ServiceFact {
  return { id, label, value, detail };
}

/** The stages whose acceptance deadline still matters: the booking isn't accepted yet. */
const ACCEPT_BY = new Set<BookingContext["stage"]>([
  "requestNotSent",
  "requestInTransit",
  "waitingApproval",
  "readyToDeposit",
  "confirmingDeposit",
  "waitingAcceptance",
]);

/** What the reader gets, in the offer's words. */
function getValue(ctx: BookingContext): string {
  const { t, profile } = ctx;
  if (profile === "hubDay") return t("of.s.get");
  if (profile === "access") return t("of.c.get");
  return `${ctx.serviceUnits.toString()} ${ctx.input.snapshot.offer?.unitLabel ?? ""}`.trim();
}

/** What the issuer reported, counted the way the service is (a hub day, days, minutes). */
function reportedValue(ctx: BookingContext): string {
  const { t, profile, delivered, refund, release } = ctx;
  const done = Number(delivered);
  const of = Number(ctx.serviceUnits);
  const value =
    profile === "access"
      ? t("rd.sh.deliveredC", { done, of: ctx.accessDays })
      : profile === "minutes"
        ? t("rd.sh.deliveredL", { done, of })
        : profile === "hubDay"
          ? delivered === 0n
            ? t("rd.f.reportedNone")
            : refund > 0n && release > 0n
              ? t("rd.sh.deliveredSP")
              : t("rd.sh.deliveredS")
          : t("rd.f.count", { done, of });
  const visit = ctx.input.schedule?.visitAt;
  return visit ? `${value} · ${ctx.date(visit)}` : value;
}

/**
 * The facts that matter now. An open offer says what you get, what it takes and who offers it; a
 * booking says what you get, where your vouchers are, the acceptance deadline while it matters,
 * and what was reported once it was.
 */
export function bookingFacts(ctx: BookingContext): ServiceFact[] {
  const { t, unit, count, isOne, units, n } = ctx;
  if (!ctx.setup) {
    const held = ctx.input.held;
    const issuer = t("rd.who.sun");
    const offered =
      ctx.profile === "hubDay"
        ? t("of.s.getS")
        : ctx.profile === "access"
          ? t("of.c.getS")
          : t("pay.v.getS", { issuerFull: ctx.input.issuer?.name ?? "" });
    return [
      fact("get", t("of.q.get"), getValue(ctx), offered),
      fact(
        "takes",
        t("rd.f.takes"),
        t("of.v.give", { n, unit: unit(units) }),
        held !== null ? t("of.v.giveS", { held: count(held) }) : null
      ),
      ...(issuer ? [fact("by", t("rd.f.by"), issuer, null)] : []),
    ];
  }
  const [amount, where] = vouchersNow(ctx);
  const facts = [
    fact("get", ctx.kept || ctx.endedEarly ? t("rd.f.got") : t("of.q.get"), getValue(ctx), null),
    fact(
      "vouchers",
      t("rd.f.vouchers", { count: isOne(amount) ? 1 : 2 }),
      `${count(amount)} ${where}`,
      null
    ),
  ];
  if (ctx.deadline !== null && ACCEPT_BY.has(ctx.stage))
    facts.push(fact("deadline", t("rd.f.deadline"), ctx.date(ctx.deadline), null));
  if (ctx.reported) facts.push(fact("reported", t("rd.f.reported"), reportedValue(ctx), null));
  return facts;
}

/**
 * What the page no longer says up front: who holds the vouchers, who acts next and what comes
 * back, under How booking works before a booking; once booked, what comes back if it falls short.
 */
export function bookingHowItWorks(ctx: BookingContext): ServiceFact[] {
  const { t, profile, member, accessDays } = ctx;
  const minutes = Number(ctx.serviceUnits);
  const back = ctx.setup
    ? fact(
        "back",
        t("rd.f.back"),
        profile === "access"
          ? t("rd.f.backC", { of: accessDays })
          : profile === "minutes"
            ? t("rd.f.backL", { of: minutes })
            : t("rd.f.backS"),
        t("rd.f.backSub")
      )
    : fact(
        "back",
        t("of.q.back"),
        member ? t("of.m.back", { count: ctx.one ? 1 : 2 }) : t("of.v.back"),
        profile === "hubDay"
          ? t("of.s.backS")
          : profile === "access"
            ? t("of.c.backS", { of: accessDays })
            : profile === "minutes"
              ? t("of.m.backS", { of: minutes })
              : t("rd.f.backS")
      );
  if (ctx.setup) return [back];
  return [
    fact("held", t("of.q.held"), t("of.v.held"), t("of.v.heldS")),
    member
      ? fact("next", t("of.q.next"), t("of.m.next"), t("of.m.nextS"))
      : fact("next", t("of.q.next"), t("of.v.next"), t("of.v.nextS")),
    back,
  ];
}

/** Where the reader's vouchers are at this stage: in the account, in escrow, or on their way. */
function vouchersNow(ctx: BookingContext): [bigint, string] {
  const { t, unit, isOne, units, refund, release } = ctx;
  const final = ctx.setup?.destination?.finalAllocation ?? null;
  const phrase = (key: string, amount: bigint) => t(key, { unit: unit(amount) });
  switch (ctx.stage) {
    case "requestNotSent":
    case "requestInTransit":
    case "waitingApproval":
    case "readyToDeposit":
    case "termsChanged":
    case "canceling": {
      // A cancellation's vouchers are where its deposit left them: in escrow once deposited.
      if (ctx.stage === "canceling" && bookingDeposited(ctx.setup))
        return [units, phrase("rd.b.held", units)];
      // The booking rests on the reader's own vouchers until the deposit: say so when they fall short.
      const held = ctx.input.held;
      if (held !== null && held < units)
        return [held, t("rd.b.short", { unit: unit(held), n: ctx.n })];
      return [units, phrase("rd.b.yours", units)];
    }
    case "canceled":
      return [units, phrase("rd.b.back", units)];
    case "transfersPending":
      return refund > 0n
        ? [refund, phrase("rd.b.coming", refund)]
        : [release, phrase(isOne(release) ? "rd.b.toSun1" : "rd.b.toSun", release)];
    case "returnFailed":
      return final?.refund.state === "failed"
        ? [refund, phrase("rd.b.retry", refund)]
        : [release, phrase("rd.b.retryS", release)];
    case "closed":
      return refund > 0n
        ? [refund, phrase("rd.b.backDone", refund)]
        : [release, phrase(isOne(release) ? "rd.b.sunDone1" : "rd.b.sunDone", release)];
    default:
      return [units, phrase("rd.b.held", units)];
  }
}
