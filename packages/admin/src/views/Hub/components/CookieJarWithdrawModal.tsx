import { TxInlineFeedback } from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { useCookieJarWithdraw } from "@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useTxErrorMessages } from "@green-goods/shared/hooks/utils/useTxErrorMessages";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";

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
        <AdminSelect
          id="withdraw-jar-select"
          label={formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie jar" })}
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
        </AdminSelect>

        {/* Amount + Max */}
        <div className="flex items-start gap-2">
          <AdminTextField
            id="withdraw-amount"
            className="min-w-0 flex-1"
            label={formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
            type="text"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="0.00"
            error={withdrawInputError ? formatMessage({ id: withdrawInputError }) : undefined}
            inputProps={{ inputMode: "decimal" }}
          />
          <AdminButton
            variant="outlined"
            size="sm"
            className="mt-2 min-w-14"
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

        {/* Purpose */}
        <AdminTextArea
          id="withdraw-purpose"
          label={formatMessage({ id: "app.cookieJar.purpose", defaultMessage: "Purpose" })}
          value={withdrawPurpose}
          onChange={(e) => setWithdrawPurpose(e.target.value)}
          placeholder={formatMessage({
            id: "app.cookieJar.purposePlaceholder",
            defaultMessage: "Describe what these funds will be used for...",
          })}
          rows={2}
        />

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
