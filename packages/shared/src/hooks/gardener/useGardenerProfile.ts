import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData } from "viem";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { useAuth } from "../auth/useAuth";

// GardenerAccount ABI (minimal - just the functions we need)
const GARDENER_ACCOUNT_ABI = [
  {
    type: "function",
    name: "setProfile",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_bio", type: "string" },
      { name: "_location", type: "string" },
      { name: "_imageURI", type: "string" },
      { name: "_socialLinks", type: "string[]" },
      { name: "_contactInfo", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getProfile",
    inputs: [],
    outputs: [
      { name: "", type: "string" },
      { name: "", type: "string" },
      { name: "", type: "string" },
      { name: "", type: "string" },
      { name: "", type: "string[]" },
      { name: "", type: "string" },
      { name: "", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "updateName",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateBio",
    inputs: [{ name: "_bio", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateLocation",
    inputs: [{ name: "_location", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateImage",
    inputs: [{ name: "_imageURI", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateSocialLinks",
    inputs: [{ name: "_links", type: "string[]" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateContact",
    inputs: [{ name: "_contact", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export interface GardenerProfile {
  name: string;
  bio: string;
  location: string;
  imageURI: string;
  socialLinks: string[];
  contactInfo: string;
  profileUpdatedAt: number;
}

/**
 * Hook to manage gardener profile (on-chain storage in GardenerAccount smart contract)
 *
 * Provides:
 * - Query profile from indexer (fast, off-chain)
 * - Mutate profile on-chain (gasless via Pimlico paymaster)
 * - Individual field updates for gas efficiency
 *
 * @example
 * ```tsx
 * function ProfileEditor() {
 *   const { profile, updateProfile, isUpdating } = useGardenerProfile();
 *
 *   const handleSubmit = () => {
 *     updateProfile({
 *       name: "Alice",
 *       bio: "Regenerative farmer",
 *       location: "Portland, OR",
 *       imageURI: "ipfs://Qm...",
 *       socialLinks: ["https://twitter.com/alice"],
 *       contactInfo: "@alice",
 *     });
 *   };
 * }
 * ```
 */
export function useGardenerProfile() {
  const { smartAccountClient, smartAccountAddress } = useAuth();
  const queryClient = useQueryClient();

  // Query profile from indexer (GraphQL)
  // TODO: Replace with actual GraphQL query once indexer is updated
  const profileQuery = useQuery({
    queryKey: ["gardener-profile", smartAccountAddress, DEFAULT_CHAIN_ID],
    queryFn: async () => {
      if (!smartAccountAddress) return null;

      // Placeholder: Will be replaced with GraphQL query
      // For now, return null (profile not yet indexed)
      return null as GardenerProfile | null;
    },
    enabled: !!smartAccountAddress,
    staleTime: 30_000, // 30 seconds
  });

  // Mutation to update entire profile on-chain (gasless)
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: Omit<GardenerProfile, "profileUpdatedAt">) => {
      if (!smartAccountClient || !smartAccountAddress) {
        throw new Error("Not authenticated");
      }

      // Encode function call
      const data = encodeFunctionData({
        abi: GARDENER_ACCOUNT_ABI,
        functionName: "setProfile",
        args: [
          profileData.name,
          profileData.bio,
          profileData.location,
          profileData.imageURI,
          profileData.socialLinks,
          profileData.contactInfo,
        ],
      });

      // Send with paymaster (gasless via Pimlico)
      if (!smartAccountClient.account) {
        throw new Error("Smart account not initialized");
      }
      const txHash = await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        chain: null,
        to: smartAccountAddress,
        data,
        value: 0n,
      });

      return txHash;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardener-profile"] });
      toastService.success({
        title: "Profile updated",
        message: "Your profile changes were saved.",
        context: "profile update",
        suppressLogging: true,
      });
    },
    onError: (error) => {
      console.error("Profile update failed:", error);
      toastService.error({
        title: "Profile update failed",
        message: "Please try again.",
        context: "profile update",
        error,
      });
    },
  });

  // Individual field update mutations (gas efficient)
  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!smartAccountClient || !smartAccountAddress) {
        throw new Error("Not authenticated");
      }

      const data = encodeFunctionData({
        abi: GARDENER_ACCOUNT_ABI,
        functionName: "updateName",
        args: [name],
      });

      if (!smartAccountClient.account) {
        throw new Error("Smart account not initialized");
      }
      return await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        chain: null,
        to: smartAccountAddress,
        data,
        value: 0n,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardener-profile"] });
      toastService.success({
        title: "Name updated",
        message: "Your profile name has been updated.",
        context: "profile update",
        suppressLogging: true,
      });
    },
  });

  const updateBioMutation = useMutation({
    mutationFn: async (bio: string) => {
      if (!smartAccountClient || !smartAccountAddress) {
        throw new Error("Not authenticated");
      }

      const data = encodeFunctionData({
        abi: GARDENER_ACCOUNT_ABI,
        functionName: "updateBio",
        args: [bio],
      });

      if (!smartAccountClient.account) {
        throw new Error("Smart account not initialized");
      }
      return await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        chain: null,
        to: smartAccountAddress,
        data,
        value: 0n,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardener-profile"] });
      toastService.success({
        title: "Bio updated",
        message: "Your biography has been updated.",
        context: "profile update",
        suppressLogging: true,
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (location: string) => {
      if (!smartAccountClient || !smartAccountAddress) {
        throw new Error("Not authenticated");
      }

      const data = encodeFunctionData({
        abi: GARDENER_ACCOUNT_ABI,
        functionName: "updateLocation",
        args: [location],
      });

      if (!smartAccountClient.account) {
        throw new Error("Smart account not initialized");
      }
      return await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        chain: null,
        to: smartAccountAddress,
        data,
        value: 0n,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardener-profile"] });
      toastService.success({
        title: "Location updated",
        message: "Your location has been saved.",
        context: "profile update",
        suppressLogging: true,
      });
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: async (imageURI: string) => {
      if (!smartAccountClient || !smartAccountAddress) {
        throw new Error("Not authenticated");
      }

      const data = encodeFunctionData({
        abi: GARDENER_ACCOUNT_ABI,
        functionName: "updateImage",
        args: [imageURI],
      });

      if (!smartAccountClient.account) {
        throw new Error("Smart account not initialized");
      }
      return await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        chain: null,
        to: smartAccountAddress,
        data,
        value: 0n,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gardener-profile"] });
      toastService.success({
        title: "Profile image updated",
        message: "Your new image is on the way.",
        context: "profile update",
        suppressLogging: true,
      });
    },
  });

  return {
    // Query state
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    refetch: profileQuery.refetch,

    // Full profile update
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,

    // Individual field updates
    updateName: updateNameMutation.mutate,
    updateBio: updateBioMutation.mutate,
    updateLocation: updateLocationMutation.mutate,
    updateImage: updateImageMutation.mutate,

    // Mutation states
    isUpdatingName: updateNameMutation.isPending,
    isUpdatingBio: updateBioMutation.isPending,
    isUpdatingLocation: updateLocationMutation.isPending,
    isUpdatingImage: updateImageMutation.isPending,
  };
}
