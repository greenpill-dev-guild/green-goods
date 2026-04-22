import {
  type Address,
  Button,
  formatTokenAmount,
  getVaultAssetSymbol,
  TxInlineFeedback,
  useCookieJarWithdraw,
  useGardenCookieJars,
  useTxErrorMessages,
  validateDecimalInput,
} from "@green-goods/shared";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";

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

  const withdrawTxError = useTxErrorMessages(withdrawMutation.error);

  const activeJars = jars.filter((j) => !j.isPaused);
  const isPending = withdrawMutation.isPending;

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      title={formatMessage({
        id: "app.cookieJar.withdrawModal.title",
        defaultMessage: "Cookie Jar Withdrawal",
      })}
    >
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
          <label htmlFor="withdraw-amount" className="block text-sm font-medium text-text-strong">
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
            <AdminButton
              variant="outlined"
              size="sm"
              onClick={() => {
                if (!selectedWithdrawJar) return;
                const max =
                  selectedWithdrawJar.maxWithdrawal < selectedWithdrawJar.balance
                    ? selectedWithdrawJar.maxWithdrawal
                    : selectedWithdrawJar.balance;
                setWithdrawAmount(formatUnits(max, withdrawDecimals));
              }}
            >
              {formatMessage({ id: "app.treasury.max", defaultMessage: "Max" })}
            </AdminButton>
          </div>
          {withdrawInputError && (
            <p className="mt-1.5 text-xs text-error-dark" role="alert">
              {formatMessage({ id: withdrawInputError })}
            </p>
          )}
        </div>

        {/* Purpose */}
        <div>
          <label htmlFor="withdraw-purpose" className="block text-sm font-medium text-text-strong">
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
          severity={withdrawTxError.view.severity}
          title={withdrawTxError.title}
          message={withdrawTxError.message}
          reserveClassName="min-h-[5.5rem]"
        />
      </div>
    </AdminDialog>
  );
}
