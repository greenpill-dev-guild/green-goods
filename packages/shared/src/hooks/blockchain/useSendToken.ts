/**
 * Send an ERC-20 token to a recipient (client PWA "Send" flow).
 *
 * V1 is ERC-20 only (GOODS + stablecoins); native ETH is deferred. The transfer
 * goes through `useTransactionSender()` — gas-sponsored for passkey smart accounts,
 * user-paid for wallet/embedded. Mirrors the `useCookieJarDeposit` mutation shape.
 * The optional note is stored off-chain with the recent recipient; ERC-20 transfers
 * carry no on-chain memo.
 *
 * @module hooks/blockchain/useSendToken
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { formatUnits, isAddress, maxUint256 } from "viem";
import { toastService } from "../../components/toast";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { isCeloGoodDollar, type SendableToken } from "../../config/tokens";
import { getGardenerDeliveryEnabled } from "../../modules/commitment-pooling/data-settlement";
import {
  quoteGoodDollarTransfer,
  type GoodDollarFeeQuote,
} from "../../modules/wallet/good-dollar-fees";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI, ERC20_TRANSFER_ABI } from "../../utils/blockchain/abis/erc20";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useTransactionSender } from "./useTransactionSender";
import { addRecentRecipient } from "./useRecentRecipients";

export interface SendTokenParams {
  /** The token to send (from the sendable-token registry). */
  token: SendableToken;
  /** Resolved recipient address (post-ENS). */
  to: Address;
  /** Amount in base units. */
  amount: bigint;
  /** Off-chain note stored with the recent recipient. Never sent on-chain. */
  note?: string;
  /** The quote explicitly reviewed by the user; a change requires another review. */
  reviewedFee?: GoodDollarFeeQuote;
}

export function useSendToken() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { primaryAddress } = useUser();
  const sender = useTransactionSender();
  const identity = useRef({ primaryAddress, sender });
  identity.current = { primaryAddress, sender };
  const handleError = createMutationErrorHandler({
    source: "useSendToken",
    toastContext: "token send",
  });
  const sentRef = useRef<{ account: string; chainId: number } | null>(null);

  // Balances are direct RPC reads, so one delayed refetch covers read-after-write
  // staleness — no indexer-lag schedule needed.
  const { start: scheduleRefetch } = useDelayedInvalidation(
    useCallback(() => {
      if (!sentRef.current) return;
      queryInvalidation
        .onTokenSent(sentRef.current.account, sentRef.current.chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }, [queryClient]),
    3000
  );

  const mutation = useMutation({
    retry: false,
    // Reject immediately while offline; TanStack must not resume a value transfer later.
    networkMode: "always",
    mutationFn: async ({ token, to, amount, reviewedFee }: SendTokenParams) => {
      if (typeof navigator !== "undefined" && !navigator.onLine)
        throw new Error("Token sends require an online connection");
      if (!primaryAddress) throw new Error("Connected account required");
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!token.supported || !Number.isSafeInteger(token.chainId) || token.chainId <= 0)
        throw new Error("Token is not available on this network");
      if (amount <= 0n || amount > maxUint256)
        throw new Error("Amount must be greater than zero and fit uint256");
      if (!isAddress(to) || /^0x0{40}$/i.test(to)) throw new Error("Invalid recipient");
      const celo = isCeloGoodDollar(token);
      if ((token.chainId === 42220 || token.symbol === "G$") && !celo)
        throw new Error("Unsupported Celo token");
      let totalDebit = amount;
      if (celo) {
        if ((await getGardenerDeliveryEnabled()) !== true)
          throw new Error("Gardener delivery is unavailable");
        const quote = await quoteGoodDollarTransfer(amount, primaryAddress as Address, to);
        if (
          !reviewedFee ||
          reviewedFee.amount !== amount ||
          reviewedFee.fee !== quote.fee ||
          reviewedFee.senderPays !== quote.senderPays
        ) {
          throw new Error(
            "G$ token fee changed or is missing. Review the fee again before sending."
          );
        }
        totalDebit = quote.totalDebit;
      }
      const client = createPublicClientForChain(token.chainId);
      try {
        const balance = await client.readContract({
          address: token.address,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [primaryAddress as Address],
        });
        if (typeof balance !== "bigint" || balance < 0n)
          throw new Error("Token balance unavailable");
        if (balance < totalDebit) throw new Error("Insufficient token balance");
      } catch (error) {
        // Preserve primary-token behavior; Celo fee-aware sends need a proven gross balance.
        if (
          celo ||
          (error instanceof Error && error.message.includes("Insufficient token balance"))
        )
          throw error;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine)
        throw new Error("Token sends require an online connection");
      if (
        identity.current.primaryAddress !== primaryAddress ||
        identity.current.sender !== sender
      ) {
        throw new Error("Wallet session changed. Review the send again.");
      }
      const result = await sender.sendContractCall({
        account: primaryAddress as Address,
        address: token.address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to, amount],
        chainId: token.chainId,
      });
      if (celo) {
        // A submission identifier alone (including a Safe proposal) cannot prove inclusion.
        if (!/^0x[0-9a-f]{64}$/i.test(result.hash))
          throw new Error("Celo transaction inclusion is unavailable");
        let changedTransaction = false;
        const receipt = await client.waitForTransactionReceipt({
          hash: result.hash,
          onReplaced: ({ reason }) => {
            if (reason !== "repriced") changedTransaction = true;
          },
        });
        if (changedTransaction) throw new Error("Transaction cancelled or replaced");
        if (receipt.status !== "success") throw new Error("Transaction reverted on-chain");
        return {
          ...result,
          hash: receipt.transactionHash ?? result.hash,
          account: primaryAddress.toLowerCase(),
        };
      }
      return { ...result, account: primaryAddress.toLowerCase() };
    },
    onMutate: () => ({
      toastId: toastService.loading({
        title: formatMessage({ id: "app.send.title" }),
        message: formatMessage({ id: "app.send.sending" }),
      }),
    }),
    onSuccess: (result, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.send.title" }),
        message: formatMessage(
          { id: "app.send.success" },
          {
            amount: formatUnits(params.amount, params.token.decimals),
            symbol: params.token.symbol,
          }
        ),
      });

      addRecentRecipient(params.to, params.note);
      sentRef.current = { account: result.account, chainId: params.token.chainId };
      queryInvalidation
        .onTokenSent(sentRef.current.account, sentRef.current.chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleRefetch();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { chainId: params?.token?.chainId, token: params?.token?.symbol },
        showToast: true,
      });
    },
  });

  return useSafeMutation(mutation);
}
