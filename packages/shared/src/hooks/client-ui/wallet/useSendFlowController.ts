import type { SendableTokenBalance } from "../../../hooks/blockchain/useSendableTokens";
import { useEffect, useMemo, useReducer } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import {
  initialSendFlowState,
  sendFlowReducer,
  validateSendAmount,
  type SelectedRecipient,
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
    },
    options: { onSuccess: () => void }
  ): void;
}

interface UseSendFlowControllerOptions {
  isOnline: boolean;
  resolvedEnsName?: string | null;
  resetNonce?: number;
  sendMutation: SendMutationPort;
}

export function useSendFlowController({
  isOnline,
  resolvedEnsName,
  resetNonce,
  sendMutation,
}: UseSendFlowControllerOptions) {
  const { formatMessage } = useIntl();
  const [state, dispatch] = useReducer(sendFlowReducer, initialSendFlowState);
  const { amountInput, note, recipient, selectedToken, step } = state;

  useEffect(() => {
    if (resetNonce !== undefined) dispatch({ type: "reset-tab" });
  }, [resetNonce]);

  const validation = useMemo(
    () => validateSendAmount(selectedToken, amountInput),
    [amountInput, selectedToken]
  );
  const recipientDisplayName = recipient
    ? resolvedEnsName || recipient.ensName || formatAddress(recipient.address)
    : "";
  const canAdvance =
    step === "recipient"
      ? Boolean(recipient)
      : step === "amount"
        ? validation.valid
        : isOnline && !sendMutation.isPending;
  const primaryLabel =
    step === "recipient"
      ? formatMessage({ id: "app.send.continue" })
      : step === "amount"
        ? formatMessage({ id: "app.send.reviewCta" })
        : formatMessage({ id: "app.send.sendCta" });

  const executeSend = () => {
    if (!recipient || !selectedToken) return;
    sendMutation.mutate(
      {
        token: selectedToken,
        to: recipient.address,
        amount: validation.parsedAmount,
        note,
      },
      { onSuccess: () => dispatch({ type: "reset-after-send" }) }
    );
  };

  return {
    ...state,
    canAdvance,
    isOnline,
    isSending: sendMutation.isPending,
    primaryLabel,
    recipientDisplayName,
    validation,
    acts: {
      back: () => dispatch({ type: "back" }),
      changeAmount: (amount: string) => dispatch({ type: "change-amount", amount }),
      changeNote: (nextNote: string) => dispatch({ type: "change-note", note: nextNote }),
      closeConfirm: () => dispatch({ type: "close-confirm" }),
      editAmount: () => dispatch({ type: "edit-amount" }),
      editRecipient: () => dispatch({ type: "edit-recipient" }),
      executeSend,
      max: () => {
        if (selectedToken?.balance) {
          dispatch({
            type: "change-amount",
            amount: formatUnits(selectedToken.balance, selectedToken.decimals),
          });
        }
      },
      primary: () => dispatch(step === "review" ? { type: "open-confirm" } : { type: "advance" }),
      selectMode: (mode: WalletMode) => dispatch({ type: "select-mode", mode }),
      selectRecipient: (nextRecipient: SelectedRecipient) =>
        dispatch({ type: "select-recipient", recipient: nextRecipient }),
      selectToken: (token: SendableTokenBalance | null) =>
        dispatch({ type: "select-token", token }),
      startSend: (token: SendableTokenBalance) => dispatch({ type: "start-send", token }),
    },
  };
}
