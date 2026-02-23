import { formatTokenAmount } from "@green-goods/shared";
import {
  RiBankLine,
  RiCheckboxCircleLine,
  RiFileList3Line,
  RiGroupLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { StatCard } from "@/components/StatCard";

interface GardenStatsGridProps {
  gardenerCount: number;
  operatorCount: number;
  workCount: number;
  assessmentCount: number;
  hasVaults: boolean;
  vaultNetDeposited: bigint;
  vaultHarvestCount: number;
  vaultDepositorCount: number;
  communityLoading: boolean;
  communityLabel: string | undefined;
}

export const GardenStatsGrid: React.FC<GardenStatsGridProps> = ({
  gardenerCount,
  operatorCount,
  workCount,
  assessmentCount,
  hasVaults,
  vaultNetDeposited,
  vaultHarvestCount,
  vaultDepositorCount,
  communityLoading,
  communityLabel,
}) => {
  const { formatMessage } = useIntl();

  return (
    <section className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 md:grid-cols-4">
      <StatCard
        icon={<RiUserLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.roles.gardener.plural" })}
        value={gardenerCount}
      />
      <StatCard
        icon={<RiShieldCheckLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.roles.operator.plural" })}
        value={operatorCount}
      />
      <StatCard
        icon={<RiCheckboxCircleLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.garden.admin.statWork" })}
        value={workCount}
      />
      <StatCard
        icon={<RiFileList3Line className="h-5 w-5" />}
        label={formatMessage({ id: "app.garden.admin.statAssessments" })}
        value={assessmentCount}
      />
      {hasVaults && (
        <>
          <StatCard
            icon={<RiBankLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalValueLocked" })}
            value={formatTokenAmount(vaultNetDeposited)}
          />
          <StatCard
            icon={<RiBankLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalHarvests" })}
            value={vaultHarvestCount}
          />
          <StatCard
            icon={<RiBankLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.depositorCount" })}
            value={vaultDepositorCount}
          />
        </>
      )}
      <StatCard
        icon={<RiGroupLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.community.title" })}
        value={
          communityLoading
            ? "..."
            : communityLabel
              ? formatMessage({
                  id: `app.community.weightScheme.${communityLabel.toLowerCase()}`,
                })
              : formatMessage({ id: "app.community.noCommunity" })
        }
      />
    </section>
  );
};
