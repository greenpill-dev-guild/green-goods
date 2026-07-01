import { formatTokenAmount, type SendableTokenBalance } from "@green-goods/shared";
import { RiSendPlaneLine, RiWallet3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";

interface BalanceViewProps {
  tokens: SendableTokenBalance[];
  isLoading: boolean;
  /** Start a send pre-filled with this token. */
  onSend: (token: SendableTokenBalance) => void;
}

/**
 * "Balance" side of the Tokens tab: what the user holds. Each row starts a
 * pre-filled Send. Models the AmountStep token-row markup, with the balance as
 * the prominent value.
 */
export function BalanceView({ tokens, isLoading, onSend }: BalanceViewProps) {
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

  return (
    <div className="space-y-2 p-4">
      {tokens.map((token) => (
        <button
          key={`${token.symbol}-${token.address}`}
          type="button"
          onClick={() => onSend(token)}
          aria-label={formatMessage({ id: "app.balance.sendToken" }, { symbol: token.symbol })}
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
            <span className="text-sm font-medium text-text-strong-950">
              {formatTokenAmount(token.balance ?? 0n, token.decimals)}
            </span>
            <RiSendPlaneLine className="h-4 w-4 text-text-soft-400" aria-hidden />
          </div>
        </button>
      ))}
    </div>
  );
}
