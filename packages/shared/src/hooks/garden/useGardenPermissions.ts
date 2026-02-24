import { useMemo } from "react";
import type { Garden } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";

export interface GardenPermissions {
  canManageGarden: (garden: Garden) => boolean;
  canReviewGarden: (garden: Garden) => boolean;
  canViewGarden: (garden: Garden) => boolean;
  isOperatorOfGarden: (garden: Garden) => boolean;
  isOwnerOfGarden: (garden: Garden) => boolean;
  isEvaluatorOfGarden: (garden: Garden) => boolean;
  canAddMembers: (garden: Garden) => boolean;
  canRemoveMembers: (garden: Garden) => boolean;
}

export function useGardenPermissions(): GardenPermissions {
  // Use single source of truth for primary address (smart account for passkey, EOA for wallet)
  const address = usePrimaryAddress() as string | undefined;

  const permissions = useMemo(() => {
    const isOperatorOfGarden = (garden: Garden): boolean => {
      return isAddressInList(address, garden.operators);
    };

    const isOwnerOfGarden = (garden: Garden): boolean => {
      return isAddressInList(address, garden.owners);
    };

    const isEvaluatorOfGarden = (garden: Garden): boolean => {
      return isAddressInList(address, garden.evaluators);
    };

    const canViewGarden = (_garden: Garden): boolean => {
      // Everyone can view gardens (read-only access)
      return true;
    };

    const canManageGarden = (garden: Garden): boolean => {
      // Owners + operators can manage the garden
      return isOperatorOfGarden(garden) || isOwnerOfGarden(garden);
    };

    const canReviewGarden = (garden: Garden): boolean => {
      // Evaluators can review work and create assessments
      return canManageGarden(garden) || isEvaluatorOfGarden(garden);
    };

    const canAddMembers = (garden: Garden): boolean => {
      // Owners + operators can manage roles
      return isOperatorOfGarden(garden) || isOwnerOfGarden(garden);
    };

    const canRemoveMembers = (garden: Garden): boolean => {
      // Owners + operators can manage roles
      return isOperatorOfGarden(garden) || isOwnerOfGarden(garden);
    };

    return {
      canManageGarden,
      canReviewGarden,
      canViewGarden,
      isOperatorOfGarden,
      isOwnerOfGarden,
      isEvaluatorOfGarden,
      canAddMembers,
      canRemoveMembers,
    };
  }, [address]);

  return permissions;
}
