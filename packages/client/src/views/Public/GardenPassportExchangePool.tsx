import type {
  PassportSection,
  PassportVoucherSupply,
} from "@green-goods/shared/commitment-pooling/public";
import { useIntl } from "react-intl";
import {
  PassportFigure,
  PassportLine,
  PassportNote,
  PassportNothingYet,
  PassportSource,
  PassportUnavailable,
} from "./GardenPassportAtoms";
import { passportAmount, passportDate, passportIsoDate } from "./gardenPassportFormat";

/**
 * What the exchange pools hold of the vouchers this garden issues, read from the voucher chain.
 * Three facts on three sentences: what a pool holds, the most it may hold, and what is
 * outstanding. Once people use a voucher, the holding and the outstanding total stay out, because
 * nobody has counted the people behind those numbers; the holding limit stays.
 */
export function PassportExchangePool({
  supply,
  onRetry,
}: {
  supply: PassportSection<PassportVoucherSupply[]>;
  onRetry: () => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const read = supply.status === "available" ? supply : null;
  return (
    <PassportLine
      id="passport-vouchers-pool"
      label={formatMessage({
        id: "public.passport.vouchers.pool.label",
        defaultMessage: "In the exchange pool",
      })}
      meta={
        read && read.asOf !== null ? (
          <p className="text-sm leading-relaxed text-text-soft-400">
            {formatMessage(
              { id: "public.passport.vouchers.pool.asRead", defaultMessage: "As read on {date}." },
              {
                date: (
                  <time key="date" dateTime={passportIsoDate(read.asOf)}>
                    {passportDate(intl, read.asOf)}
                  </time>
                ),
              }
            )}
          </p>
        ) : null
      }
    >
      {!read ? (
        <PassportUnavailable onRetry={onRetry} />
      ) : read.value.length === 0 ? (
        <PassportNothingYet>
          {formatMessage({
            id: "public.passport.vouchers.pool.none",
            defaultMessage: "This garden issues no voucher that the exchange pool lists.",
          })}
        </PassportNothingYet>
      ) : (
        <>
          {read.value.map((voucher) => (
            <VoucherSupply key={voucher.token} voucher={voucher} />
          ))}
          <PassportSource>
            <p>{formatMessage({ id: "public.passport.vouchers.pool.source" })}</p>
          </PassportSource>
        </>
      )}
    </PassportLine>
  );
}

function VoucherSupply({ voucher }: { voucher: PassportVoucherSupply }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const amount = (value: bigint) => passportAmount(intl, value, voucher.decimals);
  const { symbol } = voucher;
  return (
    <div className="flex flex-col gap-2">
      {voucher.pools.map((pool) => (
        <div key={pool.id} className="flex flex-col gap-2">
          {pool.holding !== null ? (
            <PassportFigure>
              {formatMessage(
                {
                  id: "public.passport.vouchers.pool.figure",
                  defaultMessage: "{amount} {symbol} in the {pool} exchange pool",
                },
                { amount: amount(pool.holding), symbol, pool: pool.name }
              )}
            </PassportFigure>
          ) : null}
          <PassportNote>
            {!pool.listed
              ? formatMessage(
                  { id: "public.passport.vouchers.pool.notListed" },
                  { pool: pool.name }
                )
              : pool.holding !== null
                ? formatMessage(
                    { id: "public.passport.vouchers.pool.limit" },
                    { amount: amount(pool.holdingLimit), symbol }
                  )
                : formatMessage(
                    { id: "public.passport.vouchers.pool.limitNamed" },
                    { amount: amount(pool.holdingLimit), symbol, pool: pool.name }
                  )}
          </PassportNote>
        </div>
      ))}
      <PassportNote>
        {voucher.outstanding === null
          ? formatMessage({ id: "public.passport.vouchers.pool.heldBack" }, { symbol })
          : voucher.outstanding === 0n
            ? formatMessage({ id: "public.passport.vouchers.pool.noneOutstanding" }, { symbol })
            : formatMessage(
                { id: "public.passport.vouchers.pool.outstanding" },
                { amount: amount(voucher.outstanding), symbol }
              )}
      </PassportNote>
    </div>
  );
}
