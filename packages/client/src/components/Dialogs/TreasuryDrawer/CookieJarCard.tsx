import {
  FormattedAmountInput,
  useFormattedAmountInput,
} from "@green-goods/shared/components/Form/FormattedAmountInput";
import type { Address } from "@green-goods/shared/types/domain";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import {
  formatTokenAmount,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { useCookieJarWithdraw } from "@green-goods/shared/hooks/cookie-jar/useCookieJarWithdraw";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { RiLoader4Line } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";

export interface CookieJarCardProps {
  jar: CookieJar;
  gardenAddress: Address;
  gardenName: string;
}

export function CookieJarCard({ jar, gardenAddress, gardenName }: CookieJarCardProps) {
  const { formatMessage } = useIntl();
  const isOnline = useOnlineStatus();
  const withdrawMutation = useCookieJarWithdraw(gardenAddress);
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const decimals = jar.decimals;
  const assetSymbol = getVaultAssetSymbol(jar.assetAddress, undefined);
  const { parsedAmount: amount, formatErrorId: inputError } = useFormattedAmountInput(
    amountInput,
    decimals
  );
  const parsedAmount = amount ?? 0n;

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
          <FormattedAmountInput
            value={amountInput}
            onValueChange={setAmountInput}
            placeholder={formatMessage({ id: "app.cookieJar.amount" })}
            aria-label={formatMessage({ id: "app.cookieJar.amount" })}
            error={inputError ? formatMessage({ id: inputError }) : undefined}
            inputClassName={`w-full rounded-md border px-3 py-2.5 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary-base/20 ${
              inputError
                ? "border-error-base focus:border-error-base"
                : "border-stroke-sub-300 bg-bg-white-0 focus:border-primary-base"
            }`}
            errorClassName="text-xs text-error-dark"
            endSlot={
              <button
                type="button"
                onClick={() => {
                  const max = jar.maxWithdrawal < jar.balance ? jar.maxWithdrawal : jar.balance;
                  setAmountInput(formatUnits(max, decimals));
                }}
                className="min-h-11 min-w-11 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-xs font-medium text-text-sub-600 hover:bg-bg-weak-50"
              >
                {formatMessage({ id: "app.treasury.max" })}
              </button>
            }
          />

          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={formatMessage({ id: "app.cookieJar.purposePlaceholder" })}
            aria-label={formatMessage({ id: "app.cookieJar.purpose" })}
            className="w-full rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20 resize-none"
            rows={2}
          />

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={
              !isOnline ||
              parsedAmount <= 0n ||
              parsedAmount > jar.maxWithdrawal ||
              parsedAmount > jar.balance ||
              !purpose.trim() ||
              withdrawMutation.isPending
            }
            aria-busy={withdrawMutation.isPending || undefined}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2 text-sm font-medium text-text-sub-600 transition hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {withdrawMutation.isPending && (
              <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {formatMessage({ id: "app.cookieJar.withdraw" })}
          </button>

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
