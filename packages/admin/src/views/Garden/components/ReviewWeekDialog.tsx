/**
 * One week's records from Review Health: what was sent that week, or what got its first decision
 * that week. A row opens its record in Review, where the steward acts on it.
 */
import { Alert } from "@green-goods/shared/components/Alert";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type {
  GardenReviewHealth,
  ReviewHealthWeek,
} from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import { useAddressDisplayName } from "@green-goods/shared/hooks/ens/useAddressDisplayName";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { Work } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiCalendarLine, RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { reviewWorkStatus } from "@/views/Review/components/ReviewWorkCard";

function WeekWorkRow({ work, onOpen }: { work: Work; onOpen: () => void }) {
  const intl = useIntl();
  const { display: gardener } = useAddressDisplayName(work.gardenerAddress, { variant: "card" });
  const status = reviewWorkStatus(work.status, intl.formatMessage);
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
      status={{ label: status.label, tone: status.tone }}
      edge={status.tone}
      details={[
        gardener,
        {
          text: intl.formatDate(work.createdAt * 1000, { month: "short", day: "numeric" }),
          tone: "soft",
        },
      ]}
      onOpen={onOpen}
    />
  );
}

export function ReviewWeekDialog({
  health,
  gardenId,
  weekLabel,
}: {
  health: GardenReviewHealth;
  gardenId: string;
  weekLabel: (week: ReviewHealthWeek) => string;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { openWeek, openList } = health;
  const works = openWeek ? (openList === "submitted" ? openWeek.submitted : openWeek.reviewed) : [];
  const complete = openWeek
    ? openList === "submitted"
      ? openWeek.submittedComplete
      : openWeek.reviewedComplete
    : true;

  return (
    <AdminDialog
      open={openWeek !== null}
      onOpenChange={(next) => {
        if (!next) health.handleCloseWeek();
      }}
      title={
        openWeek
          ? intl.formatMessage(
              {
                id:
                  openList === "submitted"
                    ? "hub.garden.reviewHealth.dialog.submitted"
                    : "hub.garden.reviewHealth.dialog.reviewed",
                defaultMessage:
                  openList === "submitted"
                    ? "Submitted the week of {week}"
                    : "Reviewed the week of {week}",
              },
              { week: weekLabel(openWeek) }
            )
          : ""
      }
      size="md"
      tone="garden"
    >
      {openWeek ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={intl.formatMessage({
            id: "hub.garden.reviewHealth.dialog.lists",
            defaultMessage: "Which work",
          })}
        >
          {(["submitted", "reviewed"] as const).map((list) => (
            <AdminFilterChip
              key={list}
              label={intl.formatMessage(
                { id: "hub.garden.reviewHealth.listCount", defaultMessage: "{list} ({count})" },
                {
                  list: intl.formatMessage({ id: `hub.garden.reviewHealth.${list}` }),
                  count: `${(list === "submitted" ? openWeek.submitted : openWeek.reviewed).length}${
                    (list === "submitted" ? openWeek.submittedComplete : openWeek.reviewedComplete)
                      ? ""
                      : "+"
                  }`,
                }
              )}
              selected={openList === list}
              onToggle={() => navigate(health.weekHref(openWeek, list), { replace: true })}
            />
          ))}
        </div>
      ) : null}
      {!complete ? (
        <Alert
          variant="warning"
          title={intl.formatMessage({
            id: "hub.garden.reviewHealth.dialog.partial",
            defaultMessage: "This week could not be read in full",
          })}
        >
          {intl.formatMessage({
            id: "hub.garden.reviewHealth.dialog.partialDescription",
            defaultMessage: "The list below is what could be read, so some work may be missing.",
          })}
        </Alert>
      ) : null}
      {works.length > 0 ? (
        <ul className="flex flex-col gap-(--gg-list-gap)">
          {works.map((work) => (
            <li key={work.id}>
              <WeekWorkRow
                work={work}
                onOpen={() => navigate(adminRoutes.reviewWorkDetail(work.id, { gardenId }))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<RiCalendarLine className="h-6 w-6" />}
          title={intl.formatMessage({
            id: "hub.garden.reviewHealth.dialog.empty",
            defaultMessage: "Nothing this week",
          })}
        />
      )}
    </AdminDialog>
  );
}
