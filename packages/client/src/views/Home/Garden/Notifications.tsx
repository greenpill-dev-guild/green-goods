import { RiAlertFill, RiSeedlingFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
import { formatAddress } from "@/utils/app/text";

interface GardenNotificationsProps {
  garden: Garden;
  notifications: Work[];
}

export const GardenNotifications: React.FC<GardenNotificationsProps> = ({
  garden,
  notifications,
}) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const pendingNotifications = notifications.filter((work) => work.status === "pending");

  return (
    <div className="relative p-3 gap-3 border border-slate-200 rounded-2xl w-80 flex flex-col items-center overflow-y-auto bg-white shadow-xl mx-auto min-h-[400px] max-h-[80vh] transition-all duration-300 transform translate-y-0">
      {pendingNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-6">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {intl.formatMessage({
              id: "app.home.notifications.noWork",
              defaultMessage: "Your garden is waiting!",
            })}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {intl.formatMessage({
              id: "app.home.notifications.encourageWork",
              defaultMessage:
                "No new work to review yet. Why not explore your garden and see what's growing?",
            })}
          </p>
          <button
            onClick={() => navigate(`/home/${garden.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium text-sm rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
          <h3 className="text-base font-semibold text-slate-900 self-start mb-2">
            {intl.formatMessage({
              id: "app.home.notifications.title",
              defaultMessage: "Work to Review",
            })}
          </h3>
          {pendingNotifications.map(({ id, gardenerAddress }) => (
            <Link
              key={id}
              to={`/home/${garden.id}/work/${id}`}
              state={{ from: "garden" }}
              className="w-full flex flex-col gap-2 p-4 text-black bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border border-amber-200 cursor-pointer group"
            >
              <div className="inline-flex gap-2 items-center">
                <RiAlertFill size={20} className="text-amber-600 group-hover:animate-pulse" />
                <span className="text-sm font-semibold text-slate-900">
                  {intl.formatMessage({
                    id: "app.home.notifications.pendingWorkApproval",
                    defaultMessage: "Pending Work Approval",
                  })}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                <span className="font-medium">{formatAddress(gardenerAddress)}</span>{" "}
                {intl.formatMessage({
                  id: "app.home.notifications.completedWorkApproval",
                  defaultMessage: "completed work on",
                })}{" "}
                <span className="font-medium">{garden.name}</span>
              </p>
            </Link>
          ))}
        </>
      )}
    </div>
  );
};
