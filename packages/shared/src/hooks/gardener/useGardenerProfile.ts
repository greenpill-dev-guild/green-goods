import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { encodeFunctionData } from "viem";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { logger } from "../../modules/app/logger";
import { parseContractError } from "../../utils/errors/contract-errors";
import { USER_FRIENDLY_ERRORS } from "../../utils/errors/user-messages";
import { useAuth } from "../auth/useAuth";
import { queryKeys } from "../query-keys";

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
  const { formatMessage } = useIntl();

  // Query profile from indexer (GraphQL)
  // TODO: Replace with actual GraphQL query once indexer is updated
  const profileQuery = useQuery({
    queryKey: queryKeys.gardenerProfile.byAddress(smartAccountAddress ?? "", DEFAULT_CHAIN_ID),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.gardenerProfile.all });
      toastService.success({
        title: formatMessage({
          id: "app.gardener.profile.update.success.title",
          defaultMessage: "Profile updated",
        }),
        message: formatMessage({
          id: "app.gardener.profile.update.success.message",
          defaultMessage: "Your profile changes were saved.",
        }),
        context: "profile update",
        suppressLogging: true,
      });
    },
    onError: (error) => {
      logger.error("Profile update failed", { source: "useGardenerProfile", error });
      toastService.error({
        title: formatMessage({
          id: "app.gardener.profile.update.error.title",
          defaultMessage: "Profile update failed",
        }),
        message: formatMessage({
          id: "app.gardener.profile.update.error.message",
          defaultMessage: "Please try again.",
        }),
        context: "profile update",
        error,
      });
    },
  });

  // Build mutation options for individual field updates (DRY helper — not a hook)
  const fieldMutationOptions = (config: {
    functionName: "updateName" | "updateBio" | "updateLocation" | "updateImage";
    successTitle: string;
    successMessage: string;
    errorTitle: string;
    errorMessage: string;
  }) => ({
    mutationFn: async (value: string) => {
      if (!smartAccountClient || !smartAccountAddress) {
        throw new Error("Not authenticated");
      }

      const data = encodeFunctionData({
        abi: GARDENER_ACCOUNT_ABI,
        functionName: config.functionName,
        args: [value],
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
      queryClient.invalidateQueries({ queryKey: queryKeys.gardenerProfile.all });
      toastService.success({
        title: config.successTitle,
        message: config.successMessage,
        context: "profile update",
        suppressLogging: true,
      });
    },
    onError: (error: Error) => {
      const parsed = parseContractError(error);
      // Defensive: ensure parsed.name is a string before calling toLowerCase()
      const safeName = typeof parsed?.name === "string" ? parsed.name.toLowerCase() : "";
      const userFriendlyMsg = USER_FRIENDLY_ERRORS[safeName] || config.errorMessage;
      toastService.error({
        title: config.errorTitle,
        message: userFriendlyMsg,
        context: "profile update",
        error: parsed,
      });
    },
  });

  // Individual field update mutations (gas efficient)
  const updateNameMutation = useMutation(
    fieldMutationOptions({
      functionName: "updateName",
      successTitle: formatMessage({
        id: "app.gardener.profile.name.success.title",
        defaultMessage: "Name updated",
      }),
      successMessage: formatMessage({
        id: "app.gardener.profile.name.success.message",
        defaultMessage: "Your profile name has been updated.",
      }),
      errorTitle: formatMessage({
        id: "app.gardener.profile.name.error.title",
        defaultMessage: "Name update failed",
      }),
      errorMessage: formatMessage({
        id: "app.gardener.profile.name.error.message",
        defaultMessage: "Could not update your profile name. Please try again.",
      }),
    })
  );

  const updateBioMutation = useMutation(
    fieldMutationOptions({
      functionName: "updateBio",
      successTitle: formatMessage({
        id: "app.gardener.profile.bio.success.title",
        defaultMessage: "Bio updated",
      }),
      successMessage: formatMessage({
        id: "app.gardener.profile.bio.success.message",
        defaultMessage: "Your biography has been updated.",
      }),
      errorTitle: formatMessage({
        id: "app.gardener.profile.bio.error.title",
        defaultMessage: "Bio update failed",
      }),
      errorMessage: formatMessage({
        id: "app.gardener.profile.bio.error.message",
        defaultMessage: "Could not update your biography. Please try again.",
      }),
    })
  );

  const updateLocationMutation = useMutation(
    fieldMutationOptions({
      functionName: "updateLocation",
      successTitle: formatMessage({
        id: "app.gardener.profile.location.success.title",
        defaultMessage: "Location updated",
      }),
      successMessage: formatMessage({
        id: "app.gardener.profile.location.success.message",
        defaultMessage: "Your location has been saved.",
      }),
      errorTitle: formatMessage({
        id: "app.gardener.profile.location.error.title",
        defaultMessage: "Location update failed",
      }),
      errorMessage: formatMessage({
        id: "app.gardener.profile.location.error.message",
        defaultMessage: "Could not update your location. Please try again.",
      }),
    })
  );

  const updateImageMutation = useMutation(
    fieldMutationOptions({
      functionName: "updateImage",
      successTitle: formatMessage({
        id: "app.gardener.profile.image.success.title",
        defaultMessage: "Profile image updated",
      }),
      successMessage: formatMessage({
        id: "app.gardener.profile.image.success.message",
        defaultMessage: "Your new image is on the way.",
      }),
      errorTitle: formatMessage({
        id: "app.gardener.profile.image.error.title",
        defaultMessage: "Image update failed",
      }),
      errorMessage: formatMessage({
        id: "app.gardener.profile.image.error.message",
        defaultMessage: "Could not update your profile image. Please try again.",
      }),
    })
  );

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
