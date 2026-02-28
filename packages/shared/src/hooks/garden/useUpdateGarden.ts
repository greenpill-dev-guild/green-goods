import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { queryKeys } from "../query-keys";

interface UpdateGardenStringParam {
  gardenAddress: Address;
  value: string;
}

interface UpdateGardenBoolParam {
  gardenAddress: Address;
  value: boolean;
}

interface UpdateGardenNumberParam {
  gardenAddress: Address;
  value: number;
}

/**
 * Creates a mutation hook for a GardenAccount string-update function.
 *
 * Each function (updateName, updateDescription, etc.) follows the same pattern:
 * call `functionName(string)` on the garden's smart account address.
 */
function useGardenStringMutation(
  functionName: string,
  source: string,
  toastContext: string,
  loadingMessageId: string,
  successMessageId: string,
) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({ source, toastContext });

  return useMutation({
    mutationFn: async (params: UpdateGardenStringParam) => {
      return sendContractTx({
        address: params.gardenAddress,
        abi: GardenAccountABI,
        functionName,
        args: [params.value],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: loadingMessageId, defaultMessage: "Updating..." }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: successMessageId, defaultMessage: "Updated" }),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}

/**
 * Update a garden's name. Requires the garden owner role.
 * Calls `updateName(string)` on the GardenAccount contract.
 */
export function useUpdateGardenName() {
  return useGardenStringMutation(
    "updateName",
    "useUpdateGardenName",
    "update garden name",
    "app.garden.update.name.loading",
    "app.garden.update.name.success",
  );
}

/**
 * Update a garden's description. Requires the operator role.
 * Calls `updateDescription(string)` on the GardenAccount contract.
 */
export function useUpdateGardenDescription() {
  return useGardenStringMutation(
    "updateDescription",
    "useUpdateGardenDescription",
    "update garden description",
    "app.garden.update.description.loading",
    "app.garden.update.description.success",
  );
}

/**
 * Update a garden's location. Requires the operator role.
 * Calls `updateLocation(string)` on the GardenAccount contract.
 */
export function useUpdateGardenLocation() {
  return useGardenStringMutation(
    "updateLocation",
    "useUpdateGardenLocation",
    "update garden location",
    "app.garden.update.location.loading",
    "app.garden.update.location.success",
  );
}

/**
 * Update a garden's banner image URL. Requires the operator role.
 * Calls `updateBannerImage(string)` on the GardenAccount contract.
 */
export function useUpdateGardenBannerImage() {
  return useGardenStringMutation(
    "updateBannerImage",
    "useUpdateGardenBannerImage",
    "update garden banner image",
    "app.garden.update.bannerImage.loading",
    "app.garden.update.bannerImage.success",
  );
}

/**
 * Update a garden's metadata. Requires the operator role.
 * Calls `updateMetadata(string)` on the GardenAccount contract.
 */
export function useUpdateGardenMetadata() {
  return useGardenStringMutation(
    "updateMetadata",
    "useUpdateGardenMetadata",
    "update garden metadata",
    "app.garden.update.metadata.loading",
    "app.garden.update.metadata.success",
  );
}

/**
 * Toggle a garden's open joining setting. Requires the operator role.
 * Calls `setOpenJoining(bool)` on the GardenAccount contract.
 */
export function useSetOpenJoining() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useSetOpenJoining",
    toastContext: "set open joining",
  });

  return useMutation({
    mutationFn: async (params: UpdateGardenBoolParam) => {
      return sendContractTx({
        address: params.gardenAddress,
        abi: GardenAccountABI,
        functionName: "setOpenJoining",
        args: [params.value],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({
          id: "app.garden.update.openJoining.loading",
          defaultMessage: "Updating joining settings...",
        }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({
          id: "app.garden.update.openJoining.success",
          defaultMessage: "Joining settings updated",
        }),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}

/**
 * Set a garden's maximum number of gardeners. Requires the operator role.
 * Calls `setMaxGardeners(uint256)` on the GardenAccount contract.
 */
export function useSetMaxGardeners() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useSetMaxGardeners",
    toastContext: "set max gardeners",
  });

  return useMutation({
    mutationFn: async (params: UpdateGardenNumberParam) => {
      return sendContractTx({
        address: params.gardenAddress,
        abi: GardenAccountABI,
        functionName: "setMaxGardeners",
        args: [BigInt(params.value)],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({
          id: "app.garden.update.maxGardeners.loading",
          defaultMessage: "Updating max gardeners...",
        }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({
          id: "app.garden.update.maxGardeners.success",
          defaultMessage: "Max gardeners updated",
        }),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.gardens.all });
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}
