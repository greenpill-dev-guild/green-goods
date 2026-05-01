import {
  type Action,
  useActions,
  useApp,
  useInstallGuidance,
  usePublicInstallHandler,
} from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { type EditorialDomain, EditorialDomainChip } from "@/components/Public/atoms";
import { PublicActionCard } from "@/components/Public/PublicActionCard";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicSourceDialog } from "@/components/Public/PublicSourceDialog";
import { publicCuration } from "@/content/publicCuration";

interface DomainEntry {
  id: EditorialDomain;
  filterId: string;
  labelId: string;
  defaultLabel: string;
}

const DOMAINS: readonly DomainEntry[] = [
  { id: "all", filterId: "all", labelId: "public.actions.domain.all", defaultLabel: "All" },
  { id: "solar", filterId: "0", labelId: "app.domain.tab.solar", defaultLabel: "Solar" },
  { id: "agro", filterId: "1", labelId: "app.domain.tab.agro", defaultLabel: "Agroforestry" },
  {
    id: "education",
    filterId: "2",
    labelId: "app.domain.tab.education",
    defaultLabel: "Education",
  },
  { id: "waste", filterId: "3", labelId: "app.domain.tab.waste", defaultLabel: "Waste" },
] as const;

/**
 * Actions — readable public Action library.
 *
 * Editorial recomposition:
 *   Hero ("A field guide for regenerative work.") → domain filter strip
 *   with per-domain ink chips → grid of PublicActionCard → optional
 *   PublicSourceDialog → Footer.
 *
 * No create/edit controls — each card opens a read-only source dialog.
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
  const [domain, setDomain] = useState<EditorialDomain>("all");
  const [activeAction, setActiveAction] = useState<Action | null>(null);

  const filtered = useMemo(() => {
    if (domain === "all") return actions;
    const entry = DOMAINS.find((d) => d.id === domain);
    if (!entry) return actions;
    return actions.filter((action) => String(action.domain) === entry.filterId);
  }, [actions, domain]);

  const counts = useMemo(() => {
    const byDomain: Record<string, number> = { all: actions.length };
    for (const entry of DOMAINS) {
      if (entry.id === "all") continue;
      byDomain[entry.id] = actions.filter((a) => String(a.domain) === entry.filterId).length;
    }
    return byDomain;
  }, [actions]);

  return (
    <>
      <PublicEditorialHero
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-actions-hero-title"
        title={formatMessage({
          id: "public.actions.heroTitle",
          defaultMessage: "A field guide for regenerative work.",
        })}
        lede={formatMessage({
          id: "public.actions.heroLede",
          defaultMessage:
            "Actions are the templates Gardens use to document Work across solar, agroforestry, education, and waste.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 md:pt-48 md:pb-28"
        aria-labelledby="public-actions-grid-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
              {formatMessage({
                id: "public.actions.kicker",
                defaultMessage: "Field guide",
              })}
            </p>
            <h2
              id="public-actions-grid-title"
              className="mt-3 font-serif text-3xl font-normal leading-[1.04] tracking-[-0.02em] text-text-strong-950 md:text-4xl"
            >
              {formatMessage({
                id: "public.actions.gridTitle",
                defaultMessage: "Templates Gardens use to plan and document Work.",
              })}
            </h2>
          </header>

          <nav
            aria-label={formatMessage({
              id: "public.actions.filterLabel",
              defaultMessage: "Filter Actions by domain",
            })}
            className="mt-8"
          >
            <ul className="flex flex-wrap gap-2">
              {DOMAINS.map((entry) => (
                <li key={entry.id}>
                  <EditorialDomainChip
                    domain={entry.id}
                    active={domain === entry.id}
                    count={counts[entry.id] ?? 0}
                    onClick={() => setDomain(entry.id)}
                  >
                    {formatMessage({ id: entry.labelId, defaultMessage: entry.defaultLabel })}
                  </EditorialDomainChip>
                </li>
              ))}
            </ul>
          </nav>

          {isLoading ? (
            <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="aspect-[4/3] w-full animate-pulse bg-editorial-warm"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="mt-12 max-w-md font-serif text-xl italic text-text-soft-400">
              {formatMessage({
                id: "public.actions.empty",
                defaultMessage: "Action templates will appear here as they are published.",
              })}
            </p>
          ) : (
            <ul className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((action) => (
                <li key={action.id}>
                  <PublicActionCard action={action} onOpen={setActiveAction} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <PublicFooter />

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
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground hover:bg-primary-action-hover"
          >
            {formatMessage({ id: "public.nav.installApp", defaultMessage: "Install App" })}
          </a>
        </PublicSourceDialog>
      ) : null}
    </>
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
