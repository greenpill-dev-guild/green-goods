import {
  type Address,
  ConfirmDialog,
  cn,
  formatAddress,
  formatTokenAmount,
  type SendableTokenBalance,
  useCurrentChain,
  useOffline,
  useSendableTokens,
  useSendToken,
  useUser,
} from "@green-goods/shared";
import { RiArrowLeftLine, RiLoader4Line } from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { AmountStep } from "./Send/AmountStep";
import { RecipientPicker } from "./Send/RecipientPicker";
import { ReviewStep } from "./Send/ReviewStep";
import type { SelectedRecipient, SendStep } from "./Send/types";
import { validateSendAmount } from "./Send/validation";

export const SendTab: React.FC = () => {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const { isOnline } = useOffline();
  const { tokens, isLoading } = useSendableTokens(primaryAddress as Address | null, chainId);
  const sendMutation = useSendToken();

  const [step, setStep] = useState<SendStep>("recipient");
  const [recipient, setRecipient] = useState<SelectedRecipient | null>(null);
  const [selectedToken, setSelectedToken] = useState<SendableTokenBalance | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const validation = useMemo(
    () => validateSendAmount(selectedToken, amountInput),
    [selectedToken, amountInput]
  );

  const resetForm = () => {
    setStep("recipient");
    setRecipient(null);
    setSelectedToken(null);
    setAmountInput("");
    setNote("");
  };

  const handleMax = () => {
    if (selectedToken?.balance) {
      setAmountInput(formatUnits(selectedToken.balance, selectedToken.decimals));
    }
  };

  const executeSend = () => {
    if (!recipient || !selectedToken) return;
    sendMutation.mutate(
      { token: selectedToken, to: recipient.address, amount: validation.parsedAmount, note },
      { onSuccess: () => resetForm() }
    );
  };

  const recipientLabel = recipient ? recipient.ensName || formatAddress(recipient.address) : "";

  // Action-bar enabled state per step.
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

  const onPrimary = () => {
    if (step === "recipient") setStep("amount");
    else if (step === "amount") setStep("review");
    else setShowConfirm(true);
  };

  const onBack = () => {
    if (step === "amount") setStep("recipient");
    else if (step === "review") setStep("amount");
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        {step !== "recipient" && recipient ? (
          <p className="truncate px-4 pt-4 text-xs text-text-soft-400" title={recipient.address}>
            {formatMessage({ id: "app.send.recipient.selected" })}: {recipientLabel}
          </p>
        ) : null}

        {step === "recipient" ? (
          <RecipientPicker
            selectedAddress={recipient?.address}
            onSelect={(next) => {
              setRecipient(next);
              setStep("amount");
            }}
          />
        ) : null}

        {step === "amount" ? (
          <AmountStep
            tokens={tokens}
            isLoading={isLoading}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
            amountInput={amountInput}
            onAmountChange={setAmountInput}
            validation={validation}
            onMax={handleMax}
          />
        ) : null}

        {step === "review" && recipient && selectedToken ? (
          <ReviewStep
            recipient={recipient}
            token={selectedToken}
            parsedAmount={validation.parsedAmount}
            note={note}
            onNoteChange={setNote}
            isOnline={isOnline}
          />
        ) : null}
      </div>

      {/* Sticky action bar (the drawer footer is parent-owned, so SendTab owns its own). */}
      <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t border-stroke-soft-200 bg-bg-white-0 p-4">
        {step !== "recipient" ? (
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-11 items-center gap-1 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-sub-600 hover:bg-bg-weak-50"
          >
            <RiArrowLeftLine className="h-4 w-4" aria-hidden />
            {formatMessage({ id: "app.send.back" })}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimary}
          disabled={!canAdvance}
          aria-busy={sendMutation.isPending || undefined}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
            "bg-primary-base text-static-white hover:bg-primary-darker"
          )}
        >
          {sendMutation.isPending ? (
            <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {primaryLabel}
        </button>
      </div>

      {recipient && selectedToken ? (
        <ConfirmDialog
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title={formatMessage({ id: "app.send.confirm.title" })}
          description={formatMessage(
            {
              id: selectedToken.confersGovernance
                ? "app.send.confirm.governanceDescription"
                : "app.send.confirm.description",
            },
            {
              amount: formatTokenAmount(validation.parsedAmount, selectedToken.decimals),
              symbol: selectedToken.symbol,
              recipient: recipientLabel,
            }
          )}
          confirmLabel={formatMessage({ id: "app.send.sendCta" })}
          variant={selectedToken.confersGovernance ? "warning" : "default"}
          isLoading={sendMutation.isPending}
          onConfirm={() => {
            setShowConfirm(false);
            executeSend();
          }}
        />
      ) : null}
    </div>
  );
};
