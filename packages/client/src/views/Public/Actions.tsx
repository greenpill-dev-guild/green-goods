import { useActions } from "@green-goods/shared";
import { useIntl } from "react-intl";

const DOMAIN_LABELS: Record<number, string> = {
  0: "Solar",
  1: "Agro",
  2: "Edu",
  3: "Waste",
};

/**
 * Read-only action template gallery.
 * Public view — no auth required, no create/edit controls.
 */
export default function ActionsGallery() {
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading } = useActions();

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
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action) => (
            <div key={action.id} className="rounded-xl border border-stroke-soft bg-bg-white p-4">
              {action.media.length > 0 && (
                <img src={action.media[0]} alt="" className="h-32 w-full rounded-lg object-cover" />
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
                  {DOMAIN_LABELS[action.domain as number] ?? "Unknown"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
