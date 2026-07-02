import { formatTokenAmount, type SendableTokenBalance } from "@green-goods/shared";
import {
  RiErrorWarningLine,
  RiSendPlaneLine,
  RiWallet3Line,
  RiWifiOffLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";

interface BalanceViewProps {
  tokens: SendableTokenBalance[];
  isLoading: boolean;
  /** The whole balance query failed (distinct from per-token read failures). */
  isError: boolean;
  isOnline: boolean;
  onRetry: () => void;
  /** Start a send pre-filled with this token. */
  onSend: (token: SendableTokenBalance) => void;
}

const retryButtonClass =
  "min-h-11 shrink-0 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2 text-xs font-medium text-text-sub-600 transition hover:bg-bg-weak-50 duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]";

/**
 * "Balance" side of the Tokens tab: what the user holds. Each row starts a
 * pre-filled Send. Models the AmountStep token-row markup, with the balance as
 * the prominent value.
 *
 * A failed load must never masquerade as "no tokens": an empty list resolves
 * offline → error → genuinely-empty, in that order (offline explains more than
 * error when both are true, and retrying is pointless without a connection).
 * A per-token read failure renders "—", never a fake zero.
 */
export function BalanceView({
  tokens,
  isLoading,
  isError,
  isOnline,
  onRetry,
  onSend,
}: BalanceViewProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="space-y-2.5 animate-pulse p-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-14 rounded-lg bg-bg-weak-50" />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    if (!isOnline) {
      return (
        <div className="p-4">
          <EmptyState
            icon={<RiWifiOffLine />}
            title={formatMessage({ id: "app.balance.loadError" })}
            description={formatMessage({ id: "app.balance.offlineNote" })}
          />
        </div>
      );
    }
    if (isError) {
      return (
        <div className="p-4">
          <EmptyState
            tone="error"
            icon={<RiErrorWarningLine />}
            title={formatMessage({ id: "app.balance.loadError" })}
            description={formatMessage({ id: "app.balance.loadErrorDescription" })}
            action={
              <button type="button" onClick={onRetry} className={retryButtonClass}>
                {formatMessage({ id: "app.common.retry" })}
              </button>
            }
          />
        </div>
      );
    }
    return (
      <div className="p-4">
        <EmptyState
          icon={<RiWallet3Line />}
          title={formatMessage({ id: "app.balance.empty" })}
          description={formatMessage({ id: "app.balance.emptyDescription" })}
        />
      </div>
    );
  }

  const hasErroredToken = tokens.some((token) => token.errored);
  const unavailableLabel = formatMessage({ id: "app.balance.unavailable" });

  return (
    <div className="space-y-2 p-4">
      {!isOnline ? (
        <p className="text-xs text-warning-dark" role="status">
          {formatMessage({ id: "app.balance.offlineNote" })}
        </p>
      ) : hasErroredToken ? (
        <div className="flex items-center justify-between gap-2" role="status">
          <p className="text-xs text-warning-dark">
            {formatMessage({ id: "app.balance.partialError" })}
          </p>
          <button type="button" onClick={onRetry} className={retryButtonClass}>
            {formatMessage({ id: "app.common.retry" })}
          </button>
        </div>
      ) : null}
      {tokens.map((token) => {
        const balanceText =
          token.balance === null ? "—" : formatTokenAmount(token.balance, token.decimals);
        return (
          <button
            key={`${token.symbol}-${token.address}`}
            type="button"
            onClick={() => onSend(token)}
            aria-label={formatMessage(
              { id: "app.balance.sendToken" },
              {
                symbol: token.symbol,
                balance: token.balance === null ? unavailableLabel : balanceText,
              }
            )}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-3 text-left transition hover:bg-bg-weak-50"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-strong-950">{token.symbol}</span>
                {token.confersGovernance ? (
                  <span className="inline-flex rounded-full bg-primary-base/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-base">
                    {formatMessage({ id: "app.send.token.governanceTag" })}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-text-soft-400" title={token.label}>
                {token.label}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-right">
              <span
                className="text-sm font-medium text-text-strong-950"
                title={token.balance === null ? unavailableLabel : undefined}
              >
                {balanceText}
              </span>
              <RiSendPlaneLine className="h-4 w-4 text-text-soft-400" aria-hidden />
            </div>
          </button>
        );
      })}
    </div>
  );
}
