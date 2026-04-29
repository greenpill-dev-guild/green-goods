import {
  type Action,
  useActions,
  useApp,
  useInstallGuidance,
  usePublicInstallHandler,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { PublicActionCard } from "@/components/Public/PublicActionCard";
import { PublicSourceDialog } from "@/components/Public/PublicSourceDialog";

const DOMAINS = [
  { id: "all", labelId: "public.actions.domain.all", defaultLabel: "All" },
  { id: "0", labelId: "app.domain.tab.solar", defaultLabel: "Solar" },
  { id: "1", labelId: "app.domain.tab.agro", defaultLabel: "Agro" },
  { id: "2", labelId: "app.domain.tab.education", defaultLabel: "Education" },
  { id: "3", labelId: "app.domain.tab.waste", defaultLabel: "Waste" },
] as const;

/**
 * Actions — readable public Action library.
 *
 * Filterable by domain, opens a source-anchored read-only dialog per Action.
 * No create/edit controls.
 */
export default function ActionsGallery() {
  const { formatMessage } = useIntl();
  const { data: actions = [], isLoading } = useActions();
  const { isMobile, platform, isInstalled, wasInstalled, deferredPrompt, promptInstall } = useApp();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );
  const handleInstallClick = usePublicInstallHandler(guidance, promptInstall);
  const [domain, setDomain] = useState<string>("all");
  const [activeAction, setActiveAction] = useState<Action | null>(null);

  const filtered = useMemo(() => {
    if (domain === "all") return actions;
    return actions.filter((action) => String(action.domain) === domain);
  }, [actions, domain]);

  return (
    <div className="bg-bg-weak-50">
      <header className="mx-auto max-w-7xl px-6 pt-12 pb-6 sm:px-10 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
          {formatMessage({ id: "public.actions.kicker", defaultMessage: "Library" })}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-text-strong-950 md:text-5xl">
          {formatMessage({ id: "public.actions.title", defaultMessage: "Actions" })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-sub-600 md:text-base">
          {formatMessage({
            id: "public.actions.description",
            defaultMessage:
              "Action templates Gardens use to plan, document, and verify regenerative Work.",
          })}
        </p>
      </header>

      <nav
        aria-label={formatMessage({
          id: "public.actions.filterLabel",
          defaultMessage: "Filter Actions by domain",
        })}
        className="mx-auto max-w-7xl border-y border-stroke-soft-200 px-6 py-4 sm:px-10"
      >
        <ul className="flex flex-wrap gap-2">
          {DOMAINS.map((entry) => {
            const isActive = domain === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setDomain(entry.id)}
                  className={
                    isActive
                      ? "rounded-full bg-text-strong-950 px-4 py-1.5 text-xs font-medium text-static-white"
                      : "rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-1.5 text-xs font-medium text-text-sub-600 hover:bg-bg-weak-50"
                  }
                >
                  {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-16 sm:px-10">
        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-3xl bg-bg-white-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-stroke-soft-200 bg-bg-white-0 p-8 text-sm text-text-sub-600">
            {formatMessage({
              id: "public.actions.empty",
              defaultMessage: "Action templates will appear here as they are published.",
            })}
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((action) => (
              <li key={action.id}>
                <PublicActionCard action={action} onOpen={setActiveAction} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeAction ? (
        <PublicSourceDialog
          open
          onClose={() => setActiveAction(null)}
          title={activeAction.title}
          subtitle={formatMessage({
            id: `app.domain.tab.${typeof activeAction.domain === "string" ? activeAction.domain : domainSlug(activeAction.domain)}`,
            defaultMessage: String(activeAction.domain),
          })}
        >
          {activeAction.media[0] ? (
            <img
              src={activeAction.media[0]}
              alt={activeAction.title}
              className="w-full rounded-2xl object-cover"
            />
          ) : null}
          {activeAction.description ? (
            <p className="text-sm text-text-strong-950">{activeAction.description}</p>
          ) : null}
          <p className="text-xs text-text-soft-400">
            {formatMessage({
              id: "public.actions.dialog.participate",
              defaultMessage:
                "Install the Green Goods app to log Work for this Action with your Garden.",
            })}
          </p>
          <a
            href="#install"
            onClick={handleInstallClick}
            data-install-action={guidance.primaryAction.type}
            className="inline-flex w-fit rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground hover:bg-primary-action-hover"
          >
            {formatMessage({ id: "public.nav.installApp", defaultMessage: "Install App" })}
          </a>
        </PublicSourceDialog>
      ) : null}
    </div>
  );
}

function domainSlug(domain: number): string {
  switch (domain) {
    case 0:
      return "solar";
    case 1:
      return "agro";
    case 2:
      return "education";
    case 3:
      return "waste";
    default:
      return "unknown";
  }
}
