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
import { formatUnits } from "viem";
import { toastService } from "../../components/toast";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryInvalidation } from "../../config/query-keys";
import type { SendableToken } from "../../config/tokens";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI, ERC20_TRANSFER_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useCurrentChain } from "./useChainConfig";
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
}

export function useSendToken() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sender = useTransactionSender();
  const handleError = createMutationErrorHandler({
    source: "useSendToken",
    toastContext: "token send",
  });
  const accountRef = useRef<string>("");

  // Balances are direct RPC reads, so one delayed refetch covers read-after-write
  // staleness — no indexer-lag schedule needed.
  const { start: scheduleRefetch } = useDelayedInvalidation(
    useCallback(() => {
      if (!accountRef.current) return;
      queryInvalidation
        .onTokenSent(accountRef.current, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }, [queryClient, chainId]),
    3000
  );

  const mutation = useMutation({
    mutationFn: async ({ token, to, amount }: SendTokenParams) => {
      if (!primaryAddress) throw new Error("Connected account required");
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!token.supported) throw new Error("Token is not available on this network");
      if (amount <= 0n) throw new Error("Amount must be greater than zero");

      // Balance pre-check (best-effort: a read failure must not block the send,
      // but an explicit insufficient balance should stop it before signing).
      try {
        const balance = (await createPublicClientForChain(chainId).readContract({
          address: token.address,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [primaryAddress as Address],
        })) as bigint;
        if (typeof balance === "bigint" && balance < amount) {
          throw new Error("Insufficient token balance");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Insufficient token balance")) {
          throw error;
        }
      }

      return sender.sendContractCall({
        address: token.address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to, amount],
        chainId,
      });
    },
    onMutate: () => ({
      toastId: toastService.loading({
        title: formatMessage({ id: "app.send.title" }),
        message: formatMessage({ id: "app.send.sending" }),
      }),
    }),
    onSuccess: (_result, params, context) => {
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
      accountRef.current = (primaryAddress ?? "").toLowerCase();
      queryInvalidation
        .onTokenSent(accountRef.current, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleRefetch();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { to: params?.to, token: params?.token?.symbol },
        showToast: true,
      });
    },
  });

  return useSafeMutation(mutation);
}
