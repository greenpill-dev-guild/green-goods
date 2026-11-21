/**
 * One calendar day's work, opened from Garden › Activity's month calendar: a quick list that
 * stays in Activity. Each row opens its record in Review, and View in Work opens Review's
 * list for the same garden and day, so the steward acts where review happens.
 */
import { Alert } from "@green-goods/shared/components/Alert";
import { ItemRow, type ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { SkeletonText } from "@green-goods/shared/components/Skeleton";
import {
  dateOfDay,
  type GardenWorkCalendar,
  type WorkCalendarStatus,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { useAddressDisplayName } from "@green-goods/shared/hooks/ens/useAddressDisplayName";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { Work } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiCalendarLine, RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminDialog } from "@/components/AdminDialog";
import { describeWorkCounts, WORK_CALENDAR_STATUS_LABEL } from "./WorkCalendarMarks";

const STATUS_TONE: Record<WorkCalendarStatus, ItemRowTone> = {
  approved: "success",
  // Waiting is information, never an alarm (DL-044).
  pending: "neutral",
  rejected: "error",
  unknown: "neutral",
};

function DayWorkRow({
  work,
  status,
  onOpen,
}: {
  work: Work;
  status: WorkCalendarStatus;
  onOpen: () => void;
}) {
  const intl = useIntl();
  const { display: gardener } = useAddressDisplayName(work.gardenerAddress, { variant: "card" });
  const photo = work.media[0];
  return (
    <ItemRow
      lead={{
        kind: "photo",
        src: photo ? `${resolveIPFSUrl(photo)}?w=160&h=160` : null,
        fallbackIcon: RiImageLine,
      }}
      title={
        work.title ||
        intl.formatMessage({ id: "hub.garden.calendar.untitled", defaultMessage: "Untitled work" })
      }
      status={{
        label: intl.formatMessage(WORK_CALENDAR_STATUS_LABEL[status]),
        tone: STATUS_TONE[status],
      }}
      edge={STATUS_TONE[status]}
      details={[
        gardener,
        {
          text: intl.formatTime(work.createdAt * 1000, { hour: "numeric", minute: "2-digit" }),
          tone: "soft",
        },
      ]}
      onOpen={onOpen}
    />
  );
}

export function WorkDayDialog({
  calendar,
  gardenId,
}: {
  calendar: GardenWorkCalendar;
  gardenId: string;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { openDay, openDayWorkHref } = calendar;
  const title = openDay
    ? intl.formatDate(dateOfDay(openDay.day), { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <AdminDialog
      open={openDay !== null}
      onOpenChange={(next) => {
        if (!next) calendar.handleCloseDay();
      }}
      title={title}
      description={
        openDay && openDay.counts.total > 0 ? describeWorkCounts(openDay.counts, intl) : undefined
      }
      size="md"
      tone="garden"
      actions={
        openDay && openDay.works.length > 0 && openDayWorkHref
          ? {
              primary: {
                label: intl.formatMessage({
                  id: "hub.garden.calendar.viewInWork",
                  defaultMessage: "View in Work",
                }),
                onClick: () => navigate(openDayWorkHref),
              },
            }
          : undefined
      }
    >
      {/* A day opened from a link can come before its month is read, or while it cannot be:
          the dialog says so rather than reading as a quiet day. */}
      {calendar.state === "loading" ? (
        <div
          role="status"
          aria-label={intl.formatMessage({
            id: "hub.garden.calendar.loading",
            defaultMessage: "Reading this month's work",
          })}
        >
          <SkeletonText lines={3} />
        </div>
      ) : calendar.state === "error" ? (
        <Alert
          variant="error"
          title={intl.formatMessage({
            id: "hub.garden.calendar.error.title",
            defaultMessage: "This month could not be read",
          })}
        >
          {intl.formatMessage({
            id: "hub.garden.calendar.error.description",
            defaultMessage: "Nothing is shown, so no day reads as empty by mistake.",
          })}
        </Alert>
      ) : calendar.state === "offline" ? (
        <Alert
          variant="info"
          title={intl.formatMessage({
            id: "hub.garden.calendar.offline.title",
            defaultMessage: "You are offline",
          })}
        >
          {intl.formatMessage({
            id: "hub.garden.calendar.offline.description",
            defaultMessage: "The calendar reads this month when you are back online.",
          })}
        </Alert>
      ) : openDay && openDay.works.length > 0 ? (
        <ul
          aria-label={intl.formatMessage({
            id: "hub.garden.calendar.dayList",
            defaultMessage: "Work submitted this day",
          })}
          className="flex flex-col gap-(--gg-list-gap)"
        >
          {openDay.works.map((work) => (
            <li key={work.id}>
              <DayWorkRow
                work={work}
                status={calendar.statusOf(work)}
                onOpen={() =>
                  navigate(adminRoutes.reviewWorkDetail(work.id, { gardenId, day: openDay.day }))
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<RiCalendarLine className="h-6 w-6" />}
          title={intl.formatMessage({
            id: "hub.garden.calendar.dayEmpty.title",
            defaultMessage: "Nothing submitted this day",
          })}
          description={intl.formatMessage({
            id: "hub.garden.calendar.dayEmpty.description",
            defaultMessage: "Work a gardener sends on this day appears here.",
          })}
        />
      )}
    </AdminDialog>
  );
}
