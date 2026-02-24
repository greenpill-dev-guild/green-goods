import { resolveIPFSUrl, type Address } from "@green-goods/shared";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiFileList3Line,
  RiMedalLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

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
    id: Address;
    tokenAddress: Address;
    tokenID: string;
    chainId: number;
  };
  gardenId: string;
  canManage: boolean;
  canReview: boolean;
  gardenerCount?: number;
  operatorCount?: number;
  workCount?: number;
}

export const GardenHeroSection: React.FC<GardenHeroSectionProps> = ({
  garden,
  gardenId,
  canManage,
  canReview,
  gardenerCount = 0,
  operatorCount = 0,
  workCount = 0,
}) => {
  const { formatMessage } = useIntl();

  return (
    <section className="overflow-hidden rounded-xl border border-stroke-soft bg-bg-white shadow-sm">
      <div className="relative h-64 sm:h-72">
        {garden.bannerImage ? (
          <img
            src={resolveIPFSUrl(garden.bannerImage)}
            alt={garden.name}
            className="h-full w-full object-cover"
            onError={(event) => {
              const placeholder = event.currentTarget.nextElementSibling as HTMLElement | null;
              if (placeholder) {
                placeholder.style.display = "flex";
              }
              event.currentTarget.style.display = "none";
            }}
            loading="lazy"
          />
        ) : null}
        <div
          className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-primary-dark via-primary-base to-primary-darker text-primary-foreground ${garden.bannerImage ? "hidden" : "flex"}`}
          style={{ display: garden.bannerImage ? "none" : "flex" }}
        >
          <div className="text-center">
            <div className="text-4xl font-bold opacity-80">{garden.name.charAt(0)}</div>
            <div className="mt-2 text-lg opacity-60">{garden.name}</div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-static-black/80 via-static-black/50 to-transparent p-4 pb-8 text-static-white sm:p-6 sm:pb-10">
          <h2 className="text-xl font-bold drop-shadow-lg sm:text-2xl">{garden.name}</h2>
          <p className="mt-1 body-sm opacity-90">{garden.location}</p>
        </div>

        <div className="flex flex-row flex-wrap gap-2 justify-end mt-3 sm:mt-0 sm:absolute sm:top-4 sm:right-4 sm:flex-col">
          <Link
            to={`/gardens/${gardenId}/assessments`}
            className="flex h-11 w-11 touch-target items-center justify-center rounded-full border border-white/20 bg-bg-white/95 text-text-sub shadow-lg backdrop-blur transition hover:bg-bg-white active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
            title={formatMessage({ id: "app.garden.admin.viewAssessments" })}
            aria-label={formatMessage({ id: "app.garden.admin.viewAssessments" })}
          >
            <RiFileList3Line className="h-5 w-5" />
            <span className="hidden label-sm sm:inline">
              {formatMessage({ id: "app.garden.admin.viewAssessments" })}
            </span>
          </Link>
          <Link
            to={`/gardens/${gardenId}/hypercerts`}
            className="flex h-11 w-11 touch-target items-center justify-center rounded-full border border-white/20 bg-bg-white/95 text-text-sub shadow-lg backdrop-blur transition hover:bg-bg-white active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
            title={formatMessage({ id: "app.hypercerts.actions.viewHypercerts" })}
            aria-label={formatMessage({ id: "app.hypercerts.actions.viewHypercerts" })}
          >
            <RiMedalLine className="h-5 w-5" />
            <span className="hidden label-sm sm:inline">
              {formatMessage({ id: "app.hypercerts.actions.viewHypercerts" })}
            </span>
          </Link>
          {canReview && (
            <Link
              to={`/gardens/${gardenId}/assessments/create`}
              className="flex h-11 w-11 touch-target items-center justify-center rounded-full bg-primary-base text-primary-foreground shadow-lg transition hover:bg-primary-darker active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
              title={formatMessage({ id: "app.garden.admin.newAssessment" })}
              aria-label={formatMessage({ id: "app.garden.admin.newAssessment" })}
            >
              <RiFileList3Line className="h-5 w-5" />
              <span className="hidden label-sm sm:inline">
                {formatMessage({ id: "app.garden.admin.newAssessment" })}
              </span>
            </Link>
          )}
          {canManage && (
            <Link
              to={`/gardens/${gardenId}/hypercerts/create`}
              className="flex h-11 w-11 touch-target items-center justify-center rounded-full bg-primary-base text-primary-foreground shadow-lg transition hover:bg-primary-darker active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
              title={formatMessage({ id: "app.hypercerts.actions.newHypercert" })}
              aria-label={formatMessage({ id: "app.hypercerts.actions.newHypercert" })}
            >
              <RiAddLine className="h-5 w-5" />
              <span className="hidden label-sm sm:inline">
                {formatMessage({ id: "app.hypercerts.actions.newHypercert" })}
              </span>
            </Link>
          )}
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
