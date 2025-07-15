import { RiAlertFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { formatAddress } from "@/utils/text";

interface GardenNotificationsProps {
  garden: Garden;
  notifications: Work[];
}

export const GardenNotifications: React.FC<GardenNotificationsProps> = ({
  garden,
  notifications,
}) => {
  const intl = useIntl();
  return (
    <div className="relative p-2 gap-3 border border-slate-100 rounded-2xl w-72 flex flex-col items-center overflow-scroll bg-white text-xs mx-auto h-[80%]">
      {notifications.map(({ id, gardenerAddress }) => (
        <Link
          key={id}
          to={`/home/${garden.id}/work/${id}`}
          className="flex flex-col gap-2 p-4 text-black bg-bg-weak-50 text-xs rounded-lg"
        >
          <div className="inline-flex gap-2 items-center">
            <RiAlertFill size={20} className="text-amber-500" />
            <span className="text-base">
              {intl.formatMessage({
                id: "app.home.notifications.pendingWorkApproval",
                description: "Pending Work Approval",
              })}
            </span>
          </div>
          <p className="">
            <b>{formatAddress(gardenerAddress)}</b>{" "}
            {intl.formatMessage({
              id: "app.home.notifications.completedWorkApproval",
              description: "Completed work on",
            })}{" "}
            <b>{garden.name}</b>
          </p>
          <p>
            {" "}
            {intl.formatMessage({
              id: "app.home.notifications.tapToReview",
              description: "Tap notification to review",
            })}
          </p>
        </Link>
      ))}
    </div>
  );
};
