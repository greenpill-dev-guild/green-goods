import type { BookingContext, ServiceFact } from "./serviceBookingTypes";

/**
 * The one status message, from the reader's seat, with the title where a value has no read. A
 * member's words count the vouchers the booking takes, one or more.
 */
export function bookingSentence(ctx: BookingContext): string {
  const { t, stage, profile, member, values, one, refund, units, date } = ctx;
  const { coreState, schedule, problem } = ctx.input;
  const final = ctx.setup?.destination?.finalAllocation ?? null;
  const counted = { ...values, count: one ? 1 : 2 };
  switch (stage) {
    case "open":
    case "notEnough":
      return t("pp.band.openV");
    case "requestNotSent":
      return t("wait.requestNotSent");
    case "requestInTransit":
      return t("wait.requestInTransit");
    case "activationInTransit":
      return t("wait.activationInTransit");
    case "waitingApproval":
      if (member) return t("rd.n.approvalM.b", counted);
      return ctx.sigs ? t("rd.band.approval", { sigs: ctx.sigs }) : t("rd.n.approval.t");
    case "readyToDeposit":
      if (member) return t("rd.n.depositM.b", counted);
      return t(one ? "rd.n.deposit1.b" : "rd.n.deposit.b", values);
    case "confirmingDeposit":
      return member ? t("rd.n.confirmingM.b", counted) : t("rd.n.confirming.b");
    case "waitingAcceptance":
      if (member) return t("rd.n.acceptanceM.b", counted);
      return t(one ? "rd.n.acceptance1.b" : "rd.n.acceptance.b", values);
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
      return t(profile === "access" ? "rd.n.courseOn.t" : "rd.n.sessionOn.t");
    case "readyToClose":
      return t("rd.n.close.b");
    case "returnProposed":
      if (profile === "hubDay" && refund === units) return t("rd.n.proposedS.b");
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
      if (ctx.kept) return profile === "hubDay" ? t("rd.n.kept.b") : t("rd.n.kept.t");
      if (coreState !== "CANCELLED") return t("rd.n.closedEarly.t");
      return t(member ? "rd.n.closedEarlyM.b" : "rd.n.closedEarly.b", values);
    case "canceling":
      return t("rd.n.canceling.b");
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

/**
 * Service Access's facts: an offer answers what you get, what you give, who holds it, who acts
 * next and what can come back; a booking says where the reader's vouchers are now, its
 * acceptance deadline and its remedy.
 */
export function bookingFacts(ctx: BookingContext): ServiceFact[] {
  const { t, unit, count, profile, member, units, n, accessDays } = ctx;
  const minutes = Number(ctx.serviceUnits);
  if (!ctx.setup) {
    const offer = ctx.input.snapshot.offer;
    const held = ctx.input.held;
    return [
      profile === "hubDay"
        ? fact("get", t("of.q.get"), t("of.s.get"), t("of.s.getS"))
        : profile === "access"
          ? fact("get", t("of.q.get"), t("of.c.get"), t("of.c.getS"))
          : fact(
              "get",
              t("of.q.get"),
              `${ctx.serviceUnits.toString()} ${offer?.unitLabel ?? ""}`.trim(),
              t("pay.v.getS", { issuerFull: ctx.input.issuer?.name ?? "" })
            ),
      fact(
        "give",
        t("of.q.give"),
        t("of.v.give", { n, unit: unit(units) }),
        held !== null ? t("of.v.giveS", { held: count(held) }) : null
      ),
      fact("held", t("of.q.held"), t("of.v.held"), t("of.v.heldS")),
      member
        ? fact("next", t("of.q.next"), t("of.m.next"), t("of.m.nextS"))
        : fact("next", t("of.q.next"), t("of.v.next"), t("of.v.nextS")),
      fact(
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
      ),
    ];
  }
  const [amount, where] = vouchersNow(ctx);
  const facts = [fact("vouchers", t("rd.f.vouchers"), `${count(amount)} ${where}`, null)];
  if (ctx.deadline !== null)
    facts.push(
      fact(
        "deadline",
        t("rd.f.deadline"),
        ctx.date(ctx.deadline),
        t(member ? "rd.f.deadlineSM" : "rd.f.deadlineS")
      )
    );
  facts.push(
    fact(
      "back",
      t("rd.f.back"),
      profile === "access"
        ? t("rd.f.backC", { of: accessDays })
        : profile === "minutes"
          ? t("rd.f.backL", { of: minutes })
          : t("rd.f.backS"),
      t("rd.f.backSub")
    )
  );
  return facts;
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
      return [units, phrase("rd.b.yours", units)];
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
