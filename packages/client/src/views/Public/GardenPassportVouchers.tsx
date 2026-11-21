import type {
  PassportSection,
  PassportVouchers,
} from "@green-goods/shared/commitment-pooling/public";
import { useIntl } from "react-intl";
import {
  PassportFigure,
  PassportFreshness,
  PassportLine,
  PassportNote,
  PassportNothingYet,
  PassportSource,
  PassportUnavailable,
  PassportUnitRows,
} from "./GardenPassportAtoms";
import { PassportBookings } from "./GardenPassportBookings";
import { Section } from "./GardenDetailSections";

/**
 * `§ 01 Vouchers` on the passport. A voucher on offer, a voucher earned, a voucher bought and a
 * voucher used are four different facts, so each has its own line and none is added to another.
 * A voucher going back to its issuer is not delivery: only the holder's approval is.
 */
export function PassportVouchersSection({
  vouchers,
  onRetry,
}: {
  vouchers: PassportSection<PassportVouchers>;
  onRetry: () => void;
}) {
  const { formatMessage, formatNumber } = useIntl();
  const meta = vouchers.status === "available" ? <PassportFreshness asOf={vouchers.asOf} /> : null;
  const value = vouchers.status === "available" ? vouchers.value : null;
  return (
    <Section
      id="public-passport-vouchers"
      kicker={formatMessage({
        id: "public.passport.vouchers.kicker",
        defaultMessage: "§ 01: Vouchers",
      })}
      heading={formatMessage({
        id: "public.passport.vouchers.heading",
        defaultMessage: "Vouchers for services",
      })}
      helper={formatMessage({ id: "public.passport.vouchers.helper" })}
    >
      <div className="border-b border-stroke-soft-200">
        <PassportLine
          id="passport-vouchers-offer"
          label={formatMessage({
            id: "public.passport.vouchers.offer.label",
            defaultMessage: "On offer",
          })}
          meta={meta}
        >
          {!value ? (
            <PassportUnavailable onRetry={onRetry} />
          ) : value.offersBookable === 0 ? (
            <PassportNothingYet>
              {formatMessage({
                id: "public.passport.vouchers.offer.none",
                defaultMessage: "No service is on offer for vouchers right now.",
              })}
            </PassportNothingYet>
          ) : (
            <>
              <PassportFigure>
                {formatMessage(
                  {
                    id: "public.passport.vouchers.offer.figure",
                    defaultMessage:
                      "{count, plural, one {# offer can be booked with a voucher} other {# offers can be booked with a voucher}}",
                  },
                  { count: value.offersBookable }
                )}
              </PassportFigure>
              <PassportUnitRows
                label={formatMessage({
                  id: "public.passport.units.label",
                  defaultMessage: "By unit",
                })}
                rows={value.capacityOnOffer.map((line) => ({
                  unitLabel: line.unitLabel,
                  value: formatNumber(line.units),
                }))}
              />
              <PassportNote>
                {formatMessage({ id: "public.passport.vouchers.offer.note" })}
              </PassportNote>
            </>
          )}
        </PassportLine>

        <PassportLine
          id="passport-vouchers-earned"
          label={formatMessage({
            id: "public.passport.vouchers.earned.label",
            defaultMessage: "Earned through work",
          })}
          meta={meta}
        >
          {!value ? <PassportUnavailable onRetry={onRetry} /> : <Earned earned={value.earned} />}
        </PassportLine>

        <PassportLine
          id="passport-vouchers-bought"
          label={formatMessage({
            id: "public.passport.vouchers.bought.label",
            defaultMessage: "Bought",
          })}
        >
          <PassportNothingYet>
            {formatMessage({
              id: "public.passport.vouchers.bought.none",
              defaultMessage: "No vouchers bought.",
            })}
          </PassportNothingYet>
          <PassportNote>
            {formatMessage({ id: "public.passport.vouchers.bought.note" })}
          </PassportNote>
        </PassportLine>

        <PassportLine
          id="passport-vouchers-used"
          label={formatMessage({
            id: "public.passport.vouchers.used.label",
            defaultMessage: "Used for services",
          })}
          meta={meta}
        >
          {!value ? (
            <PassportUnavailable onRetry={onRetry} />
          ) : (
            <PassportBookings bookings={value.bookings} />
          )}
        </PassportLine>

        <PassportLine
          id="passport-vouchers-pool"
          label={formatMessage({
            id: "public.passport.vouchers.pool.label",
            defaultMessage: "In the exchange pool",
          })}
        >
          <PassportNothingYet>
            {formatMessage({
              id: "public.passport.vouchers.pool.none",
              defaultMessage: "Not published here yet.",
            })}
          </PassportNothingYet>
          <PassportNote>{formatMessage({ id: "public.passport.vouchers.pool.note" })}</PassportNote>
        </PassportLine>
      </div>
    </Section>
  );
}

function Earned({ earned }: { earned: PassportVouchers["earned"] }) {
  const { formatMessage } = useIntl();
  if (earned.withheld) {
    return (
      <PassportNote>
        {formatMessage({ id: "public.passport.vouchers.earned.withheld" })}
      </PassportNote>
    );
  }
  const unmatched = earned.issued - earned.tracedToKeptPromise;
  return (
    <>
      {earned.issued === 0 ? (
        <PassportNothingYet>
          {formatMessage({
            id: "public.passport.vouchers.earned.none",
            defaultMessage: "No vouchers issued yet.",
          })}
        </PassportNothingYet>
      ) : (
        <PassportFigure>
          {formatMessage(
            {
              id: "public.passport.vouchers.earned.figure",
              defaultMessage:
                "{count, plural, one {# voucher award issued} other {# voucher awards issued}}",
            },
            { count: earned.issued }
          )}
        </PassportFigure>
      )}
      {earned.tracedToKeptPromise > 0 ? (
        <PassportNote>
          {formatMessage(
            { id: "public.passport.vouchers.earned.traced" },
            {
              traced: earned.tracedToKeptPromise,
              own: earned.confirmedByOwnConfirmers,
              fallback: earned.confirmedByFallback,
            }
          )}
        </PassportNote>
      ) : null}
      {unmatched > 0 ? (
        <PassportNote>
          {formatMessage({ id: "public.passport.vouchers.earned.unmatched" }, { count: unmatched })}
        </PassportNote>
      ) : null}
      {earned.awaiting > 0 ? (
        <PassportNote>
          {formatMessage(
            { id: "public.passport.vouchers.earned.awaiting" },
            { count: earned.awaiting }
          )}
        </PassportNote>
      ) : null}
      {earned.failed > 0 ? (
        <PassportNote>
          {formatMessage(
            { id: "public.passport.vouchers.earned.failed" },
            { count: earned.failed }
          )}
        </PassportNote>
      ) : null}
      {earned.promisesWithApprovedTerms > 0 ? (
        <PassportNote>
          {formatMessage(
            { id: "public.passport.vouchers.earned.terms" },
            { count: earned.promisesWithApprovedTerms }
          )}
        </PassportNote>
      ) : null}
      <PassportSource>
        <p>{formatMessage({ id: "public.passport.vouchers.earned.source" })}</p>
      </PassportSource>
    </>
  );
}
