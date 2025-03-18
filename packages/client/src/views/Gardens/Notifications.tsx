import React from "react";
import { RiAlertFill } from "@remixicon/react";
import { formatAddress } from "@/utils/text";
import { Link } from "react-router-dom";

interface GardenNotificationsProps {
  garden: Garden;
  notifications: Work[];
}

export const GardenNotifications: React.FC<GardenNotificationsProps> = ({
  garden,
  notifications,
}) => {
  return (
    <ul
      tabIndex={0}
      className="dropdown-content max-h-80 p-2 gap-3 border border-slate-100 rounded-2xl w-72 flex flex-col items-center noscroll overflow-scroll bg-white z-10"
    >
      {notifications.map(({ id, gardenerAddress }) => (
        <li key={id}>
          <Link
            to={`/gardens/${garden.id}/work/${id}`}
            className="flex flex-col gap-2 p-2"
          >
            <div className="inline-flex gap-2 items-center text-sm">
              <RiAlertFill size={20} className="text-amber-500" />
              <h5 className="text-lg">Pending Work Approval</h5>
            </div>
            <p className="text-sm">
              <b>{formatAddress(gardenerAddress)}</b> completed work on{" "}
              <b>{garden.name}</b>
            </p>
            <p> Tap notification to review</p>
          </Link>
        </li>
      ))}
    </ul>
  );
};
