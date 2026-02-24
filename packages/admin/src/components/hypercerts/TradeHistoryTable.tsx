import {
  useTradeHistory,
  DEFAULT_CHAIN_ID,
  getNetworkConfig,
  type Address,
  type FractionTrade,
} from "@green-goods/shared";
import { RiLoader4Line, RiExternalLinkLine, RiAlertLine, RiHistoryLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { formatEther } from "viem";

interface TradeHistoryTableProps {
  hypercertId: bigint;
  chainId?: number;
}

function formatUnits(units: bigint): string {
  const num = Number(units);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "\u2014";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Table showing FractionPurchased trade history for a hypercert.
 * Links to block explorer for each transaction.
 */
export function TradeHistoryTable({
  hypercertId,
  chainId = DEFAULT_CHAIN_ID,
}: TradeHistoryTableProps) {
  const intl = useIntl();
  const { trades, isLoading, error } = useTradeHistory(hypercertId);
  const networkConfig = getNetworkConfig(chainId);
  const explorerUrl = networkConfig?.blockExplorer;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <RiLoader4Line className="h-4 w-4 animate-spin text-text-soft" />
        <span className="text-sm text-text-soft">
          {intl.formatMessage({ id: "app.admin.tradeHistory.loading", defaultMessage: "Loading trade history..." })}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-error-lighter p-3">
        <RiAlertLine className="h-4 w-4 text-error-base" />
        <span className="text-sm text-error-dark">
          {intl.formatMessage({ id: "app.admin.tradeHistory.loadError", defaultMessage: "Failed to load trades" })}
        </span>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stroke-soft p-6 text-center">
        <RiHistoryLine className="mx-auto h-6 w-6 text-text-disabled" />
        <p className="mt-2 text-sm text-text-soft">
          {intl.formatMessage({ id: "app.admin.tradeHistory.empty", defaultMessage: "No trades yet" })}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stroke-soft">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stroke-soft bg-bg-soft">
            <th className="px-4 py-2.5 text-xs font-medium uppercase text-text-soft">
              {intl.formatMessage({ id: "app.admin.tradeHistory.columnDate", defaultMessage: "Date" })}
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase text-text-soft">
              {intl.formatMessage({ id: "app.admin.tradeHistory.columnUnits", defaultMessage: "Units" })}
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase text-text-soft">
              {intl.formatMessage({ id: "app.admin.tradeHistory.columnPayment", defaultMessage: "Payment" })}
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase text-text-soft">
              {intl.formatMessage({ id: "app.admin.tradeHistory.columnRecipient", defaultMessage: "Recipient" })}
            </th>
            <th className="px-4 py-2.5 text-xs font-medium uppercase text-text-soft text-right">
              {intl.formatMessage({ id: "app.admin.tradeHistory.columnTx", defaultMessage: "Tx" })}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke-soft">
          {trades.map((trade, idx) => (
            <tr key={`${trade.txHash}-${idx}`} className="hover:bg-bg-soft/50 transition">
              <td className="px-4 py-2.5 text-text-sub">{formatTimestamp(trade.timestamp)}</td>
              <td className="px-4 py-2.5 font-medium text-text-strong">
                {formatUnits(trade.units)}
              </td>
              <td className="px-4 py-2.5 text-text-sub">{formatEther(trade.payment)} ETH</td>
              <td className="px-4 py-2.5 text-text-soft font-mono text-xs">
                {truncateAddress(trade.recipient)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {explorerUrl && trade.txHash ? (
                  <a
                    href={`${explorerUrl}/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-primary-base transition hover:text-primary-darker"
                  >
                    <RiExternalLinkLine className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-text-disabled">{"\u2014"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
