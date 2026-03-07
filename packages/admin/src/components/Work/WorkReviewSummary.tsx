import type { Work } from "@green-goods/shared";
import { useIntl } from "react-intl";

interface WorkReviewSummaryProps {
  work: Work;
}

export function WorkReviewSummary({ work }: WorkReviewSummaryProps): React.ReactNode {
  const { formatMessage } = useIntl();

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md bg-bg-weak p-3">
        <p className="text-xs font-medium text-text-soft">
          {formatMessage({ id: "app.work.detail.statusLabel" })}
        </p>
        <p className="mt-0.5 text-sm font-medium text-text-strong">
          {work.status === "approved"
            ? formatMessage({ id: "app.work.status.approved" })
            : formatMessage({ id: "app.work.status.rejected" })}
        </p>
      </div>
      <p className="text-xs text-text-soft">
        {formatMessage({ id: "app.work.detail.alreadyReviewed" })}
      </p>
    </div>
  );
}
