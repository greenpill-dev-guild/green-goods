import {
  type Address,
  formatAddress,
  formatDateTime,
  formatTokenAmount,
  getNetworkConfig,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
  useCurrentChain,
  useVaultEvents,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { getAssetTotalKey } from "./assetTotals";

interface VaultEventHistoryProps {
  gardenAddress: Address;
  assetDecimalsByKey?: Map<string, number>;
}

const EVENT_BADGE_CLASS: Record<string, string> = {
  DEPOSIT: "bg-success-lighter text-success-dark",
  WITHDRAW: "bg-info-lighter text-info-dark",
  HARVEST: "bg-feature-lighter text-feature-dark",
  EMERGENCY_PAUSED: "bg-error-lighter text-error-dark",
};

const EVENT_TYPE_I18N: Record<string, string> = {
  DEPOSIT: "app.treasury.eventType.DEPOSIT",
  WITHDRAW: "app.treasury.eventType.WITHDRAW",
  HARVEST: "app.treasury.eventType.HARVEST",
  EMERGENCY_PAUSED: "app.treasury.eventType.EMERGENCY_PAUSED",
};

export function VaultEventHistory({ gardenAddress, assetDecimalsByKey }: VaultEventHistoryProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { events, isLoading } = useVaultEvents(gardenAddress, { limit: 200, enabled: true });
  const [visibleCount, setVisibleCount] = useState(20);

  const blockExplorer = useMemo(() => getNetworkConfig(chainId).blockExplorer, [chainId]);
  const visibleEvents = useMemo(() => events.slice(0, visibleCount), [events, visibleCount]);
  const getEventDecimals = (asset: Address, eventChainId: number) =>
    assetDecimalsByKey?.get(getAssetTotalKey(eventChainId, asset)) ??
    getVaultAssetDecimals(asset, eventChainId);

  return (
    <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-strong sm:text-lg">
          {formatMessage({ id: "app.treasury.events" })}
        </h2>
      </div>

      {isLoading && (
        <p className="text-sm text-text-soft">
          {formatMessage({ id: "app.treasury.eventsLoading" })}
        </p>
      )}

      {!isLoading && events.length === 0 && (
        <p className="text-sm text-text-soft">
          {formatMessage({ id: "app.treasury.eventsEmpty" })}
        </p>
      )}

      {!isLoading && events.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-stroke-soft text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-soft">
                  <th className="py-2 pr-4">{formatMessage({ id: "app.treasury.type" })}</th>
                  <th className="py-2 pr-4">{formatMessage({ id: "app.treasury.asset" })}</th>
                  <th className="py-2 pr-4">{formatMessage({ id: "app.treasury.amount" })}</th>
                  <th className="py-2 pr-4">{formatMessage({ id: "app.treasury.actor" })}</th>
                  <th className="py-2 pr-4">{formatMessage({ id: "app.treasury.tx" })}</th>
                  <th className="py-2">{formatMessage({ id: "app.treasury.timestamp" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke-soft">
                {visibleEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          EVENT_BADGE_CLASS[event.eventType] ?? "bg-bg-weak text-text-sub"
                        }`}
                      >
                        {EVENT_TYPE_I18N[event.eventType]
                          ? formatMessage({ id: EVENT_TYPE_I18N[event.eventType] })
                          : event.eventType}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{getVaultAssetSymbol(event.asset, event.chainId)}</td>
                    <td className="py-2 pr-4">
                      {event.amount !== null
                        ? formatTokenAmount(
                            event.amount,
                            getEventDecimals(event.asset, event.chainId)
                          )
                        : formatMessage({ id: "app.treasury.none" })}
                    </td>
                    <td className="py-2 pr-4">
                      {formatAddress(event.actor, { variant: "default" })}
                    </td>
                    <td className="py-2 pr-4">
                      {blockExplorer ? (
                        <a
                          href={`${blockExplorer}/tx/${event.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-base hover:text-primary-darker"
                        >
                          {formatMessage({ id: "app.treasury.viewTx" })}
                        </a>
                      ) : (
                        formatAddress(event.txHash, { variant: "card" })
                      )}
                    </td>
                    <td className="py-2">{formatDateTime(event.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {visibleEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-stroke-soft bg-bg-weak p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      EVENT_BADGE_CLASS[event.eventType] ?? "bg-bg-weak text-text-sub"
                    }`}
                  >
                    {EVENT_TYPE_I18N[event.eventType]
                      ? formatMessage({ id: EVENT_TYPE_I18N[event.eventType] })
                      : event.eventType}
                  </span>
                  <span className="text-xs text-text-soft">{formatDateTime(event.timestamp)}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-soft">
                      {formatMessage({ id: "app.treasury.asset" })}
                    </span>
                    <span className="font-medium text-text-strong">
                      {getVaultAssetSymbol(event.asset, event.chainId)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-soft">
                      {formatMessage({ id: "app.treasury.amount" })}
                    </span>
                    <span className="font-medium text-text-strong">
                      {event.amount !== null
                        ? formatTokenAmount(
                            event.amount,
                            getEventDecimals(event.asset, event.chainId)
                          )
                        : formatMessage({ id: "app.treasury.none" })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-soft">
                      {formatMessage({ id: "app.treasury.actor" })}
                    </span>
                    <span className="text-text-strong">
                      {formatAddress(event.actor, { variant: "card" })}
                    </span>
                  </div>
                  {blockExplorer && (
                    <div className="pt-1">
                      <a
                        href={`${blockExplorer}/tx/${event.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary-base hover:text-primary-darker"
                      >
                        {formatMessage({ id: "app.treasury.viewTx" })}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {visibleCount < events.length && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 20)}
                className="rounded-md border border-stroke-sub bg-bg-white px-3 py-1.5 text-sm font-medium text-text-sub hover:bg-bg-weak"
              >
                {formatMessage({ id: "app.treasury.loadMore" })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
