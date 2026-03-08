import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { wagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type {
  DepositParams,
  EmergencyPauseParams,
  HarvestParams,
  WithdrawParams,
} from "../../types/vaults";
import {
  ERC20_ALLOWANCE_ABI,
  OCTANT_MODULE_ABI,
  OCTANT_VAULT_ABI,
} from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { VAULT_MAX_BPS, ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useBeforeUnloadWhilePending } from "../utils/useBeforeUnloadWhilePending";
import { useMutationLock } from "../utils/useMutationLock";
import { useDelayedInvalidation } from "../utils/useTimeout";

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
type VaultDepositFailureReason =
  | "vaultShutdown"
  | "depositLimitZero"
  | "depositLimitReached"
  | "vaultUnavailable"
  | "slippage";
type TxErrorMode = "toast" | "inline" | "auto";

interface VaultMutationOptions {
  errorMode?: TxErrorMode;
}

function shouldShowErrorToast(mode: TxErrorMode = "auto"): boolean {
  return mode !== "inline";
}

class VaultDepositStageError extends Error {
  stage: VaultDepositStage;
  reason?: VaultDepositFailureReason;
  diagnostics?: Record<string, string>;

  constructor(stage: VaultDepositStage, message: string, reason?: VaultDepositFailureReason) {
    super(message);
    this.name = "VaultDepositStageError";
    this.stage = stage;
    this.reason = reason;
  }
}

export function useVaultDeposit(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
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

      const maxDepositResult = await readContract(wagmiConfig, {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxDeposit",
        args: [receiver],
      });
      const maxDeposit = typeof maxDepositResult === "bigint" ? maxDepositResult : 0n;

      if (maxDeposit <= 0n) {
        // Run diagnostic reads to determine the specific reason maxDeposit is 0
        const [shutdownResult, depositLimitResult, totalAssetsResult] = await Promise.all([
          readContract(wagmiConfig, {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "isShutdown",
            args: [],
          }).catch(() => "read_failed" as const),
          readContract(wagmiConfig, {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "depositLimit",
            args: [],
          }).catch(() => "read_failed" as const),
          readContract(wagmiConfig, {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "totalAssets",
            args: [],
          }).catch(() => "read_failed" as const),
        ]);

        const isShutdown = shutdownResult === true;
        const depLimit = typeof depositLimitResult === "bigint" ? depositLimitResult : null;
        const totalAssets = typeof totalAssetsResult === "bigint" ? totalAssetsResult : null;

        let reason: VaultDepositFailureReason = "vaultUnavailable";
        let message = "Vault is not accepting deposits right now";

        if (isShutdown) {
          reason = "vaultShutdown";
          message = "Vault has been permanently shut down";
        } else if (depLimit === 0n) {
          reason = "depositLimitZero";
          message = "Vault deposit limit is zero — configureVaultRoles() may be needed";
        } else if (depLimit !== null && totalAssets !== null && totalAssets >= depLimit) {
          reason = "depositLimitReached";
          message = `Vault deposit limit reached (${totalAssets}/${depLimit})`;
        }

        const error = new VaultDepositStageError("deposit", message, reason);
        error.diagnostics = {
          vaultAddress: params.vaultAddress,
          receiver,
          maxDeposit: String(maxDeposit),
          isShutdown: String(shutdownResult),
          depositLimit: String(depositLimitResult),
          totalAssets: String(totalAssetsResult),
        };
        throw error;
      }
      if (params.amount > maxDeposit) {
        throw new VaultDepositStageError(
          "deposit",
          "Deposit amount exceeds the current vault limit"
        );
      }

      // Early slippage check: reject if caller-provided minSharesOut already fails
      if (params.minSharesOut !== undefined) {
        const earlyPreview = await readContract(wagmiConfig, {
          address: params.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "previewDeposit",
          args: [params.amount],
        });
        const earlyShares = typeof earlyPreview === "bigint" ? earlyPreview : 0n;
        if (earlyShares < params.minSharesOut) {
          throw new Error(
            "Deposit would receive fewer shares than expected due to price movement. Please try again."
          );
        }
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

      // Post-approval slippage check: re-read preview with fresh exchange rate
      const freshPreview = await readContract(wagmiConfig, {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [params.amount],
      });
      const freshShares = typeof freshPreview === "bigint" ? freshPreview : 0n;
      // Default slippage tolerance: 1% (99% of fresh preview)
      const minShares = params.minSharesOut ?? (freshShares * 99n) / 100n;
      if (freshShares > 0n && freshShares < minShares) {
        throw new VaultDepositStageError(
          "deposit",
          "Exchange rate moved unfavorably during approval. Please try again.",
          "slippage"
        );
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
      const metadata = {
        gardenAddress: params?.gardenAddress,
        assetAddress: params?.assetAddress,
        vaultAddress: params?.vaultAddress,
      };
      if (error instanceof VaultDepositStageError) {
        let messageId: string;

        if (error.stage === "approval") {
          messageId = "app.treasury.approvalFailed";
        } else {
          switch (error.reason) {
            case "vaultShutdown":
              messageId = "app.treasury.vaultShutdown";
              break;
            case "depositLimitZero":
              messageId = "app.treasury.depositLimitZero";
              break;
            case "depositLimitReached":
              messageId = "app.treasury.depositLimitReached";
              break;
            case "vaultUnavailable":
              messageId = "app.treasury.vaultPaused";
              break;
            default:
              messageId = "app.treasury.depositFailed";
          }
        }

        const diagnosticsSuffix = error.diagnostics
          ? ` [vault: ${error.diagnostics.vaultAddress?.slice(0, 10)}… | depositLimit: ${error.diagnostics.depositLimit} | totalAssets: ${error.diagnostics.totalAssets} | shutdown: ${error.diagnostics.isShutdown}]`
          : "";

        if (showErrorToast) {
          toastService.error({
            title: formatMessage({ id: "app.treasury.deposit" }),
            message:
              formatMessage({
                id: messageId,
                defaultMessage:
                  error.stage === "approval"
                    ? "Approval failed. Please try again."
                    : "Deposit failed. Please try again.",
              }) + diagnosticsSuffix,
            context: "vault deposit",
            error,
          });
        } else {
          handleError(error, { metadata, showToast: false });
        }
        return;
      }
      handleError(error, {
        metadata,
        showToast: showErrorToast,
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

export function useVaultWithdraw(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
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

      // Pre-check: verify amount doesn't exceed withdrawable limit
      const maxWithdrawResult = await readContract(wagmiConfig, {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxWithdraw",
        args: [owner, VAULT_MAX_BPS, []],
      });
      const maxWithdrawable = typeof maxWithdrawResult === "bigint" ? maxWithdrawResult : 0n;

      if (maxWithdrawable <= 0n) {
        throw new Error("Vault is not accepting withdrawals right now");
      }
      if (params.amount > maxWithdrawable) {
        throw new Error("Withdrawal amount exceeds the available balance");
      }

      return sendContractTx({
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "withdraw",
        args: [params.amount, receiver, owner, VAULT_MAX_BPS, []],
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
        showToast: showErrorToast,
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

interface ConfigureVaultRolesParams {
  gardenAddress: Address;
  assetAddress: Address;
}

export function useConfigureVaultRoles() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useConfigureVaultRoles",
    toastContext: "vault configure",
  });
  const { runWithLock, isPending: isLockPending } = useMutationLock();

  const mutation = useMutation({
    mutationFn: async (params: ConfigureVaultRolesParams) => {
      const octantModule = getOctantModuleAddress(chainId);

      return sendContractTx({
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "configureVaultRoles",
        args: [params.gardenAddress, params.assetAddress],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.configureVault" }),
        message: formatMessage({ id: "app.treasury.configuringVault" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.configureVault" }),
        message: formatMessage({ id: "app.treasury.configureVaultSuccess" }),
      });

      queryInvalidation
        .onVaultDeposit(params.gardenAddress, undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
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
