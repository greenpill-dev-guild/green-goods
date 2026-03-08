import type { Address, GardenRole } from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed z-50 w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
          onPointerDownOutside={(e) => {
            if (isLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isLoading) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-lg font-semibold text-text-strong sm:text-xl">
                {formatMessage({
                  id: "app.garden.roles.modal.title",
                  defaultMessage: "Manage Roles",
                })}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-text-soft sm:text-sm">
                {formatMessage(
                  {
                    id: "app.garden.roles.modal.description",
                    defaultMessage: "{count} members across all roles",
                  },
                  { count: totalMembers }
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
                aria-label={formatMessage({ id: "app.common.close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 sm:p-6">
            <GardenRolesPanel
              roleMembers={roleMembers}
              canManageRoles={canManageRoles}
              isLoading={isLoading}
              onOpenAddMember={onOpenAddMember}
              onOpenMembersModal={onOpenMembersModal}
              onRemoveMember={onRemoveMember}
            />
          </div>

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden" aria-hidden="true">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
