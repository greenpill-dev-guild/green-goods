import type { PublicGardenPassportRecord } from "@green-goods/shared/commitment-pooling/public";
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
import { namedSupport } from "./GardenPassportSentence";
import { StillToDeliver } from "./GardenPassportStillToDeliver";

/**
 * The first thing a funder reads (DL-201): one plain sentence, then four lines. Promised,
 * Supported, Delivered, Still to deliver. Each line carries its figure in its own unit, the
 * window it covers, when its record last changed, and where it comes from one tap away.
 */
export function PassportLedger({
  passport,
  onRetry,
}: {
  passport: PublicGardenPassportRecord;
  onRetry: () => void;
}) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  const { promises, settlement } = passport;
  const record = promises.status === "available" ? promises.value : null;
  const promiseMeta =
    promises.status === "available" ? (
      <PassportFreshness since={promises.value.since} asOf={promises.asOf} />
    ) : null;
  const ofPromised = (count: bigint, promised: bigint) =>
    formatMessage(
      { id: "public.passport.units.ofPromised", defaultMessage: "{count} of {promised}" },
      { count: formatNumber(count), promised: formatNumber(promised) }
    );
  const unitsLabel = formatMessage({
    id: "public.passport.units.label",
    defaultMessage: "By unit",
  });
  const promisedUnits = record?.units.filter((unit) => unit.promised > 0n) ?? [];
  const support = settlement.status === "available" ? namedSupport(intl, settlement.value) : [];
  const unnamedSupport =
    settlement.status === "available" && settlement.value.support.lines.length > support.length;

  return (
    <div className="border-b border-stroke-soft-200">
      <PassportLine
        id="passport-promised"
        as="h2"
        label={formatMessage({ id: "public.passport.promised.label", defaultMessage: "Promised" })}
        meta={promiseMeta}
      >
        {!record ? (
          <PassportUnavailable onRetry={onRetry} />
        ) : (
          <>
            {record.due === 0 ? (
              <PassportNothingYet>
                {record.takenUp > 0
                  ? formatMessage({
                      id: "public.passport.promised.noneDue",
                      defaultMessage: "No promise is waiting to be kept right now.",
                    })
                  : formatMessage({
                      id: "public.passport.promised.none",
                      defaultMessage: "No promise has been taken up yet.",
                    })}
              </PassportNothingYet>
            ) : (
              <PassportFigure>
                {formatMessage(
                  {
                    id: "public.passport.promised.figure",
                    defaultMessage:
                      "{count, plural, one {# promise taken up} other {# promises taken up}}",
                  },
                  { count: record.due }
                )}
              </PassportFigure>
            )}
            <PassportUnitRows
              label={unitsLabel}
              rows={promisedUnits.map((unit) => ({
                unitLabel: unit.unitLabel,
                value: formatNumber(unit.promised),
              }))}
            />
            {record.standingOffers > 0 ? (
              <PassportNote>
                {formatMessage(
                  {
                    id: "public.passport.promised.offers",
                    defaultMessage:
                      "{count, plural, one {# more offer is open for someone to take up.} other {# more offers are open for someone to take up.}} An open offer is not a promise yet.",
                  },
                  { count: record.standingOffers }
                )}
              </PassportNote>
            ) : null}
            <PassportSource>
              <p>{formatMessage({ id: "public.passport.promised.source" })}</p>
            </PassportSource>
          </>
        )}
      </PassportLine>

      <PassportLine
        id="passport-supported"
        as="h2"
        label={formatMessage({
          id: "public.passport.supported.label",
          defaultMessage: "Supported",
        })}
        meta={
          settlement.status === "available" ? <PassportFreshness asOf={settlement.asOf} /> : null
        }
      >
        {settlement.status === "unavailable" ? (
          <PassportUnavailable onRetry={onRetry} />
        ) : (
          <>
            {support.every((entry) => entry.line.confirmed === 0n) ? (
              <PassportNothingYet>
                {formatMessage({
                  id: "public.passport.supported.none",
                  defaultMessage: "No G$ support has been confirmed for this garden yet.",
                })}
              </PassportNothingYet>
            ) : null}
            {support.map((entry) => (
              <div key={entry.line.token} className="flex flex-col gap-3">
                {entry.line.confirmed > 0n ? (
                  <PassportFigure>
                    {formatMessage(
                      {
                        id: "public.passport.supported.figure",
                        defaultMessage: "{amount} {symbol} received",
                      },
                      { amount: entry.amount(entry.line.confirmed), symbol: entry.symbol }
                    )}
                  </PassportFigure>
                ) : null}
                {entry.line.sent > 0n ? (
                  <PassportNote>
                    {formatMessage(
                      {
                        id: "public.passport.supported.awaiting",
                        defaultMessage: "{amount} {symbol} sent and not yet confirmed.",
                      },
                      { amount: entry.amount(entry.line.sent), symbol: entry.symbol }
                    )}
                  </PassportNote>
                ) : null}
                {entry.line.queued > 0n ? (
                  <PassportNote>
                    {formatMessage(
                      {
                        id: "public.passport.supported.queued",
                        defaultMessage: "{amount} {symbol} recorded and not yet sent.",
                      },
                      { amount: entry.amount(entry.line.queued), symbol: entry.symbol }
                    )}
                  </PassportNote>
                ) : null}
                {entry.line.failed > 0n ? (
                  <PassportNote>
                    {formatMessage(
                      {
                        id: "public.passport.supported.failed",
                        defaultMessage: "{amount} {symbol} was sent and did not arrive.",
                      },
                      { amount: entry.amount(entry.line.failed), symbol: entry.symbol }
                    )}
                  </PassportNote>
                ) : null}
              </div>
            ))}
            {unnamedSupport ? (
              <PassportNote>
                {formatMessage({ id: "public.passport.supported.unnamed" })}
              </PassportNote>
            ) : null}
            <PassportSource>
              <p>{formatMessage({ id: "public.passport.supported.source" })}</p>
            </PassportSource>
          </>
        )}
      </PassportLine>

      <PassportLine
        id="passport-delivered"
        as="h2"
        label={formatMessage({
          id: "public.passport.delivered.label",
          defaultMessage: "Delivered",
        })}
        meta={promiseMeta}
      >
        {!record ? (
          <PassportUnavailable onRetry={onRetry} />
        ) : (
          <>
            {record.kept === 0 ? (
              <PassportNothingYet>
                {formatMessage({
                  id: "public.passport.delivered.none",
                  defaultMessage: "No promise is confirmed as kept yet.",
                })}
              </PassportNothingYet>
            ) : (
              <PassportFigure>
                {formatMessage(
                  {
                    id: "public.passport.delivered.figure",
                    defaultMessage: "{count, plural, one {# promise kept} other {# promises kept}}",
                  },
                  { count: record.kept }
                )}
              </PassportFigure>
            )}
            <PassportUnitRows
              label={unitsLabel}
              rows={promisedUnits.map((unit) => ({
                unitLabel: unit.unitLabel,
                value: ofPromised(unit.delivered, unit.promised),
              }))}
            />
            {record.breakdown && record.breakdown.partlyDelivered > 0 ? (
              <PassportNote>
                {formatMessage(
                  {
                    id: "public.passport.delivered.partly",
                    defaultMessage:
                      "Partly delivered: {count, plural, one {# promise has} other {# promises have}} some units approved and some not.",
                  },
                  { count: record.breakdown.partlyDelivered }
                )}
              </PassportNote>
            ) : null}
            <PassportSource>
              <p>{formatMessage({ id: "public.passport.delivered.source" })}</p>
            </PassportSource>
          </>
        )}
      </PassportLine>

      <PassportLine
        id="passport-still"
        as="h2"
        label={formatMessage({
          id: "public.passport.still.label",
          defaultMessage: "Still to deliver",
        })}
        meta={promiseMeta}
      >
        {!record ? (
          <PassportUnavailable onRetry={onRetry} />
        ) : (
          <StillToDeliver record={record} unitsLabel={unitsLabel} ofPromised={ofPromised} />
        )}
      </PassportLine>
    </div>
  );
}
