import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function WorkView() {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.work.title", defaultMessage: "Work Pipeline" })}
        description={formatMessage({
          id: "cockpit.work.description",
          defaultMessage: "Review and manage work submissions across your gardens",
        })}
      />

      {/* Pipeline content will be wired in Phase 1b */}
      <div className="rounded-xl border border-stroke-soft bg-bg-white p-8 text-center">
        <p className="text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.work.emptyQueue",
            defaultMessage: "No work submissions pending review",
          })}
        </p>
      </div>
    </div>
  );
}
