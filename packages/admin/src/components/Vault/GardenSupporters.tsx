import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useFunderLeaderboard } from "@green-goods/shared/hooks/vault/useFunderLeaderboard";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { useIntl } from "react-intl";
import { AdminCard } from "@/components/AdminCard";
import { FunderRow } from "./FunderRow";

interface GardenSupportersProps {
  gardenAddress: Address;
}

export function GardenSupporters({ gardenAddress }: GardenSupportersProps) {
  const { formatMessage } = useIntl();
  const { funders, totalProtocolYield, isLoading } = useFunderLeaderboard({ gardenAddress });

  if (isLoading) {
    return (
      <AdminCard className="sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 flex flex-col gap-(--gg-list-gap)">
          <ItemRowSkeleton lead="avatar" />
          <ItemRowSkeleton lead="avatar" />
        </div>
      </AdminCard>
    );
  }

  if (funders.length === 0) {
    return null;
  }

  return (
    <AdminCard className="sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading type-title-md font-semibold text-text-strong">
            {formatMessage({ id: "app.funders.gardenSupportersTitle" })}
          </h2>
          <p className="type-body text-text-sub">
            {formatMessage({ id: "app.funders.gardenSupportersSubtitle" })}
          </p>
        </div>
        {totalProtocolYield > 0n && (
          <span className="shrink-0 rounded-full bg-success-lighter px-2.5 py-1 type-meta font-semibold text-success-dark">
            {formatMessage(
              { id: "app.funders.yieldGenerated" },
              { amount: formatTokenAmount(totalProtocolYield) }
            )}
          </span>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-(--gg-list-gap)">
        {funders.map((funder) => (
          <li key={funder.address}>
            <FunderRow funder={funder} />
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}
