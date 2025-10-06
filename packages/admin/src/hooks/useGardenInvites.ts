import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { type Hex, keccak256, toHex } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useToastAction } from "./useToastAction";
import { GardenAccountABI } from "@/utils/contracts";

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

export function useGardenInvites(gardenAddress: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Fetch invites from Envio indexer
  const {
    data: invites,
    isLoading: isFetching,
    refetch,
  } = useQuery<GardenInvite[]>({
    queryKey: ["garden-invites", gardenAddress],
    queryFn: async (): Promise<GardenInvite[]> => {
      const ENVIO_URL = import.meta.env.VITE_ENVIO_INDEXER_URL;
      if (!ENVIO_URL) {
        console.warn("ENVIO_INDEXER_URL not configured");
        return [];
      }

      const response = await fetch(ENVIO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query GetGardenInvites($gardenId: String!) {
              gardenInvites(where: { garden: $gardenId }) {
                id
                garden
                creator
                expiry
                used
                usedBy
                createdAt
                usedAt
                chainId
              }
            }
          `,
          variables: { gardenId: gardenAddress.toLowerCase() },
        }),
      });

      const result = await response.json();
      return result.data?.gardenInvites || [];
    },
    enabled: !!gardenAddress,
  });

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
            abi: GardenAccountABI.abi,
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

      // Refetch invites after revocation
      await refetch();
    } finally {
      setIsRevoking(false);
    }
  };

  return {
    invites,
    isLoading: isLoading || isFetching,
    isRevoking,
    createInvite,
    revokeInvite,
    generateInviteCode,
    generateInviteLink,
    refetch,
  };
}
