/**
 * Redeem shares from an Octant V2 campaign vault using the **connected wallet**
 * that owns the position, for the `/vaults` management surface.
 *
 * The repo's existing Garden vault withdrawal hook is Garden/indexer-oriented and
 * does NOT thread `chainId` through its reads/writes, so it silently targets the
 * app's default chain — wrong for these Ethereum-mainnet pilot vaults. This hook
 * mirrors {@link useOctantVaultWalletEndow}: it reads `maxRedeem` and sends
 * `redeem` through the transaction sender with an explicit `chainId`, prompting a
 * network switch when needed.
 *
 * Card/recovered email-wallet positions use a separate Thirdweb-signed path (the
 * shared package can't depend on `thirdweb/react`); both paths pass the SAME
 * {@link DEFAULT_WITHDRAW_MAX_LOSS_BPS} to the `maxRedeem` pre-check so the
 * redeemable shares shown on screen are the shares the contract will accept.
 *
 * @module hooks/vault/useOctantVaultRedeem
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

export interface OctantVaultRedeemParams {
  /** Chain the vault lives on (Octant V2 Ethereum mainnet = 1). */
  chainId: number;
  vaultAddress: Address;
  /** Vault shares to redeem, in share base units. */
  shares: bigint;
  /** Position owner. Defaults to the connected wallet; must equal it. */
  owner?: Address;
  /** Where redeemed assets land. Defaults to the owner. */
  receiver?: Address;
  /** Slippage cap for `maxRedeem` in bps. Defaults to {@link DEFAULT_WITHDRAW_MAX_LOSS_BPS} (1%). */
  maxLossBps?: bigint;
}

export function useOctantVaultRedeem(options: VaultMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const showLifecycleToast = shouldShowLifecycleToast(options.toastMode);
  const showErrorToast = showLifecycleToast && shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useOctantVaultRedeem",
    toastContext: "Octant Vault Redeem",
  });

  const mutation = useMutation({
    mutationFn: async (params: OctantVaultRedeemParams) => {
      if (params.chainId !== OCTANT_V2_ETHEREUM_CHAIN_ID) {
        throw new Error("Octant vault redeem requires Ethereum mainnet chain ID 1");
      }
      if (!sender) {
        throw new Error("TransactionSender not available — auth not initialized");
      }
      if (authMode !== "wallet" || sender.authMode !== "wallet" || !primaryAddress) {
        throw new Error("Octant vault redeem requires a connected wallet");
      }

      const owner = (params.owner ?? primaryAddress) as Address;
      if (!addressesEqual(owner, primaryAddress)) {
        throw new Error("Octant vault redeem owner must be the connected wallet");
      }
      const receiver = (params.receiver ?? owner) as Address;
      const maxLossBps = params.maxLossBps ?? DEFAULT_WITHDRAW_MAX_LOSS_BPS;

      if (params.shares <= 0n) {
        throw new Error("Redeem shares must be greater than zero");
      }

      // Pre-check redeemable shares at this slippage so we fail clearly before the
      // wallet prompt rather than letting the on-chain call revert.
      const maxRedeemResult = await readContract(getWagmiConfig(), {
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "maxRedeem",
        args: [owner, maxLossBps, []],
        chainId: params.chainId,
      });
      const maxRedeemable = typeof maxRedeemResult === "bigint" ? maxRedeemResult : 0n;

      if (maxRedeemable <= 0n) {
        throw new Error("Vault is not accepting redemptions right now");
      }
      if (params.shares > maxRedeemable) {
        throw new Error("Redeem shares exceed the available share balance");
      }

      const result = await sender.sendContractCall({
        address: params.vaultAddress,
        abi: OCTANT_VAULT_ABI,
        functionName: "redeem",
        args: [params.shares, receiver, owner, maxLossBps, []],
        chainId: params.chainId,
      });
      return result.hash;
    },
    onMutate: () => {
      if (!showLifecycleToast) return { toastId: undefined };
      const toastId = toastService.loading({
        title: formatMessage({ id: "public.vaults.manage.redeem.toastTitle" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      if (showLifecycleToast) {
        toastService.success({
          title: formatMessage({ id: "public.vaults.manage.redeem.toastTitle" }),
          message: formatMessage({ id: "public.vaults.manage.redeem.toastSuccess" }),
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
