import {
  type Address,
  Button,
  classifyTxError,
  DialogShell,
  formatTokenAmount,
  getVaultAssetSymbol,
  isMeaningfulTxErrorMessage,
  TxInlineFeedback,
  useCookieJarDeposit,
  useGardenCookieJars,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";

interface CookieJarDepositDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

export function CookieJarDepositDialog({
  isOpen,
  onClose,
  gardenAddress,
  gardenName,
}: CookieJarDepositDialogProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();

  const { jars, isLoading: isLoadingJars } = useGardenCookieJars(gardenAddress, {
    enabled: Boolean(gardenAddress) && isOpen,
  });

  const depositMutation = useCookieJarDeposit(gardenAddress, { errorMode: "inline" });
  const [jarAddress, setJarAddress] = useState<string>("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setJarAddress(jars[0]?.jarAddress ?? "");
    setAmount("");
    depositMutation.reset();
  }, [isOpen, jars, depositMutation.reset]);

  const selectedJar = useMemo(
    () => jars.find((j) => j.jarAddress === jarAddress),
    [jars, jarAddress]
  );
  const decimals = selectedJar?.decimals ?? 18;

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedJar?.assetAddress as Address | undefined,
    query: { enabled: Boolean(primaryAddress && selectedJar) },
  });

  const inputError = useMemo(() => validateDecimalInput(amount, decimals), [amount, decimals]);
  const parsedAmount = useMemo(() => {
    if (!amount.trim() || inputError) return 0n;
    try {
      return parseUnits(amount, decimals);
    } catch {
      return 0n;
    }
  }, [amount, inputError, decimals]);

  useEffect(() => {
    if (depositMutation.error) depositMutation.reset();
  }, [amount, jarAddress, depositMutation.error, depositMutation.reset]);

  const belowMin =
    selectedJar && !inputError && parsedAmount > 0n && parsedAmount < selectedJar.minDeposit;

  const txErrorView = useMemo(
    () => classifyTxError(depositMutation.error),
    [depositMutation.error]
  );
  const txErrorTitle = formatMessage({
    id: txErrorView.titleKey,
    defaultMessage:
      txErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const txErrorMessage = isMeaningfulTxErrorMessage(txErrorView.rawMessage)
    ? txErrorView.rawMessage
    : formatMessage({
        id: txErrorView.messageKey,
        defaultMessage: "Something went wrong. Please try again.",
      });

  const handleSubmit = () => {
    if (!selectedJar || parsedAmount <= 0n) return;
    depositMutation.mutate(
      {
        jarAddress: selectedJar.jarAddress,
        amount: parsedAmount,
        assetAddress: selectedJar.assetAddress,
      },
      {
        onSuccess: () => {
          setAmount("");
          onClose();
        },
      }
    );
  };

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="md"
      title={formatMessage(
        {
          id: "public.fund.cookieJarTitle",
          defaultMessage: "Fund Cookie Jar · {garden}",
        },
        { garden: gardenName }
      )}
      description={formatMessage({
        id: "public.fund.cookieJarDescription",
        defaultMessage: "Cookie jars directly reward gardeners for verified regenerative work.",
      })}
      preventClose={depositMutation.isPending}
    >
      {!primaryAddress ? (
        <p className="py-6 text-center text-sm text-text-sub">
          {formatMessage({
            id: "public.fund.connectToDeposit",
            defaultMessage: "Connect your wallet to deposit.",
          })}
        </p>
      ) : isLoadingJars ? (
        <p className="py-6 text-center text-sm text-text-sub">
          {formatMessage({
            id: "public.fund.loadingJars",
            defaultMessage: "Loading this garden's cookie jars…",
          })}
        </p>
      ) : jars.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-sub">
          {formatMessage({
            id: "public.fund.noCookieJars",
            defaultMessage: "This garden doesn't have an active cookie jar yet.",
          })}
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="cookie-jar-select"
              className="block text-sm font-medium text-text-strong"
            >
              {formatMessage({ id: "app.cookieJar.title", defaultMessage: "Cookie Jar" })}
            </label>
            <select
              id="cookie-jar-select"
              value={jarAddress}
              onChange={(e) => setJarAddress(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"
            >
              {jars.map((jar) => (
                <option key={jar.jarAddress} value={jar.jarAddress}>
                  {getVaultAssetSymbol(jar.assetAddress, undefined)} (
                  {formatTokenAmount(jar.balance, jar.decimals)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="cookie-jar-amount"
              className="block text-sm font-medium text-text-strong"
            >
              {formatMessage({ id: "app.cookieJar.amount", defaultMessage: "Amount" })}
            </label>
            <input
              id="cookie-jar-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={depositMutation.isPending}
              aria-invalid={Boolean(inputError)}
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-base/40 ${
                inputError
                  ? "border-error-base focus:border-error-base"
                  : "border-stroke-sub bg-bg-white focus:border-primary-base"
              }`}
            />
            {inputError && (
              <p className="mt-1.5 text-xs text-error-dark" role="alert">
                {formatMessage({ id: inputError })}
              </p>
            )}
            {belowMin && selectedJar && (
              <p className="mt-1.5 text-xs text-error-dark" role="alert">
                {formatMessage(
                  {
                    id: "app.cookieJar.belowMinDeposit",
                    defaultMessage: "Minimum deposit is {amount} {asset}",
                  },
                  {
                    amount: formatTokenAmount(selectedJar.minDeposit, selectedJar.decimals),
                    asset: getVaultAssetSymbol(selectedJar.assetAddress, undefined),
                  }
                )}
              </p>
            )}
          </div>

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

          <TxInlineFeedback
            visible={Boolean(depositMutation.error)}
            severity={txErrorView.severity}
            title={txErrorTitle}
            message={txErrorMessage}
            reserveClassName="min-h-[5.5rem]"
          />

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={
              !selectedJar || parsedAmount <= 0n || Boolean(belowMin) || depositMutation.isPending
            }
            loading={depositMutation.isPending}
          >
            {depositMutation.isPending
              ? formatMessage({
                  id: "app.cookieJar.depositing",
                  defaultMessage: "Depositing...",
                })
              : formatMessage({ id: "app.cookieJar.deposit", defaultMessage: "Deposit" })}
          </Button>
        </div>
      )}
    </DialogShell>
  );
}
