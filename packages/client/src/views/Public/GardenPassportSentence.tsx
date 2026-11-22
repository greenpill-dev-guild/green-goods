import type {
  PassportPromises,
  PassportSettlement,
  PublicGardenPassportRecord,
} from "@green-goods/shared/commitment-pooling/public";
import { type IntlShape, useIntl } from "react-intl";
import { passportAmount, passportDate, passportMoneyToken } from "./gardenPassportFormat";

/** Promises still inside their term. Below the display floor that is every unresolved one. */
export function openPromises(promises: PassportPromises): number {
  return promises.breakdown ? promises.breakdown.stillOpen : promises.unresolved;
}

/** Support in the tokens the page can name, each with its own formatter. */
export function namedSupport(intl: IntlShape, settlement: PassportSettlement) {
  return settlement.support.lines.flatMap((line) => {
    const token = passportMoneyToken(line.token);
    if (!token) return [];
    const amount = (value: bigint) => passportAmount(intl, value, token.decimals);
    return [{ line, symbol: token.symbol, amount }];
  });
}

/** The record as one sentence a reader outside Green Goods can repeat. */
export function PassportSentence({ passport }: { passport: PublicGardenPassportRecord }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { promises, settlement } = passport;
  if (promises.status === "unavailable") {
    return (
      <p className="max-w-3xl font-serif text-2xl leading-snug text-text-soft-400 md:text-3xl">
        {formatMessage({
          id: "public.passport.sentence.unavailable",
          defaultMessage: "This garden's promise record could not be read just now.",
        })}
      </p>
    );
  }
  const record = promises.value;
  const since = record.since === null ? "" : passportDate(intl, record.since);
  const support =
    settlement.status === "available"
      ? namedSupport(intl, settlement.value).filter((entry) => entry.line.confirmed > 0n)
      : [];
  return (
    <p
      data-testid="passport-sentence"
      className="max-w-3xl font-serif text-2xl leading-snug text-text-strong-950 md:text-3xl"
    >
      {record.due === 0
        ? // Promises taken up and later released are off the record, and were still taken up.
          record.takenUp > 0
          ? formatMessage({
              id: "public.passport.sentence.noneDue",
              defaultMessage: "This garden has no promises to keep right now.",
            })
          : formatMessage({
              id: "public.passport.sentence.none",
              defaultMessage: "No one has taken up a promise in this garden yet.",
            })
        : record.breakdown
          ? formatMessage(
              {
                id: "public.passport.sentence.promises",
                defaultMessage:
                  "Since {since}, neighbors have taken up {due, plural, one {# promise} other {# promises}} in this garden. {kept, plural, =0 {None is kept yet} one {# is kept} other {# are kept}}, and {open, plural, =0 {none is waiting} one {# is still to deliver} other {# are still to deliver}}.",
              },
              { since, due: record.due, kept: record.kept, open: record.breakdown.stillOpen }
            )
          : // A small record does not say which of its unresolved promises have lapsed.
            formatMessage(
              {
                id: "public.passport.sentence.promisesSmall",
                defaultMessage:
                  "Since {since}, neighbors have taken up {due, plural, one {# promise} other {# promises}} in this garden. {kept, plural, =0 {None is kept yet} one {# is kept} other {# are kept}}, and {open, plural, =0 {none is waiting} one {# is not yet kept} other {# are not yet kept}}.",
              },
              { since, due: record.due, kept: record.kept, open: record.unresolved }
            )}
      {record.breakdown && record.breakdown.notKept > 0
        ? ` ${formatMessage(
            {
              id: "public.passport.sentence.notKept",
              defaultMessage: "{count, plural, one {# was not kept.} other {# were not kept.}}",
            },
            { count: record.breakdown.notKept }
          )}`
        : null}
      {support.map((entry) => (
        <span key={entry.line.token}>
          {" "}
          {formatMessage(
            {
              id: "public.passport.sentence.support",
              defaultMessage: "{amount} {symbol} in support has reached the garden.",
            },
            { amount: entry.amount(entry.line.confirmed), symbol: entry.symbol }
          )}
        </span>
      ))}
    </p>
  );
}
