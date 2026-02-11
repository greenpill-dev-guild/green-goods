import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useIntl } from "react-intl";
import { useRef } from "react";
import { encodeFunctionData } from "viem";
import { useWriteContract } from "wagmi";
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
import { useUser } from "../auth/useUser";
import { queryInvalidation } from "../query-keys";
import { wagmiConfig } from "../../config/appkit";
import {
  ERC20_ALLOWANCE_ABI,
  OCTANT_MODULE_ABI,
  OCTANT_VAULT_ABI,
} from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";

interface SendContractTxRequest {
  address: Address;
  abi: readonly Record<string, unknown>[];
  functionName: string;
  args: readonly unknown[];
}

function useContractTxSender() {
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();

  return async (request: SendContractTxRequest): Promise<`0x${string}`> => {
    if (authMode === "passkey" && smartAccountClient?.account) {
      const data = encodeFunctionData({
        abi: request.abi,
        functionName: request.functionName as never,
        args: request.args as never,
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
      functionName: request.functionName as never,
      args: request.args as never,
    });
  };
}

function getOctantModuleAddress(chainId: number): Address {
  const moduleAddress = getNetworkContracts(chainId).octantModule;
  if (!moduleAddress || moduleAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("OctantModule is not configured for the current chain");
  }
  return moduleAddress as Address;
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

  const activeToastId = useRef<string | undefined>(undefined);

  return useMutation({
    mutationFn: async (params: DepositParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      const receiver = (params.receiver ?? primaryAddress) as Address;
      const allowanceResult = await readContract(wagmiConfig, {
        address: params.assetAddress,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        args: [primaryAddress as Address, params.vaultAddress],
      });
      const allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;

      if (allowance < params.amount) {
        await sendContractTx({
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "approve",
          args: [params.vaultAddress, params.amount],
        });
      }

      // Update toast to reflect deposit phase (after approval)
      if (activeToastId.current) {
        toastService.loading({
          id: activeToastId.current,
          title: formatMessage({ id: "app.treasury.deposit" }),
          message: formatMessage({ id: "app.treasury.depositing" }),
        });
      }

      return sendContractTx({
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "deposit",
        args: [params.amount, receiver],
      });
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

      queryInvalidation
        .onVaultDeposit(params.gardenAddress, primaryAddress ?? undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
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

  return useMutation({
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

      queryInvalidation
        .onVaultWithdraw(params.gardenAddress, primaryAddress ?? undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
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

  return useMutation({
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

      queryInvalidation
        .onVaultHarvest(params.gardenAddress, chainId)
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

  return useMutation({
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

  return useMutation({
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

      queryInvalidation
        .onVaultHarvest(params.gardenAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
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
}
