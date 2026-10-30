import type {
  BookingContext,
  BookingHistoryAnchor,
  ServiceBookingView,
  ServiceConfirmExtras,
  ServicePhase,
  ServiceStep,
  ServiceStepState,
  ServiceTransfer,
} from "./serviceBookingTypes";

function phase(
  id: ServicePhase["id"],
  title: string,
  who: string,
  steps: ServiceStep[]
): ServicePhase {
  const state: ServiceStepState = steps.some((s) => s.state === "fail")
    ? "fail"
    : steps.some((s) => s.state === "warn")
      ? "warn"
      : steps.every((s) => s.state === "done")
        ? "done"
        : steps.some((s) => s.state === "now" || s.state === "done")
          ? "now"
          : "todo";
  return { id, title, who, state, steps };
}

/** The booking's steps grouped into phases, each naming who acts (V2). */
export function bookingPhases(ctx: BookingContext): ServicePhase[] {
  const { t, stage, profile, member, pos, setup, one, n, units, date } = ctx;
  if (!setup) return [];
  const d = setup.destination;
  const final = d?.finalAllocation ?? null;
  const at = (i: number): ServiceStepState => (pos > i ? "done" : pos === i ? "now" : "todo");
  const step = (
    id: string,
    text: string,
    state: ServiceStepState,
    stateLabel = t(`pu.s.${state}`)
  ): ServiceStep => ({ id, text, state, stateLabel });
  // The steps that are the promise's own events take their time from them in History.
  const dated = (entry: ServiceStep, anchor: BookingHistoryAnchor): ServiceStep => ({
    ...entry,
    anchor,
  });
  const canceled = stage === "canceling" || stage === "canceled";
  // Decision 3 sets the deadline seven days from agreeing, so the agreement's day reads from it.
  const agreedAt = ctx.deadline !== null ? ctx.deadline - 7n * 86_400n : null;
  const phases = [
    phase("booked", t("rd.p.booked"), t("rd.who.booked"), [
      dated(
        step(
          "agreed",
          agreedAt !== null ? t("rd.sub.agreed", { date: date(agreedAt) }) : t("pay.j.agree"),
          "done"
        ),
        "CLAIM_REQUESTED"
      ),
      step(
        "approved",
        t("rd.sub.approved"),
        d?.result.issuerApproved ? "done" : canceled ? "todo" : at(0)
      ),
      step(
        "deposited",
        one ? t("rd.sub.depositedM") : t("rd.sub.deposited", { n }),
        (d?.result.depositedUnits ?? 0n) > 0n ? "done" : canceled ? "todo" : at(1)
      ),
      step(
        "confirmed",
        t("rd.sub.confirmed"),
        setup.source.setupResult?.depositedUnits === units ? "done" : canceled ? "todo" : at(2)
      ),
    ]),
  ];
  if (canceled)
    return [
      ...phases,
      phase("canceled", t("rd.p.canceled"), t("rd.who.you"), [
        step("cancelAsked", t("rd.sub.cancelAsked"), "done"),
        step(
          "returned",
          one ? t("rd.sub.returnedM") : t("rd.sub.returned", { n }),
          stage === "canceled" ? "done" : "now"
        ),
      ]),
    ];
  const visit = ctx.input.schedule;
  const deliveredText =
    profile === "access"
      ? t("rd.sub.lessons", { done: ctx.daysDone ?? 0, of: ctx.accessDays })
      : profile === "hubDay" && visit?.visitAt && visit.from && visit.to
        ? t("rd.sub.session", { date: date(visit.visitAt), from: visit.from, to: visit.to })
        : profile === "minutes" && ctx.reported
          ? t("rd.sub.minutes", { done: Number(ctx.delivered), of: Number(ctx.serviceUnits) })
          : t("rd.who.sunReports");
  const flagged = stage === "problemReported" || stage === "returnProposed";
  return [
    ...phases,
    // A member approves their own bookings; the garden's stewards accept them.
    phase("accepted", t("rd.p.accepted"), t(member ? "rd.who.stewards" : "rd.who.sun"), [
      dated(
        step(
          "accepted",
          t(member ? "rd.sub.acceptedM" : "rd.sub.accepted"),
          stage === "termsChanged" ? "warn" : at(3)
        ),
        "ACCEPTED"
      ),
      step("started", t("rd.sub.started"), at(4)),
    ]),
    phase(
      "delivery",
      t(
        profile === "access"
          ? "rd.p.lessons"
          : profile === "minutes"
            ? "rd.p.lesson"
            : "rd.p.session"
      ),
      t("rd.who.sunReports"),
      [
        dated(
          step(
            "delivered",
            deliveredText,
            flagged ? "warn" : at(5),
            stage === "problemReported"
              ? t("pu.s.disputed")
              : stage === "returnProposed"
                ? t("pu.s.review")
                : undefined
          ),
          "READY_FOR_CONFIRMATION"
        ),
      ]
    ),
    // A full delivery closes with the member's confirmation; an early end, with the stewards'.
    phase("close", t("rd.p.close"), t("rd.who.youThen"), [
      step(
        "split",
        t("rd.sub.split"),
        final ? "done" : stage === "readyToClose" || stage === "returnProposed" ? "now" : "todo"
      ),
      step(
        "transfers",
        t("rd.sub.transfers"),
        stage === "closed"
          ? "done"
          : stage === "returnFailed"
            ? "fail"
            : stage === "transfersPending"
              ? "now"
              : "todo"
      ),
      ctx.refund === 0n
        ? dated(
            step("kept", t("rd.sub.kept"), ctx.kept ? "done" : final ? "now" : "todo"),
            "FULFILLED"
          )
        : dated(
            step("closedEarly", t("rd.sub.closedEarly"), ctx.endedEarly ? "done" : "todo"),
            "CANCELLED"
          ),
    ]),
  ];
}

/** Each transfer the split fixed, with its own pill: pending until it arrives (V4). */
export function bookingTransfers(ctx: BookingContext): ServiceTransfer[] {
  const { t, refund, release, values } = ctx;
  const final = ctx.setup?.destination?.finalAllocation;
  if (!final) return [];
  const pill = (state: string): Pick<ServiceTransfer, "state" | "stateLabel"> =>
    state === "succeeded"
      ? { state: "succeeded", stateLabel: t("rd.leg.done") }
      : state === "failed"
        ? { state: "failed", stateLabel: t("rd.leg.failed") }
        : { state: "pending", stateLabel: t("rd.leg.pending") };
  const transfers: ServiceTransfer[] = [];
  if (refund > 0n)
    transfers.push({
      id: "refund",
      label: t("rd.leg.back", { n: values.back! }),
      detail:
        final.refund.state === "failed"
          ? t("rd.leg.backFail", { n: values.back! })
          : t("rd.leg.backSub"),
      ...pill(final.refund.state),
    });
  if (release > 0n)
    transfers.push({
      id: "release",
      label: t("rd.leg.rel", { n: values.rel! }),
      detail:
        final.release.state === "failed"
          ? t("rd.leg.relFail", { n: values.rel! })
          : t("rd.leg.relSub"),
      ...pill(final.release.state),
    });
  return transfers;
}

/** Chains, Safes and record numbers, only under Transaction details (D2). */
export function bookingDetails(ctx: BookingContext): string[] {
  const a = ctx.setup?.authorization;
  if (!a) return [];
  return [
    ctx.t("rd.x.escrow"),
    ctx.t("rd.x.record", { id: a.commitmentId.toString(), v: a.termsRevision.toString() }),
    ctx.t("rd.x.receipts"),
  ];
}

/** Progress and proof: the delivered count once someone reported it, else who reports it. */
export function bookingDelivery(ctx: BookingContext): ServiceBookingView["delivery"] {
  if (!ctx.setup) return null;
  const counted = ctx.reported || (ctx.profile === "access" && ctx.daysDone !== null);
  if (ctx.pos < 5 || !counted) return { none: ctx.t("rd.prog.none") };
  if (ctx.profile === "access")
    return { label: ctx.t("rd.prog.lessons"), done: ctx.daysDone ?? 0, of: ctx.accessDays };
  return {
    label: ctx.t(ctx.profile === "minutes" ? "rd.prog.minutes" : "rd.prog.session"),
    done: Number(ctx.delivered),
    of: Number(ctx.serviceUnits),
  };
}

/** Promise kept? once the split is final: the strip at its last step and the approved split. */
export function bookingConfirm(ctx: BookingContext): ServiceConfirmExtras | null {
  const final = ctx.setup?.destination?.finalAllocation;
  if (!final) return null;
  const { t } = ctx;
  // Settlement and confirming are separate: the transfers may finish before the member confirms.
  const arrived = [final.release.state, final.refund.state].every(
    (state) => state === "succeeded" || state === "not-required"
  );
  return {
    stepsLabel: t("pay.journey"),
    steps: [
      { id: "split", label: t("rd.sh.split"), state: "done" },
      { id: "kept", label: t("rd.sh.kept"), state: "now" },
    ],
    split: {
      label: t("rd.sh.splitDone"),
      value: t("rd.sh.splitDoneV", { rel: ctx.values.rel }),
      detail: t(arrived ? "rd.sh.splitArrived" : "rd.sh.splitDoneS"),
    },
    note: t("rd.sh.confirmNote"),
    passkey: t("c.passkey"),
  };
}
