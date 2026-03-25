import { type Address, formatTokenAmount, useFunderLeaderboard } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { FunderRow } from "./FunderRow";

interface GardenSupportersProps {
  gardenAddress: Address;
}

export function GardenSupporters({ gardenAddress }: GardenSupportersProps) {
  const { formatMessage } = useIntl();
  const { funders, totalProtocolYield, isLoading } = useFunderLeaderboard({ gardenAddress });

  if (isLoading) {
    return (
      <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (funders.length === 0) {
    return null;
  }

  const maxYield = funders[0]?.totalYieldGenerated ?? 0n;

  return (
    <section className="rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text-strong">
            {formatMessage({ id: "app.funders.gardenSupportersTitle" })}
          </h2>
          <p className="text-sm text-text-sub">
            {formatMessage({ id: "app.funders.gardenSupportersSubtitle" })}
          </p>
        </div>
        {totalProtocolYield > 0n && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2.5 py-1 text-xs font-semibold text-success-dark">
            {formatMessage(
              { id: "app.funders.yieldGenerated" },
              { amount: formatTokenAmount(totalProtocolYield) }
            )}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {funders.map((funder) => (
          <FunderRow key={funder.address} funder={funder} maxYield={maxYield} />
        ))}
      </div>
    </section>
  );
}
