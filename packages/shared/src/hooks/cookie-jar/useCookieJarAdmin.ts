import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import type { Address } from "viem";
import { toastService } from "../../components/toast";
import type {
  CookieJarAdminParams,
  CookieJarEmergencyWithdrawParams,
  CookieJarUpdateIntervalParams,
  CookieJarUpdateMaxWithdrawalParams,
} from "../../types/cookie-jar";
import { COOKIE_JAR_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

export function useCookieJarPause(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarPause",
    toastContext: "cookie jar pause",
  });

  const lastParamsRef = useRef<{ gardenAddress: string; jarAddress: string }>({
    gardenAddress,
    jarAddress: "",
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarAdminAction(
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
    mutationFn: async (params: CookieJarAdminParams) => {
      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "pause",
        args: [],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.pause" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.pause" }),
      });

      lastParamsRef.current = { gardenAddress, jarAddress: params.jarAddress };
      queryInvalidation
        .onCookieJarAdminAction(gardenAddress, params.jarAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress, jarAddress: params?.jarAddress },
      });
    },
  });
}

export function useCookieJarUnpause(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarUnpause",
    toastContext: "cookie jar unpause",
  });

  const lastParamsRef = useRef<{ gardenAddress: string; jarAddress: string }>({
    gardenAddress,
    jarAddress: "",
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarAdminAction(
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
    mutationFn: async (params: CookieJarAdminParams) => {
      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "unpause",
        args: [],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.unpause" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.unpause" }),
      });

      lastParamsRef.current = { gardenAddress, jarAddress: params.jarAddress };
      queryInvalidation
        .onCookieJarAdminAction(gardenAddress, params.jarAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress, jarAddress: params?.jarAddress },
      });
    },
  });
}

export function useCookieJarUpdateMaxWithdrawal(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarUpdateMaxWithdrawal",
    toastContext: "cookie jar update max withdrawal",
  });

  const lastParamsRef = useRef<{ gardenAddress: string; jarAddress: string }>({
    gardenAddress,
    jarAddress: "",
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarAdminAction(
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
    mutationFn: async (params: CookieJarUpdateMaxWithdrawalParams) => {
      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "updateMaxWithdrawalAmount",
        args: [params.maxWithdrawal],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.updateLimits" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.updateLimits" }),
      });

      lastParamsRef.current = { gardenAddress, jarAddress: params.jarAddress };
      queryInvalidation
        .onCookieJarAdminAction(gardenAddress, params.jarAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress, jarAddress: params?.jarAddress },
      });
    },
  });
}

export function useCookieJarUpdateInterval(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarUpdateInterval",
    toastContext: "cookie jar update interval",
  });

  const lastParamsRef = useRef<{ gardenAddress: string; jarAddress: string }>({
    gardenAddress,
    jarAddress: "",
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarAdminAction(
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
    mutationFn: async (params: CookieJarUpdateIntervalParams) => {
      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "updateWithdrawalInterval",
        args: [params.withdrawalInterval],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.updateLimits" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.updateLimits" }),
      });

      lastParamsRef.current = { gardenAddress, jarAddress: params.jarAddress };
      queryInvalidation
        .onCookieJarAdminAction(gardenAddress, params.jarAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress, jarAddress: params?.jarAddress },
      });
    },
  });
}

export function useCookieJarEmergencyWithdraw(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarEmergencyWithdraw",
    toastContext: "cookie jar emergency withdraw",
  });

  const lastParamsRef = useRef<{ gardenAddress: string; jarAddress: string }>({
    gardenAddress,
    jarAddress: "",
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarAdminAction(
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
    mutationFn: async (params: CookieJarEmergencyWithdrawParams) => {
      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "emergencyWithdraw",
        args: [params.tokenAddress, params.amount],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.emergencyWithdraw" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.emergencyWithdraw" }),
      });

      lastParamsRef.current = { gardenAddress, jarAddress: params.jarAddress };
      queryInvalidation
        .onCookieJarAdminAction(gardenAddress, params.jarAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress, jarAddress: params?.jarAddress },
      });
    },
  });
}
