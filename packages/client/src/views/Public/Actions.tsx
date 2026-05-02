import { type Action, cn, useActions } from "@green-goods/shared";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  type EditorialDomain,
  EditorialDomainChip,
  EditorialHeading,
  EditorialKicker,
  EditorialNumeral,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicActionCard } from "@/components/Public/PublicActionCard";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicInstallAction } from "@/components/Public/PublicInstallAction";
import { PublicSourceDialog } from "@/components/Public/PublicSourceDialog";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

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

interface DomainExplainer {
  id: Exclude<EditorialDomain, "all">;
  numeral: string;
  titleId: string;
  defaultTitle: string;
  bodyId: string;
  defaultBody: string;
  /** Tailwind utility for the top accent bar; uses domain ink tokens. */
  accentClass: string;
  /** Tailwind utility for the numeral tint; uses domain ink tokens. */
  numeralClass: string;
}

const DOMAIN_EXPLAINERS: readonly DomainExplainer[] = [
  {
    id: "solar",
    numeral: "1.",
    titleId: "public.actions.domains.solar.title",
    defaultTitle: "Solar",
    bodyId: "public.actions.domains.solar.body",
    defaultBody:
      "Distributed energy work — small installations, microgrid maintenance, and the people learning to keep them running.",
    accentClass: "bg-domain-solar",
    numeralClass: "text-domain-solar",
  },
  {
    id: "agro",
    numeral: "2.",
    titleId: "public.actions.domains.agro.title",
    defaultTitle: "Agroforestry",
    bodyId: "public.actions.domains.agro.body",
    defaultBody:
      "Tree planting, harvest records, and soil care — the slow work of rebuilding land while keeping it productive.",
    accentClass: "bg-domain-agro",
    numeralClass: "text-domain-agro",
  },
  {
    id: "education",
    numeral: "3.",
    titleId: "public.actions.domains.education.title",
    defaultTitle: "Education",
    bodyId: "public.actions.domains.education.body",
    defaultBody:
      "Workshops, learning circles, and curriculum that pass regenerative practice from one generation to the next.",
    accentClass: "bg-domain-education",
    numeralClass: "text-domain-education",
  },
  {
    id: "waste",
    numeral: "4.",
    titleId: "public.actions.domains.waste.title",
    defaultTitle: "Waste",
    bodyId: "public.actions.domains.waste.body",
    defaultBody:
      "Recycling streams, composting, and reuse projects that close loops and keep materials out of landfills.",
    accentClass: "bg-domain-waste",
    numeralClass: "text-domain-waste",
  },
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
        variant="banner"
        imageSrc={getPublicHeroImage("actions")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-actions-hero-title"
        title={formatMessage(
          {
            id: "public.actions.heroTitle",
            defaultMessage: "A field guide for <accent>regenerative work</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.actions.heroLede",
          defaultMessage:
            "Actions are the templates Gardens use to document Work across solar, agroforestry, education, and waste. Each Action names what to do, what to capture, and what proof the next stage will need. Together they form a field guide every Gardener can run from.",
        })}
      />

      {/* § 01 — Four domains explainer */}
      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-12 sm:px-10 sm:pt-36 md:pt-40 md:pb-16"
        aria-labelledby="public-actions-domains-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.actions.domains.kicker",
                defaultMessage: "§ 01 — Four domains",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-actions-domains-title">
              {formatMessage({
                id: "public.actions.domains.title",
                defaultMessage: "Where regenerative work shows up.",
              })}
            </EditorialHeading>
          </header>

          <ul className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {DOMAIN_EXPLAINERS.map((domain) => (
              <li key={domain.id} className="flex flex-col gap-4">
                <span aria-hidden="true" className={cn("h-[3px] w-12", domain.accentClass)} />
                <EditorialNumeral className={domain.numeralClass}>
                  {domain.numeral}
                </EditorialNumeral>
                <h3 className="font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
                  {formatMessage({
                    id: domain.titleId,
                    defaultMessage: domain.defaultTitle,
                  })}
                </h3>
                <p className="text-sm leading-[1.6] text-text-sub-600 md:text-base">
                  {formatMessage({
                    id: domain.bodyId,
                    defaultMessage: domain.defaultBody,
                  })}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
                  {formatMessage(
                    {
                      id: "public.actions.domains.count",
                      defaultMessage:
                        "{count, plural, =0 {No templates yet} one {# template} other {# templates}}",
                    },
                    { count: counts[domain.id] ?? 0 }
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* § 02 — Field guide */}
      <section
        className="bg-bg-weak-50 px-6 pt-12 pb-16 sm:px-10 md:pt-16 md:pb-20"
        aria-labelledby="public-actions-grid-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
              {formatMessage({
                id: "public.actions.kicker",
                defaultMessage: "§ 02 — Field guide",
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

      <PublicFooter variant="soil" />

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
          <PublicInstallAction>
            {({ label, href, onClick, dataInstallAction }) => (
              <a
                href={href}
                onClick={onClick}
                data-install-action={dataInstallAction}
                className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground hover:bg-primary-action-hover"
              >
                {label}
              </a>
            )}
          </PublicInstallAction>
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
