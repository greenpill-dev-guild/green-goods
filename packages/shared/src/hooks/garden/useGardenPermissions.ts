import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useAuthContext } from "../../providers/Auth";
import { isAddressInList } from "../../utils/blockchain/address";

export interface GardenPermissions {
  canManageGarden: (garden: Garden) => boolean;
  canViewGarden: (garden: Garden) => boolean;
  isOperatorOfGarden: (garden: Garden) => boolean;
  canAddMembers: (garden: Garden) => boolean;
  canRemoveMembers: (garden: Garden) => boolean;
}

export function useGardenPermissions(): GardenPermissions {
  const auth = useAuthContext();
  const { address: wagmiAddress } = useAccount();

  // Get address - prioritize wagmi for wallet mode, then auth context for passkey mode
  const address = (wagmiAddress ?? auth.smartAccountAddress) as string | undefined;

  const permissions = useMemo(() => {
    const isOperatorOfGarden = (garden: Garden): boolean => {
      return isAddressInList(address, garden.operators);
    };

    const canViewGarden = (_garden: Garden): boolean => {
      // Everyone can view gardens (read-only access)
      return true;
    };

    const canManageGarden = (garden: Garden): boolean => {
      // Only operators of the specific garden can manage it
      return isOperatorOfGarden(garden);
    };

    const canAddMembers = (garden: Garden): boolean => {
      // Only operators can add members to their gardens
      return isOperatorOfGarden(garden);
    };

    const canRemoveMembers = (garden: Garden): boolean => {
      // Only operators can remove members from their gardens
      return isOperatorOfGarden(garden);
    };

    return {
      canManageGarden,
      canViewGarden,
      isOperatorOfGarden,
      canAddMembers,
      canRemoveMembers,
    };
  }, [address]);

  return permissions;
}
