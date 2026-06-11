import {
  type Address,
  AddressDisplay,
  EmptyState,
  GARDEN_ROLE_I18N_KEYS,
  type GardenRole,
  useEnsAddress,
  useGardenOperations,
} from "@green-goods/shared";
import { RiSearchLine, RiTeamLine, RiUserSettingsLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminTextField } from "@/components/AdminTextField";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { ManageRolesModal } from "@/components/Garden/ManageRolesModal";
import { MembersModal } from "@/components/Garden/MembersModal";
import { getRoleLabel } from "@/components/Garden/gardenUtils";

/**
 * /garden/members — the management surface for a garden's roster.
 *
 * Composes the read roster (search by ENS/address, role chips, copy actions)
 * with the existing member-write path: AddMemberModal + ManageRolesModal +
 * MembersModal driving `useGardenOperations` add/remove per role. No new
 * contract behavior — every control maps to an existing write capability and
 * is gated behind `canManage` (owner or operator).
 */

type GardenMembersFilter = "all" | "operators" | "reviewers" | "gardeners";

/**
 * Roles displayed as chips on each member row, in canonical privilege order.
 * "community" is excluded — Members focuses on the active roster, not
 * passive community participants.
 */
const MEMBER_ROLE_DISPLAY_ORDER = [
  "owner",
  "operator",
  "evaluator",
  "gardener",
  "funder",
] as const satisfies readonly GardenRole[];

type MemberDisplayRole = (typeof MEMBER_ROLE_DISPLAY_ORDER)[number];

const MEMBER_ROLE_CHIP_CLASSES: Record<MemberDisplayRole, string> = {
  owner: "bg-warning-lighter text-warning-dark",
  operator: "bg-success-lighter text-success-dark",
  evaluator: "bg-feature-lighter text-feature-dark",
  gardener: "bg-information-lighter text-information-dark",
  funder: "bg-primary-lighter text-primary-dark",
};

export interface MemberRoleSets {
  owner: Set<string>;
  operator: Set<string>;
  evaluator: Set<string>;
  gardener: Set<string>;
  funder: Set<string>;
}

/**
 * Build lowercase role sets from per-role address arrays. Exported for unit
 * tests so the role-derivation contract is pinned without rendering the row.
 */
export function buildMemberRoleSets(input: {
  owners: Address[];
  operators: Address[];
  evaluators: Address[];
  gardeners: Address[];
  funders: Address[];
}): MemberRoleSets {
  return {
    owner: new Set(input.owners.map((address) => address.toLowerCase())),
    operator: new Set(input.operators.map((address) => address.toLowerCase())),
    evaluator: new Set(input.evaluators.map((address) => address.toLowerCase())),
    gardener: new Set(input.gardeners.map((address) => address.toLowerCase())),
    funder: new Set(input.funders.map((address) => address.toLowerCase())),
  };
}

/**
 * Roles a member holds, returned in MEMBER_ROLE_DISPLAY_ORDER so chip rows
 * are visually stable across members. Address comparison is lowercase-safe.
 */
export function memberRolesForAddress(address: Address, sets: MemberRoleSets): MemberDisplayRole[] {
  const lower = address.toLowerCase();
  return MEMBER_ROLE_DISPLAY_ORDER.filter((role) => sets[role].has(lower));
}

const GARDEN_MEMBERS_FILTERS: ReadonlyArray<{
  id: GardenMembersFilter;
  labelId: string;
  defaultMessage: string;
}> = [
  { id: "all", labelId: "cockpit.garden.members.filter.all", defaultMessage: "All" },
  {
    id: "operators",
    labelId: "cockpit.garden.members.filter.operators",
    defaultMessage: "Operators",
  },
  {
    id: "reviewers",
    labelId: "cockpit.garden.members.filter.reviewers",
    defaultMessage: "Reviewers",
  },
  {
    id: "gardeners",
    labelId: "cockpit.garden.members.filter.gardeners",
    defaultMessage: "Gardeners",
  },
];

export interface GardenMembersPanelProps {
  gardenAddress: Address;
  gardenName: string;
  gardeners: Address[];
  operators: Address[];
  evaluators: Address[];
  funders: Address[];
  owners: Address[];
  roleMembers: Record<GardenRole, Address[]>;
  canManage: boolean;
  /** Header "Add member" action state, owned by the workspace controller. */
  addMemberOpen: boolean;
  onOpenAddMember: () => void;
  onCloseAddMember: () => void;
}

export function GardenMembersPanel({
  gardenAddress,
  gardenName,
  gardeners,
  operators,
  evaluators,
  funders,
  owners,
  roleMembers,
  canManage,
  addMemberOpen,
  onOpenAddMember,
  onCloseAddMember,
}: GardenMembersPanelProps) {
  const { formatMessage } = useIntl();
  const [filter, setFilter] = useState<GardenMembersFilter>("all");
  const [search, setSearch] = useState("");
  const [manageRolesOpen, setManageRolesOpen] = useState(false);
  const [roleAddTarget, setRoleAddTarget] = useState<GardenRole | null>(null);
  const [roleListTarget, setRoleListTarget] = useState<GardenRole | null>(null);

  const operations = useGardenOperations(gardenAddress);

  // ENS-aware search: hex queries and plain fragments match the address text;
  // name-like queries (contain a dot, e.g. "afo.eth") resolve through the
  // existing ENS lookup and match the resolved address exactly.
  const trimmedSearch = search.trim().toLowerCase();
  const looksLikeEnsName = trimmedSearch.length > 2 && trimmedSearch.includes(".");
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    looksLikeEnsName ? trimmedSearch : null,
    { enabled: looksLikeEnsName }
  );

  const roleSets = useMemo(
    () => buildMemberRoleSets({ owners, operators, evaluators, gardeners, funders }),
    [gardeners, operators, evaluators, funders, owners]
  );

  const visibleGardeners = useMemo(() => {
    // Filter chips: All / Operators / Reviewers / Gardeners. Reviewers maps
    // to the evaluator role; "Gardeners" narrows to members whose only
    // display role is "gardener".
    let base = gardeners;
    if (filter === "operators") {
      base = gardeners.filter((address) => roleSets.operator.has(address.toLowerCase()));
    } else if (filter === "reviewers") {
      base = gardeners.filter((address) => roleSets.evaluator.has(address.toLowerCase()));
    } else if (filter === "gardeners") {
      base = gardeners.filter((address) => {
        const roles = memberRolesForAddress(address, roleSets);
        return roles.length === 1 && roles[0] === "gardener";
      });
    }

    if (!trimmedSearch) return base;

    const resolvedTarget =
      looksLikeEnsName && resolvedEnsAddress && isAddress(resolvedEnsAddress)
        ? resolvedEnsAddress.toLowerCase()
        : null;

    return base.filter((address) => {
      const lower = address.toLowerCase();
      if (resolvedTarget) return lower === resolvedTarget;
      return lower.includes(trimmedSearch);
    });
  }, [filter, gardeners, looksLikeEnsName, resolvedEnsAddress, roleSets, trimmedSearch]);

  const addByRole: Record<GardenRole, (address: string) => Promise<{ success: boolean }>> = {
    gardener: operations.addGardener,
    operator: operations.addOperator,
    evaluator: operations.addEvaluator,
    owner: operations.addOwner,
    funder: operations.addFunder,
    community: operations.addCommunity,
  };
  const removeByRole: Record<GardenRole, (address: string) => Promise<{ success: boolean }>> = {
    gardener: operations.removeGardener,
    operator: operations.removeOperator,
    evaluator: operations.removeEvaluator,
    owner: operations.removeOwner,
    funder: operations.removeFunder,
    community: operations.removeCommunity,
  };

  // AddMemberModal treats a resolved promise as success and closes; surface
  // failed operations as throws so the modal keeps the address for retry.
  const addMemberForRole = (role: GardenRole) => async (address: Address) => {
    const result = await addByRole[role](address);
    if (!result.success) {
      throw new Error(
        formatMessage({ id: "app.admin.roles.error.addFailed", defaultMessage: "Failed to add" })
      );
    }
  };

  const handleRemoveMember = async (address: Address, role: GardenRole) => {
    await removeByRole[role](address);
  };

  const roleListLabel = roleListTarget
    ? getRoleLabel(roleListTarget, formatMessage).plural
    : undefined;

  if (gardeners.length === 0) {
    return (
      <>
        <EmptyState
          icon={<RiTeamLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.garden.members.empty.title",
            defaultMessage: "No gardeners yet",
          })}
          description={formatMessage(
            {
              id: "cockpit.garden.members.empty.solo.description",
              defaultMessage:
                "{name} is open for joining — gardeners will appear here as they sign up.",
            },
            { name: gardenName }
          )}
          action={
            canManage
              ? {
                  label: formatMessage({
                    id: "cockpit.garden.action.addMember",
                    defaultMessage: "Add member",
                  }),
                  onClick: onOpenAddMember,
                }
              : undefined
          }
        />
        {canManage ? (
          <AddMemberModal
            isOpen={addMemberOpen}
            onClose={onCloseAddMember}
            memberType="gardener"
            onAdd={addMemberForRole("gardener")}
            isLoading={operations.isLoading}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-3" data-component="GardenMembersPanel">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-title-md font-semibold text-text-strong [overflow-wrap:anywhere]">
            {formatMessage(
              {
                id: "cockpit.garden.members.title",
                defaultMessage: "Members of {name}",
              },
              { name: gardenName }
            )}
          </h2>
          <p className="text-body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.members.scope",
              defaultMessage: "This roster is scoped to the selected garden.",
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-label-sm font-medium text-text-soft tabular-nums">
            {formatMessage(
              {
                id: "cockpit.garden.members.count",
                defaultMessage:
                  "{count, plural, one {# gardener in this garden} other {# gardeners in this garden}}",
              },
              { count: gardeners.length }
            )}
          </p>
          {canManage ? (
            <AdminButton
              variant="outlined"
              size="sm"
              leadingIcon={<RiUserSettingsLine />}
              onClick={() => setManageRolesOpen(true)}
            >
              {formatMessage({
                id: "app.garden.roles.modal.title",
                defaultMessage: "Manage Roles",
              })}
            </AdminButton>
          ) : null}
        </div>
      </header>

      <AdminTextField
        label={formatMessage({
          id: "cockpit.garden.members.search",
          defaultMessage: "Search by ENS or address",
        })}
        variant="outlined"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={formatMessage({
          id: "cockpit.garden.members.search",
          defaultMessage: "Search by ENS or address",
        })}
        leadingIcon={RiSearchLine}
      />

      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={formatMessage({
          id: "cockpit.garden.members.filterAria",
          defaultMessage: "Filter this garden's members by role",
        })}
      >
        {GARDEN_MEMBERS_FILTERS.map((chip) => (
          <AdminFilterChip
            key={chip.id}
            label={formatMessage({ id: chip.labelId, defaultMessage: chip.defaultMessage })}
            selected={filter === chip.id}
            onToggle={() => setFilter(chip.id)}
          />
        ))}
      </div>

      <div aria-live="polite" className="sr-only">
        {looksLikeEnsName && resolvingEns
          ? formatMessage({
              id: "admin.addMember.resolvingEns",
              defaultMessage: "Resolving ENS name...",
            })
          : null}
      </div>

      <ul className="flex flex-col gap-2" role="list">
        {visibleGardeners.length === 0 ? (
          <li className="rounded-[var(--r-md,12px)] border border-dashed border-stroke-soft px-3 py-4 text-center text-label-sm text-text-soft">
            {trimmedSearch
              ? formatMessage({
                  id: "cockpit.garden.members.searchEmpty",
                  defaultMessage: "No members match this search.",
                })
              : formatMessage({
                  id: "cockpit.garden.members.filterEmpty",
                  defaultMessage: "No members in this filter yet.",
                })}
          </li>
        ) : null}
        {visibleGardeners.map((address) => {
          const memberRoles = memberRolesForAddress(address, roleSets);
          const primaryRole = memberRoles[0] ?? "gardener";
          return (
            <li
              key={address}
              data-slot="member-row"
              data-role={primaryRole}
              className="flex items-center justify-between gap-3 rounded-[var(--r-md,12px)] border border-stroke-soft bg-bg-white-0 px-3 py-2.5 shadow-[var(--edge-rest)]"
            >
              <AddressDisplay address={address} className="min-w-0 flex-1" />
              {memberRoles.length > 0 ? (
                <div
                  className="flex flex-wrap items-center justify-end gap-1"
                  aria-label={formatMessage({
                    id: "cockpit.garden.members.rolesLabel",
                    defaultMessage: "Roles",
                  })}
                >
                  {memberRoles.map((role) => {
                    const label = formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular });
                    return (
                      <span
                        key={role}
                        data-role-chip={role}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-medium ${MEMBER_ROLE_CHIP_CLASSES[role]}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canManage ? (
        <>
          {/* Header "Add member" primary — adds a gardener, the common case.
              Other roles add through Manage Roles below. */}
          <AddMemberModal
            isOpen={addMemberOpen}
            onClose={onCloseAddMember}
            memberType="gardener"
            onAdd={addMemberForRole("gardener")}
            isLoading={operations.isLoading}
          />

          <ManageRolesModal
            isOpen={manageRolesOpen}
            onClose={() => setManageRolesOpen(false)}
            roleMembers={roleMembers}
            canManageRoles={canManage}
            isLoading={operations.isLoading}
            onOpenAddMember={(role) => setRoleAddTarget(role)}
            onOpenMembersModal={(role) => setRoleListTarget(role)}
            onRemoveMember={(address, role) => void handleRemoveMember(address, role)}
          />

          {roleAddTarget ? (
            <AddMemberModal
              isOpen
              onClose={() => setRoleAddTarget(null)}
              memberType={roleAddTarget}
              onAdd={addMemberForRole(roleAddTarget)}
              isLoading={operations.isLoading}
            />
          ) : null}

          {roleListTarget ? (
            <MembersModal
              isOpen
              onClose={() => setRoleListTarget(null)}
              title={roleListLabel ?? ""}
              members={roleMembers[roleListTarget] ?? []}
              canManage={canManage}
              onRemove={(member) => handleRemoveMember(member as Address, roleListTarget)}
              isLoading={operations.isLoading}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
