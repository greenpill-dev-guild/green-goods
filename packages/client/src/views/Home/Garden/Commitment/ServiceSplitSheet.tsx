import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { formatVoucherMessage } from "./serviceBooking";
import type { ServiceBookingView } from "./serviceBookingTypes";
import { detailed } from "./ServiceRedeemSheet";
import { ServiceStepStrip } from "./ServiceStepStrip";

export interface ServiceSplitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ServiceBookingView;
  /** The promise's title, under the sheet's own. */
  title: string;
  isPending: boolean;
  onApprove: () => void;
  onReport: (() => void) | null;
}

/**
 * Approve the Final Split: the proportion as a bar with the exact figures under it, and one
 * checkbox saying what the reader received (V3). A full return delivered nothing, so it asks for
 * no such confirmation and never says the service happened. Approving freezes the split and moves
 * nothing by itself; each transfer runs after it with its own status. A hub day then asks Promise
 * kept?.
 */
export function ServiceSplitSheet({
  open,
  onOpenChange,
  view,
  title,
  isPending,
  onApprove,
  onReport,
}: ServiceSplitSheetProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const checkboxId = useId();
  const w = view.words;
  const split = view.split;
  // The box affirms one split's figures: a new proposal or a reopened sheet asks again.
  const figures = split ? `${split.delivered}:${split.release}:${split.refund}` : null;
  const [receivedFor, setReceivedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setReceivedFor(null);
  }, [open]);
  if (!split) return null;
  const received = receivedFor === figures;
  const t = (id: string, values: Record<string, string | number> = {}) =>
    formatVoucherMessage(intl, id, { issuer: w.issuer, ...values });
  const rel = w.count(split.release);
  const back = w.count(split.refund);
  const done = Number(split.delivered);
  const of = w.accessDays;
  const confirmsAfter = split.refund === 0n;
  // Nothing was delivered when the whole booking comes back: no "I had it" box, no received line.
  const delivered = split.delivered > 0n;
  // A hub day that returns part of its voucher was cut short, never the full day.
  const part = split.release > 0n && split.refund > 0n;
  const minutes = { done, of: Number(w.serviceUnits) };
  const deliveredValue =
    view.profile === "access"
      ? t("rd.sh.deliveredC", { done, of })
      : view.profile === "hubDay"
        ? t(part ? "rd.sh.deliveredSP" : "rd.sh.deliveredS")
        : view.profile === "minutes"
          ? t("rd.sh.deliveredL", minutes)
          : formatMessage({ id: "app.commitment.progress.count" }, minutes);
  const check =
    view.profile === "access"
      ? t("rd.sh.chkC", { done, of })
      : view.profile === "hubDay"
        ? t(part ? "rd.sh.chkSP" : "rd.sh.chkS")
        : view.profile === "minutes"
          ? t("rd.sh.chkL", minutes)
          : `${t("rd.sh.delivered")}: ${deliveredValue}`;
  const total = Number(split.release + split.refund) || 1;
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={t("rd.sh.splitTitle")}
      description={title}
      size="md"
      sheetSize="full"
      actions={{
        primary: {
          label: t("rd.sh.approve"),
          loading: isPending,
          disabled: delivered && !received,
          onClick: onApprove,
        },
        secondary: onReport
          ? { label: t("rd.a.report"), disabled: isPending, onClick: onReport }
          : undefined,
      }}
    >
      <div className="space-y-4" data-component="ServiceSplitSheet">
        <ServiceStepStrip
          label={t("pay.journey")}
          steps={[
            { id: "split", label: t("rd.sh.split"), state: "now" },
            ...(confirmsAfter
              ? [{ id: "kept", label: t("rd.sh.kept"), state: "todo" as const }]
              : []),
          ]}
        />
        <div
          className="flex h-8 overflow-hidden rounded-[var(--radius-md)] border border-stroke-soft-200 text-xs font-bold"
          role="img"
          aria-label={t("rd.sh.bar", { rel, back })}
          data-component="ServiceSplitBar"
        >
          {split.release > 0n ? (
            <span
              className="grid min-w-0 place-items-center truncate bg-bg-weak-50 px-1 text-text-strong-950"
              style={{ flex: Number(split.release) / total }}
            >
              {t("rd.sh.relShort", { rel })}
            </span>
          ) : null}
          {split.refund > 0n ? (
            <span
              className="grid min-w-0 place-items-center truncate bg-primary-alpha-10 px-1 text-primary-on-surface"
              style={{ flex: Number(split.refund) / total }}
            >
              {t("rd.sh.backShort", { back })}
            </span>
          ) : null}
        </div>
        <FactList frame="inset">
          {delivered ? (
            <FactRow
              label={t("rd.sh.delivered")}
              value={detailed(deliveredValue, t("rd.sh.deliveredSub"))}
            />
          ) : null}
          <FactRow
            label={t("rd.sh.toSun")}
            value={detailed(
              t("rd.sh.toSunV", { rel, unit: w.unit(split.release) }),
              split.release === 0n
                ? null
                : view.profile === "access"
                  ? t("rd.sh.toSunC", { done })
                  : view.profile === "hubDay"
                    ? t("rd.sh.toSunS")
                    : view.profile === "minutes"
                      ? t("rd.sh.toSunL", { done })
                      : null
            )}
          />
          <FactRow
            label={t("rd.sh.toYou")}
            value={detailed(
              t("rd.sh.toYouV", { back, unit: w.unit(split.refund) }),
              split.refund > 0n
                ? t("rd.sh.toYouSub")
                : view.profile === "hubDay"
                  ? t("rd.sh.toYouNone")
                  : null
            )}
          />
        </FactList>
        {delivered ? (
          <label
            htmlFor={checkboxId}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] bg-bg-weak-50 p-3 text-sm text-text-strong-950"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={received}
              disabled={isPending}
              onChange={(event) => setReceivedFor(event.target.checked ? figures : null)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary-on-surface)]"
            />
            <span>{check}</span>
          </label>
        ) : null}
        <Alert variant="info" title={t("rd.sh.finalT")} className="p-3">
          {t("rd.sh.finalB")}
        </Alert>
        <p className="text-xs text-text-sub-600">{t("rd.sh.footSplit")}</p>
      </div>
    </DialogShell>
  );
}
