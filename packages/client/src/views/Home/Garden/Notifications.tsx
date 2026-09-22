import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import type { Garden, Work } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiAlertFill, RiSeedlingFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/Communication";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

interface GardenNotificationsProps {
  garden: Garden;
  notifications: Work[];
}

function GardenNotificationItem({ garden, work }: { garden: Garden; work: Work }) {
  const intl = useIntl();
  const { data: gardenerEnsName } = useEnsName(work.gardenerAddress);

  return (
    <Link
      key={work.id}
      to={`/home/${garden.id}/work/${work.id}`}
      state={{ from: "garden", returnTo: `/home/${garden.id}` }}
      viewTransition
      className={cn(
        "cv-notification w-full flex flex-col gap-2 p-4 rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border cursor-pointer group",
        pwaStatusStyles.warning.surface,
        pwaStatusStyles.warning.border
      )}
    >
      <div className="inline-flex gap-2 items-center">
        <RiAlertFill
          size={20}
          className={cn(pwaStatusStyles.warning.icon, "group-hover:animate-pulse")}
        />
        <span className="text-sm font-semibold text-text-strong-950">
          {intl.formatMessage({
            id: "app.home.notifications.pendingWorkApproval",
            defaultMessage: "Pending Work Approval",
          })}
        </span>
      </div>
      <p className="text-sm text-text-strong-950 break-words">
        <span
          className="font-medium"
          title={formatAddress(work.gardenerAddress, { ensName: gardenerEnsName, variant: "card" })}
        >
          {formatAddress(work.gardenerAddress, { ensName: gardenerEnsName, variant: "card" })}
        </span>{" "}
        {intl.formatMessage({
          id: "app.home.notifications.completedWorkApproval",
          defaultMessage: "Completed work on",
        })}{" "}
        <span className="font-medium" title={garden.name}>
          {garden.name}
        </span>
      </p>
    </Link>
  );
}

export const GardenNotifications: React.FC<GardenNotificationsProps> = ({
  garden,
  notifications,
}) => {
  const intl = useIntl();
  const pendingNotifications = notifications.filter((work) => work.status === "pending");

  // The notifications sheet's content region owns scrolling; a nested
  // scroller here has no height of its own and only clips the list.
  return (
    <div className="flex flex-col gap-3">
      {pendingNotifications.length === 0 ? (
        <EmptyState
          icon={<RiSeedlingFill />}
          title={intl.formatMessage({
            id: "app.home.notifications.noWork",
            defaultMessage: "Nothing to review",
          })}
          description={intl.formatMessage({
            id: "app.home.notifications.encourageWork",
            defaultMessage: "New submissions will appear here.",
          })}
        />
      ) : (
        pendingNotifications.map((work) => (
          <GardenNotificationItem key={work.id} garden={garden} work={work} />
        ))
      )}
    </div>
  );
};
