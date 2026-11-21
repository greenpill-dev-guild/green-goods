import type {
  PassportVoucherLine,
  PassportVouchers,
} from "@green-goods/shared/commitment-pooling/public";
import { type IntlShape, useIntl } from "react-intl";
import {
  PassportFigure,
  PassportNote,
  PassportNothingYet,
  PassportSource,
  PassportUnitRows,
} from "./GardenPassportAtoms";
import { passportAmount } from "./gardenPassportFormat";

/**
 * Services booked with vouchers. Presentment, the delivery the holder approved, and where the
 * vouchers went afterwards are three separate things here: a voucher moving back to its issuer
 * is never read as a service delivered.
 */

/** One voucher's movements, in that voucher's own units. An unnamed voucher keeps no figure. */
function voucherRows(intl: IntlShape, line: PassportVoucherLine) {
  const { formatMessage } = intl;
  if (line.symbol === null || line.decimals === null) return [];
  const amount = (value: bigint) =>
    `${passportAmount(intl, value, line.decimals ?? 0)} ${line.symbol}`;
  return [
    {
      unitLabel: formatMessage({
        id: "public.passport.vouchers.used.presented",
        defaultMessage: "Presented for a booking",
      }),
      value: amount(line.presented),
    },
    {
      unitLabel: formatMessage({
        id: "public.passport.vouchers.used.returned",
        defaultMessage: "Back with the issuer after an approved delivery",
      }),
      value: amount(line.returnedToIssuer),
    },
    {
      unitLabel: formatMessage({
        id: "public.passport.vouchers.used.refunded",
        defaultMessage: "Back with the holder",
      }),
      value: amount(line.refundedToHolder),
    },
    {
      unitLabel: formatMessage({
        id: "public.passport.vouchers.used.waiting",
        defaultMessage: "Waiting to move",
      }),
      value: amount(line.awaitingTransfer),
    },
  ];
}

export function PassportBookings({ bookings }: { bookings: PassportVouchers["bookings"] }) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  if (bookings.withheld) {
    return (
      <PassportNote>{formatMessage({ id: "public.passport.vouchers.used.withheld" })}</PassportNote>
    );
  }
  if (bookings.requested === 0) {
    return (
      <PassportNothingYet>
        {formatMessage({
          id: "public.passport.vouchers.used.none",
          defaultMessage: "No service has been booked with a voucher yet.",
        })}
      </PassportNothingYet>
    );
  }
  const unnamed = bookings.amounts?.vouchers.some((line) => line.symbol === null) ?? false;
  return (
    <>
      <PassportFigure>
        {formatMessage(
          { id: "public.passport.vouchers.used.figure" },
          {
            count: bookings.requested,
            accepted: bookings.accepted,
            notStarted: bookings.notStarted,
          }
        )}
      </PassportFigure>
      {bookings.amounts ? (
        <>
          <PassportUnitRows
            label={formatMessage({
              id: "public.passport.vouchers.used.delivered",
              defaultMessage: "Delivered, as the holder approved it",
            })}
            rows={bookings.amounts.services.map((line) => ({
              unitLabel:
                line.unitLabel ??
                formatMessage({
                  id: "public.passport.vouchers.used.unlabeled",
                  defaultMessage: "Service units",
                }),
              value: formatMessage(
                { id: "public.passport.vouchers.used.deliveredOf" },
                {
                  delivered: formatNumber(line.confirmedDelivered),
                  booked: formatNumber(line.booked),
                }
              ),
            }))}
          />
          {bookings.amounts.vouchers.map((line) => (
            <PassportUnitRows
              key={line.token}
              label={formatMessage(
                { id: "public.passport.vouchers.used.movements" },
                { symbol: line.symbol ?? "" }
              )}
              rows={voucherRows(intl, line)}
            />
          ))}
        </>
      ) : (
        <PassportNote>
          {formatMessage({ id: "public.passport.vouchers.used.amountsHeld" })}
        </PassportNote>
      )}
      {unnamed ? (
        <PassportNote>
          {formatMessage({ id: "public.passport.vouchers.used.unnamed" })}
        </PassportNote>
      ) : null}
      {bookings.transfersFailed > 0 ? (
        <PassportNote>
          {formatMessage(
            { id: "public.passport.vouchers.used.transfersFailed" },
            { count: bookings.transfersFailed }
          )}
        </PassportNote>
      ) : null}
      <PassportSource>
        <p>{formatMessage({ id: "public.passport.vouchers.used.source" })}</p>
      </PassportSource>
    </>
  );
}
