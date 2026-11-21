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
 * outstanding. The outstanding total stays out while any of it is with holders, because nobody
 * has counted the people behind that number.
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
            defaultMessage: "This garden issues no voucher of its own.",
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
        <div key={pool.name} className="flex flex-col gap-2">
          <PassportFigure>
            {formatMessage(
              {
                id: "public.passport.vouchers.pool.figure",
                defaultMessage: "{amount} {symbol} in the {pool} exchange pool",
              },
              { amount: amount(pool.holding), symbol, pool: pool.name }
            )}
          </PassportFigure>
          <PassportNote>
            {pool.listed
              ? formatMessage(
                  {
                    id: "public.passport.vouchers.pool.limit",
                    defaultMessage: "The pool may hold {amount} {symbol} at most.",
                  },
                  { amount: amount(pool.holdingLimit), symbol }
                )
              : formatMessage({
                  id: "public.passport.vouchers.pool.notListed",
                  defaultMessage: "This pool does not list the voucher right now.",
                })}
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
