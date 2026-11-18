import { Button } from "@green-goods/shared/components/Button";
import { GardenMembershipDates } from "@green-goods/shared/components/GardenMembershipDates";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { Garden, GardenMemberHistory } from "@green-goods/shared/types/domain";
import { type GardenRole, getRoleLabel } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiArrowRightSLine, RiHomeLine, RiMapPinLine, RiPlantLine } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

interface GardenMembershipCardProps {
  garden: Garden;
  role?: GardenRole;
  roles?: readonly GardenRole[];
  history?: GardenMemberHistory;
  historyLoading?: boolean;
  historyError?: boolean;
  onHome: boolean;
  recovering: boolean;
  onOpen: () => void;
  onLeave: () => void;
}

/** Opening the garden and leaving it are separate touch targets on the same account card. */
export function GardenMembershipCard({
  garden,
  role,
  roles,
  history,
  historyLoading,
  historyError,
  onHome,
  recovering,
  onOpen,
  onLeave,
}: GardenMembershipCardProps) {
  const intl = useIntl();
  const detailId = useId();
  return (
    <Card className="flex-col gap-0 overflow-hidden p-0">
      <button
        type="button"
        data-pressable="card"
        onClick={onOpen}
        aria-label={garden.name}
        aria-describedby={onHome || garden.location ? detailId : undefined}
        className="flex w-full min-h-18 items-center gap-3 p-4 text-left"
      >
        <Avatar>
          <span className="mx-auto flex items-center justify-center text-primary-on-surface">
            <RiPlantLine className="w-4" aria-hidden="true" />
          </span>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          <span
            className="line-clamp-2 min-w-0 max-w-full type-card-title [overflow-wrap:anywhere]"
            title={garden.name}
          >
            {garden.name}
          </span>
          {onHome || garden.location ? (
            <span
              id={detailId}
              className="flex min-w-0 max-w-full items-center gap-1 type-meta text-text-sub-600"
            >
              {onHome ? (
                <span className="mr-2 flex shrink-0 items-center gap-1 font-medium text-text-strong-950">
                  <RiHomeLine className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {intl.formatMessage({
                    id: "app.profile.gardensOnHome",
                    defaultMessage: "On Home",
                  })}
                </span>
              ) : null}
              {garden.location ? (
                <>
                  <RiMapPinLine className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate" title={garden.location}>
                    {garden.location}
                  </span>
                </>
              ) : null}
            </span>
          ) : null}
        </span>
        <RiArrowRightSLine className="h-5 w-5 shrink-0 text-text-soft-400" aria-hidden="true" />
      </button>
      <div className="px-4 pb-3">
        <GardenMembershipDates
          history={history}
          roles={roles ?? (role ? [role] : [])}
          isLoading={historyLoading}
          isError={historyError}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-stroke-soft-200 px-3 py-2 pl-4">
        {role ? (
          <StatusBadge size="xs" variant="neutral" showIcon={false}>
            {getRoleLabel(role, intl.formatMessage).singular}
          </StatusBadge>
        ) : null}
        <Button
          type="button"
          emphasis="tertiary"
          tone={recovering ? "default" : "danger"}
          // Compact beside the role (DESIGN.pwa.md: 32px, a 14px label under the 15px garden name,
          // still a 48px tap area). The md size's 16px label outweighed the garden it leaves.
          size="compact"
          className="ml-auto"
          aria-label={intl.formatMessage(
            { id: recovering ? "app.garden.leave.recoverFor" : "app.garden.leave.actionFor" },
            { gardenName: garden.name }
          )}
          onClick={(event) => {
            // Safari pointer taps need an explicit persistent focus target before the sheet opens.
            event.currentTarget.focus();
            onLeave();
          }}
        >
          {intl.formatMessage({
            id: recovering ? "app.garden.leave.recover" : "app.garden.leave.action",
          })}
        </Button>
      </div>
    </Card>
  );
}
