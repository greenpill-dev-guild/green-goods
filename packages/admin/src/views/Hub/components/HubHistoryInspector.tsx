import { SheetBody } from "@green-goods/shared/components/Canvas/SheetBody";
import { SheetFooter } from "@green-goods/shared/components/Canvas/SheetFooter";
import {
  type ActivityEvent,
  HUB_HISTORY_STATUS_CLASSNAME,
} from "@green-goods/shared/hooks/admin-ui/hub/hub.utils";
import { useLocalizedRelativeTime } from "@green-goods/shared/hooks/app/useLocalizedRelativeTime";
import { AdminCard } from "@/components/AdminCard";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { localizeCanonicalActionTitle } from "../actionDisplay";

export function HubHistoryInspector({ event }: { event: ActivityEvent }) {
  const { formatMessage } = useIntl();
  const formatEventAge = useLocalizedRelativeTime();
  const localizedTitle = localizeCanonicalActionTitle(event.title, formatMessage);

  const categoryLabel =
    event.category === "work"
      ? formatMessage({ id: "cockpit.hub.tab.work", defaultMessage: "Work" })
      : event.category === "impact"
        ? formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" })
        : formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" });

  return (
    <>
      <SheetBody padded={true} className="flex flex-col gap-4">
        <AdminCard density="compact" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={HUB_HISTORY_STATUS_CLASSNAME}>{categoryLabel}</span>
            <span className="text-xs text-text-soft">{formatEventAge(event.timestamp)}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-strong">{localizedTitle}</h3>
            <p className="mt-1 text-sm text-text-sub">{event.description}</p>
          </div>
        </AdminCard>

        {event.href ? (
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.hub.history.readOnlyDescription",
              defaultMessage:
                "This event is summarized inside Hub. Open the linked surface only if you need the full workflow or record context.",
            })}
          </p>
        ) : null}
      </SheetBody>

      {event.href ? (
        <SheetFooter>
          <AdminButton
            variant="tonal"
            leadingIcon={<RiExternalLinkLine />}
            className="w-full justify-center"
            asChild
          >
            <a href={event.href}>
              {formatMessage({
                id: "cockpit.hub.history.openLinkedView",
                defaultMessage: "Open linked view",
              })}
            </a>
          </AdminButton>
        </SheetFooter>
      ) : null}
    </>
  );
}
