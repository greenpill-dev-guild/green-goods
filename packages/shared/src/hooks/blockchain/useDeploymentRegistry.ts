import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { type Abi, createPublicClient, http } from "viem";
import { toastService } from "../../components/toast";
import { useToastAction } from "../app/useToastAction";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { useTransactionSender } from "./useTransactionSender";
import { getNetworkConfig } from "../../config/blockchain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIMES } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { requireConfirmed } from "../../modules/transactions/confirmation";
import {
  TransactionConfirmationPendingError,
  TransactionReplacementError,
  TransactionRevertedError,
} from "../../modules/transactions/types";
import { useAuthContext } from "../../providers/Auth";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { Address } from "../../types/domain";
import { compareAddresses, isZeroAddress } from "../../utils/blockchain/address";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { getChain, getNetworkContracts } from "../../utils/blockchain/contracts";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { roleKeys } from "../../config/query-keys/identity";
import { DEPLOYMENT_REGISTRY_ABI } from "../../utils/blockchain/abis/deployment-registry";

export { DEPLOYMENT_REGISTRY_ABI };

interface DeploymentRegistryData {
  isOwner: boolean;
  isInAllowlist: boolean;
  canDeploy: boolean;
}

async function fetchDeploymentPermissions(
  address: string,
  chainId: number
): Promise<DeploymentRegistryData> {
  const contracts = getNetworkContracts(chainId);
  const chain = getChain(chainId);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
  const networkConfig = getNetworkConfig(chainId, alchemyKey);

  logger.debug("RPC config", {
    source: "useDeploymentRegistry",
    hasAlchemyKey: alchemyKey !== "demo",
    rpcHost: new URL(networkConfig.rpcUrl).hostname,
  });

  // If deployment registry is not configured, return false
  if (isZeroAddress(contracts.deploymentRegistry)) {
    return { isOwner: false, isInAllowlist: false, canDeploy: false };
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(networkConfig.rpcUrl),
  });

  // Check if user is owner
  const owner = await publicClient.readContract({
    address: contracts.deploymentRegistry,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "owner",
  });

  // Check if user is in allowlist
  const isInAllowlist = await publicClient.readContract({
    address: contracts.deploymentRegistry,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "isInAllowlist",
    args: [address as `0x${string}`],
  });

  const isOwner = compareAddresses(owner, address);
  const canDeploy = isOwner || isInAllowlist;

  return { isOwner, isInAllowlist, canDeploy };
}

export interface DeploymentRegistryPermissions {
  isOwner: boolean;
  isInAllowlist: boolean;
  canDeploy: boolean;
  loading: boolean;
  error?: string;
}

export function useDeploymentRegistry(): DeploymentRegistryPermissions {
  const auth = useAuthContext();
  const address = usePrimaryAddress();
  const normalizedAddress = address?.toLowerCase();
  const ready = auth.isReady && auth.isAuthenticated;

  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const chainId = selectedChainId || DEFAULT_CHAIN_ID;

  const { data, isLoading, error } = useQuery({
    queryKey: roleKeys.deploymentPermissions(normalizedAddress ?? undefined, chainId),
    queryFn: () => fetchDeploymentPermissions(normalizedAddress!, chainId),
    enabled: !!normalizedAddress && ready,
    staleTime: STALE_TIMES.baseLists,
    networkMode: "offlineFirst",
  });

  return {
    isOwner: data?.isOwner ?? false,
    isInAllowlist: data?.isInAllowlist ?? false,
    canDeploy: data?.canDeploy ?? false,
    loading: !ready || isLoading,
    ...(error ? { error: error instanceof Error ? error.message : "Unknown error" } : {}),
  };
}

// --- Allowlist query (gated by isOwner) ---

async function fetchDeploymentAllowlist(chainId: number): Promise<Address[]> {
  const contracts = getNetworkContracts(chainId);
  const chain = getChain(chainId);
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
  const networkConfig = getNetworkConfig(chainId, alchemyKey);

  if (isZeroAddress(contracts.deploymentRegistry)) {
    return [];
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(networkConfig.rpcUrl),
  });

  const allowlist = await publicClient.readContract({
    address: contracts.deploymentRegistry,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "getAllowlist",
  });

  return allowlist as Address[];
}

export interface DeploymentAllowlistResult {
  allowlist: Address[];
  loading: boolean;
  error?: string;
}

export function useDeploymentAllowlist(enabled: boolean): DeploymentAllowlistResult {
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const chainId = selectedChainId || DEFAULT_CHAIN_ID;

  const { data, isLoading, error } = useQuery({
    queryKey: roleKeys.allowlist(chainId),
    queryFn: () => fetchDeploymentAllowlist(chainId),
    enabled,
    staleTime: STALE_TIMES.baseLists,
    networkMode: "offlineFirst",
  });

  return {
    allowlist: data ?? [],
    loading: isLoading,
    ...(error ? { error: error instanceof Error ? error.message : "Unknown error" } : {}),
  };
}

// --- Garden creators: the allowlist as its managers see and change it ---

/**
 * Once the call could reach the network, only a revert, a replacement or a declined signature
 * proves it did not land. Anything else, a receipt read that failed say, may still land.
 */
function mayStillLand(error: unknown, couldReachNetwork: boolean): boolean {
  return (
    couldReachNetwork &&
    !(error instanceof TransactionConfirmationPendingError) &&
    !(error instanceof TransactionRevertedError) &&
    !(error instanceof TransactionReplacementError) &&
    !isCancelledTxError(error)
  );
}

async function fetchCanManageAllowlist(address: string, chainId: number): Promise<boolean> {
  const contracts = getNetworkContracts(chainId);
  if (isZeroAddress(contracts.deploymentRegistry)) return false;

  const networkConfig = getNetworkConfig(chainId, import.meta.env.VITE_ALCHEMY_API_KEY || "demo");
  const publicClient = createPublicClient({
    chain: getChain(chainId),
    transport: http(networkConfig.rpcUrl),
  });

  return publicClient.readContract({
    address: contracts.deploymentRegistry,
    abi: DEPLOYMENT_REGISTRY_ABI,
    functionName: "canManageAllowlist",
    args: [address as `0x${string}`],
  });
}

export interface GardenCreators {
  /** Accounts on the allowlist. The chain's answer, never the request just sent. */
  creators: Address[];
  /** The registry says this account may change the allowlist. A failed read means no. */
  canManage: boolean;
  loading: boolean;
  error?: string;
  isWriting: boolean;
  /**
   * Resolves to whether the wallet accepted the change, including one still waiting for its
   * confirmation. Failures reach the person as a toast.
   */
  addCreator: (creator: Address) => Promise<boolean>;
  removeCreator: (creator: Address) => Promise<boolean>;
}

export function useGardenCreators(): GardenCreators {
  const { formatMessage } = useIntl();
  const auth = useAuthContext();
  const address = usePrimaryAddress();
  const normalizedAddress = address?.toLowerCase();
  const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
  const chainId = selectedChainId || DEFAULT_CHAIN_ID;
  const sender = useTransactionSender();
  const { executeWithToast } = useToastAction();
  const queryClient = useQueryClient();
  const [isWriting, setIsWriting] = useState(false);

  const manager = useQuery({
    queryKey: roleKeys.allowlistManager(normalizedAddress ?? undefined, chainId),
    queryFn: () => fetchCanManageAllowlist(normalizedAddress!, chainId),
    enabled: !!normalizedAddress && auth.isReady && auth.isAuthenticated,
    staleTime: STALE_TIMES.baseLists,
    // A registry from before this check reverts, and asking again will not change that.
    retry: false,
    networkMode: "offlineFirst",
  });
  const canManage = manager.data ?? false;
  const allowlist = useDeploymentAllowlist(canManage);

  const { start: scheduleRefresh } = useProgressiveInvalidation(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: roleKeys.allowlist(chainId) });
      void queryClient.invalidateQueries({
        queryKey: roleKeys.deploymentPermissions(normalizedAddress ?? undefined, chainId),
      });
    }, [chainId, normalizedAddress, queryClient]),
    INDEXER_LAG_SCHEDULE_MS
  );

  const writeAllowlist = useCallback(
    async (
      functionName: "addToAllowlist" | "removeFromAllowlist",
      creator: Address,
      messages: { loadingMessage: string; successMessage: string; errorMessage: string }
    ): Promise<boolean> => {
      if (!sender || !address) {
        // The sender is still being set up, a passkey account initializing say: nothing can go.
        toastService.error({
          title: messages.errorMessage,
          message: formatMessage({ id: "cockpit.community.gardenCreators.checkFailed" }),
          context: "garden creators",
        });
        return false;
      }
      const registry = getNetworkContracts(chainId).deploymentRegistry;
      const abi = DEPLOYMENT_REGISTRY_ABI as Abi;

      setIsWriting(true);
      try {
        const simulation = await simulateTransaction(
          registry,
          abi,
          functionName,
          [creator],
          address,
          chainId
        );
        if (!simulation.success) {
          toastService.error({
            title: messages.errorMessage,
            // Only a revert is the registry's refusal. Any other failure means the check itself
            // could not run, and its parsed message would read as a refusal it never made.
            message: simulation.error?.reverted
              ? simulation.error.message
              : formatMessage({ id: "cockpit.community.gardenCreators.checkFailed" }),
            context: "garden creators",
          });
          return false;
        }

        let couldReachNetwork = false;
        try {
          await executeWithToast(
            async () => {
              try {
                const result = await sender.sendContractCall(
                  {
                    address: registry,
                    // The account the simulation and the permission read were for, and no other.
                    account: address,
                    abi,
                    functionName,
                    args: [creator],
                    chainId,
                  },
                  {
                    assertOwnership: () => sender.assertOwnership?.(address, chainId),
                    onBeforeBroadcast: async () => {
                      couldReachNetwork = true;
                    },
                  }
                );
                // A wallet that queues the call, a Safe say, answers before it runs.
                return requireConfirmed(result);
              } catch (error) {
                if (mayStillLand(error, couldReachNetwork)) {
                  throw new TransactionConfirmationPendingError();
                }
                throw error;
              }
            },
            { ...messages, context: "garden creators" }
          );
          return true;
        } catch (error) {
          // Sent and not confirmed yet: offering it again would ask for a second signature.
          if (error instanceof TransactionConfirmationPendingError) return true;
          logger.warn("Garden creator change was not sent", {
            source: "useGardenCreators",
            functionName,
            error,
          });
          return false;
        } finally {
          // A send that failed after it left may still land, so the list asks the chain again.
          scheduleRefresh();
        }
      } finally {
        setIsWriting(false);
      }
    },
    [address, chainId, executeWithToast, formatMessage, scheduleRefresh, sender]
  );

  const addCreator = useCallback(
    (creator: Address) =>
      writeAllowlist("addToAllowlist", creator, {
        loadingMessage: formatMessage({
          id: "cockpit.community.gardenCreators.adding",
          defaultMessage: "Adding garden creator...",
        }),
        successMessage: formatMessage({
          id: "cockpit.community.gardenCreators.added",
          defaultMessage: "Garden creator added",
        }),
        errorMessage: formatMessage({
          id: "cockpit.community.gardenCreators.addFailed",
          defaultMessage: "Couldn't add garden creator",
        }),
      }),
    [formatMessage, writeAllowlist]
  );

  const removeCreator = useCallback(
    (creator: Address) =>
      writeAllowlist("removeFromAllowlist", creator, {
        loadingMessage: formatMessage({
          id: "cockpit.community.gardenCreators.removing",
          defaultMessage: "Removing garden creator...",
        }),
        successMessage: formatMessage({
          id: "cockpit.community.gardenCreators.removed",
          defaultMessage: "Garden creator removed",
        }),
        errorMessage: formatMessage({
          id: "cockpit.community.gardenCreators.removeFailed",
          defaultMessage: "Couldn't remove garden creator",
        }),
      }),
    [formatMessage, writeAllowlist]
  );

  return {
    creators: allowlist.allowlist,
    canManage,
    loading: manager.isLoading || allowlist.loading,
    ...(allowlist.error ? { error: allowlist.error } : {}),
    isWriting,
    addCreator,
    removeCreator,
  };
}
