import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { formatUnixDate, shortAddress } from "../poolPresentation";
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
      <p className="label-md text-text-strong">
        {formatMessage({
          id: "cockpit.garden.pool.commitment.timeline",
          defaultMessage: "Timeline",
        })}
      </p>
      {events.length === 0 ? (
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.timelineEmpty",
            defaultMessage: "Nothing recorded yet.",
          })}
        </p>
      ) : (
        <ol className="divide-y divide-[rgb(var(--m3-outline-variant))] text-sm">
          {events.map((event) => (
            <li key={event.id} className="flex justify-between gap-2 py-1.5">
              <span className="text-text-strong">{eventLabel(event, formatMessage)}</span>
              <span className="shrink-0 text-xs text-text-soft" title={event.actor ?? undefined}>
                {[
                  event.actor ? shortAddress(event.actor) : null,
                  formatUnixDate(event.timestamp, locale, ""),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
