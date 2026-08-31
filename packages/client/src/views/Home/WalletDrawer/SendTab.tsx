import type { Address } from "@green-goods/shared/types/domain";
import { Alert } from "@green-goods/shared/components/Alert";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useSendFlowController } from "@green-goods/shared/hooks/client-ui/wallet/useSendFlowController";
import { useSendableTokens } from "@green-goods/shared/hooks/blockchain/useSendableTokens";
import { useSendToken } from "@green-goods/shared/hooks/blockchain/useSendToken";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import type { WalletMode } from "@green-goods/shared/modules/wallet/send-flow";
import { RiArrowLeftLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { PWA_DRAWER_SCROLL_CLASSNAME } from "@/components/Pwa/drawerScrollStyles";
import { AmountStep } from "./Send/AmountStep";
import { BalanceView } from "./Send/BalanceView";
import { ReceiveView } from "./Send/ReceiveView";
import { RecipientPicker } from "./Send/RecipientPicker";
import { ReviewStep } from "./Send/ReviewStep";

const WALLET_MODES: ReadonlyArray<{ value: WalletMode; labelId: string }> = [
  { value: "balance", labelId: "app.send.mode.balance" },
  { value: "send", labelId: "app.send.mode.send" },
  { value: "receive", labelId: "app.send.mode.receive" },
];

const SEND_ACTION_BAR_CLASSNAME =
  "flex shrink-0 items-center gap-2 border-t border-stroke-soft-200 bg-bg-white-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]";

interface SendTabProps {
  /** Bumped by the parent when the Tokens tab is (re)selected, to reset to Balance. */
  resetNonce?: number;
}

export const SendTab: React.FC<SendTabProps> = ({ resetNonce }) => {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const { isOnline } = useOffline();
  const { tokens, isLoading, isError, refetch } = useSendableTokens(
    primaryAddress as Address | null,
    chainId
  );
  const sendMutation = useSendToken();
  const [recipientAddress, setRecipientAddress] = React.useState<Address | undefined>();
  const { data: resolvedEnsName } = useEnsName(recipientAddress);
  const {
    acts,
    amountInput,
    canAdvance,
    isSending,
    mode,
    note,
    primaryLabel,
    recipient,
    recipientDisplayName,
    selectedToken,
    showConfirm,
    step,
    validation,
  } = useSendFlowController({ isOnline, resolvedEnsName, resetNonce, sendMutation });

  React.useEffect(() => setRecipientAddress(recipient?.address), [recipient?.address]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Send / Receive toggle */}
      <div className="shrink-0 p-4 pb-0">
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
              onClick={() => acts.selectMode(value)}
              className={cn(
                "min-h-11 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
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
        <div className={PWA_DRAWER_SCROLL_CLASSNAME}>
          <BalanceView
            tokens={tokens}
            isLoading={isLoading}
            isError={isError}
            isOnline={isOnline}
            onRetry={refetch}
            onSend={acts.startSend}
          />
        </div>
      ) : mode === "receive" ? (
        <div className={PWA_DRAWER_SCROLL_CLASSNAME}>
          <ReceiveView />
        </div>
      ) : (
        <>
          <div className={PWA_DRAWER_SCROLL_CLASSNAME}>
            {!isOnline ? (
              <div className="px-4 pt-4">
                <Alert variant="warning">{formatMessage({ id: "app.send.review.offline" })}</Alert>
              </div>
            ) : null}
            {step !== "recipient" && recipient ? (
              <button
                type="button"
                onClick={acts.editRecipient}
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
                onSelect={acts.selectRecipient}
              />
            ) : null}

            {step === "amount" ? (
              <AmountStep
                tokens={tokens}
                isLoading={isLoading}
                selectedToken={selectedToken}
                onSelectToken={acts.selectToken}
                amountInput={amountInput}
                onAmountChange={acts.changeAmount}
                validation={validation}
                onMax={acts.max}
              />
            ) : null}

            {step === "review" && recipient && selectedToken ? (
              <ReviewStep
                recipient={recipient}
                recipientLabel={recipientDisplayName}
                token={selectedToken}
                parsedAmount={validation.parsedAmount}
                note={note}
                onNoteChange={acts.changeNote}
                onEditRecipient={acts.editRecipient}
                onEditAmount={acts.editAmount}
              />
            ) : null}
          </div>
          <div className={SEND_ACTION_BAR_CLASSNAME}>
            {step !== "recipient" ? (
              <button
                type="button"
                onClick={acts.back}
                className="flex min-h-11 items-center gap-1 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-sub-600 hover:bg-bg-weak-50"
              >
                <RiArrowLeftLine className="h-4 w-4" aria-hidden />
                {formatMessage({ id: "app.send.back" })}
              </button>
            ) : null}
            <button
              type="button"
              onClick={acts.primary}
              disabled={!canAdvance}
              aria-busy={isSending || undefined}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] disabled:cursor-not-allowed disabled:opacity-60",
                "bg-primary-base text-primary-accent-foreground hover:bg-primary-darker"
              )}
            >
              {isSending ? <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {primaryLabel}
            </button>
          </div>
        </>
      )}

      {recipient && selectedToken ? (
        <ConfirmDialog
          isOpen={showConfirm}
          onClose={acts.closeConfirm}
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
          isLoading={isSending}
          onConfirm={() => {
            acts.closeConfirm();
            acts.executeSend();
          }}
        />
      ) : null}
    </div>
  );
};
