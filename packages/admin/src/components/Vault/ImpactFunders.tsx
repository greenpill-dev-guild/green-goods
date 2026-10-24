import { ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { useFunderLeaderboard } from "@green-goods/shared/hooks/vault/useFunderLeaderboard";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { FunderRow } from "./FunderRow";

const DEFAULT_VISIBLE = 3;

export function ImpactFunders() {
  const { formatMessage } = useIntl();
  const { funders, totalProtocolYield, isLoading } = useFunderLeaderboard();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <AdminCard className="sm:p-5">
        <div className="h-5 w-40 rounded skeleton-shimmer" />
        <div className="mt-3 flex flex-col gap-(--gg-list-gap)">
          {[0, 1, 2].map((i) => (
            <ItemRowSkeleton key={i} lead="avatar" />
          ))}
        </div>
      </AdminCard>
    );
  }

  if (funders.length === 0) {
    return null;
  }

  const visibleFunders = expanded ? funders : funders.slice(0, DEFAULT_VISIBLE);
  const hasMore = funders.length > DEFAULT_VISIBLE;

  return (
    <AdminCard className="sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading type-title-md font-semibold text-text-strong">
            {formatMessage({ id: "app.funders.impactFundersTitle" })}
          </h2>
          <p className="type-body text-text-sub">
            {formatMessage({ id: "app.funders.impactFundersSubtitle" })}
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
        {visibleFunders.map((funder) => (
          <li key={funder.address}>
            <FunderRow funder={funder} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <AdminButton
          variant="outlined"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setExpanded((prev) => !prev)}
          leadingIcon={expanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
        >
          {expanded
            ? formatMessage({ id: "app.funders.collapse" })
            : formatMessage({ id: "app.funders.viewAll" }, { count: funders.length })}
        </AdminButton>
      )}

      <p className="mt-3 type-meta text-text-sub">
        {formatMessage({ id: "app.funders.contextExplainer" })}
      </p>
    </AdminCard>
  );
}
