import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import type { GardenMemberHistory } from "../types/domain";
import {
  formatRoleList,
  GARDEN_ROLE_ORDER,
  getRoleLabel,
  type GardenRole,
} from "../utils/blockchain/garden-roles";
import { FactList, FactRow } from "./Cards/FactRow";

const DATE_FORMAT = { year: "numeric", month: "short", day: "numeric" } as const;

const validDate = (value: number | null | undefined): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 8_640_000_000_000_000;

/**
 * Membership facts use the same dates and unknown state in the app and the Hub.
 *
 * The rows are events, not one row per role: a role that began on the day the member joined or
 * rejoined is named on that row ("Joined as Steward and Gardener"), and only a role that began on
 * another day gets a row of its own ("Became Steward"), so one date never reads twice. A current
 * role with no recorded start keeps its own row, dated unknown. `children` are further fact rows
 * about the same membership (a recorded contribution), kept in the same list so the values align.
 */
export function GardenMembershipDates({
  history,
  roles,
  isLoading = false,
  isError = false,
  compact = false,
  children,
}: {
  history?: GardenMemberHistory;
  roles?: readonly GardenRole[];
  isLoading?: boolean;
  isError?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  const intl = useIntl();
  const joinedAt = history?.joinedAt;
  if (isLoading || isError || !validDate(joinedAt)) {
    return (
      <>
        <p className="type-meta text-text-sub-600" role={isLoading ? "status" : undefined}>
          {intl.formatMessage({
            id: isLoading ? "app.garden.membership.loading" : "app.garden.membership.unavailable",
          })}
        </p>
        {children ? <FactList frame="inset">{children}</FactList> : null}
      </>
    );
  }

  // Two moments are the same event when the reader would see the same date.
  const day = (at: number) => intl.formatDate(at, DATE_FORMAT);
  const roleNames = (list: readonly GardenRole[]) => formatRoleList(list, intl);

  const memberSince = history?.memberSince;
  const rejoinedAt =
    validDate(memberSince) && day(memberSince) !== day(joinedAt) ? memberSince : null;
  const currentRoles = compact
    ? []
    : GARDEN_ROLE_ORDER.filter((role) =>
        roles ? roles.includes(role) : validDate(history?.roleSince[role])
      );

  const startedOn = (at: number) =>
    currentRoles.filter((role) => {
      const since = history?.roleSince[role];
      return validDate(since) && day(since) === day(at);
    });
  const joinedRoles = rejoinedAt === null ? startedOn(joinedAt) : [];
  const rejoinedRoles = rejoinedAt === null ? [] : startedOn(rejoinedAt);

  const rows: Array<{ key: string; label: string; at: number | null }> = [
    {
      key: "joined",
      label: joinedRoles.length
        ? intl.formatMessage(
            { id: "app.garden.membership.joinedAs" },
            { roles: roleNames(joinedRoles) }
          )
        : intl.formatMessage({ id: "app.garden.membership.joined" }),
      at: joinedAt,
    },
  ];
  if (rejoinedAt !== null) {
    rows.push({
      key: "rejoined",
      label: rejoinedRoles.length
        ? intl.formatMessage(
            { id: "app.garden.membership.rejoinedAs" },
            { roles: roleNames(rejoinedRoles) }
          )
        : intl.formatMessage({ id: "app.garden.membership.rejoined" }),
      at: rejoinedAt,
    });
  }

  // Roles that began on another day, one row per day, oldest first.
  const folded = new Set<GardenRole>([...joinedRoles, ...rejoinedRoles]);
  const laterDays = new Map<string, { at: number; roles: GardenRole[] }>();
  for (const role of currentRoles) {
    const since = history?.roleSince[role];
    if (folded.has(role) || !validDate(since)) continue;
    const entry = laterDays.get(day(since)) ?? { at: since, roles: [] };
    entry.roles.push(role);
    laterDays.set(day(since), entry);
  }
  for (const { at, roles: started } of [...laterDays.values()].sort((a, b) => a.at - b.at)) {
    rows.push({
      key: `became-${at}`,
      label: intl.formatMessage(
        { id: "app.garden.membership.became" },
        { roles: roleNames(started) }
      ),
      at,
    });
  }
  for (const role of currentRoles) {
    if (validDate(history?.roleSince[role])) continue;
    rows.push({
      key: `unknown-${role}`,
      label: intl.formatMessage(
        { id: "app.garden.membership.roleSince" },
        { role: getRoleLabel(role, intl.formatMessage).singular }
      ),
      at: null,
    });
  }

  return (
    <FactList frame="inset">
      {rows.map(({ key, label, at }) => (
        <FactRow
          key={key}
          label={label}
          value={
            at === null ? (
              intl.formatMessage({ id: "app.garden.membership.dateUnknown" })
            ) : (
              <time dateTime={new Date(at).toISOString()}>{day(at)}</time>
            )
          }
        />
      ))}
      {children}
    </FactList>
  );
}
