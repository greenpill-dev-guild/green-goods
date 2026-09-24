import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import { useGardenOperations } from "@green-goods/shared/hooks/garden/useGardenOperations";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAddress } from "viem";
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
  const [searchParams] = useSearchParams();
  const memberParam = searchParams.get("member");
  const initialMemberAddress =
    selectedItem === "manage-members" && memberParam && isAddress(memberParam)
      ? memberParam
      : undefined;
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
      steward: operations.addSteward,
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
      steward: operations.removeSteward,
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
        key={garden.id}
        open={manageMembersOpen}
        initialSearch={initialMemberAddress}
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
