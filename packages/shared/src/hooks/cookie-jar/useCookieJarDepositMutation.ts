import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import { batchKeys } from "../../config/query-keys/garden";
import { logger } from "../../modules/app/logger";
import { depositDomain } from "../../modules/garden/deposit-batch";
import { requireConfirmed } from "../../modules/transactions/confirmation";
import type { CookieJarDepositParams } from "../../types/cookie-jar";
import type { Address } from "../../types/domain";
import { COOKIE_JAR_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { ERC20_ALLOWANCE_ABI, ERC20_BALANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { useDepositRoute } from "../vault/useDepositRoute";

type TxErrorMode = "toast" | "inline" | "auto";

export interface CookieJarMutationOptions {
  errorMode?: TxErrorMode;
}

function shouldShowErrorToast(mode: TxErrorMode = "auto"): boolean {
  return mode !== "inline";
}

export function useCookieJarDepositMutation({
  options,
  source,
  toastContext,
  balanceWarning,
  metadata = {},
  invalidationKeys,
}: {
  options: CookieJarMutationOptions;
  source: string;
  toastContext: string;
  balanceWarning: string;
  metadata?: { gardenAddress?: Address };
  invalidationKeys: (jarAddress: Address, chainId: number, account?: Address) => QueryKey[];
}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const sender = useTransactionSender();
  const routes = useDepositRoute("jar-deposit");
  const handleError = createMutationErrorHandler({
    source,
    toastContext,
  });
  const activeToastId = useRef<string | undefined>(undefined);
  const lastDepositRef = useRef<{
    jarAddress: Address;
    invalidationKeys: typeof invalidationKeys;
  } | null>(null);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      const deposit = lastDepositRef.current;
      if (!deposit) return;
      deposit
        .invalidationKeys(deposit.jarAddress, chainId, primaryAddress ?? undefined)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }, [queryClient, chainId, primaryAddress]),
    INDEXER_LAG_SCHEDULE_MS
  );
  const refreshJar = (jarAddress: Address) => {
    lastDepositRef.current = { jarAddress, invalidationKeys };
    invalidationKeys(jarAddress, chainId, primaryAddress ?? undefined).forEach((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    );
    scheduleFollowUp();
  };

  const showDepositing = () => {
    if (!activeToastId.current) return;
    toastService.loading({
      id: activeToastId.current,
      title: formatMessage({ id: "app.cookieJar.deposit" }),
      message: formatMessage({ id: "app.cookieJar.depositing" }),
    });
  };
  const holdKeyFor = (params: CookieJarDepositParams) =>
    batchKeys.hold(
      depositDomain({ kind: "jar", address: params.jarAddress }),
      primaryAddress ?? "",
      chainId
    );

  const mutation = useMutation({
    mutationKey: batchKeys.depositSend(primaryAddress ?? "", chainId),
    mutationFn: async (params: CookieJarDepositParams) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      // Pre-check: verify user has sufficient token balance
      try {
        const balanceResult = await readContract(getWagmiConfig(), {
          address: params.assetAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [primaryAddress as Address],
          chainId,
        });
        const balance = typeof balanceResult === "bigint" ? balanceResult : 0n;
        if (balance < params.amount) {
          throw new Error("Insufficient token balance for deposit");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Insufficient token balance")) {
          throw error;
        }
        logger.warn(balanceWarning, { error });
      }

      const route = await routes.routeFor(params.assetAddress);
      if (route) {
        const outcome = await routes.send(route, {
          target: { kind: "jar", address: params.jarAddress, asset: params.assetAddress },
          amount: params.amount,
          checkBeforeDeposit: async () => showDepositing(),
        });
        if (outcome.status === "deposited") return outcome.transactionHash;
        throw new Error("Deposit failed");
      }

      // Check ERC20 allowance and approve if needed
      let allowance: bigint;
      try {
        const allowanceResult = await readContract(getWagmiConfig(), {
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [primaryAddress as Address, params.jarAddress],
          chainId,
        });
        allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;
      } catch {
        allowance = 0n;
      }

      if (allowance < params.amount) {
        requireConfirmed(
          await sender.sendContractCall({
            address: params.assetAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "approve",
            args: [params.jarAddress, params.amount],
            chainId,
          })
        );
      }

      showDepositing();

      const result = await sender.sendContractCall({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "deposit",
        args: [params.amount],
        chainId,
      });
      return requireConfirmed(result).hash;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: holdKeyFor(params) });
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.deposit" }),
        message: formatMessage({ id: "app.cookieJar.approving" }),
      });
      activeToastId.current = toastId;
      return { toastId };
    },
    onSuccess: (_txHash, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.deposit" }),
        message: formatMessage({ id: "app.cookieJar.depositSuccess" }),
      });

      refreshJar(_params.jarAddress);
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      const view = classifyTxError(error);
      if (view.kind === "unconfirmed" || view.kind === "overCeilings") {
        if (showErrorToast) {
          toastService.info({
            title: formatMessage({ id: view.titleKey }),
            message: formatMessage({ id: view.messageKey }),
            context: toastContext,
            suppressLogging: true,
          });
        }
        // It may have landed, so the balances are worth reading again.
        if (view.kind === "unconfirmed") refreshJar(params.jarAddress);
        return;
      }
      handleError(error, {
        metadata: {
          ...metadata,
          jarAddress: params?.jarAddress,
          assetAddress: params?.assetAddress,
        },
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
          params.jarAddress,
          chainId
        ),
      });
    },
  });

  return useSafeMutation(mutation);
}
