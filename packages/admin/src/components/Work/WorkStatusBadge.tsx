import type { Work } from "@green-goods/shared";
import { RiCheckboxCircleLine, RiCloseLine, RiTimeLine } from "@remixicon/react";
import { useIntl } from "react-intl";

const STATUS_CONFIG = {
  pending: {
    labelId: "app.work.status.pending",
    color: "bg-warning-lighter text-warning-dark",
    icon: RiTimeLine,
  },
  approved: {
    labelId: "app.work.status.approved",
    color: "bg-success-lighter text-success-dark",
    icon: RiCheckboxCircleLine,
  },
  rejected: {
    labelId: "app.work.status.rejected",
    color: "bg-error-lighter text-error-dark",
    icon: RiCloseLine,
  },
} as const;

interface WorkStatusBadgeProps {
  status: Work["status"];
}

export function WorkStatusBadge({ status }: WorkStatusBadgeProps): React.ReactNode {
  const { formatMessage } = useIntl();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {formatMessage({ id: config.labelId })}
    </span>
  );
}
