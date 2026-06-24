import { useMutation } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import type { OctantVaultWalletEndowPreparedTransaction } from "../../modules/vault-crowdfunding";
import type { Address } from "../../types/domain";
import {
  ERC20_ALLOWANCE_ABI,
  ERC20_BALANCE_ABI,
  OCTANT_VAULT_ABI,
} from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import {
  isRecoverableAllowanceReadError,
  shouldShowLifecycleToast,
  shouldShowErrorToast,
  VaultDepositStageError,
  type VaultDepositFailureReason,
  type VaultMutationOptions,
} from "./vault-helpers";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;

function addressesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function useOctantVaultWalletEndow(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const showLifecycleToast = shouldShowLifecycleToast(options.toastMode);
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useOctantVaultWalletEndow",
    toastContext: "Octant Wallet Endow",
  });
  const activeToastId = useRef<string | undefined>(undefined);

  const mutation = useMutation({
    mutationFn: async (transaction: OctantVaultWalletEndowPreparedTransaction) => {
      if (transaction.chainId !== OCTANT_V2_ETHEREUM_CHAIN_ID) {
        throw new Error("Octant Wallet Endow requires Ethereum mainnet chain ID 1");
      }
      if (!sender) {
        throw new Error("TransactionSender not available — auth not initialized");
      }
      if (authMode !== "wallet" || sender.authMode !== "wallet" || !primaryAddress) {
        throw new Error("Octant Wallet Endow requires a connected wallet");
      }

      const receiver = transaction.receiver.receiverAddress;
      if (!addressesEqual(primaryAddress, receiver)) {
        throw new Error("Octant Wallet Endow receiver must be the connected wallet");
      }

      const chainId = transaction.chainId;
      const maxDepositResult = await readContract(getWagmiConfig(), {
        address: transaction.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxDeposit",
        args: [receiver],
        chainId,
      });
      const maxDeposit = typeof maxDepositResult === "bigint" ? maxDepositResult : 0n;

      if (maxDeposit <= 0n) {
        const [shutdownResult, depositLimitResult, totalAssetsResult] = await Promise.all([
          readContract(getWagmiConfig(), {
            address: transaction.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "isShutdown",
            args: [],
            chainId,
          }).catch(() => "read_failed" as const),
          readContract(getWagmiConfig(), {
            address: transaction.vaultAddress,
            abi: OCTANT_VAULT_ABI,
            functionName: "depositLimit",
            args: [],
            chainId,
          }).catch(() => "read_failed" as const),
          readContract(getWagmiConfig(), {
            address: transaction.vaultAddress,
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
        } else if (depLimit !== null && depLimit === 0n) {
          reason = "depositLimitZero";
          message = "Vault deposit limit is zero";
        } else if (depLimit !== null && totalAssets !== null && totalAssets >= depLimit) {
          reason = "depositLimitReached";
          message = `Vault deposit limit reached (${totalAssets}/${depLimit})`;
        }

        const error = new VaultDepositStageError("deposit", message, reason);
        error.diagnostics = {
          chainId: String(chainId),
          vaultAddress: transaction.vaultAddress,
          receiver,
          maxDeposit: String(maxDeposit),
          isShutdown: String(shutdownResult),
          depositLimit: String(depositLimitResult),
          totalAssets: String(totalAssetsResult),
        };
        throw error;
      }
      if (transaction.amount > maxDeposit) {
        throw new VaultDepositStageError("deposit", "Endow amount exceeds the current vault limit");
      }

      // Pre-flight balance check (before any approval). The vault pulls `amount` of
      // the underlying asset (WETH) via transferFrom on deposit, so a wallet that
      // doesn't hold enough WETH makes the deposit revert in simulation. Surface this
      // clearly up front instead of letting the user approve a deposit that can't
      // succeed. A flaky balance read fails open — the on-chain deposit still guards funds.
      try {
        const balanceResult = await readContract(getWagmiConfig(), {
          address: transaction.assetAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [primaryAddress as Address],
          chainId,
        });
        const balance = typeof balanceResult === "bigint" ? balanceResult : 0n;
        if (balance < transaction.amount) {
          const error = new VaultDepositStageError(
            "deposit",
            formatMessage({
              id: "public.vaults.walletEndow.insufficientWeth",
              defaultMessage: "Connected wallet holds insufficient WETH to complete this deposit",
            }),
            "insufficientBalance"
          );
          error.diagnostics = {
            chainId: String(chainId),
            assetAddress: transaction.assetAddress,
            receiver,
            balance: String(balance),
            amount: String(transaction.amount),
          };
          throw error;
        }
      } catch (error) {
        if (error instanceof VaultDepositStageError) throw error;
        // Non-stage error => balance read failed; fall through and let the flow proceed.
      }

      const preApprovalPreview = await readContract(getWagmiConfig(), {
        address: transaction.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [transaction.amount],
        chainId,
      });
      const expectedShares = typeof preApprovalPreview === "bigint" ? preApprovalPreview : 0n;

      let allowance: bigint;
      try {
        const allowanceResult = await readContract(getWagmiConfig(), {
          address: transaction.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [primaryAddress as Address, transaction.vaultAddress],
          chainId,
        });
        allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;
      } catch (error) {
        if (!isRecoverableAllowanceReadError(error)) {
          throw error;
        }
        allowance = 0n;
      }

      if (allowance < transaction.amount) {
        options.onLifecycleStep?.("approval");
        try {
          if (allowance > 0n) {
            await sender.sendContractCall({
              address: transaction.assetAddress,
              abi: ERC20_ALLOWANCE_ABI,
              functionName: "approve",
              args: [transaction.vaultAddress, 0n],
              chainId,
            });
          }

          await sender.sendContractCall({
            address: transaction.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "approve",
            args: [transaction.vaultAddress, transaction.amount],
            chainId,
          });

          const refreshedAllowanceResult = await readContract(getWagmiConfig(), {
            address: transaction.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance",
            args: [primaryAddress as Address, transaction.vaultAddress],
            chainId,
          });
          const refreshedAllowance =
            typeof refreshedAllowanceResult === "bigint" ? refreshedAllowanceResult : 0n;
          if (refreshedAllowance < transaction.amount) {
            throw new Error(
              "Token approval was confirmed, but allowance is still below the Endow amount."
            );
          }
        } catch (error) {
          throw new VaultDepositStageError(
            "approval",
            error instanceof Error ? error.message : "Approval failed"
          );
        }
      }

      const freshPreview = await readContract(getWagmiConfig(), {
        address: transaction.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "previewDeposit",
        args: [transaction.amount],
        chainId,
      });
      const freshShares = typeof freshPreview === "bigint" ? freshPreview : 0n;
      const minShares = (expectedShares * 99n) / 100n;
      if (freshShares > 0n && freshShares < minShares) {
        throw new VaultDepositStageError(
          "deposit",
          "Exchange rate moved unfavorably during approval. Please try again.",
          "slippage"
        );
      }

      options.onLifecycleStep?.("deposit");
      if (showLifecycleToast && activeToastId.current) {
        toastService.loading({
          id: activeToastId.current,
          title: formatMessage({ id: "app.treasury.deposit" }),
          message: formatMessage({ id: "app.treasury.depositing" }),
        });
      }

      try {
        const result = await sender.sendContractCall({
          address: transaction.vaultAddress,
          abi: OCTANT_VAULT_ABI,
          functionName: "deposit",
          args: [transaction.amount, receiver],
          chainId,
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
      if (!showLifecycleToast) {
        activeToastId.current = undefined;
        return { toastId: undefined };
      }
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.deposit" }),
        message: formatMessage({ id: "app.treasury.approving" }),
      });
      activeToastId.current = toastId;
      return { toastId };
    },
    onSuccess: (_txHash, _transaction, context) => {
      options.onLifecycleStep?.("success");
      if (context?.toastId) toastService.dismiss(context.toastId);
      activeToastId.current = undefined;
      if (showLifecycleToast) {
        toastService.success({
          title: formatMessage({ id: "app.treasury.deposit" }),
          message: formatMessage({ id: "app.treasury.depositSuccess" }),
        });
      }
    },
    onError: (error, transaction, context) => {
      options.onLifecycleStep?.("error");
      if (context?.toastId) toastService.dismiss(context.toastId);
      activeToastId.current = undefined;
      const metadata = {
        chainId: transaction?.chainId,
        assetAddress: transaction?.assetAddress,
        vaultAddress: transaction?.vaultAddress,
        receiver: transaction?.receiver.receiverAddress,
      };
      if (error instanceof VaultDepositStageError) {
        if (error.reason === "insufficientBalance") {
          // User-actionable pre-flight (wallet lacks WETH): surfaced inline in the
          // checkout sheet, so keep telemetry but suppress a competing error toast.
          handleError(error, {
            metadata: { ...metadata, ...error.diagnostics },
            showToast: false,
          });
          return;
        }
        if (showErrorToast) {
          toastService.error({
            title: formatMessage({ id: "app.treasury.deposit" }),
            message: formatMessage({
              id:
                error.stage === "approval"
                  ? "app.treasury.approvalFailed"
                  : "app.treasury.depositFailed",
              defaultMessage:
                error.stage === "approval"
                  ? "Approval failed. Please try again."
                  : "Deposit failed. Please try again.",
            }),
            context: "Octant Wallet Endow",
            error,
          });
        }
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
