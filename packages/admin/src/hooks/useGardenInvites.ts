import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { type Hex, keccak256, toHex } from "viem";
import { useToastAction } from "./useToastAction";
import { GardenAccountABI } from "@/utils/contracts";

export interface GardenInvite {
  code: Hex;
  garden: string;
  creator: string;
  expiry: number;
  used: boolean;
  usedBy?: string;
  link: string;
}

export function useGardenInvites(gardenAddress: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  /**
   * Generates a unique invite code
   */
  const generateInviteCode = (): Hex => {
    const random = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString();
    const combined = `${random}-${timestamp}-${gardenAddress}`;
    return keccak256(toHex(combined));
  };

  /**
   * Generates an invite link from invite code
   */
  const generateInviteLink = (inviteCode: Hex): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/garden/join?invite=${inviteCode}&garden=${gardenAddress}`;
  };

  /**
   * Creates a new invite code
   */
  const createInvite = async (expiryDays: number = 7): Promise<string> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const inviteCode = generateInviteCode();
      const expiry = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;

      const result = await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenAddress as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "createInviteCode",
            account: address,
            args: [inviteCode, BigInt(expiry)],
          });

          return hash;
        },
        {
          loadingMessage: "Creating invite...",
          successMessage: "Invite created successfully",
          errorMessage: "Failed to create invite",
        }
      );

      // Return the invite link
      return generateInviteLink(inviteCode);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Revokes an unused invite
   */
  const revokeInvite = async (inviteCode: Hex): Promise<void> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenAddress as `0x${string}`,
            abi: GardenAccountABI.abi,
            functionName: "revokeInvite",
            account: address,
            args: [inviteCode],
          });

          return hash;
        },
        {
          loadingMessage: "Revoking invite...",
          successMessage: "Invite revoked successfully",
          errorMessage: "Failed to revoke invite",
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createInvite,
    revokeInvite,
    generateInviteCode,
    generateInviteLink,
    isLoading,
  };
}
