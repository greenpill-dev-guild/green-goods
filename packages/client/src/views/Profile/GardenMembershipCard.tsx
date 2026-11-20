import { Button } from "@green-goods/shared/components/Button";
import type { Garden, GardenMemberHistory } from "@green-goods/shared/types/domain";
import { formatRoleList, type GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiArrowRightSLine, RiHomeLine, RiPlantLine } from "@remixicon/react";
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

const DATE_FORMAT = { year: "numeric", month: "short", day: "numeric" } as const;

const validDate = (value: number | null | undefined): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 8_640_000_000_000_000;

/**
 * Opening the garden and leaving it are separate touch targets on the same account card. The
 * card is three lines at every role count, so a list of them keeps one height: the garden's name,
 * every role the member holds in words, then when the current membership began and whether the
 * garden is on Home. Leave Garden has the footer to itself; the garden's own pages carry the rest.
 */
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
  const rolesId = useId();
  const membershipId = useId();
  const held = roles?.length ? roles : role ? [role] : [];
  const joinedAt = history?.joinedAt;
  const memberSince = history?.memberSince;
  const rejoinedAt =
    validDate(joinedAt) &&
    validDate(memberSince) &&
    intl.formatDate(memberSince, DATE_FORMAT) !== intl.formatDate(joinedAt, DATE_FORMAT)
      ? memberSince
      : null;
  const membershipAt = rejoinedAt ?? (validDate(joinedAt) ? joinedAt : null);
  const membership =
    historyLoading || historyError || membershipAt === null ? (
      intl.formatMessage({
        id: historyLoading ? "app.garden.membership.loading" : "app.garden.membership.unavailable",
      })
    ) : (
      <time dateTime={new Date(membershipAt).toISOString()}>
        {intl.formatMessage(
          {
            id:
              rejoinedAt === null
                ? "app.garden.membership.joinedOn"
                : "app.garden.membership.rejoinedOn",
          },
          { date: intl.formatDate(membershipAt, DATE_FORMAT) }
        )}
      </time>
    );
  return (
    <Card className="flex-col gap-0 overflow-hidden p-0">
      <button
        type="button"
        data-pressable="card"
        onClick={onOpen}
        aria-label={garden.name}
        aria-describedby={held.length ? `${rolesId} ${membershipId}` : membershipId}
        className="flex w-full min-h-18 items-center gap-3 p-4 text-left"
      >
        <Avatar>
          <span className="mx-auto flex items-center justify-center text-primary-on-surface">
            <RiPlantLine className="w-4" aria-hidden="true" />
          </span>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="min-w-0 max-w-full truncate type-card-title" title={garden.name}>
            {garden.name}
          </span>
          {held.length ? (
            <span
              id={rolesId}
              className="min-w-0 max-w-full truncate type-meta text-text-strong-950"
            >
              {formatRoleList(held, intl)}
            </span>
          ) : null}
          <span
            id={membershipId}
            className="flex min-w-0 max-w-full items-center gap-1 type-meta text-text-sub-600"
          >
            <span className="min-w-0 truncate">{membership}</span>
            {onHome ? (
              <span className="flex shrink-0 items-center gap-1 font-medium text-text-strong-950">
                <span aria-hidden="true">·</span>
                <RiHomeLine className="h-3 w-3 shrink-0" aria-hidden="true" />
                {intl.formatMessage({
                  id: "app.profile.gardensOnHome",
                  defaultMessage: "On Home",
                })}
              </span>
            ) : null}
          </span>
        </span>
        <RiArrowRightSLine className="h-5 w-5 shrink-0 text-text-soft-400" aria-hidden="true" />
      </button>
      <div className="flex items-center justify-end gap-3 border-t border-stroke-soft-200 px-3 py-2 pl-4">
        <Button
          type="button"
          emphasis="tertiary"
          tone={recovering ? "default" : "danger"}
          // Compact (DESIGN.pwa.md: 32px, a 14px label under the 15px garden name, still a 48px
          // tap area). The md size's 16px label outweighed the garden it leaves.
          size="compact"
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
