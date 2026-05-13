import {
  cn,
  formatAddress,
  type Garden,
  useEnsName,
  useNavigateToTop,
  type Work,
} from "@green-goods/shared";
import { RiAlertFill, RiSeedlingFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/Communication";
import { APP_ROUTES } from "@/config/pwa-routing";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface GardenNotificationsProps {
  garden: Garden;
  notifications: Work[];
  onClose?: () => void;
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
          defaultMessage: "completed work on",
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
  onClose,
}) => {
  const intl = useIntl();
  const navigate = useNavigateToTop();
  const pendingNotifications = notifications.filter((work) => work.status === "pending");

  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {pendingNotifications.length === 0 ? (
        <EmptyState
          icon={<RiSeedlingFill />}
          title={intl.formatMessage({
            id: "app.home.notifications.noWork",
            defaultMessage: "Your garden is waiting!",
          })}
          description={intl.formatMessage({
            id: "app.home.notifications.encourageWork",
            defaultMessage:
              "No new work to review yet. Why not explore your garden and see what's growing?",
          })}
          action={
            <button
              onClick={() => {
                onClose?.();
                navigate(APP_ROUTES.garden, { state: { gardenId: garden.id } });
              }}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary-action px-4 py-2 text-sm font-medium text-primary-action-foreground transition-[background-color,box-shadow,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] active:scale-95 focus:outline-none focus-visible:shadow-button-primary-focus"
            >
              <RiSeedlingFill className="w-4 h-4" />
              {intl.formatMessage({
                id: "app.home.notifications.visitGarden",
                defaultMessage: "Visit Garden",
              })}
            </button>
          }
        />
      ) : (
        pendingNotifications.map((work) => (
          <GardenNotificationItem key={work.id} garden={garden} work={work} />
        ))
      )}
    </div>
  );
};
