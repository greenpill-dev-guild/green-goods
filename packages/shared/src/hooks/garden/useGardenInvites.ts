import { useState } from "react";
import { type Address, type Hex, keccak256 } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { useToastAction } from "../app/useToastAction";
import { useCurrentChain } from "../blockchain/useChainConfig";

export interface GardenInvite {
  id: string;
  garden: string;
  creator: string;
  expiry: bigint;
  used: boolean;
  usedBy?: string;
  createdAt: number;
  usedAt?: number;
  chainId: number;
}

export function useGardenInvites(gardenAddress: Address) {
  const chainId = useCurrentChain();
  const [invites, setInvites] = useState<GardenInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  /**
   * Generates a unique invite code using cryptographically secure randomness
   */
  const generateInviteCode = (): Hex => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const hexString = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return keccak256(`0x${hexString}` as Hex);
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

      await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenAddress as `0x${string}`,
            abi: GardenAccountABI,
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

      const now = Math.floor(Date.now() / 1000);
      setInvites((current) => [
        {
          id: inviteCode,
          garden: gardenAddress,
          creator: address,
          expiry: BigInt(expiry),
          used: false,
          createdAt: now,
          chainId,
        },
        ...current,
      ]);

      // Return the invite link
      return generateInviteLink(inviteCode);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Revokes an unused invite
   */
  const revokeInvite = async (inviteCode: string): Promise<void> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setIsRevoking(true);

    try {
      await executeWithToast(
        async () => {
          const hash = await walletClient.writeContract({
            address: gardenAddress as `0x${string}`,
            abi: GardenAccountABI,
            functionName: "revokeInvite",
            account: address,
            args: [inviteCode as Hex],
          });

          return hash;
        },
        {
          loadingMessage: "Revoking invite...",
          successMessage: "Invite revoked successfully",
          errorMessage: "Failed to revoke invite",
        }
      );
      const now = Math.floor(Date.now() / 1000);
      setInvites((current) =>
        current.map((invite) =>
          invite.id === inviteCode
            ? {
                ...invite,
                used: true,
                usedBy: address,
                usedAt: now,
              }
            : invite
        )
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const refetch = async (): Promise<GardenInvite[]> => invites;

  return {
    invites,
    isLoading,
    isRevoking,
    createInvite,
    revokeInvite,
    generateInviteCode,
    generateInviteLink,
    refetch,
  };
}
