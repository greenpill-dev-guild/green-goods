import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
  getRoleColorClasses,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiDeleteBinLine, RiLoader4Line, RiUserAddLine, RiUserLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "../AdminButton";
import { AdminConfirmDialog, AdminDialog, type AdminDialogProps } from "../AdminDialog";
import { AdminFilterChip } from "../AdminFilterChip";
import { getRoleLabel } from "./gardenUtils";

export interface ManageMembersDialogProps {
  open: boolean;
  onClose: () => void;
  roleMembers: Record<GardenRole, Address[]>;
  canManage: boolean;
  /** True while a membership write is in flight — disables row actions. */
  isLoading: boolean;
  onRemoveMember: (address: Address, role: GardenRole) => Promise<{ success: boolean }>;
  /** Opens the Add Members dialog (the single add path). */
  onAddMembers: () => void;
  tone?: AdminDialogProps["tone"];
}

interface MemberRow {
  address: Address;
  role: GardenRole;
}

/**
 * Manage Members — the single membership surface: one flat roster across all
 * roles with role filter chips and per-member remove, plus the "Add members"
 * action. Replaces the retired Manage Roles / per-role Members / per-role Add
 * modal stack ("keep it simple": add members and manage members, nothing else).
 */
export function ManageMembersDialog({
  open,
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
  const [pendingRemoval, setPendingRemoval] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErrorRole, setRemoveErrorRole] = useState<GardenRole | null>(null);

  const rows = useMemo<MemberRow[]>(
    () =>
      GARDEN_ROLE_ORDER.flatMap((role) =>
        (roleMembers[role] ?? []).map((address) => ({ address, role }))
      ),
    [roleMembers]
  );
  const visibleRows = roleFilter === "all" ? rows : rows.filter((row) => row.role === roleFilter);
  const busy = isLoading || removing;
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
            defaultMessage: "{count} members across all roles",
          },
          { count: rows.length }
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
                onClick={onAddMembers}
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
            {visibleRows.length === 0 ? (
              <div className="flex min-h-[16rem] items-center justify-center">
                <EmptyState
                  icon={<RiUserLine className="h-6 w-6" />}
                  title={formatMessage({ id: "app.admin.garden.members.empty" })}
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {visibleRows.map(({ address, role }) => {
                  const label = getRoleLabel(role, formatMessage);
                  const colors = getRoleColorClasses(role);
                  const isRemovingRow =
                    removing &&
                    pendingRemoval?.role === role &&
                    pendingRemoval.address.toLowerCase() === address.toLowerCase();
                  return (
                    <li
                      key={`${role}-${address}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--m3-shape-md)] bg-bg-weak px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <AddressDisplay address={address} className="min-w-0 flex-1" />
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colors.iconBg} ${colors.iconText}`}
                        >
                          {label.singular}
                        </span>
                      </div>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveErrorRole(null);
                            setPendingRemoval({ address, role });
                          }}
                          disabled={busy}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--m3-shape-sm)] text-error-dark transition hover:bg-error-lighter disabled:opacity-50"
                          aria-label={formatMessage(
                            { id: "app.admin.roles.remove" },
                            { role: label.singular }
                          )}
                        >
                          {isRemovingRow ? (
                            <RiLoader4Line className="h-4 w-4 animate-spin" />
                          ) : (
                            <RiDeleteBinLine className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
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
