import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiGroupLine, RiUserSettingsLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSelect } from "@/components/AdminTextField";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { CommunityJoinRequests } from "./CommunityJoinRequests";
import { CommunityMembersDialogs } from "./CommunityMembersDialogs";
import { communityRoleIcons } from "./communityRoleIcons";

export type CommunityMembersTabProps = Pick<
  CommunityWorkspace,
  | "canManage"
  | "closeMembersModal"
  | "memberCount"
  | "memberSearch"
  | "noteJoinRequestsRead"
  | "roleMembers"
  | "roleSummary"
  | "scheduleBackgroundRefetch"
  | "selectedItem"
  | "setMemberSearch"
  | "visibleDirectory"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityMembersTab({
  garden,
  canManage,
  closeMembersModal,
  memberCount,
  memberSearch,
  noteJoinRequestsRead,
  roleMembers,
  roleSummary,
  scheduleBackgroundRefetch,
  selectedItem,
  setMemberSearch,
  visibleDirectory,
}: CommunityMembersTabProps) {
  const { formatMessage } = useIntl();
  const [roleFilter, setRoleFilter] = useState<GardenRole | "all">("all");
  const gardenAddress = garden.id;
  const hasValidGardenAddress = isAddress(gardenAddress);
  const gardenRouteContext = { gardenId: garden.id };
  const filteredDirectory = useMemo(
    () =>
      roleFilter === "all"
        ? visibleDirectory
        : visibleDirectory.filter((entry) => entry.roles.includes(roleFilter)),
    [roleFilter, visibleDirectory]
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
            <div>
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.members.directory" })}
              </AdminCardTitle>
              <p className="mt-1 type-meta text-text-sub">
                {formatMessage({ id: "app.admin.garden.members.count" }, { count: memberCount })}
              </p>
            </div>

            <AdminSearchToolbar
              search={memberSearch}
              onSearchChange={setMemberSearch}
              placeholder={formatMessage({ id: "app.garden.detail.community.memberSearch" })}
            />

            {/* The chips are the one place role counts show (D15); on a narrow card
                they fold into a select so the members stay above the fold. */}
            <AdminSelect
              className="@[480px]:hidden"
              label={formatMessage({ id: "cockpit.community.members.filterAria" })}
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as GardenRole | "all")}
            >
              <option value="all">
                {formatMessage({ id: "cockpit.community.members.filterAll" })}
              </option>
              {roleSummary.map((entry) => (
                <option key={entry.role} value={entry.role}>
                  {`${getRoleLabel(entry.role, formatMessage).plural} (${entry.count})`}
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
                selected={roleFilter === "all"}
                onToggle={() => setRoleFilter("all")}
              />
              {roleSummary.map((entry) => {
                const roleLabel = getRoleLabel(entry.role, formatMessage);
                const Icon = communityRoleIcons[entry.role];
                return (
                  <AdminFilterChip
                    key={entry.role}
                    label={`${roleLabel.plural} (${entry.count})`}
                    selected={roleFilter === entry.role}
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
                  memberSearch.trim() || roleFilter !== "all"
                    ? formatMessage({ id: "app.garden.detail.community.membersEmpty" })
                    : formatMessage({ id: "app.admin.garden.members.empty" })
                }
                description={
                  roleFilter !== "all"
                    ? formatMessage({ id: "cockpit.community.members.emptyFiltered" })
                    : undefined
                }
              />
            ) : (
              // One person row each: the highest role is the row's chip, and the count
              // says how many roles they hold when it is more than that one (DL-112).
              <ul className="flex flex-col gap-(--gg-list-gap)">
                {filteredDirectory.map((entry) => (
                  <li key={entry.address}>
                    <PersonRow
                      address={entry.address}
                      roles={entry.roles}
                      chainId={garden.chainId}
                      details={
                        entry.roles.length > 1
                          ? [
                              formatMessage(
                                { id: "cockpit.community.members.roleCount" },
                                { count: entry.roles.length }
                              ),
                            ]
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
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <aside className="garden-tab-rail flex flex-col gap-section">
          {canManage && hasValidGardenAddress ? (
            <CommunityJoinRequests gardenAddress={gardenAddress} onRead={noteJoinRequestsRead} />
          ) : null}
          <AdminCard variant="elevated" className="space-y-3">
            <AdminCardTitle>
              {formatMessage({ id: "cockpit.community.members.coverage" })}
            </AdminCardTitle>
            <FactList frame="inset">
              <FactRow
                label={formatMessage({ id: "cockpit.community.members.total" })}
                value={memberCount}
              />
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
      <CommunityMembersDialogs
        garden={garden}
        canManage={canManage}
        closeMembersModal={closeMembersModal}
        roleMembers={roleMembers}
        scheduleBackgroundRefetch={scheduleBackgroundRefetch}
        selectedItem={selectedItem}
      />
    </div>
  );
}
