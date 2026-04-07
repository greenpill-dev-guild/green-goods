import { useGardens } from "@green-goods/shared";
import { useIntl } from "react-intl";

/**
 * Protocol-wide impact gallery — aggregate metrics and hypercert placeholder.
 * Public view, read-only.
 */
export default function ImpactGallery() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = useGardens();

  const totalAssessments = gardens.reduce((sum, g) => sum + (g.assessments?.length ?? 0), 0);
  const totalGardeners = new Set(gardens.flatMap((g) => g.gardeners ?? [])).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-text-strong">
        {formatMessage({ id: "public.impact.title", defaultMessage: "Impact" })}
      </h1>
      <p className="mt-2 text-sm text-text-sub">
        {formatMessage({
          id: "public.impact.description",
          defaultMessage: "Protocol-wide regenerative impact metrics",
        })}
      </p>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-bg-weak animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "public.impact.totalAssessments",
                defaultMessage: "Total Assessments",
              })}
            </p>
            <p className="mt-1 text-2xl font-bold text-text-strong">{totalAssessments}</p>
          </div>
          <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "public.impact.totalGardens",
                defaultMessage: "Total Gardens",
              })}
            </p>
            <p className="mt-1 text-2xl font-bold text-text-strong">{gardens.length}</p>
          </div>
          <div className="rounded-xl border border-stroke-soft bg-bg-white p-4">
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "public.impact.totalGardeners",
                defaultMessage: "Total Gardeners",
              })}
            </p>
            <p className="mt-1 text-2xl font-bold text-text-strong">{totalGardeners}</p>
          </div>
        </div>
      )}

      {/* Hypercert Gallery — responsive grid per frontend-design Rule 11 */}
      <div
        data-testid="hypercert-gallery"
        className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {gardens.flatMap((g) =>
          (g.assessments ?? []).map((assessment) => (
            <div
              key={assessment.id}
              className="rounded-xl border border-stroke-soft bg-bg-white p-4"
            >
              <div className="h-32 rounded-lg bg-primary-alpha-10" />
              <p className="mt-3 text-sm font-medium text-text-strong truncate" title={g.name}>
                {g.name}
              </p>
              <p className="mt-1 text-xs text-text-sub">Assessment {assessment.id}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
