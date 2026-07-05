import {
  type Address,
  formatTokenAmount,
  FormField,
  getVaultAssetSymbol,
  NativeSelect,
  TextInput,
  TxInlineFeedback,
  useCookieJarDeposit,
  useGardenCookieJars,
  useTxErrorMessages,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";

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

  useEffect(() => {
    if (!depositMutation.error) return;
    resetDepositMutation();
  }, [depositAmount, depositJar, depositMutation.error, resetDepositMutation]);

  const depositTxError = useTxErrorMessages(depositMutation.error);

  const belowMinDeposit =
    selectedDepositJar &&
    !depositInputError &&
    parsedDepositAmount > 0n &&
    parsedDepositAmount < selectedDepositJar.minDeposit;

  const isPending = depositMutation.isPending;
  const handleDeposit = () => {
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
  };

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => !open && !isPending && onClose()}
      // Workspace tone — mounted from the Community payouts panel.
      tone="community"
      title={formatMessage({
        id: "app.cookieJar.depositModal.title",
        defaultMessage: "Fund Cookie Jar",
      })}
      description={formatMessage({
        id: "app.cookieJar.depositModal.description",
        defaultMessage: "Fund a jar from your connected wallet.",
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
            disabled={!selectedDepositJar || parsedDepositAmount <= 0n || Boolean(belowMinDeposit)}
            onClick={handleDeposit}
          >
            {formatMessage({ id: "app.cookieJar.deposit", defaultMessage: "Deposit" })}
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Jar select */}
        <FormField
          label={formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie Jar" })}
          htmlFor="deposit-jar-select"
        >
          <NativeSelect
            id="deposit-jar-select"
            surface="admin"
            value={depositJar}
            onChange={(e) => setDepositJar(e.target.value)}
          >
            <option value="">--</option>
            {jars.map((jar) => (
              <option key={jar.jarAddress} value={jar.jarAddress}>
                {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                {formatTokenAmount(jar.balance, jar.decimals)})
              </option>
            ))}
          </NativeSelect>
        </FormField>

        {/* Amount */}
        <FormField
          label={formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
          htmlFor="deposit-amount"
          error={
            depositInputError
              ? formatMessage({ id: depositInputError })
              : belowMinDeposit
                ? formatMessage(
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
                  )
                : undefined
          }
        >
          <TextInput
            id="deposit-amount"
            surface="admin"
            type="text"
            inputMode="decimal"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.00"
            aria-invalid={Boolean(depositInputError || belowMinDeposit)}
            invalid={Boolean(depositInputError || belowMinDeposit)}
          />
        </FormField>

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
              : {formatTokenAmount(selectedDepositJar.minDeposit, selectedDepositJar.decimals)}{" "}
              {getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined)}
            </p>
          )}
        </div>

        {/* Error feedback */}
        <TxInlineFeedback
          visible={Boolean(depositMutation.error)}
          severity={depositTxError.view.severity}
          title={depositTxError.title}
          message={depositTxError.message}
          reserveClassName="min-h-[5.5rem]"
        />
      </div>
    </AdminDialog>
  );
}
