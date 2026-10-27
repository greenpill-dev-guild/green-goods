import type {
  ServiceIssuerAction,
  ServiceIssuerAsset,
  ServiceIssuerBooking,
  ServiceIssuerBookings as Bookings,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import type {
  ItemRowDetail,
  ItemRowTone,
} from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import { RiArrowGoBackLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import {
  type IssuerBookingState,
  issuerAmount,
  issuerBookingState,
} from "./serviceIssuerPresentation";

interface Props {
  bookings: Bookings;
  asset: ServiceIssuerAsset;
  /** The reviewed action still being checked, so its booking reads as confirming. */
  pending: ServiceIssuerAction | null;
  disabled: boolean;
  onApprove: (booking: ServiceIssuerBooking) => void;
  onPropose: (booking: ServiceIssuerBooking) => void;
}

const PILL: Record<IssuerBookingState, { id: string; tone: ItemRowTone }> = {
  approve: { id: "app.commitments.row.needsYou", tone: "warning" },
  confirming: { id: "app.voucher.ms.t.confirming", tone: "info" },
  deposit: { id: "app.voucher.ms.t.booked", tone: "info" },
  accept: { id: "app.voucher.ms.t.booked", tone: "info" },
  active: { id: "app.voucher.ms.t.active", tone: "info" },
  proposed: { id: "app.voucher.ms.t.proposed", tone: "info" },
  settling: { id: "app.voucher.ms.t.settling", tone: "info" },
  delivered: { id: "app.voucher.ms.t.delivered", tone: "success" },
  unapproved: { id: "app.voucher.ms.t.unapproved", tone: "neutral" },
  canceled: { id: "app.voucher.ms.t.canceled", tone: "neutral" },
};

/**
 * Bookings on the member's service are people with a booking (DL-112): each row is the holder,
 * the booking's state as its pill, and the member's act in the right slot. Only canonically
 * verified issuer records supply the binding an approval or a return is reviewed against.
 */
export function ServiceIssuerBookings({
  bookings,
  asset,
  pending,
  disabled,
  onApprove,
  onPropose,
}: Props) {
  const { formatMessage, formatDate, locale } = useIntl();
  const t = (id: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.voucher.ms.${id}` }, values);
  const amount = (value: bigint) => issuerAmount(value, asset, locale);
  const details = (
    b: ServiceIssuerBooking,
    state: IssuerBookingState
  ): readonly ItemRowDetail[] => {
    const split = b.finalAllocation?.allocation;
    switch (state) {
      case "approve":
        return [
          t("d.asked"),
          t("d.acceptBy", {
            date: formatDate(Number(b.authorization.acceptanceDeadline) * 1000, {
              month: "short",
              day: "numeric",
            }),
          }),
        ];
      case "confirming":
        return [t("d.pending")];
      case "deposit":
        return [t("d.deposit")];
      case "accept":
        return [t("d.accept")];
      case "active":
        return [amount(b.authorization.voucherUnits)];
      case "proposed":
        return [t("d.upTo", { amount: amount(b.issuerReturnCeiling) }), t("d.decides")];
      case "settling":
        return [
          t("d.toReserve", { amount: amount(split!.releaseVoucherUnits) }),
          t("d.toHolder", { amount: amount(split!.refundVoucherUnits) }),
        ];
      case "delivered":
        return [t("d.toReserve", { amount: amount(split!.releaseVoucherUnits) })];
      case "unapproved":
        return [b.reviewedTermsMatch ? t("d.lapsed") : t("d.earlier")];
      case "canceled":
        return [amount(b.authorization.voucherUnits)];
    }
  };
  return (
    <section className="space-y-2" data-component="ServiceIssuerBookings">
      <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{t("book.t")}</h3>
      <p className="text-xs text-text-sub-600">
        {bookings.status === "unavailable"
          ? t("book.unavailable")
          : bookings.status === "partial"
            ? t("book.partial")
            : bookings.records.length === 0
              ? t("book.none")
              : t("book.note")}
      </p>
      {bookings.records.length > 0 ? (
        <ul className="flex flex-col gap-[var(--gg-list-gap,12px)]">
          {bookings.records.map((record) => {
            const state = issuerBookingState(record, pending);
            const [first, second] = details(record, state);
            const act =
              state === "approve" ? (
                <Button
                  type="button"
                  size="sm"
                  data-act="approve"
                  disabled={disabled}
                  onClick={() => onApprove(record)}
                >
                  {t("a.review")}
                </Button>
              ) : record.returnEligible && (state === "active" || state === "proposed") ? (
                // An icon keeps the pill readable beside it; its name is also its tooltip.
                <IconButton
                  type="button"
                  size="sm"
                  emphasis="secondary"
                  data-act="propose"
                  aria-label={t("a.propose")}
                  title={t("a.propose")}
                  icon={<RiArrowGoBackLine aria-hidden="true" />}
                  disabled={disabled}
                  onClick={() => onPropose(record)}
                />
              ) : undefined;
            return (
              <li key={`${record.setupId}:${record.authorizationHash}`}>
                <PersonRow
                  address={record.authorization.holder}
                  status={{ label: formatMessage({ id: PILL[state].id }), tone: PILL[state].tone }}
                  details={second ? [first!, second] : [first!]}
                  action={act}
                  data-state={state}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
