import { useEnsName, useNavigateToTop } from "@green-goods/shared/hooks";
import { formatAddress } from "@green-goods/shared/utils";
import { RiAlertFill, RiSeedlingFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

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
      state={{ from: "garden" }}
      viewTransition
      className="w-full flex flex-col gap-2 p-4 bg-warning-lighter rounded-xl transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border border-warning-light cursor-pointer group"
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
}) => {
  const intl = useIntl();
  const navigate = useNavigateToTop();
  const pendingNotifications = notifications.filter((work) => work.status === "pending");

  return (
    <div className="relative p-3 gap-3 border border-stroke-soft-200 rounded-2xl w-80 flex flex-col items-center overflow-y-auto overflow-x-hidden bg-bg-white-0 shadow-xl mx-auto min-h-[400px] max-h-[80vh] transition-all duration-300 transform translate-y-0">
      {pendingNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-6">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-lg font-semibold text-text-strong-950 mb-2">
            {intl.formatMessage({
              id: "app.home.notifications.noWork",
              defaultMessage: "Your garden is waiting!",
            })}
          </h3>
          <p className="text-sm text-text-sub-600 leading-relaxed mb-6">
            {intl.formatMessage({
              id: "app.home.notifications.encourageWork",
              defaultMessage:
                "No new work to review yet. Why not explore your garden and see what's growing?",
            })}
          </p>
          <button
            onClick={() => {
              navigate("/garden", { state: { gardenId: garden.id } });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <RiSeedlingFill className="w-4 h-4" />
            {intl.formatMessage({
              id: "app.home.notifications.visitGarden",
              defaultMessage: "Visit Garden",
            })}
          </button>
        </div>
      ) : (
        <>
          <h3 className="text-base font-semibold text-text-strong-950 self-start mb-2">
            {intl.formatMessage({
              id: "app.home.notifications.title",
              defaultMessage: "Work to Review",
            })}
          </h3>
          {pendingNotifications.map((work) => (
            <GardenNotificationItem key={work.id} garden={garden} work={work} />
          ))}
        </>
      )}
    </div>
  );
};
