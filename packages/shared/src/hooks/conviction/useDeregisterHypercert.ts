import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { encodeFunctionData } from "viem";
import { useWriteContract } from "wagmi";
import { toastService } from "../../components/toast";
import type { DeregisterHypercertParams } from "../../types/conviction";
import { HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useUser } from "../auth/useUser";
import { queryInvalidation } from "../query-keys";

export function useDeregisterHypercert() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();
  const handleError = createMutationErrorHandler({
    source: "useDeregisterHypercert",
    toastContext: "deregister hypercert",
  });

  return useMutation({
    mutationFn: async (params: DeregisterHypercertParams) => {
      const request = {
        address: params.poolAddress,
        abi: HYPERCERT_SIGNAL_POOL_ABI,
        functionName: "deregisterHypercert" as const,
        args: [params.hypercertId] as const,
      };

      if (authMode === "passkey" && smartAccountClient?.account) {
        const data = encodeFunctionData({
          abi: request.abi,
          functionName: request.functionName,
          args: request.args,
        });

        return smartAccountClient.sendTransaction({
          account: smartAccountClient.account,
          chain: smartAccountClient.chain,
          to: request.address,
          value: 0n,
          data,
        });
      }

      return writeContractAsync({
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.signal.removing" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.signal.removeSuccess" }),
      });

      queryInvalidation
        .onHypercertRegistrationChanged(params.poolAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          poolAddress: params?.poolAddress,
          hypercertId: params?.hypercertId?.toString(),
        },
      });
    },
  });
}
