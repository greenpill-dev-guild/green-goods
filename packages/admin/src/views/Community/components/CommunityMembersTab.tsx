import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiGroupLine, RiUserSettingsLine } from "@remixicon/react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSelect } from "@/components/AdminTextField";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { MemberNameReaders, withMemberName } from "@/components/Garden/MemberNames";
import { memberMatchesSearch } from "@/components/Garden/manageRoles";
import { CommunityJoinRequests } from "./CommunityJoinRequests";
import { communityRoleIcons } from "./communityRoleIcons";

export type CommunityMembersTabProps = Pick<
  CommunityWorkspace,
  | "canManage"
  | "keepJoinRequestCountGrant"
  | "memberCount"
  | "memberSearch"
  | "noteJoinRequestsRead"
  | "roleSummary"
  | "setMemberSearch"
  | "visibleDirectory"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityMembersTab({
  garden,
  canManage,
  keepJoinRequestCountGrant,
  memberCount,
  memberSearch,
  noteJoinRequestsRead,
  roleSummary,
  setMemberSearch,
  visibleDirectory,
}: CommunityMembersTabProps) {
  const { formatMessage, formatDate } = useIntl();
  const history = useGardenMemberHistory({
    garden: isAddress(garden.id) ? garden.id : undefined,
    chainId: garden.chainId,
  });
  const historyByAccount = new Map(
    history.isError ? [] : history.members.map((member) => [member.account.toLowerCase(), member])
  );
  const [roleFilter, setRoleFilter] = useState<GardenRole | "all">("all");
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const onName = useCallback(
    (address: Address, name: string | null) =>
      setNames((current) => withMemberName(current, address, name)),
    []
  );
  const gardenAddress = garden.id;
  const hasValidGardenAddress = isAddress(gardenAddress);
  const gardenRouteContext = { gardenId: garden.id };
  const availableRoles = roleSummary.filter((entry) => entry.count > 0);
  const activeRole = availableRoles.some((entry) => entry.role === roleFilter) ? roleFilter : "all";
  // Search matches the names the rows show, as Manage Roles does, so a person found here is
  // found there.
  const filteredDirectory = useMemo(
    () =>
      visibleDirectory.filter(
        (entry) =>
          (activeRole === "all" || entry.roles.includes(activeRole)) &&
          memberMatchesSearch(
            entry,
            memberSearch,
            names.get(entry.address.toLowerCase()),
            formatMessage
          )
      ),
    [activeRole, formatMessage, memberSearch, names, visibleDirectory]
  );
  const missingCriticalRoles = useMemo(
    () =>
      roleSummary.filter(
        (entry) =>
          entry.count === 0 &&
          (entry.role === "owner" || entry.role === "steward" || entry.role === "evaluator")
      ),
    [roleSummary]
  );

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main min-w-0">
          <AdminCard variant="elevated" className="@container space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <AdminCardTitle>
                  {formatMessage({ id: "cockpit.community.members.directory" })}
                </AdminCardTitle>
                <span className="type-meta text-text-sub">
                  {formatMessage({ id: "app.admin.garden.members.count" }, { count: memberCount })}
                </span>
              </div>
              {/* Manage Roles for everyone; a row's button opens it for that person (DL-112). */}
              {canManage ? (
                <Button asChild emphasis="secondary" size="sm">
                  <Link
                    to={adminRoutes.communityMembers({
                      ...gardenRouteContext,
                      item: "manage-members",
                    })}
                  >
                    <RiUserSettingsLine className="h-[18px] w-[18px]" aria-hidden="true" />
                    {formatMessage({ id: "cockpit.community.members.manageRoles" })}
                  </Link>
                </Button>
              ) : null}
            </div>

            <AdminSearchToolbar
              search={memberSearch}
              onSearchChange={setMemberSearch}
              placeholder={formatMessage({ id: "app.garden.detail.community.memberSearch" })}
            />

            {/* Counts live in the Members rail; these controls only filter (DL-141). */}
            <AdminSelect
              className="@[480px]:hidden"
              label={formatMessage({ id: "cockpit.community.members.filterAria" })}
              value={activeRole}
              onChange={(event) => setRoleFilter(event.target.value as GardenRole | "all")}
            >
              <option value="all">
                {formatMessage({ id: "cockpit.community.members.filterAll" })}
              </option>
              {availableRoles.map((entry) => (
                <option key={entry.role} value={entry.role}>
                  {getRoleLabel(entry.role, formatMessage).plural}
                </option>
              ))}
            </AdminSelect>
            <div
              className="hidden flex-wrap gap-2 @[480px]:flex"
              role="group"
              aria-label={formatMessage({ id: "cockpit.community.members.filterAria" })}
            >
              <AdminFilterChip
                label={formatMessage({ id: "cockpit.community.members.filterAll" })}
                selected={activeRole === "all"}
                onToggle={() => setRoleFilter("all")}
              />
              {availableRoles.map((entry) => {
                const roleLabel = getRoleLabel(entry.role, formatMessage);
                const Icon = communityRoleIcons[entry.role];
                return (
                  <AdminFilterChip
                    key={entry.role}
                    label={roleLabel.plural}
                    selected={activeRole === entry.role}
                    leadingIcon={Icon}
                    onToggle={() => setRoleFilter(entry.role)}
                  />
                );
              })}
            </div>

            {filteredDirectory.length === 0 ? (
              <EmptyState
                icon={<RiGroupLine className="h-6 w-6" />}
                title={
                  memberSearch.trim() || activeRole !== "all"
                    ? formatMessage({ id: "app.garden.detail.community.membersEmpty" })
                    : formatMessage({ id: "app.admin.garden.members.empty" })
                }
                description={
                  activeRole !== "all"
                    ? formatMessage({ id: "cockpit.community.members.emptyFiltered" })
                    : undefined
                }
              />
            ) : (
              // One person row each: the highest role is the row's chip, and the count
              // says how many roles they hold when it is more than that one (DL-112).
              <ul className="flex flex-col gap-(--gg-list-gap)">
                {filteredDirectory.map((entry) => {
                  const joinedAt = historyByAccount.get(entry.address.toLowerCase())?.joinedAt;
                  const joined = joinedAt
                    ? {
                        text: formatMessage(
                          { id: "app.garden.membership.joinedOn" },
                          {
                            date: formatDate(joinedAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }),
                          }
                        ),
                        dateTime: new Date(joinedAt).toISOString(),
                      }
                    : undefined;
                  const count =
                    entry.roles.length > 1
                      ? formatMessage(
                          { id: "cockpit.community.members.roleCount" },
                          { count: entry.roles.length }
                        )
                      : undefined;
                  return (
                    <li key={entry.address}>
                      <PersonRow
                        address={entry.address}
                        roles={entry.roles}
                        chainId={garden.chainId}
                        details={
                          joined
                            ? count
                              ? [joined, count]
                              : [joined]
                            : count
                              ? [count]
                              : undefined
                        }
                        action={
                          canManage ? (
                            <IconButton
                              asChild
                              emphasis="tertiary"
                              size="sm"
                              aria-label={formatMessage({
                                id: "cockpit.community.members.manageRoles",
                              })}
                              title={formatMessage({ id: "cockpit.community.members.manageRoles" })}
                            >
                              <Link
                                to={adminRoutes.communityMembers({
                                  ...gardenRouteContext,
                                  item: "manage-members",
                                  member: entry.address,
                                })}
                              >
                                <RiUserSettingsLine />
                              </Link>
                            </IconButton>
                          ) : undefined
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <MemberNameReaders
              addresses={visibleDirectory.map((entry) => entry.address)}
              onName={onName}
            />
          </AdminCard>
        </div>

        <aside className="garden-tab-rail flex flex-col gap-section">
          {canManage && hasValidGardenAddress ? (
            <CommunityJoinRequests
              gardenAddress={gardenAddress}
              onRead={noteJoinRequestsRead}
              onCountGrant={keepJoinRequestCountGrant}
            />
          ) : null}
          <AdminCard variant="elevated" className="space-y-3">
            <AdminCardTitle>
              {formatMessage({ id: "cockpit.community.members.title" })}
            </AdminCardTitle>
            <FactList frame="inset">
              {roleSummary.map((entry) => (
                <FactRow
                  key={entry.role}
                  label={getRoleLabel(entry.role, formatMessage).plural}
                  value={entry.count}
                />
              ))}
            </FactList>
            {missingCriticalRoles.length > 0 ? (
              <Alert variant="warning" className="p-3">
                {formatMessage(
                  { id: "cockpit.community.members.missingCritical" },
                  {
                    roles: missingCriticalRoles
                      .map((entry) => getRoleLabel(entry.role, formatMessage).plural)
                      .join(", "),
                  }
                )}
              </Alert>
            ) : null}
          </AdminCard>
        </aside>
      </div>
    </div>
  );
}
