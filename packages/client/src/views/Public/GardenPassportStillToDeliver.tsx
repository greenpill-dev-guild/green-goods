import type { PassportPromises } from "@green-goods/shared/commitment-pooling/public";
import { useIntl } from "react-intl";
import {
  PassportFigure,
  PassportNote,
  PassportNothingYet,
  PassportSource,
  PassportUnitRows,
} from "./GardenPassportAtoms";
import { openPromises } from "./GardenPassportSentence";

/**
 * The ledger's last line: what is left on promises that were taken up. Above the display floor
 * it separates promises still inside their term from those whose term ended unkept; below it,
 * it says only that they are not yet kept, so a small record cannot single anyone out.
 */
export function StillToDeliver({
  record,
  unitsLabel,
  ofPromised,
}: {
  record: PassportPromises;
  unitsLabel: string;
  ofPromised: (count: bigint, promised: bigint) => string;
}) {
  const { formatMessage } = useIntl();
  const { breakdown } = record;
  const open = openPromises(record);
  // With the split published, a unit whose promises all lapsed belongs under Not kept only.
  const units = record.units.filter((unit) => (unit.stillToDeliver ?? unit.undelivered) > 0n);
  return (
    <>
      {open === 0 ? (
        <PassportNothingYet>
          {formatMessage({
            id: "public.passport.still.none",
            defaultMessage: "Nothing is waiting to be delivered.",
          })}
        </PassportNothingYet>
      ) : (
        <PassportFigure>
          {breakdown
            ? formatMessage(
                {
                  id: "public.passport.still.figure",
                  defaultMessage:
                    "{count, plural, one {# promise still to deliver} other {# promises still to deliver}}",
                },
                { count: open }
              )
            : formatMessage(
                {
                  id: "public.passport.still.figureSmall",
                  defaultMessage:
                    "{count, plural, one {# promise not yet kept} other {# promises not yet kept}}",
                },
                { count: open }
              )}
        </PassportFigure>
      )}
      <PassportUnitRows
        label={unitsLabel}
        rows={units.map((unit) => ({
          unitLabel: unit.unitLabel,
          value: ofPromised(unit.stillToDeliver ?? unit.undelivered, unit.promised),
        }))}
      />
      {breakdown && breakdown.awaitingConfirmation > 0 ? (
        <PassportNote>
          {formatMessage(
            {
              id: "public.passport.still.awaiting",
              defaultMessage:
                "{count, plural, one {# has its work shown and is waiting for confirmation.} other {# have their work shown and are waiting for confirmation.}}",
            },
            { count: breakdown.awaitingConfirmation }
          )}
        </PassportNote>
      ) : null}
      {breakdown && breakdown.pastDue > 0 ? (
        <PassportNote>
          {formatMessage({ id: "public.passport.still.pastDue" }, { count: breakdown.pastDue })}
        </PassportNote>
      ) : null}
      {breakdown && breakdown.notKept > 0 ? (
        <>
          <PassportNote>
            {formatMessage(
              {
                id: "public.passport.still.notKept",
                defaultMessage:
                  "Not kept: {count, plural, one {# promise} other {# promises}} whose term ended before it was confirmed.",
              },
              { count: breakdown.notKept }
            )}
          </PassportNote>
          <PassportUnitRows
            label={formatMessage({
              id: "public.passport.still.notKeptUnits",
              defaultMessage: "Not kept, by unit",
            })}
            rows={record.units
              .filter((unit) => (unit.notDelivered ?? 0n) > 0n)
              .map((unit) => ({
                unitLabel: unit.unitLabel,
                value: ofPromised(unit.notDelivered ?? 0n, unit.promised),
              }))}
          />
        </>
      ) : null}
      {!breakdown && record.unresolved > 0 ? (
        <PassportNote>{formatMessage({ id: "public.passport.still.smallRecord" })}</PassportNote>
      ) : null}
      <PassportSource>
        <p>{formatMessage({ id: "public.passport.still.source" })}</p>
      </PassportSource>
    </>
  );
}
