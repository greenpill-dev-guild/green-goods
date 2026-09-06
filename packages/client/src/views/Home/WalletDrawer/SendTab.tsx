import type { Address } from "@green-goods/shared/types/domain";
import { Alert } from "@green-goods/shared/components/Alert";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { formatUnits } from "viem";
import {
  getNetworkConfigForChain,
  useCurrentChain,
} from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useSendFlowController } from "@green-goods/shared/hooks/client-ui/wallet/useSendFlowController";
import { useSendableTokens } from "@green-goods/shared/hooks/blockchain/useSendableTokens";
import { useSendToken } from "@green-goods/shared/hooks/blockchain/useSendToken";
import { useCeloWallet } from "@green-goods/shared/hooks/client-ui/wallet/useCeloWallet";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import type { WalletMode } from "@green-goods/shared/modules/wallet/send-flow";
import { RiArrowLeftLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { PWA_DRAWER_SCROLL_CLASSNAME } from "@/components/Pwa/drawerScrollStyles";
import { AmountStep } from "./Send/AmountStep";
import { BalanceView } from "./Send/BalanceView";
import { CeloWalletStatus } from "./Send/CeloWalletStatus";
import { WalletSupportHistory } from "./Send/WalletSupportHistory";
import { GoodDollarFeeSummary } from "./Send/GoodDollarFeeSummary";
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
  const { primaryAddress, authMode } = useUser();
  const chainId = useCurrentChain();
  const { isOnline } = useOffline();
  const { tokens, isLoading, isError, refetch } = useSendableTokens(
    primaryAddress as Address | null,
    chainId
  );
  const sendMutation = useSendToken();
  const celoWallet = useCeloWallet();
  const allTokens = React.useMemo(() => [...tokens, celoWallet.token], [tokens, celoWallet.token]);
  const [receiveCelo, setReceiveCelo] = React.useState(false);
  const primaryButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmWasOpen = React.useRef(false);
  const [recipientAddress, setRecipientAddress] = React.useState<Address | undefined>();
  const { data: resolvedEnsName } = useEnsName(recipientAddress);
  const {
    acts,
    amountInput,
    canAdvance,
    canMax,
    feeQuote,
    feeLoading,
    feeError,
    feeInsufficient,
    feeChanged,
    retryFee,
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
  } = useSendFlowController({
    isOnline,
    resolvedEnsName,
    resetNonce,
    sendMutation,
    tokens: allTokens,
    canSendCelo: celoWallet.canSend,
  });

  React.useEffect(() => setRecipientAddress(recipient?.address), [recipient?.address]);
  React.useEffect(() => {
    if (confirmWasOpen.current && !showConfirm) primaryButtonRef.current?.focus();
    confirmWasOpen.current = showConfirm;
  }, [showConfirm]);

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
              onClick={() => {
                if (value === "receive") setReceiveCelo(false);
                acts.selectMode(value);
              }}
              className={cn(
                "min-h-11 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
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
            tokens={allTokens.map((token) => ({
              ...token,
              label: `${token.label} · ${getNetworkConfigForChain(token.chainId).name}`,
              ...(token.chainId === 42220
                ? {
                    sendDisabled: !celoWallet.canSend || !token.balance,
                    balanceLoading: celoWallet.balanceLoading,
                    details: <CeloWalletStatus wallet={celoWallet} showRetry />,
                  }
                : {}),
            }))}
            isLoading={isLoading && celoWallet.balanceLoading}
            isError={isError}
            isOnline={isOnline}
            onRetry={() => {
              void refetch();
              void celoWallet.refetch();
            }}
            onSend={acts.startSend}
          />
          <WalletSupportHistory
            receipts={celoWallet.receipts}
            decimals={celoWallet.token.decimals}
            isLoading={celoWallet.historyLoading}
            isError={Boolean(celoWallet.historyError)}
            isOffline={celoWallet.isOffline}
            onRetry={() => void celoWallet.refetch()}
          />
        </div>
      ) : mode === "receive" ? (
        <div className={PWA_DRAWER_SCROLL_CLASSNAME}>
          <fieldset className="mx-4 mt-4 flex gap-4 text-sm text-text-sub-600">
            <legend className="mb-2 text-xs">{formatMessage({ id: "app.receive.network" })}</legend>
            {[false, true].map((celo) => (
              <label key={String(celo)} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="receive-network"
                  checked={receiveCelo === celo}
                  onChange={() => setReceiveCelo(celo)}
                  className="accent-primary-base"
                />
                {getNetworkConfigForChain(celo ? 42220 : chainId).name}
              </label>
            ))}
          </fieldset>
          <ReceiveView
            celo={receiveCelo}
            addressMismatch={celoWallet.readiness === "address-mismatch"}
          />
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
                tokens={allTokens}
                isLoading={isLoading && celoWallet.balanceLoading}
                canSendCelo={celoWallet.canSend}
                selectedToken={selectedToken}
                onSelectToken={acts.selectToken}
                amountInput={amountInput}
                onAmountChange={acts.changeAmount}
                validation={validation}
                onMax={acts.max}
                canMax={canMax}
              />
            ) : null}
            {step !== "recipient" && selectedToken?.chainId === 42220 ? (
              <>
                {!celoWallet.canSend && isOnline ? (
                  <div className="px-4 pb-3">
                    <CeloWalletStatus wallet={celoWallet} showRetry />
                  </div>
                ) : null}
                <GoodDollarFeeSummary
                  quote={feeQuote}
                  decimals={selectedToken.decimals}
                  loading={feeLoading}
                  error={Boolean(feeError)}
                  insufficient={feeInsufficient}
                  changed={feeChanged}
                  sponsored={authMode === "passkey"}
                  onRetry={retryFee}
                  isOnline={isOnline}
                />
              </>
            ) : null}
            {isSending || sendMutation.isError ? (
              <p role="status" aria-live="polite" className="px-4 pb-4 text-sm text-text-sub-600">
                {formatMessage({
                  id: isSending
                    ? selectedToken?.chainId === 42220
                      ? "app.celoWallet.sendPending"
                      : "app.send.sending"
                    : "app.celoWallet.sendFailed",
                })}
              </p>
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
              ref={primaryButtonRef}
              type="button"
              onClick={acts.primary}
              disabled={!canAdvance}
              aria-busy={isSending || undefined}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
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
              amount: formatUnits(validation.parsedAmount, selectedToken.decimals),
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
