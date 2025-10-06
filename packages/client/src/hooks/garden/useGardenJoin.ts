import { useState } from "react";
import { type Hex, encodeFunctionData } from "viem";
import { isRateLimited, recordSponsoredOperation } from "@/modules/pimlico/paymaster";
import { createPublicClientForChain } from "@/modules/pimlico/config";
import { useAuth } from "../auth/useAuth";
import { useCurrentChain } from "../blockchain/useChainConfig";

// Garden Account ABI for joinGardenWithInvite
const GARDEN_ACCOUNT_ABI = [
  {
    name: "joinGardenWithInvite",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "inviteCode", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "gardenInvites",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "inviteCode", type: "bytes32" }],
    outputs: [{ name: "isValid", type: "bool" }],
  },
  {
    name: "inviteExpiry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "inviteCode", type: "bytes32" }],
    outputs: [{ name: "expiry", type: "uint256" }],
  },
  {
    name: "inviteUsed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "inviteCode", type: "bytes32" }],
    outputs: [{ name: "isUsed", type: "bool" }],
  },
] as const;

export interface GardenJoinResult {
  success: boolean;
  transactionHash?: Hex;
  gardenAddress?: Hex;
  error?: string;
}

export interface InviteValidation {
  isValid: boolean;
  isExpired: boolean;
  isUsed: boolean;
  error?: string;
}

export function useGardenJoin() {
  const { smartAccountClient, smartAccountAddress, isReady } = useAuth();
  const chainId = useCurrentChain();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Validates an invite code before attempting to join
   */
  const validateInvite = async (gardenAddress: Hex, inviteCode: Hex): Promise<InviteValidation> => {
    try {
      const publicClient = createPublicClientForChain(chainId);

      // Check if invite is valid
      const isValid = await publicClient.readContract({
        address: gardenAddress,
        abi: GARDEN_ACCOUNT_ABI,
        functionName: "gardenInvites",
        args: [inviteCode],
      });

      if (!isValid) {
        return {
          isValid: false,
          isExpired: false,
          isUsed: false,
          error: "Invalid invite code",
        };
      }

      // Check if invite is used
      const isUsed = await publicClient.readContract({
        address: gardenAddress,
        abi: GARDEN_ACCOUNT_ABI,
        functionName: "inviteUsed",
        args: [inviteCode],
      });

      if (isUsed) {
        return {
          isValid: false,
          isExpired: false,
          isUsed: true,
          error: "Invite code already used",
        };
      }

      // Check if invite is expired
      const expiry = await publicClient.readContract({
        address: gardenAddress,
        abi: GARDEN_ACCOUNT_ABI,
        functionName: "inviteExpiry",
        args: [inviteCode],
      });

      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = Number(expiry) < currentTime;

      if (isExpired) {
        return {
          isValid: false,
          isExpired: true,
          isUsed: false,
          error: "Invite code has expired",
        };
      }

      return {
        isValid: true,
        isExpired: false,
        isUsed: false,
      };
    } catch (err) {
      console.error("[GardenJoin] Validation error:", err);
      return {
        isValid: false,
        isExpired: false,
        isUsed: false,
        error: err instanceof Error ? err.message : "Failed to validate invite",
      };
    }
  };

  /**
   * Joins a garden using an invite code with sponsored transaction
   */
  const joinWithInvite = async (gardenAddress: Hex, inviteCode: Hex): Promise<GardenJoinResult> => {
    if (!smartAccountClient || !smartAccountAddress) {
      const error = "Passkey wallet not initialized";
      setError(new Error(error));
      return { success: false, error };
    }

    if (!isReady) {
      const error = "Smart account not ready";
      setError(new Error(error));
      return { success: false, error };
    }

    // Check rate limiting
    if (isRateLimited(smartAccountAddress)) {
      const error = "Rate limit exceeded. Please try again later.";
      setError(new Error(error));
      return { success: false, error };
    }

    setIsJoining(true);
    setError(null);

    try {
      // Validate invite before attempting to join
      const validation = await validateInvite(gardenAddress, inviteCode);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid invite");
      }

      // Encode function call
      const data = encodeFunctionData({
        abi: GARDEN_ACCOUNT_ABI,
        functionName: "joinGardenWithInvite",
        args: [inviteCode],
      });

      // Send sponsored transaction
      const txHash = await (smartAccountClient as any).sendTransaction({
        to: gardenAddress,
        data,
        value: 0n,
      });

      // Record this operation for rate limiting
      recordSponsoredOperation(smartAccountAddress);

      console.log("[GardenJoin] Successfully joined garden:", {
        garden: gardenAddress,
        txHash,
      });

      return {
        success: true,
        transactionHash: txHash,
        gardenAddress,
      };
    } catch (err) {
      console.error("[GardenJoin] Failed to join garden:", err);
      const error = err instanceof Error ? err : new Error("Failed to join garden");
      setError(error);

      return {
        success: false,
        gardenAddress,
        error: error.message,
      };
    } finally {
      setIsJoining(false);
    }
  };

  return {
    joinWithInvite,
    validateInvite,
    isJoining,
    error,
  };
}
