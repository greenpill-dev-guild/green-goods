import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import {
  type CommitmentCycleRecord,
  cycleStanding,
  useCommitmentCycle,
  useCommitmentCycleNames,
  useCommitments,
  useCycleClock,
} from "@green-goods/shared/commitment-pooling";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import { AppSheet } from "@/components/Sheets/AppSheet";
import { CycleIdentity, cycleDates } from "./CycleRail";
import { cyclePromiseStanding } from "./cyclePromiseStanding";

interface CycleDetailsSheetProps {
  /** The season or campaign to describe; the last one stays drawn while the sheet closes. */
  cycle: CommitmentCycleRecord | null;
  isOpen: boolean;
  onClose: () => void;
  /** Selects the cycle's card, so the list shows only its promises. */
  onShowPromises: (cycleId: bigint) => void;
}

/** Holds a count's place while the cycle's promises are read (DL-056). */
const COUNT_PLACEHOLDER = (
  <span
    aria-hidden="true"
    className="inline-block h-4 w-6 animate-pulse rounded-full bg-bg-soft-200"
  />
);

/**
 * A season's or campaign's details, opened from the ⓘ on its card (D5): its
 * identity, what it runs, where its promises stand and what they add up to
 * (DL-169). Show Its Promises selects the card and closes, so filtering stays
 * one tap away.
 *
 * Seasons and campaigns share this one sheet; only the words and colour differ.
 * It is a full sheet, the height of the other sheets over Home (DL-164). Where
 * its promises stand counts its own promise list by the words its promise rows
 * use, while Kept so far stays the cycle's record ("3 of 7 kept"), as its card
 * says it; what they add up to is the cycle's units, each label on its own row.
 * A campaign that runs as a project brief adds its brief note (PRD-1299,
 * SBrief): how its separate promises fit together, in its stewards' words.
 *
 * One past its end that no steward has closed reads Ended, and says when it
 * ended and that a steward still needs to close it (DL-162).
 */
export function CycleDetailsSheet({
  cycle,
  isOpen,
  onClose,
  onShowPromises,
}: CycleDetailsSheetProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const shown = useMemo(() => (cycle ? [cycle] : []), [cycle]);
  const { byCycleId } = useCommitmentCycleNames(shown);
  const now = useCycleClock(shown);
  // The cycle's promises and its units, read while its details are open.
  const scope = { chainId: cycle?.chainId ?? 0, cycleId: cycle?.cycleId ?? 0n };
  const readsOn = { enabled: isOpen && cycle !== null };
  const promisesRead = useCommitments(scope, readsOn);
  const unitsRead = useCommitmentCycle(scope, readsOn);
  if (!cycle) return null;

  const standing = cycleStanding(cycle, now);
  const isCampaign = cycle.cycleType === "CAMPAIGN";
  const kindLabel = formatMessage({
    id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season",
  });
  const metadata = byCycleId.get(cycle.cycleId.toString());
  const name = metadata?.name ?? kindLabel;
  const brief = isCampaign && metadata?.status === "resolved" ? metadata.brief : undefined;
  // Said ahead of what counts toward it, in a long month: a short Portuguese one ends in its own
  // period ("out.").
  const endedNote =
    standing === "ended" && cycle.endTime
      ? formatMessage(
          { id: "app.pool.cycle.ended" },
          {
            date: intl.formatDate(new Date(Number(cycle.endTime) * 1000), {
              month: "long",
              day: "numeric",
            }),
          }
        )
      : null;

  // The list's counts hold their places while it is read. A list that cannot answer, because its
  // read failed or waits offline with nothing saved, says so under the record's own count instead
  // of showing less as though it were all.
  const listed = promisesRead.data !== undefined;
  const promisesUnread = !listed && (promisesRead.isError || promisesRead.fetchStatus === "paused");
  const reading = !listed && !promisesUnread && promisesRead.fetchStatus === "fetching";
  const where = cyclePromiseStanding(promisesRead.commitments);
  const count = (value: number) => (listed ? intl.formatNumber(value) : COUNT_PLACEHOLDER);
  // A cycle with no units has no section; one whose read cannot answer keeps the heading and says
  // so, so a failed read never passes for a cycle with nothing to add up.
  const units = unitsRead.detail?.unitSummaries ?? [];
  const unitsUnread =
    !unitsRead.detail && (unitsRead.isError || unitsRead.fetchStatus === "paused");

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      header={{
        title: name,
        description: cycleDates(intl, cycle, { withYear: true }) ?? undefined,
      }}
      actions={{
        primary: {
          label: formatMessage({ id: "app.pool.cycle.showPromises" }),
          onClick: () => onShowPromises(cycle.cycleId),
        },
      }}
    >
      <div className="space-y-4">
        <CycleIdentity cycle={cycle} standing={standing} />
        <p className="text-sm leading-relaxed text-text-strong-950">
          {endedNote ? `${endedNote} ` : null}
          {formatMessage({
            id: isCampaign ? "app.pool.cycle.intro.campaign" : "app.pool.cycle.intro.season",
          })}
        </p>
        <section
          className="space-y-2"
          data-component="CyclePromiseStanding"
          aria-busy={reading || undefined}
        >
          <SheetHeading>{formatMessage({ id: "app.pool.cycle.standing.title" })}</SheetHeading>
          <FactList>
            {listed || reading ? (
              <>
                <FactRow
                  label={formatMessage({ id: "app.pool.cycle.standing.open" })}
                  value={count(where.open)}
                />
                <FactRow
                  label={formatMessage({ id: "app.commitments.state.inProgress" })}
                  value={count(where.inProgress)}
                />
                <FactRow
                  label={formatMessage({ id: "app.commitments.state.awaitingConfirmation" })}
                  value={count(where.waiting)}
                />
              </>
            ) : null}
            <FactRow
              label={formatMessage({ id: "app.pool.cycle.keptSoFar" })}
              value={formatMessage(
                { id: "app.pool.rail.counts" },
                { kept: Number(cycle.commitmentsFulfilled), made: Number(cycle.commitmentsDue) }
              )}
            />
            {listed && where.ended > 0 ? (
              <FactRow
                label={formatMessage({ id: "app.pool.cycle.standing.ended" })}
                value={count(where.ended)}
              />
            ) : null}
          </FactList>
          {promisesUnread ? (
            <p className="type-meta text-text-sub-600">
              {formatMessage({ id: "app.pool.cycle.standing.unread" })}
            </p>
          ) : null}
        </section>
        {units.length > 0 || unitsUnread ? (
          <section className="space-y-2" data-component="CycleUnits">
            <SheetHeading>{formatMessage({ id: "app.pool.cycle.units.title" })}</SheetHeading>
            {unitsUnread ? (
              <p className="type-meta text-text-sub-600">
                {formatMessage({ id: "app.pool.cycle.units.unread" })}
              </p>
            ) : (
              <FactList>
                {units.map((unit) => (
                  <FactRow
                    key={unit.id}
                    label={unit.unitLabel}
                    value={formatMessage(
                      { id: "app.pool.cycle.units.progress" },
                      {
                        fulfilled: intl.formatNumber(unit.fulfilledUnits),
                        expected: intl.formatNumber(unit.expectedUnits),
                      }
                    )}
                  />
                ))}
              </FactList>
            )}
          </section>
        ) : null}
        {brief ? (
          <section className="space-y-1" data-component="CampaignBrief">
            <h3 className="type-title-sm text-text-strong-950">
              {formatMessage({ id: "app.pool.cycle.brief.title" })}
            </h3>
            <p className="whitespace-pre-line type-body text-text-sub-600">{brief}</p>
          </section>
        ) : null}
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.pool.cycle.separate" })}
        </p>
      </div>
    </AppSheet>
  );
}
