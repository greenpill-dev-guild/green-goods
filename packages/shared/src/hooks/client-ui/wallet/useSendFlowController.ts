import type { SendableTokenBalance } from "../../../hooks/blockchain/useSendableTokens";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { useQuery } from "@tanstack/react-query";
import { tokensKeys } from "../../../config/query-keys/tokens";
import { isCeloGoodDollar } from "../../../config/tokens";
import {
  quoteGoodDollarTransfer,
  type GoodDollarFeeQuote,
} from "../../../modules/wallet/good-dollar-fees";
import { useUser } from "../../auth/useUser";
import type { Address } from "../../../types/domain";
import {
  initialSendFlowState,
  sendFlowReducer,
  validateSendAmount,
  type SelectedRecipient,
  type SendFlowEvent,
  type WalletMode,
} from "../../../modules/wallet/send-flow";
import { formatAddress } from "../../../utils/app/text";

interface SendMutationPort {
  isPending: boolean;
  mutate(
    input: {
      token: SendableTokenBalance;
      to: SelectedRecipient["address"];
      amount: bigint;
      note: string;
      reviewedFee?: GoodDollarFeeQuote;
    },
    options: { onSuccess: () => void }
  ): void;
}

interface UseSendFlowControllerOptions {
  isOnline: boolean;
  resolvedEnsName?: string | null;
  resetNonce?: number;
  sendMutation: SendMutationPort;
  tokens?: SendableTokenBalance[];
  canSendCelo?: boolean;
}

export function useSendFlowController({
  isOnline,
  resolvedEnsName,
  resetNonce,
  sendMutation,
  tokens,
  canSendCelo = false,
}: UseSendFlowControllerOptions) {
  const { formatMessage } = useIntl();
  const [state, dispatch] = useReducer(sendFlowReducer, initialSendFlowState);
  const { amountInput, note, recipient, step } = state;
  const { primaryAddress } = useUser();
  const selectedToken =
    tokens && state.selectedToken
      ? (tokens.find(
          (token) =>
            token.chainId === state.selectedToken?.chainId &&
            token.address.toLowerCase() === state.selectedToken.address.toLowerCase()
        ) ?? null)
      : state.selectedToken;
  const generation = useRef(0);
  const actionPending = useRef(false);
  const confirmFee = useRef<GoodDollarFeeQuote | undefined>(undefined);
  const [feeChanged, setFeeChanged] = useState(false);
  const previousAccount = useRef(primaryAddress);
  const live = useRef({ isOnline, canSendCelo });
  live.current = { isOnline, canSendCelo };
  useEffect(() => {
    if (previousAccount.current !== primaryAddress) {
      previousAccount.current = primaryAddress;
      generation.current++;
      confirmFee.current = undefined;
      dispatch({ type: "reset-after-send" });
    }
  }, [primaryAddress]);

  useEffect(() => {
    if (resetNonce !== undefined) {
      generation.current++;
      dispatch({ type: "reset-tab" });
    }
  }, [resetNonce]);

  const validation = useMemo(
    () => validateSendAmount(selectedToken, amountInput),
    [amountInput, selectedToken]
  );
  const recipientDisplayName = recipient
    ? resolvedEnsName || recipient.ensName || formatAddress(recipient.address)
    : "";
  const celo = Boolean(selectedToken && isCeloGoodDollar(selectedToken));
  const feeQuery = useQuery({
    queryKey: tokensKeys.transferFee(
      primaryAddress ?? "",
      selectedToken?.chainId ?? 0,
      selectedToken?.address ?? "",
      recipient?.address ?? "",
      validation.parsedAmount
    ),
    enabled:
      celo &&
      isOnline &&
      canSendCelo &&
      Boolean(primaryAddress && recipient) &&
      validation.parsedAmount > 0n &&
      state.mode === "send",
    queryFn: () =>
      quoteGoodDollarTransfer(
        validation.parsedAmount,
        primaryAddress as Address,
        recipient!.address
      ),
    staleTime: 0,
    retry: false,
  });
  const feeQuote = celo ? feeQuery.data : undefined;
  const feeLoading = celo && feeQuery.isFetching;
  const feeError = celo && feeQuery.isError;
  const feeInsufficient = Boolean(
    feeQuote &&
      selectedToken?.balance !== null &&
      feeQuote.totalDebit > (selectedToken?.balance ?? 0n)
  );
  const feeReady =
    !celo ||
    Boolean(feeQuote && !feeLoading && !feeError && !feeInsufficient && canSendCelo && isOnline);
  const canAdvance =
    !sendMutation.isPending &&
    (step === "recipient"
      ? Boolean(recipient)
      : validation.valid && feeReady && (step !== "review" || isOnline));
  const canMax = Boolean(
    selectedToken?.balance &&
      !selectedToken.errored &&
      (!celo || (feeQuote && !(feeQuote.senderPays && feeQuote.fee > 0n)))
  );

  const primary = async () => {
    if (!canAdvance || actionPending.current) return;
    const actionGeneration = generation.current;
    if (celo && step !== "recipient") {
      actionPending.current = true;
      try {
        const fresh = await feeQuery.refetch();
        if (
          generation.current !== actionGeneration ||
          !live.current.isOnline ||
          !live.current.canSendCelo ||
          fresh.isError ||
          !fresh.data ||
          fresh.data.totalDebit > (selectedToken?.balance ?? 0n)
        )
          return;
        if (
          step === "review" &&
          (fresh.data.fee !== feeQuote?.fee || fresh.data.senderPays !== feeQuote?.senderPays)
        ) {
          setFeeChanged(true);
          return;
        }
        setFeeChanged(false);
        if (step === "review") confirmFee.current = fresh.data;
      } finally {
        actionPending.current = false;
      }
    }
    dispatch(step === "review" ? { type: "open-confirm" } : { type: "advance" });
  };
  const primaryLabel =
    step === "recipient"
      ? formatMessage({ id: "app.send.continue" })
      : step === "amount"
        ? formatMessage({ id: "app.send.reviewCta" })
        : formatMessage({ id: "app.send.sendCta" });

  const executeSend = () => {
    if (!recipient || !selectedToken || !canAdvance || !isOnline || (celo && !confirmFee.current))
      return;
    sendMutation.mutate(
      {
        token: selectedToken,
        to: recipient.address,
        amount: validation.parsedAmount,
        note,
        ...(celo ? { reviewedFee: confirmFee.current } : {}),
      },
      { onSuccess: () => dispatch({ type: "reset-after-send" }) }
    );
  };

  const updateDraft = (event: SendFlowEvent) => {
    generation.current++;
    confirmFee.current = undefined;
    setFeeChanged(false);
    dispatch(event);
  };

  return {
    ...state,
    selectedToken,
    feeQuote,
    feeLoading,
    feeError,
    feeInsufficient,
    feeChanged,
    canMax,
    retryFee: () => feeQuery.refetch(),
    canAdvance,
    isOnline,
    isSending: sendMutation.isPending,
    primaryLabel,
    recipientDisplayName,
    validation,
    acts: {
      back: () => updateDraft({ type: "back" }),
      changeAmount: (amount: string) => updateDraft({ type: "change-amount", amount }),
      changeNote: (nextNote: string) => dispatch({ type: "change-note", note: nextNote }),
      closeConfirm: () => dispatch({ type: "close-confirm" }),
      editAmount: () => updateDraft({ type: "edit-amount" }),
      editRecipient: () => updateDraft({ type: "edit-recipient" }),
      executeSend,
      max: () => {
        if (canMax && selectedToken?.balance) {
          updateDraft({
            type: "change-amount",
            amount: formatUnits(selectedToken.balance, selectedToken.decimals),
          });
        }
      },
      primary,
      selectMode: (mode: WalletMode) => updateDraft({ type: "select-mode", mode }),
      selectRecipient: (nextRecipient: SelectedRecipient) =>
        updateDraft({ type: "select-recipient", recipient: nextRecipient }),
      selectToken: (token: SendableTokenBalance | null) =>
        updateDraft({ type: "select-token", token }),
      startSend: (token: SendableTokenBalance) => updateDraft({ type: "start-send", token }),
    },
  };
}
