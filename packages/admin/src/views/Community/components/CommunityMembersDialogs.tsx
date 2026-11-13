import type { CommunityWorkspace } from "@green-goods/shared/hooks/admin-ui/community/useCommunityWorkspaceController";
import {
  useAddMembersBatch,
  useGardenOperations,
  useRemoveMemberRoles,
} from "@green-goods/shared/hooks/garden/useGardenOperations";
import { useRouteItemClose } from "@green-goods/shared/hooks/navigation/useCanvasSearchParams";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { ADD_MEMBER_ROUTE_ITEM } from "@green-goods/shared/utils/navigation/admin-routes";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAddress } from "viem";
import { AddMembersDialog } from "@/components/Garden/AddMembersDialog";
import { ManageMembersDialog } from "@/components/Garden/ManageMembersDialog";

export type CommunityMembersDialogsProps = Pick<
  CommunityWorkspace,
  | "canManage"
  | "closeMembersModal"
  | "isOwner"
  | "roleMembers"
  | "scheduleBackgroundRefetch"
  | "selectedItem"
> & {
  garden: NonNullable<CommunityWorkspace["garden"]>;
};

/**
 * The Community workspace's member dialogs. They mount at the workspace because
 * Add Member opens over any tab (DL-140); Manage Roles opens from Members, for
 * everyone from the directory's header or for one person from their row, and it
 * closes back there.
 */
export function CommunityMembersDialogs({
  garden,
  canManage,
  closeMembersModal,
  isOwner,
  roleMembers,
  scheduleBackgroundRefetch,
  selectedItem,
}: CommunityMembersDialogsProps) {
  const manageMembersOpen = selectedItem === "manage-members";
  const addMemberItemOpen = selectedItem === ADD_MEMBER_ROUTE_ITEM;
  const closeAddMemberItem = useRouteItemClose(addMemberItemOpen);
  // Add Members also opens over Manage Members, with no route item of its own.
  const [addingFromManage, setAddingFromManage] = useState(false);
  // The person Manage Members was showing when Add Members opened over it.
  const [roleTarget, setRoleTarget] = useState<Address | undefined>();
  if (addMemberItemOpen && roleTarget) setRoleTarget(undefined);
  const [addMembersPrefill, setAddMembersPrefill] = useState<Address | undefined>();
  // It leaves with Manage Members, by browser Back as well as by a close.
  if (addingFromManage && !manageMembersOpen) {
    setAddingFromManage(false);
    setAddMembersPrefill(undefined);
  }
  const [searchParams] = useSearchParams();
  const memberParam = searchParams.get("member");
  const initialMemberAddress =
    selectedItem === "manage-members" && memberParam && isAddress(memberParam)
      ? memberParam
      : undefined;
  const operations = useGardenOperations(garden.id);
  const addMembersBatch = useAddMembersBatch(garden.id);
  const removal = useRemoveMemberRoles(garden.id);
  const gardenAddress = garden.id;

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
  const openAddMembers = (prefill?: Address) => {
    setRoleTarget(undefined);
    setAddMembersPrefill(prefill);
    setAddingFromManage(true);
  };
  const openAddRole = (address: Address) => {
    setRoleTarget(address);
    setAddMembersPrefill(address);
    setAddingFromManage(true);
  };
  const closeAddMembers = () => {
    setAddingFromManage(false);
    setAddMembersPrefill(undefined);
    scheduleBackgroundRefetch();
    closeAddMemberItem();
  };

  return (
    <>
      {/* Each restarts when the garden changes; sibling keys must still differ. */}
      <ManageMembersDialog
        key={`manage-members:${garden.id}`}
        open={manageMembersOpen}
        gardenAddress={isAddress(gardenAddress) ? gardenAddress : undefined}
        onAddRole={openAddRole}
        initialMember={initialMemberAddress}
        onClose={closeMembersModal}
        closesByRoute
        tone="community"
        roleMembers={roleMembers}
        canManage={canManage}
        viewerIsOwner={isOwner}
        viewerAddress={removal.account}
        gardenName={garden.name}
        chainId={garden.chainId}
        isLoading={operations.isLoading}
        removal={removal}
        onRosterStale={scheduleBackgroundRefetch}
        onAddMembers={openAddMembers}
      />
      {isAddress(gardenAddress) ? (
        <AddMembersDialog
          key={`add-members:${garden.id}:${roleTarget ?? "new"}`}
          open={canManage && (addMemberItemOpen || addingFromManage)}
          closesByRoute={addMemberItemOpen}
          onClose={closeAddMembers}
          tone="community"
          gardenAddress={gardenAddress}
          roleMembers={roleMembers}
          memberAddress={roleTarget}
          initialAddress={addMembersPrefill}
          isLoading={operations.isLoading}
          onAdd={async (role, address) => {
            const result = await addByRole[role](address);
            if (result.success) scheduleBackgroundRefetch();
            return result;
          }}
          batch={{
            ...addMembersBatch,
            add: (rows, onLanded) =>
              addMembersBatch.add(rows, (landed) => {
                scheduleBackgroundRefetch();
                onLanded?.(landed);
              }),
          }}
        />
      ) : null}
    </>
  );
}
