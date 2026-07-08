import {
  type Address,
  formatTokenAmount,
  FormField,
  getVaultAssetSymbol,
  NativeSelect,
  Textarea,
  TextInput,
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
  defaultJarAddress?: Address | null;
}

export function CookieJarWithdrawModal({
  isOpen,
  onClose,
  gardenAddress,
  defaultJarAddress = null,
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

  useEffect(() => {
    if (!isOpen) return;
    setWithdrawJar(defaultJarAddress ?? "");
    setWithdrawAmount("");
    setWithdrawPurpose("");
    resetWithdrawMutation();
  }, [defaultJarAddress, isOpen, resetWithdrawMutation]);

  const activeJars = useMemo(() => jars.filter((jar) => !jar.isPaused), [jars]);

  const selectedWithdrawJar = useMemo(
    () => activeJars.find((j) => j.jarAddress === withdrawJar),
    [activeJars, withdrawJar]
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

  useEffect(() => {
    if (!withdrawMutation.error) return;
    resetWithdrawMutation();
  }, [withdrawAmount, withdrawJar, withdrawPurpose, withdrawMutation.error, resetWithdrawMutation]);

  const withdrawTxError = useTxErrorMessages(withdrawMutation.error);

  useEffect(() => {
    if (!isOpen) return;
    if (withdrawJar && activeJars.some((jar) => jar.jarAddress === withdrawJar)) return;
    if (defaultJarAddress && activeJars.some((jar) => jar.jarAddress === defaultJarAddress)) {
      setWithdrawJar(defaultJarAddress);
      return;
    }
    if (activeJars.length === 1) {
      setWithdrawJar(activeJars[0].jarAddress);
      return;
    }
    if (withdrawJar) setWithdrawJar("");
  }, [activeJars, defaultJarAddress, isOpen, withdrawJar]);

  const isPending = withdrawMutation.isPending;
  const handleWithdraw = () => {
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
  };

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      // Workspace tone — mounted from the Community payouts panel.
      tone="community"
      title={formatMessage({
        id: "app.cookieJar.withdrawModal.title",
        defaultMessage: "Cookie Jar Withdrawal",
      })}
      description={formatMessage({
        id: "app.cookieJar.withdrawModal.description",
        defaultMessage: "Withdraw from a jar and record what the funds are for.",
      })}
      preventClose={isPending}
      actions={
        <>
          <AdminButton type="button" variant="text" onClick={onClose} disabled={isPending}>
            {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </AdminButton>
          <AdminButton
            type="button"
            loading={isPending}
            disabled={!selectedWithdrawJar || parsedWithdrawAmount <= 0n}
            onClick={handleWithdraw}
          >
            {formatMessage({ id: "app.cookieJar.withdraw", defaultMessage: "Withdraw" })}
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Jar select */}
        <FormField
          label={formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie Jar" })}
          htmlFor="withdraw-jar-select"
        >
          <NativeSelect
            id="withdraw-jar-select"
            surface="admin"
            value={withdrawJar}
            onChange={(e) => setWithdrawJar(e.target.value)}
          >
            <option value="">--</option>
            {activeJars.map((jar) => (
              <option key={jar.jarAddress} value={jar.jarAddress}>
                {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                {formatTokenAmount(jar.balance, jar.decimals)})
              </option>
            ))}
          </NativeSelect>
        </FormField>

        {/* Amount + Max */}
        <FormField
          label={formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
          htmlFor="withdraw-amount"
          error={withdrawInputError ? formatMessage({ id: withdrawInputError }) : undefined}
        >
          <div className="flex items-center gap-2">
            <TextInput
              id="withdraw-amount"
              surface="admin"
              type="text"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              aria-invalid={Boolean(withdrawInputError)}
              invalid={Boolean(withdrawInputError)}
            />
            <AdminButton
              variant="outlined"
              size="sm"
              className="min-w-14"
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
        </FormField>

        {/* Purpose */}
        <FormField
          label={formatMessage({ id: "app.cookieJar.purpose", defaultMessage: "Purpose" })}
          htmlFor="withdraw-purpose"
        >
          <Textarea
            id="withdraw-purpose"
            surface="admin"
            value={withdrawPurpose}
            onChange={(e) => setWithdrawPurpose(e.target.value)}
            placeholder={formatMessage({
              id: "app.cookieJar.purposePlaceholder",
              defaultMessage: "Describe what these funds will be used for...",
            })}
            rows={2}
          />
        </FormField>

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
