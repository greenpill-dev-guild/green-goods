import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { EventTime } from "../EventTime";
import { timelineTime, zoneName } from "../poolTime";
import { eventLabel } from "./commitmentDialogPresentation";

/**
 * Everything that has happened to the record, newest first, in member words.
 * Each event reads in the viewer's own time (PRD-1025 D3): "Today, 3:42 PM",
 * then its date and time, the year only when it isn't this one, with the
 * full moment on hover and to a screen reader, and one "Times in" label for
 * the section.
 */
export function CommitmentTimeline({ events }: { events: CommitmentDialogController["events"] }) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const now = Date.now();

  return (
    <section
      className="space-y-1"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.commitment.timeline",
        defaultMessage: "Timeline",
      })}
    >
      <div className="flex items-baseline justify-between gap-2">
        <AdminCardTitle as="h4">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.timeline",
            defaultMessage: "Timeline",
          })}
        </AdminCardTitle>
        {events.length > 0 ? (
          <span className="body-xs text-text-soft">
            {formatMessage(
              { id: "cockpit.garden.pool.time.zone", defaultMessage: "Times in {zone}" },
              { zone: zoneName(intl, now) }
            )}
          </span>
        ) : null}
      </div>
      {events.length === 0 ? (
        <p className="body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.timelineEmpty",
            defaultMessage: "Nothing recorded yet.",
          })}
        </p>
      ) : (
        <ol className="divide-y divide-stroke-soft body-sm">
          {events.map((event) => {
            const ms = event.timestamp * 1000;
            return (
              <li key={event.id} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 text-text-strong">{eventLabel(event, formatMessage)}</span>
                {/* Who acted, by name, then when. A long name gives way, whole in its title. */}
                <span className="flex min-w-0 max-w-[60%] items-center gap-1.5 body-xs text-text-soft">
                  {event.actor ? (
                    <AddressDisplay
                      address={event.actor}
                      interactive={false}
                      className="min-w-0 truncate body-xs"
                    />
                  ) : null}
                  {event.actor ? <span aria-hidden="true">·</span> : null}
                  {event.timestamp > 0 ? (
                    <span className="shrink-0">
                      <EventTime ms={ms}>{timelineTime(intl, ms, now)}</EventTime>
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
