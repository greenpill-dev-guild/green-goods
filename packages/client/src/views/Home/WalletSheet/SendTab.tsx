import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { SheetActions } from "@green-goods/shared/components/Dialog/SheetActions";
import { isCeloGoodDollar, isSendableTokenAvailable } from "@green-goods/shared/config/tokens";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  getNetworkConfigForChain,
  useCurrentChain,
} from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useSendableTokens } from "@green-goods/shared/hooks/blockchain/useSendableTokens";
import { useSendToken } from "@green-goods/shared/hooks/blockchain/useSendToken";
import { useCeloWallet } from "@green-goods/shared/hooks/client-ui/wallet/useCeloWallet";
import { useSendFlowController } from "@green-goods/shared/hooks/client-ui/wallet/useSendFlowController";
import type { WalletMode } from "@green-goods/shared/modules/wallet/send-flow";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowLeftLine, RiPencilLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { PWA_SHEET_SCROLL_CLASSNAME } from "@/components/Pwa/sheetScrollStyles";
import { AmountStep } from "./Send/AmountStep";
import { BalanceView } from "./Send/BalanceView";
import { CeloWalletStatus } from "./Send/CeloWalletStatus";
import { GoodDollarFeeSummary } from "./Send/GoodDollarFeeSummary";
import { ReceiveView } from "./Send/ReceiveView";
import { RecipientPicker } from "./Send/RecipientPicker";
import { ReviewStep } from "./Send/ReviewStep";
import { WalletSupportHistory } from "./Send/WalletSupportHistory";

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
  const { formatMessage, locale } = useIntl();
  const { primaryAddress, authMode } = useUser();
  const chainId = useCurrentChain();
  const isOnline = useOnlineStatus();
  const { tokens, isLoading, isError, refetch } = useSendableTokens(
    primaryAddress as Address | null,
    chainId
  );
  const sendMutation = useSendToken();
  const celoWallet = useCeloWallet();
  const { data: gardens } = useGardens();
  const eligibleCeloRecipients = React.useMemo(
    () =>
      new Set(
        gardens?.flatMap((garden) => garden.gardeners.map((address) => address.toLowerCase()))
      ),
    [gardens]
  );
  const allTokens = React.useMemo(() => {
    const available = tokens.filter(
      (token) =>
        isSendableTokenAvailable(token) &&
        (authMode !== "passkey" || token.chainId !== 42220 || isCeloGoodDollar(token))
    );
    const celoToken = celoWallet.token;
    return isSendableTokenAvailable(celoToken) &&
      !available.some(
        (token) =>
          token.chainId === celoToken.chainId &&
          token.address.toLowerCase() === celoToken.address.toLowerCase()
      )
      ? [...available, celoToken]
      : available;
  }, [tokens, celoWallet.token, authMode]);
  const [receiveCelo, setReceiveCelo] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
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
    recipientEligible,
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
    eligibleCeloRecipients,
  });

  React.useEffect(() => setRecipientAddress(recipient?.address), [recipient?.address]);
  React.useEffect(() => {
    if (confirmWasOpen.current && !showConfirm)
      contentRef.current
        ?.querySelector<HTMLButtonElement>(
          '[data-component="SheetActions"] [data-action="primary"]'
        )
        ?.focus();
    confirmWasOpen.current = showConfirm;
  }, [showConfirm]);

  return (
    <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
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
        <div className={PWA_SHEET_SCROLL_CLASSNAME}>
          <BalanceView
            tokens={allTokens.map((token) => ({
              ...token,
              label: `${token.label} · ${getNetworkConfigForChain(token.chainId).name}`,
              ...(token.chainId === 42220
                ? {
                    sendDisabled: !celoWallet.canSend || !token.balance,
                    balanceLoading: celoWallet.balanceLoading,
                    details: <CeloWalletStatus wallet={celoWallet} />,
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
        <div className={PWA_SHEET_SCROLL_CLASSNAME}>
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
          <div className={PWA_SHEET_SCROLL_CLASSNAME} data-scroll-edge="bottom">
            {!isOnline ? (
              <div className="px-4 pt-4">
                <Alert variant="warning">{formatMessage({ id: "app.send.review.offline" })}</Alert>
              </div>
            ) : null}
            {step !== "recipient" && recipient ? (
              <div className="px-4 pt-3">
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="compact"
                  onClick={acts.editRecipient}
                  title={recipient.address}
                  trailingIcon={
                    <RiPencilLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  }
                  // The negative margin keeps the label on the content edge at rest.
                  className="-ml-3 max-w-[calc(100%+0.75rem)]"
                >
                  <span className="min-w-0 truncate">
                    {formatMessage({ id: "app.send.recipient.selected" })}: {recipientDisplayName}
                  </span>
                </Button>
              </div>
            ) : null}

            {step === "recipient" ? (
              <RecipientPicker
                selectedAddress={recipient?.address}
                onSelect={acts.selectRecipient}
                gDollarOnly={Boolean(selectedToken && isCeloGoodDollar(selectedToken))}
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
                {!recipientEligible ? (
                  <div className="px-4 pb-3">
                    <Alert variant="warning">
                      {formatMessage({ id: "app.send.recipient.gardenerOnly" })}
                    </Alert>
                  </div>
                ) : null}
                {!celoWallet.canSend && isOnline ? (
                  <div className="px-4 pb-3">
                    <CeloWalletStatus wallet={celoWallet} />
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
          {/* Step navigation keeps Back and the next step in one row (DL-016). */}
          <SheetActions
            layout="steps"
            safeArea
            secondary={
              step !== "recipient"
                ? {
                    label: formatMessage({ id: "app.send.back" }),
                    icon: <RiArrowLeftLine className="h-4 w-4" aria-hidden />,
                    onClick: acts.back,
                  }
                : undefined
            }
            primary={{
              label: primaryLabel,
              onClick: acts.primary,
              disabled: !canAdvance,
              loading: isSending,
            }}
          />
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
              amount: formatTokenAmount(
                validation.parsedAmount,
                selectedToken.decimals,
                selectedToken.decimals,
                locale
              ),
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
