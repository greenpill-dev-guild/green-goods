/**
 * Withdraw from an Octant V2 campaign vault using the **connected wallet** that
 * owns the position, for the `/vaults` management surface.
 *
 * The repo's existing {@link useVaultWithdraw} is Garden/indexer-oriented and does
 * NOT thread `chainId` through its reads/writes, so it silently targets the app's
 * default chain — wrong for these Ethereum-mainnet pilot vaults. This hook mirrors
 * {@link useOctantVaultWalletEndow}: it reads `maxWithdraw` and sends `withdraw`
 * through the transaction sender with an explicit `chainId`, prompting a network
 * switch when needed.
 *
 * Card/recovered email-wallet positions use a separate Thirdweb-signed path (the
 * shared package can't depend on `thirdweb/react`); both paths pass the SAME
 * {@link DEFAULT_WITHDRAW_MAX_LOSS_BPS} so the withdrawable shown on screen is the
 * amount the contract will accept.
 *
 * @module hooks/vault/useOctantVaultWithdraw
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import { queryKeys } from "../../config/query-keys";
import type { Address } from "../../types/domain";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis";
import { DEFAULT_WITHDRAW_MAX_LOSS_BPS } from "../../utils/blockchain/vaults";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import {
  shouldShowErrorToast,
  shouldShowLifecycleToast,
  type VaultMutationOptions,
} from "./vault-helpers";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;

function addressesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export interface OctantVaultWithdrawParams {
  /** Chain the vault lives on (Octant V2 Ethereum mainnet = 1). */
  chainId: number;
  vaultAddress: Address;
  /** Amount to withdraw, in asset base units (WETH wei). */
  amount: bigint;
  /** Position owner. Defaults to the connected wallet; must equal it. */
  owner?: Address;
  /** Where withdrawn assets land. Defaults to the owner. */
  receiver?: Address;
  /** Slippage cap in bps. Defaults to {@link DEFAULT_WITHDRAW_MAX_LOSS_BPS} (1%). */
  maxLossBps?: bigint;
}

export function useOctantVaultWithdraw(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const showLifecycleToast = shouldShowLifecycleToast(options.toastMode);
  const showErrorToast = showLifecycleToast && shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useOctantVaultWithdraw",
    toastContext: "Octant Vault Withdraw",
  });

  const mutation = useMutation({
    mutationFn: async (params: OctantVaultWithdrawParams) => {
      if (params.chainId !== OCTANT_V2_ETHEREUM_CHAIN_ID) {
        throw new Error("Octant vault withdraw requires Ethereum mainnet chain ID 1");
      }
      if (!sender) {
        throw new Error("TransactionSender not available — auth not initialized");
      }
      if (authMode !== "wallet" || sender.authMode !== "wallet" || !primaryAddress) {
        throw new Error("Octant vault withdraw requires a connected wallet");
      }

      const owner = (params.owner ?? primaryAddress) as Address;
      if (!addressesEqual(owner, primaryAddress)) {
        throw new Error("Octant vault withdraw owner must be the connected wallet");
      }
      const receiver = (params.receiver ?? owner) as Address;
      const maxLossBps = params.maxLossBps ?? DEFAULT_WITHDRAW_MAX_LOSS_BPS;

      if (params.amount <= 0n) {
        throw new Error("Withdrawal amount must be greater than zero");
      }

      // Pre-check withdrawable at this slippage so we fail clearly before the wallet
      // prompt rather than letting the on-chain call revert.
      const maxWithdrawResult = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxWithdraw",
        args: [owner, maxLossBps, []],
        chainId: params.chainId,
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
        chainId: params.chainId,
      });
      return result.hash;
    },
    onMutate: () => {
      if (!showLifecycleToast) return { toastId: undefined };
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.withdraw" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      if (showLifecycleToast) {
        toastService.success({
          title: formatMessage({ id: "app.treasury.withdraw" }),
          message: formatMessage({ id: "app.treasury.withdrawSuccess" }),
        });
      }
      const owner = (params.owner ?? primaryAddress ?? "").toLowerCase();
      if (owner) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.vaults.octantPositions(owner, params.chainId),
        });
      }
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          chainId: params?.chainId,
          vaultAddress: params?.vaultAddress,
          owner: params?.owner ?? primaryAddress ?? undefined,
        },
        showToast: showErrorToast,
      });
    },
  });

  return useSafeMutation(mutation);
}
