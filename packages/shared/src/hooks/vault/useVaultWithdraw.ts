import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type { WithdrawParams } from "../../types/vaults";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";

/**
 * Default max-loss slippage in basis points (1%). Audit finding #2 —
 * the prior default of 10000n (100%) accepted arbitrary loss; under
 * vault degradation a withdrawal could silently haircut to zero.
 */
const DEFAULT_WITHDRAW_MAX_LOSS_BPS = 100n;
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS, queryInvalidation } from "../../config/query-keys";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { shouldShowErrorToast, type VaultMutationOptions } from "./vault-helpers";

export function useVaultWithdraw(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const sender = useTransactionSender();
  const handleError = createMutationErrorHandler({
    source: "useVaultWithdraw",
    toastContext: "vault withdraw",
  });
  const lastParamsRef = useRef<{ gardenAddress: string; userAddress: string | undefined }>({
    gardenAddress: "",
    userAddress: undefined,
  });
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
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
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: WithdrawParams) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      const receiver = (params.receiver ?? primaryAddress) as Address;
      const owner = (params.owner ?? primaryAddress) as Address;
      const maxLossBps = params.maxLossBps ?? DEFAULT_WITHDRAW_MAX_LOSS_BPS;

      // Pre-check: verify amount doesn't exceed withdrawable limit at this slippage
      const maxWithdrawResult = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxWithdraw",
        args: [owner, maxLossBps, []],
      });
      const maxWithdrawable = typeof maxWithdrawResult === "bigint" ? maxWithdrawResult : 0n;

      if (maxWithdrawable <= 0n) {
        throw new Error("Vault is not accepting withdrawals right now");
      }
      if (params.amount > maxWithdrawable) {
        throw new Error("Withdrawal amount exceeds the available balance");
      }

      const result = await sender.sendContractCall({
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "withdraw",
        args: [params.amount, receiver, owner, maxLossBps, []],
      });
      return result.hash;
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

  return useSafeMutation(mutation);
}
