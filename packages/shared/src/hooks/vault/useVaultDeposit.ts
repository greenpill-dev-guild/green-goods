import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type { DepositParams } from "../../types/vaults";
import { ERC20_ALLOWANCE_ABI, OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS, queryInvalidation } from "../../config/query-keys";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import {
  isRecoverableAllowanceReadError,
  shouldShowErrorToast,
  VaultDepositStageError,
  type VaultDepositFailureReason,
  type VaultMutationOptions,
} from "./vault-helpers";

export function useVaultDeposit(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const sender = useTransactionSender();
  const handleError = createMutationErrorHandler({
    source: "useVaultDeposit",
    toastContext: "vault deposit",
  });
  const activeToastId = useRef<string | undefined>(undefined);
  const lastParamsRef = useRef<{ gardenAddress: string; userAddress: string | undefined }>({
    gardenAddress: "",
    userAddress: undefined,
  });
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
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
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: DepositParams) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      const receiver = (params.receiver ?? primaryAddress) as Address;

      const maxDepositResult = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxDeposit",
        args: [receiver],
      });
      const maxDeposit = typeof maxDepositResult === "bigint" ? maxDepositResult : 0n;

      if (maxDeposit <= 0n) {
        // Run diagnostic reads to determine the specific reason maxDeposit is 0
        const [shutdownResult, depositLimitResult, totalAssetsResult] = await Promise.all([
          readContract(getWagmiConfig(), {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "isShutdown",
            args: [],
          }).catch(() => "read_failed" as const),
          readContract(getWagmiConfig(), {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "depositLimit",
            args: [],
          }).catch(() => "read_failed" as const),
          readContract(getWagmiConfig(), {
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
          message = "Vault deposit limit is zero — enableAutoAllocate() may be needed";
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
        const earlyPreview = await readContract(getWagmiConfig(), {
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

      // Snapshot expected shares before approval for post-approval slippage detection
      const preApprovalPreview = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [params.amount],
      });
      const expectedShares = typeof preApprovalPreview === "bigint" ? preApprovalPreview : 0n;

      let allowance: bigint;
      try {
        const allowanceResult = await readContract(getWagmiConfig(), {
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
            await sender.sendContractCall({
              address: params.assetAddress,
              abi: ERC20_ALLOWANCE_ABI,
              functionName: "approve",
              args: [params.vaultAddress, 0n],
            });
          }

          await sender.sendContractCall({
            address: params.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "approve",
            args: [params.vaultAddress, params.amount],
          });

          const refreshedAllowanceResult = await readContract(getWagmiConfig(), {
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
      const freshPreview = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [params.amount],
      });
      const freshShares = typeof freshPreview === "bigint" ? freshPreview : 0n;
      // Default slippage tolerance: 1% (99% of pre-approval snapshot)
      const minShares = params.minSharesOut ?? (expectedShares * 99n) / 100n;
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
        const result = await sender.sendContractCall({
          address: params.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "deposit",
          args: [params.amount, receiver],
        });
        return result.hash;
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

        if (showErrorToast) {
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
        }
        // Always log diagnostics through error handler (toast already shown above if needed)
        handleError(error, {
          metadata: { ...metadata, ...error.diagnostics },
          showToast: !showErrorToast,
        });
        return;
      }
      handleError(error, {
        metadata,
        showToast: showErrorToast,
      });
    },
  });

  return useSafeMutation(mutation);
}
