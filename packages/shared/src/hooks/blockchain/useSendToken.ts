/**
 * Send an ERC-20 token to a recipient (client PWA "Send" flow).
 *
 * V1 is ERC-20 only (GOODS + stablecoins); native ETH is deferred. The transfer
 * goes through `useTransactionSender()` — gas-sponsored for passkey smart accounts,
 * user-paid for wallet/embedded. Mirrors the `useCookieJarDeposit` mutation shape.
 * The optional note is stored off-chain with the recent recipient; ERC-20 transfers
 * carry no on-chain memo.
 *
 * A wallet send that waits on the wallet past `WALLET_NUDGE_MS` turns `notice` to
 * `wallet-slow`, and `cancelWalletWait` stops waiting for the wallet's answer. The
 * notice also says when a send stopped that way, went out and is still confirming,
 * or is a Safe proposal waiting for its signers: none of those is a failure (PRD-1551).
 *
 * @module hooks/blockchain/useSendToken
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, isAddress, maxUint256 } from "viem";
import { toastService } from "../../components/toast";
import { createPublicClientForChain } from "../../config/pimlico";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { isCeloGoodDollar, type SendableToken } from "../../config/tokens";
import {
  type GoodDollarFeeQuote,
  quoteGoodDollarTransfer,
} from "../../modules/wallet/good-dollar-fees";
import { SEND_STAGE_WORDS, WALLET_NUDGE_MS } from "../../modules/transactions/send-stage";
import {
  asReceiptWaitLimit,
  type TxResult,
  WalletAnswerAbandonedError,
} from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import { ERC20_BALANCE_ABI, ERC20_TRANSFER_ABI } from "../../utils/blockchain/abis/erc20";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { isUnconfirmedTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useDelayedInvalidation, useTimeout } from "../utils/useTimeout";
import { addRecentRecipient } from "./useRecentRecipients";
import { useTransactionSender } from "./useTransactionSender";

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

/**
 * What the send's line says besides sending or failed: the wallet has not answered for a while
 * (offer Cancel), the person stopped waiting for it, the send went out and is still confirming,
 * or the wallet answered with a Safe proposal.
 */
export type TokenSendNotice = "wallet-slow" | "stopped" | "still-confirming" | "safe-signers";

/**
 * The notice a settled send leaves, from how it ended. A send the person stopped waiting for
 * that the wallet then sent anyway went out after all: it is still confirming.
 */
function settledNotice(
  error: unknown,
  data: { awaiting?: TxResult["awaiting"] } | undefined,
  answeredLate: boolean
): TokenSendNotice | null {
  if (error instanceof WalletAnswerAbandonedError)
    return answeredLate ? "still-confirming" : "stopped";
  if (error && isUnconfirmedTxError(error)) return "still-confirming";
  return data?.awaiting === "safe-signers" ? "safe-signers" : null;
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
  // One send at a time: its way to stop waiting on the wallet, and whether that wait is slow.
  const walletWait = useRef<AbortController | null>(null);
  const [walletSlow, setWalletSlow] = useState(false);
  const [answeredLate, setAnsweredLate] = useState(false);
  const { set: setNudge, clear: clearNudge } = useTimeout();
  const cancelWalletWait = useCallback(() => walletWait.current?.abort(), []);

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
      if (token.symbol === "G$" && !celo) throw new Error("Unsupported Celo token");
      let totalDebit = amount;
      if (celo) {
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
      // Only a wallet asks the person; a passkey approves in the app and an embedded wallet
      // asks nobody, so only a wallet send can turn slow or be stopped.
      const wait = new AbortController();
      walletWait.current = wait;
      setAnsweredLate(false);
      if (sender.authMode === "wallet") setNudge(() => setWalletSlow(true), WALLET_NUDGE_MS);
      const answered = () => {
        clearNudge();
        setWalletSlow(false);
      };
      // The wallet sent it after the person stopped waiting: say it went out, refresh the
      // balance, and leave any newer send's wait alone.
      const answeredAfterCancel = () => {
        setAnsweredLate(true);
        // Said in a toast too, in case another send has started in the meantime.
        const { label, detail } = SEND_STAGE_WORDS["still-confirming"];
        toastService.info({ title: formatMessage(label), message: formatMessage(detail!) });
        sentRef.current = { account: primaryAddress.toLowerCase(), chainId: token.chainId };
        scheduleRefetch();
      };
      let result: TxResult;
      try {
        result = await sender.sendContractCall(
          {
            account: primaryAddress as Address,
            address: token.address,
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [to, amount],
            chainId: token.chainId,
          },
          {
            signal: wait.signal,
            onBroadcast: async () => (wait.signal.aborted ? answeredAfterCancel() : answered()),
          }
        );
      } finally {
        if (walletWait.current === wait) {
          answered();
          walletWait.current = null;
        }
      }
      if (celo) {
        // A submission identifier alone (including a Safe proposal) cannot prove inclusion.
        if (!/^0x[0-9a-f]{64}$/i.test(result.hash))
          throw new Error("Celo transaction inclusion is unavailable");
        // Production senders return a canonical hash only after a successful receipt.
        // A second RPC wait can fail after the value transfer already succeeded,
        // incorrectly presenting a retry that could pay the recipient twice.
        if (result.confirmation !== "pending") {
          return { ...result, account: primaryAddress.toLowerCase() };
        }
        // A Safe proposal's hash never gets a receipt: it waits for the Safe's signers, and
        // the notice says so rather than that it was sent.
        if (result.awaiting === "safe-signers")
          return { ...result, account: primaryAddress.toLowerCase() };
        let changedTransaction = false;
        const receipt = await client
          .waitForTransactionReceipt({
            hash: result.hash,
            timeout: TX_RECEIPT_TIMEOUT_MS,
            onReplaced: ({ reason }) => {
              if (reason !== "repriced") changedTransaction = true;
            },
          })
          .catch((error: unknown) => {
            // Sent, and still confirming: never a failure to send again.
            throw asReceiptWaitLimit(error, TX_RECEIPT_TIMEOUT_MS, result.hash);
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
      // A Safe proposal has not sent anything yet: it waits for the Safe's signers.
      if (result.awaiting === "safe-signers") {
        const { label, detail } = SEND_STAGE_WORDS["safe-signers"];
        toastService.info({ title: formatMessage(label), message: formatMessage(detail!) });
      } else {
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
      }

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

  const send = useSafeMutation(mutation);
  const notice: TokenSendNotice | null =
    send.isPending && walletSlow
      ? "wallet-slow"
      : settledNotice(send.error, send.data, answeredLate);
  return { ...send, notice, cancelWalletWait };
}
