import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useIntl } from "react-intl";
import { useCallback, useRef } from "react";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import type { CookieJarDepositParams } from "../../types/cookie-jar";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { COOKIE_JAR_ABI, ERC20_ALLOWANCE_ABI } from "../../utils/blockchain/abis";
import { wagmiConfig } from "../../config/appkit";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";

export function useCookieJarDeposit(gardenAddress: string) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarDeposit",
    toastContext: "cookie jar deposit",
  });

  const activeToastId = useRef<string | undefined>(undefined);
  const lastParamsRef = useRef<{ gardenAddress: string; jarAddress: string }>({
    gardenAddress,
    jarAddress: "",
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarDeposit(
            lastParamsRef.current.gardenAddress,
            lastParamsRef.current.jarAddress,
            chainId
          )
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async (params: CookieJarDepositParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      // Check ERC20 allowance and approve if needed
      let allowance: bigint;
      try {
        const allowanceResult = await readContract(wagmiConfig, {
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [primaryAddress as Address, params.jarAddress],
        });
        allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;
      } catch {
        allowance = 0n;
      }

      if (allowance < params.amount) {
        await sendContractTx({
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "approve",
          args: [params.jarAddress, params.amount],
        });
      }

      // Update toast to reflect deposit phase
      if (activeToastId.current) {
        toastService.loading({
          id: activeToastId.current,
          title: formatMessage({ id: "app.cookieJar.deposit" }),
          message: formatMessage({ id: "app.cookieJar.depositing" }),
        });
      }

      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "deposit",
        args: [params.amount],
      });
    },
    onMutate: () => {
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

      lastParamsRef.current = {
        gardenAddress,
        jarAddress: _params.jarAddress,
      };
      queryInvalidation
        .onCookieJarDeposit(gardenAddress, _params.jarAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress,
          jarAddress: params?.jarAddress,
          assetAddress: params?.assetAddress,
        },
      });
    },
  });
}
