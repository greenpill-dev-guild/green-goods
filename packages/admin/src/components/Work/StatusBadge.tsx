import { RiCheckLine, RiCloseLine, RiTimeLine } from "@remixicon/react";

interface StatusBadgeProps {
  status: "pending" | "approved" | "rejected" | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case "approved":
        return {
          icon: <RiCheckLine className="h-3 w-3" />,
          label: "Approved",
          className: "bg-success-lighter text-success-dark border-success-light",
        };
      case "rejected":
        return {
          icon: <RiCloseLine className="h-3 w-3" />,
          label: "Rejected",
          className: "bg-error-lighter text-error-dark border-error-light",
        };
      case "pending":
      default:
        return {
          icon: <RiTimeLine className="h-3 w-3" />,
          label: "Pending",
          className: "bg-warning-lighter text-warning-dark border-warning-light",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};
