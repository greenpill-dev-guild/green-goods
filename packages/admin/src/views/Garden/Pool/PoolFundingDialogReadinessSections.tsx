import type { PoolFundingControllerView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { useIntl } from "react-intl";
import { PoolFundingDialogFact as Fact } from "./PoolFundingDialogFinancialSections";
import { readinessReasonMessage, shortAddress } from "./poolFundingPresentation";

export interface PoolFundingDialogReadinessSectionsProps {
  funding: PoolFundingControllerView;
}

export function PoolFundingDialogReadinessSections({
  funding,
}: PoolFundingDialogReadinessSectionsProps) {
  const intl = useIntl();
  const { formatMessage, locale } = intl;
  const snapshot = funding.snapshot;
  const stale = (funding.isError || funding.hasStaleBalance) && snapshot !== null;
  const settlementReady = snapshot?.settlementReadiness === "ready" && !stale;
  const settlementUnavailableReasons = snapshot?.settlementUnavailableReasons ?? [];
  const address = (value: Address | null) => (value ? `${shortAddress(value)} · ${value}` : "—");

  return (
    <>
      <section
        aria-labelledby="funding-route-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-route-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.route",
            defaultMessage: "Account and route readiness",
          })}
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.route.account",
              defaultMessage: "Registered account",
            })}
            value={address(snapshot?.routeAddresses.account ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.route.indexed",
              defaultMessage: "Indexed Celo route",
            })}
            value={address(snapshot?.routeAddresses.indexed ?? null)}
          />
          <Fact
            label={formatMessage({
              id: "cockpit.garden.pool.funding.route.live",
              defaultMessage: "Live Celo route",
            })}
            value={address(snapshot?.routeAddresses.live ?? null)}
          />
        </dl>
        {settlementReady ? (
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.pool.funding.ready",
              defaultMessage: "Account, route, token, fees, and limits are ready.",
            })}
          </p>
        ) : settlementUnavailableReasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-sub">
            {settlementUnavailableReasons.map((reason) => (
              <li key={reason}>{readinessReasonMessage(reason, intl)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.pool.funding.settlementUnavailable",
              defaultMessage: "Settlement unavailable",
            })}
          </p>
        )}
      </section>

      <section
        aria-labelledby="funding-network-title"
        className="space-y-3 border-t border-stroke-soft pt-5"
      >
        <h3 id="funding-network-title" className="label-lg text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.funding.dialog.networkFees",
            defaultMessage: "Network fees",
          })}
        </h3>
        <Fact
          label={formatMessage({
            id: "cockpit.garden.pool.funding.nativeReserve",
            defaultMessage: "Celo acknowledgment reserve",
          })}
          value={
            snapshot?.nativeFeeBalance === null || snapshot?.nativeFeeBalance === undefined
              ? "—"
              : `${formatTokenAmount(snapshot.nativeFeeBalance, 18, 18, locale, true)} CELO`
          }
        />
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.funding.nativeReserve.note",
            defaultMessage:
              "This native CELO reserve pays CCIP acknowledgment fees. It is not G$ pool liquidity.",
          })}
        </p>
      </section>
    </>
  );
}
