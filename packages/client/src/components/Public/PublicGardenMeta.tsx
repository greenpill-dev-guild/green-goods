import type { PublicGardenSummary } from "@green-goods/shared/hooks/public/usePublicGardens";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";
import { type EditorialMetaItem, EditorialMetaRow } from "./atoms";

export interface PublicGardenMetaProps {
  garden: PublicGardenSummary;
  className?: string;
}

/**
 * The two details lines under a Garden's name, the same on its card and on its
 * `/fund` row: where it is and who is in it, then what it has published and when.
 *
 * Each line holds its pair together wherever they fit. On a row too narrow for both
 * (a `/fund` row two-up on a tablet) the second item moves under the first rather
 * than clipping a short place name, and a place longer than the row ends in an
 * ellipsis with its full text as a tooltip.
 */
export function PublicGardenMeta({ garden, className }: PublicGardenMetaProps) {
  const { formatMessage, formatDate } = useIntl();

  const members = formatMessage(
    {
      id: "public.gardens.gardeners",
      defaultMessage: "{count, plural, one {# member} other {# members}}",
    },
    { count: garden.gardenerCount }
  );
  const place: EditorialMetaItem[] = garden.location
    ? [{ label: garden.location, truncate: true }, { label: members }]
    : [{ label: members }];

  const record: EditorialMetaItem[] = [
    {
      label: formatMessage(
        {
          id: "public.gardens.works",
          defaultMessage:
            "{count, plural, one {# approved submission} other {# approved submissions}}",
        },
        { count: garden.actionCount }
      ),
    },
  ];
  if (garden.lastActivityAt > 0) {
    record.push({
      label: formatMessage(
        { id: "public.gardens.latestWork", defaultMessage: "Latest {date}" },
        {
          date: formatDate(garden.lastActivityAt * 1000, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        }
      ),
    });
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <EditorialMetaRow items={place} className="text-text-sub-600" />
      <EditorialMetaRow items={record} className="text-text-sub-600" />
    </div>
  );
}
