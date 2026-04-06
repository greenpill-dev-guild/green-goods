import {
  type Address,
  ConfirmDialog,
  formatAddress,
  GARDEN_ROLE_COLORS,
  type Garden,
  type GardenRole,
  getRoleLabel,
  toastService,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { GardenDomainModal } from "@/components/Garden/GardenDomainEditor";
import { GardenProfileModal } from "@/components/Garden/GardenProfileModal";
import { ManageRolesModal } from "@/components/Garden/ManageRolesModal";
import { MembersModal } from "@/components/Garden/MembersModal";

interface RoleActions {
  add: (address: Address) => Promise<{ success: boolean; error?: Error | null }>;
  remove: (address: string) => Promise<{ success: boolean; error?: Error | null }>;
}

export interface GardenModalsProps {
  garden: Garden;
  canManage: boolean;
  canManageRoles: boolean;
  isOwner: boolean;
  isOperationLoading: boolean;
  roleMembers: Record<GardenRole, string[]>;
  roleActions: Record<GardenRole, RoleActions>;
  scheduleBackgroundRefetch: () => void;
  // Profile modal
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  // Roles modal
  rolesModalOpen: boolean;
  setRolesModalOpen: (open: boolean) => void;
  // Domain modal
  domainModalOpen: boolean;
  setDomainModalOpen: (open: boolean) => void;
  // Add member modal
  addMemberModalOpen: boolean;
  setAddMemberModalOpen: (open: boolean) => void;
  memberType: GardenRole;
  openAddMemberModal: (type: GardenRole) => void;
  // Members modal
  membersModalOpen: boolean;
  setMembersModalOpen: (open: boolean) => void;
  membersModalType: GardenRole;
  openMembersModal: (type: GardenRole) => void;
  // Member removal confirm
  memberToRemove: { address: Address; role: GardenRole } | null;
  setMemberToRemove: (member: { address: Address; role: GardenRole } | null) => void;
  // Role icons
  roleIcons: Record<GardenRole, React.ComponentType<{ className?: string }>>;
}

export function GardenModals({
  garden,
  canManage,
  canManageRoles,
  isOwner,
  isOperationLoading,
  roleMembers,
  roleActions,
  scheduleBackgroundRefetch,
  profileModalOpen,
  setProfileModalOpen,
  rolesModalOpen,
  setRolesModalOpen,
  domainModalOpen,
  setDomainModalOpen,
  addMemberModalOpen,
  setAddMemberModalOpen,
  memberType,
  openAddMemberModal,
  membersModalOpen,
  setMembersModalOpen,
  membersModalType,
  openMembersModal,
  memberToRemove,
  setMemberToRemove,
  roleIcons,
}: GardenModalsProps) {
  const { formatMessage } = useIntl();

  const activeRole = membersModalType;
  const ActiveRoleIcon = roleIcons[activeRole];

  return (
    <>
      <GardenProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        gardenAddress={garden.id as Address}
        garden={garden}
        canManage={canManage}
        isOwner={isOwner}
      />

      <ManageRolesModal
        isOpen={rolesModalOpen}
        onClose={() => setRolesModalOpen(false)}
        roleMembers={roleMembers}
        canManageRoles={canManageRoles}
        isLoading={isOperationLoading}
        onOpenAddMember={openAddMemberModal}
        onOpenMembersModal={openMembersModal}
        onRemoveMember={(address, role) => setMemberToRemove({ address, role })}
      />

      <GardenDomainModal
        isOpen={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        gardenAddress={garden.id as Address}
      />

      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        memberType={memberType}
        onAdd={async (address: Address) => {
          const result = await roleActions[memberType].add(address);
          if (result.success) {
            scheduleBackgroundRefetch();
          }
        }}
        isLoading={isOperationLoading}
      />

      <MembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={formatMessage(
          { id: "app.admin.roles.all" },
          { role: getRoleLabel(activeRole, formatMessage).plural }
        )}
        members={roleMembers[activeRole]}
        canManage={canManageRoles}
        onRemove={async (member: string) => {
          const result = await roleActions[activeRole].remove(member);
          if (result.success) {
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: getRoleLabel(activeRole, formatMessage).singular }
              ),
              message:
                result.error?.message ??
                formatMessage(
                  { id: "app.admin.roles.removeFailed" },
                  { role: getRoleLabel(activeRole, formatMessage).singular }
                ),
            });
          }
        }}
        isLoading={isOperationLoading}
        icon={<ActiveRoleIcon className="h-5 w-5" />}
        colorScheme={GARDEN_ROLE_COLORS[activeRole]}
      />

      <ConfirmDialog
        isOpen={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        title={formatMessage({ id: "app.admin.roles.confirmRemoveTitle" })}
        description={formatMessage(
          { id: "app.admin.roles.confirmRemoveDescription" },
          {
            address: formatAddress(memberToRemove?.address),
            role: memberToRemove ? getRoleLabel(memberToRemove.role, formatMessage).singular : "",
          }
        )}
        confirmLabel={formatMessage({ id: "app.admin.roles.confirmRemoveAction" })}
        variant="danger"
        isLoading={isOperationLoading}
        onConfirm={async () => {
          if (!memberToRemove) return;
          const removeMemberRole = memberToRemove.role;
          const removeMemberAddress = memberToRemove.address;
          const roleLabel = getRoleLabel(removeMemberRole, formatMessage);
          setMemberToRemove(null);

          const result = await roleActions[removeMemberRole].remove(removeMemberAddress);
          if (result.success) {
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: roleLabel.singular }
              ),
              message:
                result.error?.message ??
                formatMessage({ id: "app.admin.roles.removeFailed" }, { role: roleLabel.singular }),
            });
          }
        }}
      />
    </>
  );
}
