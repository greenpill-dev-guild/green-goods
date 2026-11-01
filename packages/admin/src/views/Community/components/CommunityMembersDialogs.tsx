import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import {
  useAddMembersBatch,
  useGardenOperations,
} from "@green-goods/shared/hooks/garden/useGardenOperations";
import { useRouteItemClose } from "@green-goods/shared/hooks/navigation/useCanvasSearchParams";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { ADD_MEMBER_ROUTE_ITEM } from "@green-goods/shared/utils/navigation/admin-routes";
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

/**
 * The Community workspace's member dialogs. They mount at the workspace because
 * Add Member opens over any tab (DL-140); Manage Roles only opens from Members,
 * and it closes back there.
 */
export function CommunityMembersDialogs({
  garden,
  canManage,
  closeMembersModal,
  roleMembers,
  scheduleBackgroundRefetch,
  selectedItem,
}: CommunityMembersDialogsProps) {
  const [manageMembersOpen, setManageMembersOpen] = useState(selectedItem === "manage-members");
  const addMemberItemOpen = selectedItem === ADD_MEMBER_ROUTE_ITEM;
  const closeAddMemberItem = useRouteItemClose(addMemberItemOpen);
  // Add Members also opens over Manage Members, with no route item of its own.
  const [addingFromManage, setAddingFromManage] = useState(false);
  // The person Manage Members was showing when Add Members opened over it.
  const [addMembersPrefill, setAddMembersPrefill] = useState<Address | undefined>();
  const [searchParams] = useSearchParams();
  const memberParam = searchParams.get("member");
  const initialMemberAddress =
    selectedItem === "manage-members" && memberParam && isAddress(memberParam)
      ? memberParam
      : undefined;
  const operations = useGardenOperations(garden.id);
  const addMembersBatch = useAddMembersBatch(garden.id);
  const gardenAddress = garden.id;

  useEffect(() => {
    if (selectedItem === "manage-members") setManageMembersOpen(true);
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
  const openAddMembers = (prefill?: Address) => {
    setAddMembersPrefill(prefill);
    setAddingFromManage(true);
  };
  const closeAddMembers = () => {
    setAddingFromManage(false);
    setAddMembersPrefill(undefined);
    closeAddMemberItem();
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
        onAddMembers={openAddMembers}
      />
      {isAddress(gardenAddress) ? (
        <AddMembersDialog
          key={garden.id}
          open={canManage && (addMemberItemOpen || addingFromManage)}
          onClose={closeAddMembers}
          tone="community"
          gardenAddress={gardenAddress}
          roleMembers={roleMembers}
          initialAddress={addMembersPrefill}
          isLoading={operations.isLoading}
          onAdd={(role, address) => addByRole[role](address)}
          batch={addMembersBatch}
        />
      ) : null}
    </>
  );
}
