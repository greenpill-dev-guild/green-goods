import { useIntl } from "react-intl";
import type { GardenMemberHistory } from "../types/domain";
import { GARDEN_ROLE_ORDER, getRoleLabel, type GardenRole } from "../utils/blockchain/garden-roles";
import { FactList, FactRow } from "./Cards/FactRow";

/** Membership facts use the same dates and unknown state in the app and cockpit. */
export function GardenMembershipDates({
  history,
  roles,
  isLoading = false,
  isError = false,
  compact = false,
}: {
  history?: GardenMemberHistory;
  roles?: readonly GardenRole[];
  isLoading?: boolean;
  isError?: boolean;
  compact?: boolean;
}) {
  const intl = useIntl();
  const validDate = (value: number | null | undefined): value is number =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 8_640_000_000_000_000;
  const joinedAt = history?.joinedAt;
  if (isLoading || isError || !validDate(joinedAt)) {
    return (
      <p className="type-meta text-text-sub-600" role={isLoading ? "status" : undefined}>
        {intl.formatMessage({
          id: isLoading ? "app.garden.membership.loading" : "app.garden.membership.unavailable",
        })}
      </p>
    );
  }
  const rows: Array<{ label: string; at: number | null | undefined }> = [
    { label: intl.formatMessage({ id: "app.garden.membership.joined" }), at: joinedAt },
  ];
  const memberSince = history?.memberSince;
  if (validDate(memberSince) && memberSince !== joinedAt) {
    rows.push({
      label: intl.formatMessage({ id: "app.garden.membership.rejoined" }),
      at: memberSince,
    });
  }
  if (!compact) {
    for (const role of roles ??
      GARDEN_ROLE_ORDER.filter((role) => validDate(history?.roleSince[role]))) {
      rows.push({
        label: intl.formatMessage(
          { id: "app.garden.membership.roleSince" },
          {
            role: getRoleLabel(role, intl.formatMessage).singular,
          }
        ),
        at: history?.roleSince[role] ?? null,
      });
    }
  }
  return (
    <FactList frame="inset">
      {rows.map(({ label, at }) => (
        <FactRow
          key={label}
          label={label}
          value={
            validDate(at) ? (
              <time dateTime={new Date(at).toISOString()}>
                {intl.formatDate(at, { year: "numeric", month: "short", day: "numeric" })}
              </time>
            ) : (
              intl.formatMessage({ id: "app.garden.membership.dateUnknown" })
            )
          }
        />
      ))}
    </FactList>
  );
}
