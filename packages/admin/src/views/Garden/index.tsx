import { useIntl } from "react-intl";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function GardenView() {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={formatMessage({ id: "cockpit.garden.title", defaultMessage: "Garden" })}
        description={formatMessage({
          id: "cockpit.garden.description",
          defaultMessage: "Manage your garden overview, impact metrics, and settings",
        })}
      />

      {/* Overview card — full width */}
      <div className="rounded-xl border border-stroke-soft bg-bg-white p-6 shadow-elevation-1">
        <h3 className="text-base font-semibold text-text-strong">
          {formatMessage({ id: "cockpit.garden.overview", defaultMessage: "Overview" })}
        </h3>
        <p className="mt-2 text-sm text-text-sub">
          {formatMessage({
            id: "cockpit.garden.overviewPlaceholder",
            defaultMessage: "Garden overview will be displayed here",
          })}
        </p>
      </div>

      {/* Impact + Settings — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-6 shadow-elevation-1">
          <h3 className="text-base font-semibold text-text-strong">
            {formatMessage({ id: "cockpit.garden.impact", defaultMessage: "Impact" })}
          </h3>
          <p className="mt-2 text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.impactPlaceholder",
              defaultMessage: "Impact metrics will be displayed here",
            })}
          </p>
        </div>
        <div className="rounded-xl border border-stroke-soft bg-bg-white p-6 shadow-elevation-1">
          <h3 className="text-base font-semibold text-text-strong">
            {formatMessage({ id: "cockpit.garden.settings", defaultMessage: "Settings" })}
          </h3>
          <p className="mt-2 text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.garden.settingsPlaceholder",
              defaultMessage: "Garden settings will be displayed here",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
