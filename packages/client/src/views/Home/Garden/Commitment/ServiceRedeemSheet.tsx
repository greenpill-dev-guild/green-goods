import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { formatVoucherMessage } from "./serviceBooking";
import type { ServiceBookingView } from "./serviceBookingTypes";
import { type ServiceStripStep, ServiceStepStrip } from "./ServiceStepStrip";

/** What the sheet answers after its act, or why its act can't be taken. */
export type ServiceRedeemOutcome =
  | "noResult"
  | "nothingSent"
  | "notEnough"
  | "signingUnavailable"
  | "paused"
  | "offline"
  | null;

export interface ServiceRedeemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ServiceBookingView;
  /** The terms the reader opened the sheet on; a change since needs a fresh agreement. */
  reviewed: { revision: bigint; units: bigint } | null;
  /** The deadline agreeing would set: seven days from the source chain's own time. */
  agreeDeadline: string | null;
  outcome: ServiceRedeemOutcome;
  held: bigint | null;
  isPending: boolean;
  onAgree: () => void;
  onDeposit: () => void;
  onCheck: () => void;
  onExchange: () => void;
  /** Whether a pool can quote an exchange; without one, too few vouchers has no Exchange act. */
  canExchange: boolean;
}

/** A fact's value with its one line of detail under it (D1 Full copy). */
export function detailed(value: ReactNode, detail: ReactNode | null) {
  return (
    <>
      {value}
      {detail ? (
        <span className="mt-0.5 block text-xs font-normal leading-4 text-text-sub-600">
          {detail}
        </span>
      ) : null}
    </>
  );
}

/**
 * Review and Redeem, the booking sheet over the promise page. Its strip shows a booking's four
 * steps (V1), its terms are a fact list, and every write says the passkey asks first. Agreeing
 * records consent and moves nothing; a deposit may ask twice, to allow and then to deposit.
 */
export function ServiceRedeemSheet({
  open,
  onOpenChange,
  view,
  reviewed,
  agreeDeadline,
  outcome,
  held,
  isPending,
  onAgree,
  onDeposit,
  onCheck,
  onExchange,
  canExchange,
}: ServiceRedeemSheetProps) {
  const intl = useIntl();
  const w = view.words;
  const t = (id: string, values: Record<string, string | number> = {}) =>
    formatVoucherMessage(intl, id, { issuer: w.issuer, issuerFull: w.issuer, ...values });
  // Agree, the issuer's approval, the deposit, and the issuer's acceptance.
  const at =
    view.stage === "open" || view.stage === "notEnough"
      ? 0
      : view.stage === "waitingApproval"
        ? 1
        : view.stage === "readyToDeposit"
          ? 2
          : 3;
  const strip: ServiceStripStep[] = (
    [
      ["agree", t("pay.j.agree"), false],
      ["approved", t("pay.j.approved"), true],
      ["deposit", t("pay.j.deposit"), false],
      ["accepted", t("pay.j.accepted"), true],
    ] as const
  ).map(([id, label, theirs], index) => ({
    id,
    label,
    state: index < at ? "done" : index === at ? (theirs ? "wait" : "now") : "todo",
  }));
  const notice = (variant: "info" | "warning" | "success", title: string, text: string) => (
    <Alert variant={variant} title={title} className="p-3">
      {text}
    </Alert>
  );
  const changed =
    at === 0 &&
    reviewed !== null &&
    (reviewed.revision !== w.revision || reviewed.units !== w.units);
  const nothingSent =
    outcome === "nothingSent" ? notice("info", t("pay.n.cancel.t"), t("pay.n.cancel.b")) : null;

  let stepTitle: string;
  let body: ReactNode;
  let actions: SheetActionsProps;
  let passkey = true;
  if (outcome === "noResult") {
    stepTitle = at <= 1 ? t("pay.step.agree") : t(w.one ? "pay.step.deposit1" : "pay.step.deposit");
    body = notice("warning", t("pay.n.nores.t"), t("pay.n.noresD.b"));
    actions = { primary: { label: t("pay.cta.checkD"), loading: isPending, onClick: onCheck } };
    passkey = false;
  } else if (at === 0) {
    stepTitle = t("pay.step.agree");
    body = (
      <>
        {changed ? notice("warning", t("pay.n.changed.t"), t("pay.n.changedV.b")) : null}
        <FactList frame="inset">
          <FactRow label={t("pay.f.get")} value={detailed(w.get, t("pay.v.getS"))} />
          <FactRow
            label={
              changed ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  {t("pay.f.give")}
                  <StatusBadge size="xs" variant="warning" showIcon={false}>
                    {t("pay.changed")}
                  </StatusBadge>
                </span>
              ) : (
                t("pay.f.give")
              )
            }
            value={detailed(
              t("pay.v.give", { n: w.n, unit: w.unit(w.units) }),
              changed && reviewed
                ? t("pay.v.was", { n: w.count(reviewed.units) })
                : held !== null
                  ? t("pay.v.giveS", { held: w.count(held) })
                  : null
            )}
          />
          <FactRow label={t("pay.f.held")} value={detailed(t("pay.v.held"), t("pay.v.heldS"))} />
          {agreeDeadline ? (
            <FactRow
              label={t("pay.f.deadline")}
              value={detailed(
                agreeDeadline,
                w.one ? t("pay.v.deadline1S") : t("pay.v.deadlineS", { n: w.n })
              )}
            />
          ) : null}
          <FactRow
            label={t("pay.f.after")}
            value={detailed(
              view.profile === "access"
                ? t("pay.c.after", { of: w.accessDays })
                : view.profile === "hubDay"
                  ? t("pay.s.after")
                  : t("rd.f.backS"),
              t("pay.v.afterS")
            )}
          />
          {view.termsVersion ? <FactRow label={t("c.terms")} value={view.termsVersion} /> : null}
        </FactList>
        {nothingSent}
        {outcome === "offline" ? notice("info", t("pay.r.offline.t"), t("pay.r.offlineV.b")) : null}
        <p className="text-sm text-text-sub-600">{t("pay.v.consent")}</p>
      </>
    );
    actions = {
      primary: {
        label: outcome === "nothingSent" ? t("pay.cta.retry") : t("pay.cta.agree"),
        loading: isPending,
        disabled: outcome === "offline",
        onClick: onAgree,
      },
    };
  } else if (at === 1) {
    stepTitle = t("pay.step.wait");
    body = notice(
      "info",
      t("pay.v.wait.t"),
      w.sigs ? t("pay.v.wait.b", { sigs: w.sigs }) : t("rd.n.approval.t")
    );
    actions = { primary: { label: t("c.done"), onClick: () => onOpenChange(false) } };
    passkey = false;
  } else if (at === 2) {
    stepTitle = t(w.one ? "pay.step.deposit1" : "pay.step.deposit");
    const why =
      outcome === "notEnough"
        ? notice(
            "warning",
            t("pay.r.shortV.t", { have: w.count(held ?? 0n), unit: w.unit(held ?? 0n) }),
            t("pay.r.shortV.b", { n: w.n })
          )
        : outcome === "signingUnavailable"
          ? notice("warning", t("pay.r.unavail.t"), t("pay.r.unavail.b"))
          : outcome === "paused"
            ? notice("warning", t("pay.r.paused.t"), t("pay.r.paused.b"))
            : outcome === "offline"
              ? notice("info", t("pay.r.offline.t"), t("pay.r.offlineV.b"))
              : null;
    body = (
      <>
        <FactList frame="inset">
          <FactRow label={t("pay.f.deposit")} value={detailed(w.vouchers, t("pay.v.depositS"))} />
          <FactRow label={t("pay.f.into")} value={t("pay.v.into")} />
          {w.deadline ? <FactRow label={t("pay.f.deadline")} value={w.deadline} /> : null}
        </FactList>
        {nothingSent}
        {why}
        <p className="text-sm text-text-sub-600">
          {w.one ? t("pay.m.depNote") : t("pay.v.depNote", { n: w.n })}
        </p>
      </>
    );
    actions =
      outcome === "notEnough"
        ? canExchange
          ? { primary: { label: t("of.a.exchange"), onClick: onExchange } }
          : { primary: { label: t("c.done"), onClick: () => onOpenChange(false) } }
        : {
            primary: {
              label:
                outcome === "nothingSent"
                  ? t("pay.cta.retry")
                  : w.one
                    ? t("pay.m.deposit")
                    : t("pay.cta.deposit", { n: w.n }),
              loading: isPending,
              disabled:
                outcome === "signingUnavailable" || outcome === "paused" || outcome === "offline",
              onClick: onDeposit,
            },
          };
    passkey = outcome !== "notEnough";
  } else {
    stepTitle = t("pay.step.accept");
    body = notice("success", t("pay.n.deposited.t"), t("pay.n.deposited.b"));
    actions = { primary: { label: t("pay.cta.viewB"), onClick: () => onOpenChange(false) } };
    passkey = false;
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={t("pay.titleV")}
      size="md"
      sheetSize="full"
      actions={actions}
    >
      <div className="space-y-4" data-component="ServiceRedeemSheet" data-step={at}>
        <ServiceStepStrip steps={strip} label={t("pay.journey")} />
        <SheetHeading>{stepTitle}</SheetHeading>
        {body}
        {passkey ? <p className="text-xs text-text-sub-600">{t("c.passkey")}</p> : null}
      </div>
    </DialogShell>
  );
}
