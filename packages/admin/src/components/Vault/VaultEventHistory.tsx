import { getNetworkConfig } from "@green-goods/shared/config/blockchain";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useVaultEvents } from "@green-goods/shared/hooks/vault/useVaultEvents";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  formatTokenAmount,
  getVaultAssetDecimals,
  getVaultAssetSymbol,
} from "@green-goods/shared/utils/blockchain/vaults";
import { formatDateTime } from "@green-goods/shared/utils/time";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { EnsAddressText } from "@/components/EnsAddressText";

interface VaultEventHistoryProps {
  gardenAddress: Address;
  /**
   * How many rows to show before the "load more" affordance. Defaults to 20 (the standalone
   * view); the endowment tab passes a smaller count so recent activity stays above the fold.
   */
  initialVisibleCount?: number;
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

export function VaultEventHistory({
  gardenAddress,
  initialVisibleCount = 20,
}: VaultEventHistoryProps) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const { events, isLoading } = useVaultEvents(gardenAddress, { limit: 200, enabled: true });
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  const blockExplorer = useMemo(() => getNetworkConfig(chainId).blockExplorer, [chainId]);
  const visibleEvents = useMemo(() => events.slice(0, visibleCount), [events, visibleCount]);

  return (
    <section className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-[var(--m3-elevation-1)] sm:p-6">
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
                <tr className="text-left label-xs text-text-soft">
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
                            getVaultAssetDecimals(event.asset, event.chainId)
                          )
                        : formatMessage({ id: "app.treasury.none" })}
                    </td>
                    <td className="py-2 pr-4">
                      <EnsAddressText address={event.actor} variant="default" />
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
                            getVaultAssetDecimals(event.asset, event.chainId)
                          )
                        : formatMessage({ id: "app.treasury.none" })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-soft">
                      {formatMessage({ id: "app.treasury.actor" })}
                    </span>
                    <span className="text-text-strong">
                      <EnsAddressText address={event.actor} />
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
              <AdminButton
                variant="text"
                size="sm"
                onClick={() => setVisibleCount((count) => count + initialVisibleCount)}
              >
                {formatMessage({ id: "app.treasury.loadMore" })}
              </AdminButton>
            </div>
          )}
        </>
      )}
    </section>
  );
}
