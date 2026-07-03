import {
  type Address,
  Alert,
  type GardenRole,
  useGardenOperations,
  useManageMembersController,
} from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog } from "@/components/AdminDialog";
import { AddMembersDialog } from "@/components/Garden/AddMembersDialog";
import { ManageMembersDialog } from "@/components/Garden/ManageMembersDialog";

// Manage Members is a route-driven action flow at /community/members (same
// pattern as the Hub create flows): navigating here opens the members roster
// directly over the Community workspace. Membership is two dialogs, nothing
// more — Manage Members (roster + remove) and Add Members (multi-add staged
// list), both community-toned. The not-found/no-permission states use a
// lightweight dialog of their own rather than double-wrapping the roster.
export default function ManageMembers() {
  const { formatMessage } = useIntl();
  const manageMembers = useManageMembersController();
  const [addOpen, setAddOpen] = useState(false);
  const gardenAddress = manageMembers.garden?.id as Address | undefined;
  const operations = useGardenOperations(gardenAddress ?? ("" as Address));
  const title = formatMessage({
    id: "app.garden.roles.modal.title",
    defaultMessage: "Manage Members",
  });

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

  if (!manageMembers.garden) {
    return (
      <AdminDialog
        open
        size="md"
        tone="community"
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
        tone="community"
        onOpenChange={() => manageMembers.handleCancel()}
        title={title}
      >
        <Alert variant="warning">{formatMessage({ id: "app.admin.auth.noPermission" })}</Alert>
      </AdminDialog>
    );
  }

  return (
    <>
      <ManageMembersDialog
        open
        onClose={manageMembers.handleCancel}
        tone="community"
        roleMembers={manageMembers.roleMembers}
        canManage={manageMembers.canManage}
        isLoading={operations.isLoading}
        onRemoveMember={(address, role) => void removeByRole[role](address)}
        onAddMembers={() => setAddOpen(true)}
      />
      <AddMembersDialog
        // Keyed by garden so a mid-dialog garden change (URL param sync,
        // back/forward) remounts the dialog and clears the staged batch —
        // addresses staged under one garden must never commit to another
        // (parity with the retired descriptor's close-on-switch guard).
        key={gardenAddress}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        tone="community"
        isLoading={operations.isLoading}
        onAdd={(role, address) => addByRole[role](address)}
      />
    </>
  );
}
