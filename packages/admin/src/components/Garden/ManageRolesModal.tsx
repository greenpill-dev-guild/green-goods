import { type Address, type GardenRole } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminDialog } from "../AdminDialog";
import { GardenRolesPanel } from "./GardenRolesPanel";

interface ManageRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleMembers: Record<GardenRole, Address[]>;
  canManageRoles: boolean;
  isLoading: boolean;
  onOpenAddMember: (role: GardenRole) => void;
  onOpenMembersModal: (role: GardenRole) => void;
  onRemoveMember: (address: Address, role: GardenRole) => void;
}

export function ManageRolesModal({
  isOpen,
  onClose,
  roleMembers,
  canManageRoles,
  isLoading,
  onOpenAddMember,
  onOpenMembersModal,
  onRemoveMember,
}: ManageRolesModalProps) {
  const { formatMessage } = useIntl();

  const totalMembers = Object.values(roleMembers).reduce((sum, m) => sum + m.length, 0);

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="2xl"
      title={formatMessage({
        id: "app.garden.roles.modal.title",
        defaultMessage: "Manage Roles",
      })}
      description={formatMessage(
        {
          id: "app.garden.roles.modal.description",
          defaultMessage: "{count} members across all roles",
        },
        { count: totalMembers }
      )}
    >
      <GardenRolesPanel
        roleMembers={roleMembers}
        canManageRoles={canManageRoles}
        isLoading={isLoading}
        onOpenAddMember={onOpenAddMember}
        onOpenMembersModal={onOpenMembersModal}
        onRemoveMember={onRemoveMember}
      />
    </AdminDialog>
  );
}
