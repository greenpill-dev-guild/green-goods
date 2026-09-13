import { Button } from "@green-goods/shared/components/Button";
import { TextInput, Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import { useCookieJarWithdraw } from "@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";

export interface CookieJarCardProps {
  jar: CookieJar;
  gardenAddress: Address;
  gardenName: string;
}

export function CookieJarCard({ jar, gardenAddress, gardenName }: CookieJarCardProps) {
  const { formatMessage } = useIntl();
  const { isOnline } = useOffline();
  const withdrawMutation = useCookieJarWithdraw(gardenAddress);
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const decimals = jar.decimals;
  const assetSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const inputError = useMemo(
    () => validateDecimalInput(amountInput, decimals),
    [amountInput, decimals]
  );

  const parsedAmount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, decimals, inputError]);

  const cooldownSeconds = Number(jar.withdrawalInterval);
  const cooldownDisplay =
    cooldownSeconds >= 86400
      ? `${Math.floor(cooldownSeconds / 86400)}d`
      : cooldownSeconds >= 3600
        ? `${Math.floor(cooldownSeconds / 3600)}h`
        : `${cooldownSeconds}s`;

  const executeWithdraw = () => {
    withdrawMutation.mutate(
      { jarAddress: jar.jarAddress, amount: parsedAmount, purpose },
      {
        onSuccess: () => {
          setAmountInput("");
          setPurpose("");
          setExpanded(false);
        },
      }
    );
  };

  return (
    <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3">
      <button
        type="button"
        data-pressable="row"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-strong-950">{assetSymbol}</p>
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              jar.isPaused
                ? "bg-warning-lighter text-warning-dark"
                : "bg-success-lighter text-success-dark"
            }`}
          >
            {jar.isPaused
              ? formatMessage({ id: "app.cookieJar.paused" })
              : formatMessage({ id: "app.cookieJar.active" })}
          </span>
        </div>
        <p className="text-xs text-text-sub-600">{formatTokenAmount(jar.balance, decimals)}</p>
      </button>

      <div className="mt-2 flex gap-3 text-xs text-text-soft-400">
        <span>
          {formatMessage({ id: "app.cookieJar.maxWithdrawal" })}:{" "}
          {formatTokenAmount(jar.maxWithdrawal, decimals)}
        </span>
        <span>
          {formatMessage({ id: "app.cookieJar.withdrawalInterval" })}: {cooldownDisplay}
        </span>
      </div>

      {expanded && !jar.isPaused && (
        <div className="mt-3 space-y-2 border-t border-stroke-soft-200 pt-3">
          <div className="flex items-center gap-2">
            <TextInput
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={formatMessage({ id: "app.cookieJar.amount" })}
              aria-label={formatMessage({ id: "app.cookieJar.amount" })}
              aria-invalid={Boolean(inputError)}
              invalid={Boolean(inputError)}
            />
            <Button
              type="button"
              emphasis="secondary"
              onClick={() => {
                const max = jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
                setAmountInput(formatUnits(max, decimals));
              }}
            >
              {formatMessage({ id: "app.treasury.max" })}
            </Button>
          </div>
          {inputError && (
            <p className="text-xs text-error-dark" role="alert">
              {formatMessage({ id: inputError })}
            </p>
          )}

          <Textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={formatMessage({ id: "app.cookieJar.purposePlaceholder" })}
            aria-label={formatMessage({ id: "app.cookieJar.purpose" })}
            className="resize-none"
            rows={2}
          />

          <Button
            type="button"
            emphasis="secondary"
            onClick={() => setShowConfirm(true)}
            loading={withdrawMutation.isPending}
            disabled={
              !withdrawMutation.isPending &&
              (!isOnline ||
                parsedAmount <= 0n ||
                parsedAmount > jar.maxWithdrawal ||
                parsedAmount > jar.balance ||
                !purpose.trim())
            }
            className="w-full"
          >
            {formatMessage({ id: "app.cookieJar.withdraw" })}
          </Button>

          <ConfirmDialog
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            title={formatMessage({ id: "app.cookieJar.confirmWithdrawTitle" })}
            description={formatMessage(
              { id: "app.cookieJar.confirmWithdrawDescription" },
              {
                amount: formatTokenAmount(parsedAmount, decimals),
                asset: assetSymbol,
                garden: gardenName,
              }
            )}
            confirmLabel={formatMessage({ id: "app.cookieJar.withdraw" })}
            variant="warning"
            isLoading={withdrawMutation.isPending}
            onConfirm={() => {
              setShowConfirm(false);
              executeWithdraw();
            }}
          />
        </div>
      )}
    </div>
  );
}
