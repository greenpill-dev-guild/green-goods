import { useActions } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";

/**
 * Read-only action template gallery.
 * Public view — no auth required, no create/edit controls.
 */
export default function ActionsGallery() {
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading } = useActions();

  const getDomainLabel = (domain: number) => {
    switch (domain) {
      case 0:
        return formatMessage({ id: "app.domain.tab.solar", defaultMessage: "Solar" });
      case 1:
        return formatMessage({ id: "app.domain.tab.agro", defaultMessage: "Agro" });
      case 2:
        return formatMessage({ id: "app.domain.tab.education", defaultMessage: "Education" });
      case 3:
        return formatMessage({ id: "app.domain.tab.waste", defaultMessage: "Waste" });
      default:
        return formatMessage({
          id: "public.actions.domain.unknown",
          defaultMessage: "Unknown",
        });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-text-strong">
        {formatMessage({ id: "public.actions.title", defaultMessage: "Actions" })}
      </h1>
      <p className="mt-2 text-sm text-text-sub">
        {formatMessage({
          id: "public.actions.description",
          defaultMessage: "Browse available regenerative action templates",
        })}
      </p>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-bg-weak animate-pulse" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
          {formatMessage({
            id: "public.actions.empty",
            defaultMessage: "Action templates will appear here as they are published.",
          })}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action) => (
            <div key={action.id} className="rounded-xl border border-stroke-soft bg-bg-white p-4">
              {action.media.length > 0 && (
                <ImageWithFallback
                  src={action.media[0]}
                  alt={action.title}
                  className="h-32 w-full rounded-lg object-cover"
                />
              )}
              <h3
                className="mt-3 text-base font-semibold text-text-strong truncate"
                title={action.title}
              >
                {action.title}
              </h3>
              <p className="mt-1 text-sm text-text-sub line-clamp-2">{action.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-bg-weak px-2.5 py-0.5 text-xs font-medium text-text-soft">
                  {getDomainLabel(action.domain as number)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
