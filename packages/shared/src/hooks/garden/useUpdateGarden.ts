import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { useAccount } from "wagmi";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import {
  createGardenSettingsChain,
  type GardenSettingsBatchOutcome,
  type GardenSettingsChange,
  type GardenSettingsHold,
  type GardenSettingsSettlement,
  gardenSettingsBudget,
  moveOnFromGardenSettingsHold,
  readGardenSettingsHold,
  sendGardenSettingsBatch,
} from "../../modules/garden/settings-batch";
import { updateGarden } from "../../modules/garden/update-garden-command";
import { isBatchEnabled } from "../../modules/transactions/batch-enablement";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { gardenSettingsBatchKeys, gardensKeys } from "../../config/query-keys/garden";

export type {
  GardenSettingsBatchOutcome,
  GardenSettingsChange,
  GardenSettingsHold,
} from "../../modules/garden/settings-batch";

const NO_SETTLEMENT: GardenSettingsSettlement = { hold: null, saved: [] };

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
  successMessageId: string
) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({ source, toastContext });

  return useMutation({
    mutationFn: async (params: UpdateGardenStringParam) => {
      return updateGarden(
        {
          gardenAddress: params.gardenAddress,
          abi: GardenAccountABI,
          functionName,
          value: params.value,
        },
        { sender: sendContractTx }
      );
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: loadingMessageId, defaultMessage: "Updating..." }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: successMessageId, defaultMessage: "Updated" }),
      });
      queryClient.invalidateQueries({ queryKey: gardensKeys.all });
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
    "app.garden.update.name.success"
  );
}

/**
 * Update a garden's description. Requires the steward role.
 * Calls `updateDescription(string)` on the GardenAccount contract.
 */
export function useUpdateGardenDescription() {
  return useGardenStringMutation(
    "updateDescription",
    "useUpdateGardenDescription",
    "update garden description",
    "app.garden.update.description.loading",
    "app.garden.update.description.success"
  );
}

/**
 * Update a garden's location. Requires the steward role.
 * Calls `updateLocation(string)` on the GardenAccount contract.
 */
export function useUpdateGardenLocation() {
  return useGardenStringMutation(
    "updateLocation",
    "useUpdateGardenLocation",
    "update garden location",
    "app.garden.update.location.loading",
    "app.garden.update.location.success"
  );
}

/**
 * Update a garden's banner image URL. Requires the steward role.
 * Calls `updateBannerImage(string)` on the GardenAccount contract.
 */
export function useUpdateGardenBannerImage() {
  return useGardenStringMutation(
    "updateBannerImage",
    "useUpdateGardenBannerImage",
    "update garden banner image",
    "app.garden.update.bannerImage.loading",
    "app.garden.update.bannerImage.success"
  );
}

/**
 * Update a garden's metadata. Requires the steward role.
 * Calls `updateMetadata(string)` on the GardenAccount contract.
 */
export function useUpdateGardenMetadata() {
  return useGardenStringMutation(
    "updateMetadata",
    "useUpdateGardenMetadata",
    "update garden metadata",
    "app.garden.update.metadata.loading",
    "app.garden.update.metadata.success"
  );
}

/**
 * Toggle a garden's open joining setting. Requires the steward role.
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
      return updateGarden(
        {
          gardenAddress: params.gardenAddress,
          abi: GardenAccountABI,
          functionName: "setOpenJoining",
          value: params.value,
        },
        { sender: sendContractTx }
      );
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
      queryClient.invalidateQueries({ queryKey: gardensKeys.all });
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}

/**
 * Set a garden's maximum number of gardeners. Requires the steward role.
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
      return updateGarden(
        {
          gardenAddress: params.gardenAddress,
          abi: GardenAccountABI,
          functionName: "setMaxGardeners",
          value: BigInt(params.value),
        },
        { sender: sendContractTx }
      );
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
      queryClient.invalidateQueries({ queryKey: gardensKeys.all });
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}

/**
 * Save several garden settings under one signature, and settle a save whose outcome is unknown.
 *
 * `available` says a save can go as one batch now: its rail is listed, and the sender reports
 * atomic. Recovery does not depend on that, so a hold from an earlier save still shows after
 * batching is switched off.
 *
 * `hold` and `saved` come from the latest read, and `lastReadAt` marks it. A read follows every
 * send and can settle that send by itself, so act on each read, not on Check Again's result.
 */
export function useGardenSettingsBatch(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
  const { connector } = useAccount();
  const handleError = createMutationErrorHandler({
    source: "useGardenSettingsBatch",
    toastContext: "save garden settings",
    formatMessage,
  });

  const batches = sender?.batches;
  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const profile = rail === "wallet" ? "eip-5792" : passkeyAccountProfile;
  const listed = Boolean(
    batches &&
      account &&
      rail &&
      profile &&
      gardenSettingsBudget(rail, chainId) &&
      isBatchEnabled({ action: "garden-settings", rail, profile, chainId })
  );

  // Asked only once listed: until then no wallet hears from this hook.
  const { data: atomic = false } = useQuery({
    queryKey: gardenSettingsBatchKeys.capability(account ?? "", chainId, connector?.uid ?? ""),
    queryFn: async () => {
      const capability = await sender!.getBatchCapability!({ account: account!, chainId });
      return capability.atomic === "supported";
    },
    enabled: listed,
    retry: false,
  });

  const holdKey = gardenSettingsBatchKeys.hold(gardenAddress, account ?? "", chainId);
  const batchInput = () => ({
    batches: batches!,
    chain: createGardenSettingsChain(chainId),
    gardenAddress,
    scope: { account: account!, chainId },
  });
  const refreshGarden = () => {
    void queryClient.invalidateQueries({ queryKey: gardensKeys.all });
    void queryClient.invalidateQueries({
      queryKey: ["readContract", { functionName: "gardenDomains", args: [gardenAddress] }],
    });
  };
  const noteSettlement = (settlement: GardenSettingsSettlement) => {
    if (settlement.saved.length > 0) refreshGarden();
    return settlement;
  };

  const sendBatch = useMutation({
    onMutate: () => queryClient.cancelQueries({ queryKey: holdKey }),
    mutationFn: async (
      changes: readonly GardenSettingsChange[]
    ): Promise<GardenSettingsBatchOutcome> => {
      try {
        return await sendGardenSettingsBatch({ ...batchInput(), rail: rail!, changes });
      } catch (error) {
        handleError(error, { authMode: rail, gardenAddress });
        return { status: "not-saved" };
      }
    },
    onSuccess: (outcome) => {
      if (outcome.status === "saved") refreshGarden();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: holdKey }),
  });

  const holdQuery = useQuery({
    queryKey: holdKey,
    queryFn: async () => noteSettlement(await readGardenSettingsHold(batchInput())),
    // This tab's own send is in flight, not unknown.
    enabled: Boolean(batches && account) && !sendBatch.isPending,
    // Read on opening and when the person asks. The journal is the durable copy.
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const settlement = holdQuery.data ?? NO_SETTLEMENT;

  const moveOn = useMutation({
    mutationFn: async (hold: GardenSettingsHold) =>
      noteSettlement(await moveOnFromGardenSettingsHold(batchInput(), hold)),
    onSuccess: (settled) => queryClient.setQueryData(holdKey, settled),
    onError: (error) => handleError(error, { authMode: rail, gardenAddress }),
  });

  return {
    available: listed && atomic,
    hold: settlement.hold,
    saved: settlement.saved,
    lastReadAt: holdQuery.dataUpdatedAt,
    isSettlingHold: holdQuery.isFetching || moveOn.isPending,
    send: (changes: readonly GardenSettingsChange[]) => sendBatch.mutateAsync(changes),
    checkAgain: async () => {
      const { error } = await holdQuery.refetch();
      if (error) handleError(error, { authMode: rail, gardenAddress });
    },
    moveOn: async () => {
      if (settlement.hold) await moveOn.mutateAsync(settlement.hold).catch(() => undefined);
    },
  };
}
