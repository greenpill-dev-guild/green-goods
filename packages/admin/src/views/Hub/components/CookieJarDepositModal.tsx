import { TxInlineFeedback } from "@green-goods/shared/components/feedback/TxInlineFeedback";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useCookieJarDeposit } from "@green-goods/shared/hooks/cookie-jar/useCookieJarDeposit";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useTxErrorMessages } from "@green-goods/shared/hooks/utils/useTxErrorMessages";
import type { Address } from "@green-goods/shared/types/domain";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import { AdminButton } from "@/components/AdminButton";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";

interface CookieJarDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  defaultJarAddress?: Address | null;
}

export function CookieJarDepositModal({
  isOpen,
  onClose,
  gardenAddress,
  defaultJarAddress = null,
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
    setDepositJar(defaultJarAddress ?? "");
    setDepositAmount("");
    resetDepositMutation();
  }, [defaultJarAddress, isOpen, resetDepositMutation]);

  useEffect(() => {
    if (!isOpen || depositJar) return;
    if (defaultJarAddress && jars.some((jar) => jar.jarAddress === defaultJarAddress)) {
      setDepositJar(defaultJarAddress);
      return;
    }
    if (jars.length === 1) {
      setDepositJar(jars[0].jarAddress);
    }
  }, [defaultJarAddress, depositJar, isOpen, jars]);

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
            disabled={!selectedDepositJar || parsedDepositAmount <= 0n}
            onClick={handleDeposit}
          >
            {formatMessage({ id: "app.cookieJar.deposit", defaultMessage: "Deposit" })}
          </AdminButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Jar switcher — compact single-select between the garden's jars (e.g. DAI / WETH) */}
        {jars.length > 1 && (
          <FormField
            label={formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie Jar" })}
          >
            <AdminChoiceGroup
              ariaLabel={formatMessage({
                id: "app.cookieJar.title",
                defaultMessage: "Cookie Jar",
              })}
              columns={2}
              value={depositJar || null}
              onChange={setDepositJar}
              options={jars.map((jar) => {
                const jarSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
                return {
                  value: jar.jarAddress,
                  label: jarSymbol,
                  description: `${formatTokenAmount(jar.balance, jar.decimals)} ${jarSymbol}`,
                };
              })}
            />
          </FormField>
        )}

        {/* Amount in the jar — the prominent number for the selected jar */}
        {selectedDepositJar && (
          <div className="rounded-lg bg-bg-weak px-4 py-3">
            <p className="text-xs font-medium text-text-soft">
              {formatMessage({ id: "app.cookieJar.balance", defaultMessage: "Jar Balance" })}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-strong">
              {formatTokenAmount(selectedDepositJar.balance, selectedDepositJar.decimals)}{" "}
              <span className="text-base font-medium text-text-sub">
                {getVaultAssetSymbol(selectedDepositJar.assetAddress, undefined)}
              </span>
            </p>
          </div>
        )}

        {/* Amount */}
        <FormField
          label={formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
          htmlFor="deposit-amount"
          error={depositInputError ? formatMessage({ id: depositInputError }) : undefined}
        >
          <TextInput
            id="deposit-amount"
            surface="admin"
            type="text"
            inputMode="decimal"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.00"
            aria-invalid={Boolean(depositInputError)}
            invalid={Boolean(depositInputError)}
          />
        </FormField>

        {/* Wallet balance */}
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
