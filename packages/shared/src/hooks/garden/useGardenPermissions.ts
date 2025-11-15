import { useMemo } from "react";
import { useOptionalPasskeyAuth } from "../../providers/PasskeyAuthProvider";
import { useOptionalWalletAuth } from "../../providers/WalletAuthProvider";

export interface GardenPermissions {
  canManageGarden: (garden: Garden) => boolean;
  canViewGarden: (garden: Garden) => boolean;
  isOperatorOfGarden: (garden: Garden) => boolean;
  canAddMembers: (garden: Garden) => boolean;
  canRemoveMembers: (garden: Garden) => boolean;
}

export function useGardenPermissions(): GardenPermissions {
  const passkeyAuth = useOptionalPasskeyAuth();
  const walletAuth = useOptionalWalletAuth();
  const address = (passkeyAuth?.walletAddress ||
    passkeyAuth?.smartAccountAddress ||
    walletAuth?.address) as string | undefined;

  const permissions = useMemo(() => {
    const isOperatorOfGarden = (garden: Garden): boolean => {
      if (!address || !garden.operators) return false;
      return garden.operators.map((op) => op.toLowerCase()).includes(address.toLowerCase());
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
