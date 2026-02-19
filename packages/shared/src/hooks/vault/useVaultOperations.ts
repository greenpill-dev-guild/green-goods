import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useIntl } from "react-intl";
import { useCallback, useRef } from "react";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import type {
  DepositParams,
  EmergencyPauseParams,
  HarvestParams,
  SetDonationAddressParams,
  WithdrawParams,
} from "../../types/vaults";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { wagmiConfig } from "../../config/appkit";
import {
  ERC20_ALLOWANCE_ABI,
  OCTANT_MODULE_ABI,
  OCTANT_VAULT_ABI,
} from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";

function getOctantModuleAddress(chainId: number): Address {
  const moduleAddress = getNetworkContracts(chainId).octantModule;
  if (!moduleAddress || moduleAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("OctantModule is not configured for the current chain");
  }
  return moduleAddress as Address;
}

function isRecoverableAllowanceReadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("revert") ||
    message.includes("execution reverted") ||
    message.includes("contractfunctionexecutionerror") ||
    message.includes("call_exception")
  );
}

type VaultDepositStage = "approval" | "deposit";

class VaultDepositStageError extends Error {
  stage: VaultDepositStage;

  constructor(stage: VaultDepositStage, message: string) {
    super(message);
    this.name = "VaultDepositStageError";
    this.stage = stage;
  }
}

export function useVaultDeposit() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useVaultDeposit",
    toastContext: "vault deposit",
  });
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const activeToastId = useRef<string | undefined>(undefined);
  const lastParamsRef = useRef<{ gardenAddress: string; userAddress: string | undefined }>({
    gardenAddress: "",
    userAddress: undefined,
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress) {
        queryInvalidation
          .onVaultDeposit(
            lastParamsRef.current.gardenAddress,
            lastParamsRef.current.userAddress,
            chainId
          )
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: DepositParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      const receiver = (params.receiver ?? primaryAddress) as Address;

      // Slippage protection: verify expected shares before approvals/transfers
      const previewShares = await readContract(wagmiConfig, {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [params.amount],
      });
      const expectedShares = typeof previewShares === "bigint" ? previewShares : 0n;

      // Default slippage tolerance: 1% (99% of preview)
      const minShares = params.minSharesOut ?? (expectedShares * 99n) / 100n;
      if (expectedShares < minShares) {
        throw new Error(
          "Deposit would receive fewer shares than expected due to price movement. Please try again."
        );
      }

      let allowance: bigint;
      try {
        const allowanceResult = await readContract(wagmiConfig, {
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [primaryAddress as Address, params.vaultAddress],
        });
        allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;
      } catch (error) {
        // Some non-standard tokens may revert on allowance() reads.
        // We only downgrade known contract reverts to zero allowance and rethrow RPC/transport errors.
        if (!isRecoverableAllowanceReadError(error)) {
          throw error;
        }
        allowance = 0n;
      }

      if (allowance < params.amount) {
        try {
          // USDT-style tokens may require zeroing allowance before setting a new value.
          if (allowance > 0n) {
            await sendContractTx({
              address: params.assetAddress,
              abi: ERC20_ALLOWANCE_ABI,
              functionName: "approve",
              args: [params.vaultAddress, 0n],
            });
          }

          await sendContractTx({
            address: params.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "approve",
            args: [params.vaultAddress, params.amount],
          });

          const refreshedAllowanceResult = await readContract(wagmiConfig, {
            address: params.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance",
            args: [primaryAddress as Address, params.vaultAddress],
          });
          const refreshedAllowance =
            typeof refreshedAllowanceResult === "bigint" ? refreshedAllowanceResult : 0n;
          if (refreshedAllowance < params.amount) {
            throw new Error(
              "Token approval was confirmed, but allowance is still below the deposit amount."
            );
          }
        } catch (error) {
          throw new VaultDepositStageError(
            "approval",
            error instanceof Error ? error.message : "Approval failed"
          );
        }
      }

      // Update toast to reflect deposit phase (after approval)
      if (activeToastId.current) {
        toastService.loading({
          id: activeToastId.current,
          title: formatMessage({ id: "app.treasury.deposit" }),
          message: formatMessage({ id: "app.treasury.depositing" }),
        });
      }

      try {
        return await sendContractTx({
          address: params.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "deposit",
          args: [params.amount, receiver],
        });
      } catch (error) {
        throw new VaultDepositStageError(
          "deposit",
          error instanceof Error ? error.message : "Deposit failed"
        );
      }
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.deposit" }),
        message: formatMessage({ id: "app.treasury.approving" }),
      });
      activeToastId.current = toastId;
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.deposit" }),
        message: formatMessage({ id: "app.treasury.depositSuccess" }),
      });

      lastParamsRef.current = {
        gardenAddress: params.gardenAddress,
        userAddress: primaryAddress ?? undefined,
      };
      queryInvalidation
        .onVaultDeposit(params.gardenAddress, primaryAddress ?? undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      if (error instanceof VaultDepositStageError) {
        const messageId =
          error.stage === "approval" ? "app.treasury.approvalFailed" : "app.treasury.depositFailed";
        toastService.error({
          title: formatMessage({ id: "app.treasury.deposit" }),
          message: formatMessage({
            id: messageId,
            defaultMessage:
              error.stage === "approval"
                ? "Approval failed. Please try again."
                : "Deposit failed. Please try again.",
          }),
          context: "vault deposit",
          error,
        });
        return;
      }
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          assetAddress: params?.assetAddress,
          vaultAddress: params?.vaultAddress,
        },
      });
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}

export function useVaultWithdraw() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useVaultWithdraw",
    toastContext: "vault withdraw",
  });
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const lastParamsRef = useRef<{ gardenAddress: string; userAddress: string | undefined }>({
    gardenAddress: "",
    userAddress: undefined,
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress) {
        queryInvalidation
          .onVaultWithdraw(
            lastParamsRef.current.gardenAddress,
            lastParamsRef.current.userAddress,
            chainId
          )
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: WithdrawParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      const receiver = (params.receiver ?? primaryAddress) as Address;
      const owner = (params.owner ?? primaryAddress) as Address;

      return sendContractTx({
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "redeem",
        args: [params.shares, receiver, owner],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.withdraw" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.withdraw" }),
        message: formatMessage({ id: "app.treasury.withdrawSuccess" }),
      });

      lastParamsRef.current = {
        gardenAddress: params.gardenAddress,
        userAddress: primaryAddress ?? undefined,
      };
      queryInvalidation
        .onVaultWithdraw(params.gardenAddress, primaryAddress ?? undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          assetAddress: params?.assetAddress,
          vaultAddress: params?.vaultAddress,
        },
      });
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}

export function useHarvest() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useHarvest",
    toastContext: "vault harvest",
  });
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const lastGardenRef = useRef<string>("");
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryInvalidation
          .onVaultHarvest(lastGardenRef.current, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: HarvestParams) => {
      const octantModule = getOctantModuleAddress(chainId);

      return sendContractTx({
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "harvest",
        args: [params.gardenAddress, params.assetAddress],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.harvest" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.harvest" }),
        message: formatMessage({ id: "app.treasury.harvestSuccess" }),
      });

      lastGardenRef.current = params.gardenAddress;
      queryInvalidation
        .onVaultHarvest(params.gardenAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          assetAddress: params?.assetAddress,
        },
      });
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}

export function useEmergencyPause() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useEmergencyPause",
    toastContext: "vault emergency pause",
  });
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const lastGardenRef = useRef<string>("");
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryInvalidation
          .onVaultDeposit(lastGardenRef.current, undefined, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: EmergencyPauseParams) => {
      const octantModule = getOctantModuleAddress(chainId);

      return sendContractTx({
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "emergencyPause",
        args: [params.gardenAddress, params.assetAddress],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.emergencyPause" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.emergencyPause" }),
      });

      lastGardenRef.current = params.gardenAddress;
      queryInvalidation
        .onVaultDeposit(params.gardenAddress, undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          assetAddress: params?.assetAddress,
        },
      });
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}

export function useSetDonationAddress() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useSetDonationAddress",
    toastContext: "set donation address",
  });
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const lastGardenRef = useRef<string>("");
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryInvalidation
          .onVaultHarvest(lastGardenRef.current, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: SetDonationAddressParams) => {
      const octantModule = getOctantModuleAddress(chainId);

      return sendContractTx({
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "setDonationAddress",
        args: [params.gardenAddress, params.donationAddress],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.donationAddress" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.donationAddress" }),
      });

      lastGardenRef.current = params.gardenAddress;
      queryInvalidation
        .onVaultHarvest(params.gardenAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          donationAddress: params?.donationAddress,
        },
      });
    },
  });

  const isPending = mutation.isPending || isLockPending;
  useBeforeUnloadWhilePending(isPending);

  const mutateAsync = useCallback(
    (...args: Parameters<typeof mutation.mutateAsync>) =>
      runWithLock(() => mutation.mutateAsync(...args)),
    [mutation, runWithLock]
  );

  const mutate = useCallback(
    (...args: Parameters<typeof mutation.mutate>) => {
      void mutateAsync(...args).catch(() => undefined);
    },
    [mutateAsync]
  );

  return { ...mutation, mutate, mutateAsync, isPending };
}
