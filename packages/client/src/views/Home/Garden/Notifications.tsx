import {
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
      className="cv-notification w-full flex flex-col gap-2 p-4 bg-warning-lighter rounded-xl transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border border-warning-light cursor-pointer group"
    >
      <div className="inline-flex gap-2 items-center">
        <RiAlertFill size={20} className="text-warning-base group-hover:animate-pulse" />
        <span className="text-sm font-semibold text-text-strong-950">
          {intl.formatMessage({
            id: "app.home.notifications.pendingWorkApproval",
            defaultMessage: "Pending Work Approval",
          })}
        </span>
      </div>
      <p className="text-sm text-text-strong-950">
        <span className="font-medium">
          {formatAddress(work.gardenerAddress, { ensName: gardenerEnsName, variant: "card" })}
        </span>{" "}
        {intl.formatMessage({
          id: "app.home.notifications.completedWorkApproval",
          defaultMessage: "completed work on",
        })}{" "}
        <span className="font-medium">{garden.name}</span>
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
        <div className="flex flex-col items-center justify-center text-center py-8 px-4">
          <div className="text-5xl mb-3">🌱</div>
          <h3 className="text-base font-semibold text-text-strong-950 mb-1.5">
            {intl.formatMessage({
              id: "app.home.notifications.noWork",
              defaultMessage: "Your garden is waiting!",
            })}
          </h3>
          <p className="text-sm text-text-sub-600 leading-relaxed mb-5">
            {intl.formatMessage({
              id: "app.home.notifications.encourageWork",
              defaultMessage:
                "No new work to review yet. Why not explore your garden and see what's growing?",
            })}
          </p>
          <button
            onClick={() => {
              onClose?.();
              navigate("/garden", { state: { gardenId: garden.id } });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <RiSeedlingFill className="w-4 h-4" />
            {intl.formatMessage({
              id: "app.home.notifications.visitGarden",
              defaultMessage: "Visit Garden",
            })}
          </button>
        </div>
      ) : (
        pendingNotifications.map((work) => (
          <GardenNotificationItem key={work.id} garden={garden} work={work} />
        ))
      )}
    </div>
  );
};
