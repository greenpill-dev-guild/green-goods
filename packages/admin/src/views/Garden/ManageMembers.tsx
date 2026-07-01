import { type Address, Alert, useManageMembersController } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { GardenRolesModals } from "@/components/Garden/GardenRolesModals";

// Manage Members is a route-driven action, same pattern as the Hub create
// flows: navigating here (from the Garden "Manage members" quick action or
// the Community header action) opens the role-management modal stack
// directly — no intermediate roster page, no second "Manage Roles" click.
// GardenRolesModals already renders its own complete centered AdminDialog
// (ManageRolesModal), so the not-found/no-permission states below use a
// lightweight dialog of their own rather than double-wrapping it.
export default function ManageMembers() {
  const { formatMessage } = useIntl();
  const manageMembers = useManageMembersController();
  const title = formatMessage({
    id: "app.garden.roles.modal.title",
    defaultMessage: "Manage Roles",
  });

  if (!manageMembers.garden) {
    return (
      <AdminDialog
        open
        size="md"
        tone="garden"
        onOpenChange={() => manageMembers.handleCancel()}
        title={title}
      >
        <Alert variant="error">{formatMessage({ id: "app.garden.admin.notFound" })}</Alert>
      </AdminDialog>
    );
  }

  if (!manageMembers.canManage) {
    return (
      <AdminDialog
        open
        size="md"
        tone="garden"
        onOpenChange={() => manageMembers.handleCancel()}
        title={title}
      >
        <Alert variant="warning">{formatMessage({ id: "app.admin.auth.noPermission" })}</Alert>
      </AdminDialog>
    );
  }

  return (
    <GardenRolesModals
      open
      onClose={manageMembers.handleCancel}
      gardenAddress={manageMembers.garden.id as Address}
      roleMembers={manageMembers.roleMembers}
      canManage={manageMembers.canManage}
    />
  );
}
