import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import {
  createDepositChain,
  type DepositTarget,
  depositDomain,
  sendDepositBatch,
} from "../../modules/garden/deposit-batch";
import { depositRoute, walletRouteListed } from "../../modules/garden/deposit-route";
import { assertBatchCapabilityKnown } from "../../modules/transactions/batch-types";
import { requireConfirmed } from "../../modules/transactions/confirmation";
import { TransactionConfirmationPendingError } from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import type { DepositParams } from "../../types/vaults";
import { ERC20_ALLOWANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis/octant";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import {
  classifyTxError,
  DEPOSIT_PAST_CEILINGS,
  isRecoverableAllowanceReadError,
  isUnconfirmedTxError,
} from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { batchKeys } from "../../config/query-keys/garden";
import {
  shouldShowErrorToast,
  VaultDepositStageError,
  type VaultDepositFailureReason,
  type VaultMutationOptions,
} from "./vault-helpers";

export { useDepositPlan } from "./useDepositPlan";

export function useVaultDeposit(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress, passkeyAccountProfile } = useUser();
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
  const holdKeyFor = (params: DepositParams) =>
    batchKeys.hold(
      depositDomain({ kind: "vault", address: params.vaultAddress }),
      primaryAddress ?? "",
      chainId
    );
  const showDepositing = () => {
    if (!activeToastId.current) return;
    toastService.loading({
      id: activeToastId.current,
      title: formatMessage({ id: "app.treasury.deposit" }),
      message: formatMessage({ id: "app.treasury.depositing" }),
    });
  };
  const refreshDeposits = (gardenAddress: string) => {
    lastParamsRef.current = { gardenAddress, userAddress: primaryAddress ?? undefined };
    queryInvalidation
      .onVaultDeposit(gardenAddress, primaryAddress ?? undefined, chainId)
      .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    scheduleFollowUp();
  };

  // How this deposit goes now, or null for today's flow. Asked at the send, so it is never stale.
  const routeFor = async (params: DepositParams) => {
    const asset = params.assetAddress;
    const rail =
      sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
    if (!sender?.batches || !primaryAddress) return null;
    let walletAtomic: boolean | undefined;
    if (rail === "wallet" && walletRouteListed({ action: "vault-deposit", chainId, asset })) {
      const capability = await sender.getBatchCapability?.({ account: primaryAddress, chainId });
      assertBatchCapabilityKnown(capability);
      walletAtomic = capability?.atomic === "supported";
    }
    const route = depositRoute({
      action: "vault-deposit",
      rail,
      passkeyProfile: passkeyAccountProfile,
      walletAtomic,
      chainId,
      asset,
    });
    return route && rail ? { ...route, rail, batches: sender.batches } : null;
  };

  const mutation = useMutation({
    mutationKey: batchKeys.depositSend(primaryAddress ?? "", chainId),
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
        chainId,
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
            chainId,
          }).catch(() => "read_failed" as const),
          readContract(getWagmiConfig(), {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "depositLimit",
            args: [],
            chainId,
          }).catch(() => "read_failed" as const),
          readContract(getWagmiConfig(), {
            address: params.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "totalAssets",
            args: [],
            chainId,
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
          chainId,
        });
        const earlyShares = typeof earlyPreview === "bigint" ? earlyPreview : 0n;
        if (earlyShares < params.minSharesOut) {
          throw new Error(
            "Deposit would receive fewer shares than expected due to price movement. Please try again."
          );
        }
      }

      const route = await routeFor(params);

      // Snapshot expected shares before approval for post-approval slippage detection
      const preApprovalPreview = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [params.amount],
        chainId,
      });
      const expectedShares = typeof preApprovalPreview === "bigint" ? preApprovalPreview : 0n;

      // Default slippage tolerance: 1% (99% of pre-approval snapshot)
      const minShares = params.minSharesOut ?? (expectedShares * 99n) / 100n;
      const checkSlippage = async () => {
        const freshPreview = await readContract(getWagmiConfig(), {
          address: params.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "previewDeposit",
          args: [params.amount],
          chainId,
        });
        const freshShares = typeof freshPreview === "bigint" ? freshPreview : 0n;
        if (freshShares > 0n && freshShares < minShares) {
          throw new VaultDepositStageError(
            "deposit",
            "Exchange rate moved unfavorably during approval. Please try again.",
            "slippage"
          );
        }
      };

      if (route) {
        const target: DepositTarget = {
          kind: "vault",
          address: params.vaultAddress,
          asset: params.assetAddress,
          receiver,
        };
        const overCeilingsKey = batchKeys.overCeilings(
          depositDomain(target),
          primaryAddress,
          chainId,
          params.amount.toString()
        );
        const tookOneSignature = route.atomic && !queryClient.getQueryData(overCeilingsKey);
        const outcome = await sendDepositBatch({
          batches: route.batches,
          chain: createDepositChain(chainId),
          scope: { account: primaryAddress as Address, chainId },
          rail: route.rail,
          atomic: tookOneSignature,
          target,
          amount: params.amount,
          checkBeforeDeposit: async () => {
            await checkSlippage();
            showDepositing();
          },
        }).catch((error: unknown) => {
          if (classifyTxError(error).kind !== "overCeilings") throw error;
          // Step by step, an earlier approval may already have landed and no press will help.
          if (!tookOneSignature) throw new Error(DEPOSIT_PAST_CEILINGS);
          // It was promised one signature, so going step by step takes another press.
          queryClient.setQueryData(overCeilingsKey, true);
          throw error;
        });
        if (outcome.status === "deposited") return outcome.transactionHash;
        if (outcome.status === "unknown") throw new TransactionConfirmationPendingError();
        if (outcome.status === "declined") throw new Error("Transaction cancelled");
        throw new VaultDepositStageError("deposit", "Deposit failed");
      }

      let allowance: bigint;
      try {
        const allowanceResult = await readContract(getWagmiConfig(), {
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [primaryAddress as Address, params.vaultAddress],
          chainId,
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
            requireConfirmed(
              await sender.sendContractCall({
                address: params.assetAddress,
                abi: ERC20_ALLOWANCE_ABI,
                functionName: "approve",
                args: [params.vaultAddress, 0n],
              })
            );
          }

          requireConfirmed(
            await sender.sendContractCall({
              address: params.assetAddress,
              abi: ERC20_ALLOWANCE_ABI,
              functionName: "approve",
              args: [params.vaultAddress, params.amount],
            })
          );

          const refreshedAllowanceResult = await readContract(getWagmiConfig(), {
            address: params.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance",
            args: [primaryAddress as Address, params.vaultAddress],
            chainId,
          });
          const refreshedAllowance =
            typeof refreshedAllowanceResult === "bigint" ? refreshedAllowanceResult : 0n;
          if (refreshedAllowance < params.amount) {
            throw new Error(
              "Token approval was confirmed, but allowance is still below the deposit amount."
            );
          }
        } catch (error) {
          if (isUnconfirmedTxError(error)) throw error;
          throw new VaultDepositStageError(
            "approval",
            error instanceof Error ? error.message : "Approval failed"
          );
        }
      }

      // Post-approval slippage check: re-read preview with fresh exchange rate
      await checkSlippage();

      showDepositing();

      try {
        const result = await sender.sendContractCall({
          address: params.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "deposit",
          args: [params.amount, receiver],
        });
        return requireConfirmed(result).hash;
      } catch (error) {
        if (isUnconfirmedTxError(error)) throw error;
        throw new VaultDepositStageError(
          "deposit",
          error instanceof Error ? error.message : "Deposit failed"
        );
      }
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: holdKeyFor(params) });
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

      refreshDeposits(params.gardenAddress);
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      const view = classifyTxError(error);
      if (view.severity === "warning" && view.kind !== "cancelled") {
        if (showErrorToast) {
          toastService.info({
            title: formatMessage({ id: view.titleKey }),
            message: formatMessage({ id: view.messageKey }),
            context: "vault deposit",
            suppressLogging: true,
          });
        }
        // It may have landed, so the balances are worth reading again.
        if (view.kind === "unconfirmed") refreshDeposits(params.gardenAddress);
        return;
      }
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
    // A read follows every send, since that is what locks the form and can settle the send itself.
    onSettled: (_hash, _error, params) => {
      void queryClient.invalidateQueries({ queryKey: holdKeyFor(params) });
      void queryClient.invalidateQueries({
        queryKey: batchKeys.allowance(
          params.assetAddress,
          primaryAddress ?? "",
          params.vaultAddress,
          chainId
        ),
      });
    },
  });

  return useSafeMutation(mutation);
}
