import { type Address, type GardenRole, useGardenOperations } from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { ManageRolesModal } from "@/components/Garden/ManageRolesModal";
import { MembersModal } from "@/components/Garden/MembersModal";

/**
 * The garden member-write modal stack — Manage Roles + the per-role AddMember /
 * Members sub-modals — extracted so it can mount in-context wherever an operator
 * manages a garden's roster (Garden → Members and Community → People). Every
 * control maps to an existing `useGardenOperations` write and is gated behind
 * `canManage`; the host owns the top-level open state so its own "Manage roles"
 * affordance stays where the operator already is.
 */
export interface GardenRolesModalsProps {
  gardenAddress: Address;
  roleMembers: Record<GardenRole, Address[]>;
  canManage: boolean;
  /** Manage Roles dialog open state, owned by the host surface. */
  open: boolean;
  onClose: () => void;
}

export function GardenRolesModals({
  gardenAddress,
  roleMembers,
  canManage,
  open,
  onClose,
}: GardenRolesModalsProps) {
  const { formatMessage } = useIntl();
  const [roleAddTarget, setRoleAddTarget] = useState<GardenRole | null>(null);
  const [roleListTarget, setRoleListTarget] = useState<GardenRole | null>(null);

  const operations = useGardenOperations(gardenAddress);

  const addByRole: Record<GardenRole, (address: Address) => Promise<{ success: boolean }>> = {
    gardener: operations.addGardener,
    operator: operations.addOperator,
    evaluator: operations.addEvaluator,
    owner: operations.addOwner,
    funder: operations.addFunder,
    community: operations.addCommunity,
  };
  const removeByRole: Record<GardenRole, (address: Address) => Promise<{ success: boolean }>> = {
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

  if (!canManage) return null;

  return (
    <>
      <ManageRolesModal
        isOpen={open}
        onClose={onClose}
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
  );
}
