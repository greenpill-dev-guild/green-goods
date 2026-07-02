import {
  type Address,
  Alert,
  ConfirmDialog,
  cn,
  formatAddress,
  formatTokenAmount,
  type SendableTokenBalance,
  useCurrentChain,
  useEnsName,
  useOffline,
  useSendableTokens,
  useSendToken,
  useUser,
} from "@green-goods/shared";
import { RiArrowLeftLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { AmountStep } from "./Send/AmountStep";
import { BalanceView } from "./Send/BalanceView";
import { ReceiveView } from "./Send/ReceiveView";
import { RecipientPicker } from "./Send/RecipientPicker";
import { ReviewStep } from "./Send/ReviewStep";
import type { SelectedRecipient, SendStep } from "./Send/types";
import { validateSendAmount } from "./Send/validation";

type WalletMode = "balance" | "send" | "receive";

const WALLET_MODES: ReadonlyArray<{ value: WalletMode; labelId: string }> = [
  { value: "balance", labelId: "app.send.mode.balance" },
  { value: "send", labelId: "app.send.mode.send" },
  { value: "receive", labelId: "app.send.mode.receive" },
];

interface SendTabProps {
  /** Bumped by the parent when the Tokens tab is (re)selected, to reset to Balance. */
  resetNonce?: number;
}

export const SendTab: React.FC<SendTabProps> = ({ resetNonce }) => {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const { isOnline } = useOffline();
  const { tokens, isLoading } = useSendableTokens(primaryAddress as Address | null, chainId);
  const sendMutation = useSendToken();

  const [mode, setMode] = useState<WalletMode>("balance");
  const [step, setStep] = useState<SendStep>("recipient");
  const [recipient, setRecipient] = useState<SelectedRecipient | null>(null);
  const [selectedToken, setSelectedToken] = useState<SendableTokenBalance | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Re-tapping the Tokens tab returns to the Balance home (keeping any chosen
  // recipient so a resumed send isn't destroyed).
  useEffect(() => {
    if (resetNonce === undefined) return;
    setMode("balance");
    setStep("recipient");
  }, [resetNonce]);

  // Always resolve the recipient's ENS name for display — garden members carry no
  // pre-resolved name, so without this the "Sending to" line shows a raw address.
  const { data: resolvedEnsName } = useEnsName(recipient?.address ?? undefined);
  const recipientDisplayName = recipient
    ? resolvedEnsName || recipient.ensName || formatAddress(recipient.address)
    : "";

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

  // From the Balance list: jump into the send flow with the token pre-selected.
  const startSendWithToken = (token: SendableTokenBalance) => {
    setSelectedToken(token);
    setStep("recipient");
    setMode("send");
  };

  const executeSend = () => {
    if (!recipient || !selectedToken) return;
    sendMutation.mutate(
      { token: selectedToken, to: recipient.address, amount: validation.parsedAmount, note },
      { onSuccess: () => resetForm() }
    );
  };

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
      {/* Send / Receive toggle */}
      <div className="p-4 pb-0">
        <div
          role="tablist"
          aria-label={formatMessage({ id: "app.wallet.tab.tokens" })}
          className="flex rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-0.5"
        >
          {WALLET_MODES.map(({ value, labelId }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
                mode === value
                  ? "bg-bg-white-0 text-text-strong-950 shadow-sm"
                  : "text-text-sub-600 hover:text-text-strong-950"
              )}
            >
              {formatMessage({ id: labelId })}
            </button>
          ))}
        </div>
      </div>

      {mode === "balance" ? (
        <BalanceView tokens={tokens} isLoading={isLoading} onSend={startSendWithToken} />
      ) : mode === "receive" ? (
        <ReceiveView />
      ) : (
        <>
          <div className="flex-1">
            {/* Offline is surfaced up front, not only at the review step —
                the send cannot complete without a connection, so the user
                should know before building the transaction. */}
            {!isOnline ? (
              <div className="px-4 pt-4">
                <Alert variant="warning">{formatMessage({ id: "app.send.review.offline" })}</Alert>
              </div>
            ) : null}
            {step !== "recipient" && recipient ? (
              <button
                type="button"
                onClick={() => setStep("recipient")}
                title={recipient.address}
                className="flex w-full items-center gap-1 px-4 pt-4 text-left text-xs text-text-soft-400 hover:text-text-sub-600"
              >
                <span className="min-w-0 flex-1 truncate">
                  {formatMessage({ id: "app.send.recipient.selected" })}: {recipientDisplayName}
                </span>
                <RiPencilLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
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
                recipientLabel={recipientDisplayName}
                token={selectedToken}
                parsedAmount={validation.parsedAmount}
                note={note}
                onNoteChange={setNote}
                onEditRecipient={() => setStep("recipient")}
                onEditAmount={() => setStep("amount")}
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
                "bg-primary-base text-primary-accent-foreground hover:bg-primary-darker"
              )}
            >
              {sendMutation.isPending ? (
                <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {primaryLabel}
            </button>
          </div>
        </>
      )}

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
              recipient: recipientDisplayName,
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
