import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiGroupLine, RiUserSettingsLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminSelect } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";
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
  roleMembers,
  roleSummary,
  scheduleBackgroundRefetch,
  selectedItem,
  setMemberSearch,
  visibleDirectory,
}: CommunityMembersTabProps) {
  const { formatMessage } = useIntl();
  const [roleFilter, setRoleFilter] = useState<GardenRole | "all">("all");
  const hasValidGardenAddress = isAddress(garden.id);
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
        <div className="garden-tab-main">
          {canManage && hasValidGardenAddress ? (
            <CommunityJoinRequests gardenAddress={garden.id} />
          ) : null}
          <AdminCard variant="elevated" className="@container space-y-4">
            <div>
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.members.directory" })}
              </AdminCardTitle>
              <p className="mt-1 text-body-sm text-text-sub">
                {formatMessage({ id: "cockpit.community.members.directoryDescription" })}
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
              <AdminCard variant="outlined" density="none" className="divide-y divide-stroke-soft">
                {filteredDirectory.map((entry) => (
                  <div
                    key={entry.address}
                    className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <EnsAddressText address={entry.address} />
                      <div className="flex flex-wrap gap-1.5">
                        {entry.roles.map((role) => (
                          <span
                            key={`${entry.address}-${role}`}
                            className="rounded-full bg-bg-sub px-2 py-0.5 text-label-sm font-medium text-text-sub"
                          >
                            {getRoleLabel(role, formatMessage).singular}
                          </span>
                        ))}
                      </div>
                    </div>
                    {canManage ? (
                      <AdminButton
                        asChild
                        variant="text"
                        size="sm"
                        className="self-start sm:self-center"
                      >
                        <Link
                          to={adminRoutes.communityMembers({
                            ...gardenRouteContext,
                            item: "manage-members",
                            member: entry.address,
                          })}
                        >
                          <RiUserSettingsLine className="h-4 w-4" />
                          {formatMessage({ id: "cockpit.community.members.manageRoles" })}
                        </Link>
                      </AdminButton>
                    ) : null}
                  </div>
                ))}
              </AdminCard>
            )}
          </AdminCard>
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard variant="filled" className="space-y-3">
              <AdminCardTitle>
                {formatMessage({ id: "cockpit.community.members.coverage" })}
              </AdminCardTitle>
              <div className="garden-stat-row">
                <span className="garden-stat-row-label">
                  {formatMessage({ id: "cockpit.community.members.total" })}
                </span>
                <span className="garden-stat-row-value">{memberCount}</span>
              </div>
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
          </div>
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
