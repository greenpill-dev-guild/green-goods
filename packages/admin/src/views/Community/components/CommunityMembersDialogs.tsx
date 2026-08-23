import {
  type Address,
  type CommunityWorkspace,
  type GardenRole,
  useGardenOperations,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { AddMembersDialog } from "@/components/Garden/AddMembersDialog";
import { ManageMembersDialog } from "@/components/Garden/ManageMembersDialog";

export type CommunityMembersDialogsProps = Pick<
  CommunityWorkspace,
  "canManage" | "closeMembersModal" | "roleMembers" | "scheduleBackgroundRefetch" | "selectedItem"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

export function CommunityMembersDialogs({
  garden,
  canManage,
  closeMembersModal,
  roleMembers,
  scheduleBackgroundRefetch,
  selectedItem,
}: CommunityMembersDialogsProps) {
  const [manageMembersOpen, setManageMembersOpen] = useState(selectedItem === "manage-members");
  const [addMembersOpen, setAddMembersOpen] = useState(selectedItem === "add-member");
  const operations = useGardenOperations(garden.id);

  useEffect(() => {
    if (selectedItem === "manage-members") setManageMembersOpen(true);
    if (selectedItem === "add-member") setAddMembersOpen(true);
  }, [selectedItem]);

  const addByRole = useMemo<
    Record<GardenRole, (address: Address) => Promise<{ success: boolean }>>
  >(
    () => ({
      gardener: operations.addGardener,
      operator: operations.addOperator,
      evaluator: operations.addEvaluator,
      owner: operations.addOwner,
      funder: operations.addFunder,
      community: operations.addCommunity,
    }),
    [operations]
  );
  const removeByRole = useMemo<
    Record<GardenRole, (address: Address) => Promise<{ success: boolean }>>
  >(
    () => ({
      gardener: operations.removeGardener,
      operator: operations.removeOperator,
      evaluator: operations.removeEvaluator,
      owner: operations.removeOwner,
      funder: operations.removeFunder,
      community: operations.removeCommunity,
    }),
    [operations]
  );

  const closeManageMembers = () => {
    setManageMembersOpen(false);
    if (selectedItem === "manage-members") closeMembersModal();
  };
  const closeAddMembers = () => {
    setAddMembersOpen(false);
    if (selectedItem === "add-member") closeMembersModal();
  };
  const handleRemoveMember = async (address: Address, role: GardenRole) => {
    const result = await removeByRole[role](address);
    if (!result.success) scheduleBackgroundRefetch();
    return result;
  };

  return (
    <>
      <ManageMembersDialog
        open={manageMembersOpen}
        onClose={closeManageMembers}
        tone="community"
        roleMembers={roleMembers}
        canManage={canManage}
        isLoading={operations.isLoading}
        onRemoveMember={handleRemoveMember}
        onAddMembers={() => setAddMembersOpen(true)}
      />
      <AddMembersDialog
        key={garden.id}
        open={addMembersOpen}
        onClose={closeAddMembers}
        tone="community"
        isLoading={operations.isLoading}
        onAdd={(role, address) => addByRole[role](address)}
      />
    </>
  );
}
