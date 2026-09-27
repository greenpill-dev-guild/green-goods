import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useEnsNames } from "@green-goods/shared/hooks/blockchain/useEnsName";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiCloseLine, RiUserAddLine, RiUserLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { AdminButton, AdminIconButton } from "../AdminButton";
import { AdminConfirmDialog, AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { AdminFilterChip } from "../AdminFilterChip";
import { AdminSearchToolbar } from "../AdminSearchToolbar";
import { getRoleLabel } from "./gardenUtils";
import { RoleChip } from "./RoleChip";

export interface ManageMembersDialogProps {
  open: boolean;
  initialSearch?: string;
  onClose: () => void;
  roleMembers: Record<GardenRole, Address[]>;
  canManage: boolean;
  /** True while a membership write is in flight — disables row actions. */
  isLoading: boolean;
  onRemoveMember: (address: Address, role: GardenRole) => Promise<{ success: boolean }>;
  /**
   * Opens the Add Members dialog (the single add path). When the roster is
   * searched by one exact address, as the Manage Roles link does, that address
   * is passed along so Add Members starts with the person already filled in.
   */
  onAddMembers: (prefill?: Address) => void;
  tone?: AdminDialogProps["tone"];
}

/** One role one person holds: what a remove takes away. */
interface MemberRole {
  address: Address;
  role: GardenRole;
}

/** A person in the garden, with every role they hold in role order. */
interface MemberPerson {
  address: Address;
  roles: GardenRole[];
}

/**
 * Manage Members — the single membership surface: one row per person across
 * all roles, a chip for each role they hold with its own remove, role filter
 * chips, plus the "Add members" action. Counts mean people, never role seats
 * (DL-049). Replaces the retired Manage Roles / per-role Members / per-role
 * Add modal stack ("keep it simple": add members and manage members).
 */
export function ManageMembersDialog({
  open,
  initialSearch = "",
  onClose,
  roleMembers,
  canManage,
  isLoading,
  onRemoveMember,
  onAddMembers,
  tone,
}: ManageMembersDialogProps) {
  const { formatMessage } = useIntl();
  const [roleFilter, setRoleFilter] = useState<GardenRole | "all">("all");
  const [memberSearch, setMemberSearch] = useState(initialSearch);
  const [pendingRemoval, setPendingRemoval] = useState<MemberRole | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErrorRole, setRemoveErrorRole] = useState<GardenRole | null>(null);
  const [shownFor, setShownFor] = useState({ open, initialSearch });

  // Each opening, and each change of the member it shows (browser history can
  // swap it while the dialog stays open), starts from `initialSearch`; a search
  // typed since is kept until then. Resetting here, rather than remounting
  // through a key, keeps the closing dialog mounted so its exit motion plays.
  if (open !== shownFor.open || initialSearch !== shownFor.initialSearch) {
    setShownFor({ open, initialSearch });
    if (open) {
      setRoleFilter("all");
      setMemberSearch(initialSearch);
      setPendingRemoval(null);
      setRemoveErrorRole(null);
    }
  }

  const people = useMemo<MemberPerson[]>(() => {
    const byAddress = new Map<string, MemberPerson>();
    for (const role of GARDEN_ROLE_ORDER) {
      for (const address of roleMembers[role] ?? []) {
        const key = address.toLowerCase();
        const person = byAddress.get(key);
        if (person) person.roles.push(role);
        else byAddress.set(key, { address, roles: [role] });
      }
    }
    return [...byAddress.values()];
  }, [roleMembers]);
  const ensNames = useEnsNames(
    people.map((person) => person.address),
    { enabled: open }
  );
  const normalizedSearch = memberSearch.trim().toLowerCase();
  const visiblePeople = useMemo(() => {
    const roleScoped =
      roleFilter === "all" ? people : people.filter((person) => person.roles.includes(roleFilter));

    if (!normalizedSearch) return roleScoped;

    return roleScoped.filter((person) =>
      [
        person.address,
        formatAddress(person.address),
        ensNames.get(person.address.toLowerCase()) ?? "",
        ...person.roles.flatMap((role) => {
          const label = getRoleLabel(role, formatMessage);
          return [label.singular, label.plural];
        }),
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [ensNames, formatMessage, normalizedSearch, roleFilter, people]);
  const busy = isLoading || removing;
  const searchedAddress = memberSearch.trim();
  const addMembersPrefill = isAddress(searchedAddress) ? searchedAddress : undefined;
  const pendingRemovalLabel = pendingRemoval
    ? getRoleLabel(pendingRemoval.role, formatMessage)
    : null;

  const handleConfirmRemoval = async () => {
    if (!pendingRemoval) return;

    setRemoving(true);
    setRemoveErrorRole(null);
    try {
      const result = await onRemoveMember(pendingRemoval.address, pendingRemoval.role);
      if (!result.success) {
        setRemoveErrorRole(pendingRemoval.role);
      }
      setPendingRemoval(null);
    } catch {
      setRemoveErrorRole(pendingRemoval.role);
      setPendingRemoval(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
        preventClose={busy}
        size="lg"
        tone={tone}
        title={formatMessage({
          id: "app.garden.roles.modal.title",
          defaultMessage: "Manage Members",
        })}
        description={formatMessage(
          {
            id: "app.garden.roles.modal.description",
            defaultMessage: "{count, plural, one {# member} other {# members}}",
          },
          { count: people.length }
        )}
        actions={
          <>
            <AdminButton type="button" variant="text" onClick={onClose} disabled={busy}>
              {formatMessage({ id: "admin.common.close", defaultMessage: "Close" })}
            </AdminButton>
            {canManage ? (
              <AdminButton
                type="button"
                variant="filled"
                leadingIcon={<RiUserAddLine />}
                onClick={() => onAddMembers(addMembersPrefill)}
                disabled={busy}
              >
                {formatMessage({ id: "admin.addMember.openAction", defaultMessage: "Add Members" })}
              </AdminButton>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          {removeErrorRole ? (
            <Alert variant="error">
              {formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: getRoleLabel(removeErrorRole, formatMessage).singular }
              )}
            </Alert>
          ) : null}

          <AdminSearchToolbar
            search={memberSearch}
            onSearchChange={setMemberSearch}
            placeholder={formatMessage({
              id: "app.admin.roles.searchPlaceholder",
              defaultMessage: "Search members by address, ENS name, or role",
            })}
          />

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={formatMessage({
              id: "app.admin.roles.filterLabel",
              defaultMessage: "Filter by role",
            })}
          >
            <AdminFilterChip
              label={formatMessage({ id: "app.common.all", defaultMessage: "All" })}
              selected={roleFilter === "all"}
              onToggle={() => setRoleFilter("all")}
            />
            {GARDEN_ROLE_ORDER.map((role) => {
              const label = getRoleLabel(role, formatMessage);
              const count = roleMembers[role]?.length ?? 0;
              return (
                <AdminFilterChip
                  key={role}
                  label={`${label.plural} · ${count}`}
                  selected={roleFilter === role}
                  onToggle={() => setRoleFilter(roleFilter === role ? "all" : role)}
                />
              );
            })}
          </div>

          {/* Reserved-geometry roster: min/max height so filter changes and
              loading never resize the dialog; the list scrolls inside. */}
          <div className="min-h-[16rem] max-h-[24rem] overflow-y-auto pr-1">
            {visiblePeople.length === 0 ? (
              <div className="flex min-h-[16rem] items-center justify-center">
                <EmptyState
                  icon={<RiUserLine className="h-6 w-6" />}
                  title={formatMessage({
                    id: normalizedSearch
                      ? "app.garden.detail.community.membersEmpty"
                      : "app.admin.garden.members.empty",
                  })}
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {visiblePeople.map(({ address, roles }) => (
                  <li
                    key={address}
                    className="space-y-2 rounded-[var(--m3-shape-md)] bg-bg-weak px-3 py-2.5"
                  >
                    {/* The person, then their roles beneath, as the directory rows read,
                        so a long address and three roles never crowd one line. */}
                    <AddressDisplay address={address} className="min-w-0" />
                    {/* Each role keeps its own remove, named for the role it takes away. */}
                    <div className="flex flex-wrap items-center gap-2">
                      {roles.map((role) => {
                        const isRemovingRole =
                          removing &&
                          pendingRemoval?.role === role &&
                          pendingRemoval.address.toLowerCase() === address.toLowerCase();
                        return (
                          <span key={role} className="inline-flex items-center gap-0.5">
                            <RoleChip role={role} />
                            {canManage ? (
                              <AdminIconButton
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setRemoveErrorRole(null);
                                  setPendingRemoval({ address, role });
                                }}
                                disabled={busy}
                                loading={isRemovingRole}
                                label={formatMessage(
                                  { id: "app.admin.roles.remove" },
                                  { role: getRoleLabel(role, formatMessage).singular }
                                )}
                              >
                                <RiCloseLine />
                              </AdminIconButton>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </AdminDialog>
      <AdminConfirmDialog
        isOpen={Boolean(pendingRemoval)}
        onClose={() => {
          if (!removing) setPendingRemoval(null);
        }}
        onConfirm={handleConfirmRemoval}
        title={formatMessage({ id: "app.admin.roles.confirmRemoveTitle" })}
        description={
          pendingRemoval && pendingRemovalLabel
            ? formatMessage(
                { id: "app.admin.roles.confirmRemoveDescription" },
                {
                  address: formatAddress(pendingRemoval.address),
                  role: pendingRemovalLabel.singular,
                }
              )
            : undefined
        }
        confirmLabel={formatMessage({ id: "app.admin.roles.confirmRemoveAction" })}
        cancelLabel={formatMessage({ id: "app.common.cancel" })}
        variant="danger"
        isLoading={removing}
        tone={tone}
      />
    </>
  );
}
