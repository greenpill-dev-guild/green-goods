import {
  type Address,
  formatTokenAmount,
  getBlockExplorerAddressUrl,
  isZeroAddress,
} from "@green-goods/shared";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface ProtocolYieldSummaryProps {
  yieldSummary: {
    allocationCount: number;
    totalCookieJar: bigint;
    totalFractions: bigint;
    totalJuicebox: bigint;
  };
  contracts: {
    octantModule: Address;
    yieldSplitter: Address;
  };
  aavePool: Address | undefined;
  chainId: number;
}

export function ProtocolYieldSummary({
  yieldSummary,
  contracts,
  aavePool,
  chainId,
}: ProtocolYieldSummaryProps) {
  const { formatMessage } = useIntl();

  return (
    <section className="surface-section">
      <h2 className="font-heading text-lg font-semibold text-text-strong">
        {formatMessage({ id: "app.yield.protocolBreakdown" })}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-bg-weak p-3 text-center">
          <p className="label-xs text-text-soft">
            {formatMessage({ id: "app.yield.cumulativeCookieJar" })}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {formatTokenAmount(yieldSummary.totalCookieJar, 18, 2)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-weak p-3 text-center">
          <p className="label-xs text-text-soft">
            {formatMessage({ id: "app.yield.cumulativeFractions" })}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {formatTokenAmount(yieldSummary.totalFractions, 18, 2)}
          </p>
        </div>
        <div className="rounded-lg bg-bg-weak p-3 text-center">
          <p className="label-xs text-text-soft">
            {formatMessage({ id: "app.yield.cumulativeJuicebox" })}
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-text-strong">
            {formatTokenAmount(yieldSummary.totalJuicebox, 18, 2)}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-stroke-soft pt-3">
        <p className="label-xs text-text-soft">
          {formatMessage({ id: "app.explorer.verifyContracts" })}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {!isZeroAddress(contracts.octantModule) && (
            <a
              href={getBlockExplorerAddressUrl(chainId, contracts.octantModule)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary-base hover:underline"
            >
              {formatMessage({ id: "app.explorer.vaultRegistry" })}
              <RiExternalLinkLine className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {!isZeroAddress(contracts.yieldSplitter) && (
            <a
              href={getBlockExplorerAddressUrl(chainId, contracts.yieldSplitter)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary-base hover:underline"
            >
              {formatMessage({ id: "app.explorer.yieldSplitter" })}
              <RiExternalLinkLine className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {aavePool && (
            <a
              href={getBlockExplorerAddressUrl(chainId, aavePool)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary-base hover:underline"
            >
              {formatMessage({ id: "app.explorer.aavePool" })}
              <RiExternalLinkLine className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
