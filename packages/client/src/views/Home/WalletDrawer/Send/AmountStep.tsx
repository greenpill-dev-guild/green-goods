import {
  cn,
  formatTokenAmount,
  FormattedAmountInput,
  type SendableTokenBalance,
} from "@green-goods/shared";
import { RiCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import type { AmountValidation } from "./validation";

interface AmountStepProps {
  tokens: SendableTokenBalance[];
  isLoading: boolean;
  selectedToken: SendableTokenBalance | null;
  onSelectToken: (token: SendableTokenBalance) => void;
  amountInput: string;
  onAmountChange: (value: string) => void;
  validation: AmountValidation;
  onMax: () => void;
}

function tokenIsSelectable(token: SendableTokenBalance): boolean {
  return token.supported && (token.balance ?? 0n) > 0n;
}

export function AmountStep({
  tokens,
  isLoading,
  selectedToken,
  onSelectToken,
  amountInput,
  onAmountChange,
  validation,
  onMax,
}: AmountStepProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4 p-4">
      <section className="space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
          {formatMessage({ id: "app.send.token.title" })}
        </h4>

        {isLoading ? (
          <div className="space-y-2.5" role="status">
            <p className="text-xs text-text-soft-400">
              {formatMessage({
                id: "app.send.token.loading",
                defaultMessage: "Checking your token balances…",
              })}
            </p>
            <div className="space-y-2.5 animate-pulse" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-12 rounded-lg bg-bg-weak-50" />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="space-y-2"
            role="group"
            aria-label={formatMessage({ id: "app.send.token.title" })}
          >
            {tokens.map((token) => {
              const selectable = tokenIsSelectable(token);
              const selected = selectedToken?.address.toLowerCase() === token.address.toLowerCase();
              return (
                <button
                  key={`${token.symbol}-${token.address}`}
                  type="button"
                  disabled={!selectable}
                  onClick={() => onSelectToken(token)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition",
                    selected
                      ? "border-primary-base bg-primary-base/10"
                      : "border-stroke-soft-200 bg-bg-white-0 hover:bg-bg-weak-50",
                    !selectable && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-strong-950">
                        {token.symbol}
                      </span>
                      {token.confersGovernance ? (
                        <span className="inline-flex rounded-full bg-primary-base/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-base">
                          {formatMessage({ id: "app.send.token.governanceTag" })}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-text-soft-400" title={token.label}>
                      {token.confersGovernance
                        ? formatMessage({ id: "app.send.token.governanceHint" })
                        : token.label}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <span
                      className="text-xs text-text-sub-600"
                      title={
                        token.balance === null
                          ? formatMessage({ id: "app.balance.unavailable" })
                          : undefined
                      }
                    >
                      {token.balance === null ? (
                        <>
                          <span aria-hidden>—</span>
                          <span className="sr-only">
                            {formatMessage({ id: "app.balance.unavailable" })}
                          </span>
                        </>
                      ) : (
                        formatTokenAmount(token.balance, token.decimals)
                      )}
                    </span>
                    {selected ? (
                      <RiCheckLine className="h-4 w-4 text-primary-base" aria-hidden />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedToken ? (
        <section className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({ id: "app.send.amount.label" })}
          </h4>
          <FormattedAmountInput
            value={amountInput}
            onValueChange={onAmountChange}
            placeholder="0.0"
            aria-label={formatMessage({ id: "app.send.amount.label" })}
            aria-invalid={Boolean(validation.formatErrorId || validation.insufficient)}
            inputClassName={cn(
              "w-full rounded-md border px-3 py-2.5 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-primary-base/20",
              validation.formatErrorId || validation.insufficient
                ? "border-error-base focus:border-error-base"
                : "border-stroke-sub-300 bg-bg-white-0 focus:border-primary-base"
            )}
            endSlot={
              <button
                type="button"
                onClick={onMax}
                className="min-h-11 min-w-11 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-xs font-medium text-text-sub-600 hover:bg-bg-weak-50"
              >
                {formatMessage({ id: "app.treasury.max" })}
              </button>
            }
            errorClassName="mt-2 text-xs text-error-dark"
            error={
              validation.formatErrorId
                ? formatMessage({ id: validation.formatErrorId })
                : validation.insufficient
                  ? formatMessage(
                      { id: "app.send.amount.insufficient" },
                      { symbol: selectedToken.symbol }
                    )
                  : null
            }
          />
        </section>
      ) : null}

      {/* Vacuously true for an empty list, so "nothing to send" covers both
          all-zero balances and no tokens at all. */}
      {!isLoading && tokens.every((token) => !tokenIsSelectable(token)) ? (
        <p className="text-xs text-text-soft-400">
          {formatMessage({ id: "app.send.token.zeroBalance" })}
        </p>
      ) : null}
    </div>
  );
}
