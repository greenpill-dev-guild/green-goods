import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { formatUnixDate } from "../poolPresentation";
import { eventLabel } from "./commitmentDialogPresentation";

/** Everything that has happened to the record, newest first, in member words. */
export function CommitmentTimeline({ events }: { events: CommitmentDialogController["events"] }) {
  const { formatMessage, locale } = useIntl();

  return (
    <section
      className="space-y-1"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.commitment.timeline",
        defaultMessage: "Timeline",
      })}
    >
      <AdminCardTitle as="h4">
        {formatMessage({
          id: "cockpit.garden.pool.commitment.timeline",
          defaultMessage: "Timeline",
        })}
      </AdminCardTitle>
      {events.length === 0 ? (
        <p className="body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.timelineEmpty",
            defaultMessage: "Nothing recorded yet.",
          })}
        </p>
      ) : (
        <ol className="divide-y divide-stroke-soft body-sm">
          {events.map((event) => (
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
                <span className="shrink-0">{formatUnixDate(event.timestamp, locale, "")}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
