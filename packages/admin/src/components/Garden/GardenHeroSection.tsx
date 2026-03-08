import { GardenBannerFallback, resolveIPFSUrl } from "@green-goods/shared";
import { useState } from "react";
import { RiCheckboxCircleLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface StatChipProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: "success" | "info" | "warning";
}

const chipColorMap: Record<StatChipProps["color"], string> = {
  success: "bg-success-lighter text-success-dark",
  info: "bg-information-lighter text-information-dark",
  warning: "bg-warning-lighter text-warning-dark",
};

function StatChip({ icon, value, label, color }: StatChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 shadow-md">
      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${chipColorMap[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold tabular-nums text-text-strong">{value}</p>
        <p className="body-xs text-text-soft">{label}</p>
      </div>
    </div>
  );
}

interface GardenHeroSectionProps {
  garden: {
    name: string;
    description: string;
    location: string;
    bannerImage: string;
  };
  gardenerCount?: number;
  operatorCount?: number;
  workCount?: number;
}

export const GardenHeroSection: React.FC<GardenHeroSectionProps> = ({
  garden,
  gardenerCount = 0,
  operatorCount = 0,
  workCount = 0,
}) => {
  const { formatMessage } = useIntl();
  const [bannerError, setBannerError] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-stroke-soft bg-bg-white shadow-sm">
      <div className="relative h-64 sm:h-72">
        {garden.bannerImage && !bannerError ? (
          <img
            src={resolveIPFSUrl(garden.bannerImage)}
            alt={garden.name}
            className="h-full w-full object-cover"
            onError={() => setBannerError(true)}
            loading="lazy"
          />
        ) : (
          <GardenBannerFallback name={garden.name} />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-static-black/80 via-static-black/50 to-transparent p-4 pb-8 text-static-white sm:p-6 sm:pb-10">
          <h2 className="text-xl font-bold drop-shadow-lg sm:text-2xl">{garden.name}</h2>
          <p className="mt-1 body-sm opacity-90">{garden.location}</p>
        </div>
      </div>

      {/* Overlapping stat chips */}
      <div className="-mt-5 relative z-10 mx-4 flex flex-wrap gap-3 sm:mx-6">
        <StatChip
          icon={<RiUserLine className="h-4 w-4" />}
          value={gardenerCount}
          label={formatMessage({ id: "app.roles.gardener.plural" })}
          color="success"
        />
        <StatChip
          icon={<RiShieldCheckLine className="h-4 w-4" />}
          value={operatorCount}
          label={formatMessage({ id: "app.roles.operator.plural" })}
          color="info"
        />
        <StatChip
          icon={<RiCheckboxCircleLine className="h-4 w-4" />}
          value={workCount}
          label={formatMessage({ id: "app.garden.admin.statWork" })}
          color="warning"
        />
      </div>

      <div className="p-4 pt-5 sm:p-6 sm:pt-5">
        <p className="max-w-prose body-sm text-text-sub">{garden.description}</p>
      </div>
    </section>
  );
};
