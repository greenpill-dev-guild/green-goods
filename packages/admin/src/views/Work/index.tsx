import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { RiSeedlingLine } from "@remixicon/react";
import { useGardens } from "@green-goods/shared";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function WorkView() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { data: gardens = [] } = useGardens();

  if (gardens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <RiSeedlingLine className="h-12 w-12 text-text-soft" />
        <h2 className="text-lg font-semibold text-text-strong">
          {formatMessage({ id: "cockpit.work.noGardens" })}
        </h2>
        <p className="text-sm text-text-sub text-center max-w-md">
          {formatMessage({ id: "cockpit.work.noGardensDescription" })}
        </p>
        <button
          type="button"
          onClick={() => navigate("/gardens/create")}
          className="mt-2 rounded-lg bg-primary-base px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
        >
          {formatMessage({ id: "cockpit.work.createGarden" })}
        </button>
      </div>
    );
  }

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
      <div className="rounded-xl border border-stroke-soft bg-bg-white p-8 text-center shadow-elevation-1">
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
