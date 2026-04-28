import {
  Button,
  formatRelativeTime,
  HUB_HISTORY_STATUS_CLASSNAME,
  Surface,
  type ActivityEvent,
} from "@green-goods/shared";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export function HubHistoryInspector({ event }: { event: ActivityEvent }) {
  const { formatMessage } = useIntl();

  const categoryLabel =
    event.category === "work"
      ? formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })
      : event.category === "impact"
        ? formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" })
        : formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" });

  return (
    <div className="flex flex-col gap-4 p-1.5">
      <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={HUB_HISTORY_STATUS_CLASSNAME}>{categoryLabel}</span>
          <span className="text-xs text-text-soft">{formatRelativeTime(event.timestamp)}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-strong">{event.title}</h3>
          <p className="mt-1 text-sm text-text-sub">{event.description}</p>
        </div>
      </Surface>

      {event.href ? (
        <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.hub.history.readOnlyDescription",
              defaultMessage:
                "This event is summarized inside Hub. Open the linked surface only if you need the full workflow or record context.",
            })}
          </p>
          <Button variant="secondary" asChild>
            <a href={event.href}>
              <RiExternalLinkLine className="h-4 w-4" />
              {formatMessage({
                id: "cockpit.hub.history.openLinkedView",
                defaultMessage: "Open linked view",
              })}
            </a>
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
