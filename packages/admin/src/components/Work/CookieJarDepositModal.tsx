import {
  type Address,
  classifyTxError,
  formatTokenAmount,
  getVaultAssetSymbol,
  isMeaningfulTxErrorMessage,
  useCookieJarDeposit,
  useGardenCookieJars,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";
import { TxInlineFeedback } from "@/components/feedback/TxInlineFeedback";
import { Button } from "@/components/ui/Button";

interface CookieJarDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
}

export function CookieJarDepositModal({
  isOpen,
  onClose,
  gardenAddress,
}: CookieJarDepositModalProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();

  const { jars } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress) && isOpen,
  });

  const depositMutation = useCookieJarDeposit(gardenAddress, { errorMode: "inline" });
  const resetDepositMutation = depositMutation.reset;

  const [depositJar, setDepositJar] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    setDepositJar("");
    setDepositAmount("");
    resetDepositMutation();
  }, [isOpen, resetDepositMutation]);

  const selectedDepositJar = useMemo(
    () => jars.find((j) => j.jarAddress === depositJar),
    [jars, depositJar]
  );

  const depositDecimals = selectedDepositJar?.decimals ?? 18;

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedDepositJar?.assetAddress as Address | undefined,
    query: { enabled: Boolean(primaryAddress && selectedDepositJar) },
  });

  const depositInputError = useMemo(
    () => validateDecimalInput(depositAmount, depositDecimals),
    [depositAmount, depositDecimals]
  );

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount.trim() || depositInputError) return 0n;
    try {
      return parseUnits(depositAmount, depositDecimals);
    } catch {
      return 0n;
    }
  }, [depositAmount, depositInputError, depositDecimals]);

  // Clear mutation error when inputs change
  useEffect(() => {
    if (!depositMutation.error) return;
    resetDepositMutation();
  }, [depositAmount, depositJar, depositMutation.error, resetDepositMutation]);

  const depositTxErrorView = useMemo(
    () => classifyTxError(depositMutation.error),
    [depositMutation.error]
  );
  const depositTxTitle = formatMessage({
    id: depositTxErrorView.titleKey,
    defaultMessage:
      depositTxErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const depositTxMessage =
    depositTxErrorView.kind === "cancelled"
      ? formatMessage({
          id: depositTxErrorView.messageKey,
          defaultMessage: "Transaction was cancelled. Please try again when ready.",
        })
      : isMeaningfulTxErrorMessage(depositTxErrorView.rawMessage)
        ? depositTxErrorView.rawMessage
        : formatMessage({
            id: depositTxErrorView.messageKey,
            defaultMessage: "Something went wrong. Please try again.",
          });

  const belowMinDeposit =
    selectedDepositJar &&
    !depositInputError &&
    parsedDepositAmount > 0n &&
    parsedDepositAmount < selectedDepositJar.minDeposit;

  const isPending = depositMutation.isPending;

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
                id: "app.cookieJar.depositModal.title",
                defaultMessage: "Fund Cookie Jar",
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
                  htmlFor="deposit-jar-select"
                  className="block text-sm font-medium text-text-strong"
                >
                  {formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie Jar" })}
                </label>
                <select
                  id="deposit-jar-select"
                  value={depositJar}
                  onChange={(e) => setDepositJar(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"
                >
                  <option value="">--</option>
                  {jars.map((jar) => (
                    <option key={jar.jarAddress} value={jar.jarAddress}>
                      {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                      {formatTokenAmount(jar.balance, jar.decimals)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="deposit-amount"
                  className="block text-sm font-medium text-text-strong"
                >
                  {formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
                </label>
                <input
                  id="deposit-amount"
                  type="text"
                  inputMode="decimal"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={Boolean(depositInputError)}
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/40 ${
                    depositInputError
                      ? "border-error-base focus:border-error-base"
                      : "border-stroke-sub bg-bg-white focus:border-primary-base"
                  }`}
                />
                {depositInputError && (
                  <p className="mt-1.5 text-xs text-error-dark" role="alert">
                    {formatMessage({ id: depositInputError })}
                  </p>
                )}
                {belowMinDeposit && (
                  <p className="mt-1.5 text-xs text-error-dark" role="alert">
                    {formatMessage(
                      {
                        id: "app.cookieJar.belowMinDeposit",
                        defaultMessage: "Minimum deposit is {amount} {asset}",
                      },
                      {
                        amount: formatTokenAmount(
                          selectedDepositJar.minDeposit,
                          selectedDepositJar.decimals
                        ),
                        asset: getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined),
                      }
                    )}
                  </p>
                )}
              </div>

              {/* Wallet balance + min deposit info */}
              <div className="space-y-1">
                <p className="text-xs text-text-soft">
                  {formatMessage({
                    id: "app.treasury.walletBalance",
                    defaultMessage: "Wallet balance",
                  })}
                  :{" "}
                  {walletBalance
                    ? `${formatTokenAmount(walletBalance.value, walletBalance.decimals)} ${walletBalance.symbol}`
                    : "--"}
                </p>
                {selectedDepositJar && selectedDepositJar.minDeposit > 0n && (
                  <p className="text-xs text-text-soft">
                    {formatMessage({
                      id: "app.cookieJar.minDeposit",
                      defaultMessage: "Min Deposit",
                    })}
                    :{" "}
                    {formatTokenAmount(selectedDepositJar.minDeposit, selectedDepositJar.decimals)}{" "}
                    {getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined)}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                variant="secondary"
                className="w-full"
                loading={isPending}
                disabled={
                  !selectedDepositJar || parsedDepositAmount <= 0n || Boolean(belowMinDeposit)
                }
                onClick={() => {
                  if (!selectedDepositJar || parsedDepositAmount <= 0n) return;
                  depositMutation.mutate(
                    {
                      jarAddress: selectedDepositJar.jarAddress,
                      amount: parsedDepositAmount,
                      assetAddress: selectedDepositJar.assetAddress,
                    },
                    {
                      onSuccess: () => {
                        setDepositAmount("");
                        onClose();
                      },
                    }
                  );
                }}
              >
                {isPending
                  ? formatMessage({
                      id: "app.cookieJar.depositing",
                      defaultMessage: "Depositing...",
                    })
                  : formatMessage({ id: "app.cookieJar.deposit", defaultMessage: "Deposit" })}
              </Button>

              {/* Error feedback */}
              <TxInlineFeedback
                visible={Boolean(depositMutation.error)}
                severity={depositTxErrorView.severity}
                title={depositTxTitle}
                message={depositTxMessage}
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
