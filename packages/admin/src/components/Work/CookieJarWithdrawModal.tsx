import {
  type Address,
  classifyTxError,
  formatTokenAmount,
  getVaultAssetSymbol,
  isMeaningfulTxErrorMessage,
  useCookieJarWithdraw,
  useGardenCookieJars,
  validateDecimalInput,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { TxInlineFeedback } from "@/components/feedback/TxInlineFeedback";
import { Button } from "@/components/ui/Button";

interface CookieJarWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
}

export function CookieJarWithdrawModal({
  isOpen,
  onClose,
  gardenAddress,
}: CookieJarWithdrawModalProps) {
  const { formatMessage } = useIntl();

  const { jars } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress) && isOpen,
  });

  const withdrawMutation = useCookieJarWithdraw(gardenAddress, { errorMode: "inline" });
  const resetWithdrawMutation = withdrawMutation.reset;

  const [withdrawJar, setWithdrawJar] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPurpose, setWithdrawPurpose] = useState("");

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    setWithdrawJar("");
    setWithdrawAmount("");
    setWithdrawPurpose("");
    resetWithdrawMutation();
  }, [isOpen, resetWithdrawMutation]);

  const selectedWithdrawJar = useMemo(
    () => jars.find((j) => j.jarAddress === withdrawJar),
    [jars, withdrawJar]
  );

  const withdrawDecimals = selectedWithdrawJar?.decimals ?? 18;

  const withdrawInputError = useMemo(
    () => validateDecimalInput(withdrawAmount, withdrawDecimals),
    [withdrawAmount, withdrawDecimals]
  );

  const parsedWithdrawAmount = useMemo(() => {
    if (!withdrawAmount.trim() || withdrawInputError) return 0n;
    try {
      return parseUnits(withdrawAmount, withdrawDecimals);
    } catch {
      return 0n;
    }
  }, [withdrawAmount, withdrawInputError, withdrawDecimals]);

  // Clear mutation error when inputs change
  useEffect(() => {
    if (!withdrawMutation.error) return;
    resetWithdrawMutation();
  }, [withdrawAmount, withdrawJar, withdrawPurpose, withdrawMutation.error, resetWithdrawMutation]);

  const withdrawTxErrorView = useMemo(
    () => classifyTxError(withdrawMutation.error),
    [withdrawMutation.error]
  );
  const withdrawTxTitle = formatMessage({
    id: withdrawTxErrorView.titleKey,
    defaultMessage:
      withdrawTxErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const withdrawTxMessage =
    withdrawTxErrorView.kind === "cancelled"
      ? formatMessage({
          id: withdrawTxErrorView.messageKey,
          defaultMessage: "Transaction was cancelled. Please try again when ready.",
        })
      : isMeaningfulTxErrorMessage(withdrawTxErrorView.rawMessage)
        ? withdrawTxErrorView.rawMessage
        : formatMessage({
            id: withdrawTxErrorView.messageKey,
            defaultMessage: "Something went wrong. Please try again.",
          });

  const activeJars = jars.filter((j) => !j.isPaused);
  const isPending = withdrawMutation.isPending;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed z-50 w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 duration-300"
          onPointerDownOutside={(e) => {
            if (isPending) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isPending) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stroke-soft bg-bg-white px-4 py-3 sm:px-6 sm:py-4">
            <Dialog.Title className="text-lg font-semibold text-text-strong">
              {formatMessage({
                id: "app.cookieJar.withdrawModal.title",
                defaultMessage: "Pay Gardeners",
              })}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95"
                aria-label={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 sm:p-6">
            <div className="space-y-4">
              {/* Jar select */}
              <div>
                <label
                  htmlFor="withdraw-jar-select"
                  className="block text-sm font-medium text-text-strong"
                >
                  {formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie Jar" })}
                </label>
                <select
                  id="withdraw-jar-select"
                  value={withdrawJar}
                  onChange={(e) => setWithdrawJar(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"
                >
                  <option value="">--</option>
                  {activeJars.map((jar) => (
                    <option key={jar.jarAddress} value={jar.jarAddress}>
                      {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                      {formatTokenAmount(jar.balance, jar.decimals)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount + Max */}
              <div>
                <label
                  htmlFor="withdraw-amount"
                  className="block text-sm font-medium text-text-strong"
                >
                  {formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="withdraw-amount"
                    type="text"
                    inputMode="decimal"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    aria-invalid={Boolean(withdrawInputError)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/40 ${
                      withdrawInputError
                        ? "border-error-base focus:border-error-base"
                        : "border-stroke-sub bg-bg-white focus:border-primary-base"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedWithdrawJar) return;
                      const max =
                        selectedWithdrawJar.maxWithdrawal < selectedWithdrawJar.balance
                          ? selectedWithdrawJar.maxWithdrawal
                          : selectedWithdrawJar.balance;
                      setWithdrawAmount(formatUnits(max, withdrawDecimals));
                    }}
                    className="min-h-11 min-w-11 rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-xs font-medium text-text-sub hover:bg-bg-weak"
                  >
                    {formatMessage({ id: "app.treasury.max", defaultMessage: "Max" })}
                  </button>
                </div>
                {withdrawInputError && (
                  <p className="mt-1.5 text-xs text-error-dark" role="alert">
                    {formatMessage({ id: withdrawInputError })}
                  </p>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label
                  htmlFor="withdraw-purpose"
                  className="block text-sm font-medium text-text-strong"
                >
                  {formatMessage({ id: "app.cookieJar.purpose", defaultMessage: "Purpose" })}
                </label>
                <textarea
                  id="withdraw-purpose"
                  value={withdrawPurpose}
                  onChange={(e) => setWithdrawPurpose(e.target.value)}
                  placeholder={formatMessage({
                    id: "app.cookieJar.purposePlaceholder",
                    defaultMessage: "Describe what these funds will be used for...",
                  })}
                  className="mt-1.5 w-full resize-none rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"
                  rows={2}
                />
              </div>

              {/* Submit */}
              <Button
                variant="primary"
                className="w-full"
                loading={isPending}
                disabled={!selectedWithdrawJar || parsedWithdrawAmount <= 0n}
                onClick={() => {
                  if (!selectedWithdrawJar || parsedWithdrawAmount <= 0n) return;
                  withdrawMutation.mutate(
                    {
                      jarAddress: selectedWithdrawJar.jarAddress,
                      amount: parsedWithdrawAmount,
                      purpose: withdrawPurpose,
                    },
                    {
                      onSuccess: () => {
                        setWithdrawAmount("");
                        setWithdrawPurpose("");
                        onClose();
                      },
                    }
                  );
                }}
              >
                {isPending
                  ? formatMessage({
                      id: "app.cookieJar.withdrawing",
                      defaultMessage: "Withdrawing...",
                    })
                  : formatMessage({ id: "app.cookieJar.withdraw", defaultMessage: "Withdraw" })}
              </Button>

              {/* Error feedback */}
              <TxInlineFeedback
                visible={Boolean(withdrawMutation.error)}
                severity={withdrawTxErrorView.severity}
                title={withdrawTxTitle}
                message={withdrawTxMessage}
                reserveClassName="min-h-[5.5rem]"
              />
            </div>
          </div>

          {/* Mobile drag indicator */}
          <div className="flex justify-center pb-2 pt-1 sm:hidden" aria-hidden="true">
            <div className="h-1 w-12 rounded-full bg-stroke-sub" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
