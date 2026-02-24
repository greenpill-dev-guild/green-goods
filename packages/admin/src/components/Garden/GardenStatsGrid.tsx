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
    <section className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <StatCard
        icon={<RiUserLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.roles.gardener.plural" })}
        value={gardenerCount}
        colorScheme="success"
      />
      <StatCard
        icon={<RiShieldCheckLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.roles.operator.plural" })}
        value={operatorCount}
        colorScheme="info"
      />
      <StatCard
        icon={<RiCheckboxCircleLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.garden.admin.statWork" })}
        value={workCount}
        colorScheme="warning"
      />
      <StatCard
        icon={<RiFileList3Line className="h-5 w-5" />}
        label={formatMessage({ id: "app.garden.admin.statAssessments" })}
        value={assessmentCount}
        colorScheme="info"
      />
      {hasVaults && (
        <>
          <StatCard
            icon={<RiBankLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalValueLocked" })}
            value={formatTokenAmount(vaultNetDeposited)}
            colorScheme="info"
          />
          <StatCard
            icon={<RiBankLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.totalHarvests" })}
            value={vaultHarvestCount}
            colorScheme="success"
          />
          <StatCard
            icon={<RiBankLine className="h-5 w-5" />}
            label={formatMessage({ id: "app.treasury.depositorCount" })}
            value={vaultDepositorCount}
            colorScheme="warning"
          />
        </>
      )}
      <StatCard
        icon={<RiGroupLine className="h-5 w-5" />}
        label={formatMessage({ id: "app.community.title" })}
        colorScheme="warning"
        titleText={
          communityLoading
            ? undefined
            : communityLabel
              ? formatMessage({
                  id: `app.community.weightScheme.${communityLabel.toLowerCase()}`,
                })
              : formatMessage({ id: "app.community.noCommunity" })
        }
        value={
          communityLoading ? (
            <span className="inline-block h-6 w-20 rounded skeleton-shimmer align-middle" />
          ) : communityLabel ? (
            formatMessage({
              id: `app.community.weightScheme.${communityLabel.toLowerCase()}`,
            })
          ) : (
            formatMessage({ id: "app.community.noCommunity" })
          )
        }
      />
    </section>
  );
};
