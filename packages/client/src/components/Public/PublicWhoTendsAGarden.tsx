import { cn, useInViewReveal } from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker, EditorialLede, EditorialLinkArrow } from "./atoms";
import { PublicInstallAction } from "./PublicInstallAction";

type PersonaId = "gardener" | "operator" | "evaluator" | "funder" | "community";

type PersonaCta =
  | { type: "install" }
  | { type: "internal"; to: string }
  | { type: "external"; href: string };

interface PersonaEntry {
  id: PersonaId;
  nameId: string;
  defaultName: string;
  roleId: string;
  defaultRole: string;
  bodyId: string;
  defaultBody: string;
  ctaId: string;
  defaultCta: string;
  cta: PersonaCta;
}

/**
 * Five archetypes that show up in a Garden. Order chosen so the visitor walks
 * outward from the field (Gardener) through stewardship (Operator), through
 * verification (Evaluator), through resourcing (Funder), to the wider circle
 * (Community). Mirrors the persona framing in the canonical user-archetypes
 * doc on the Docusaurus site.
 *
 * Operator and Evaluator CTAs route to docs since these roles aren't open
 * sign-ups today — they're invited and onboarded by an existing Garden.
 */
const PERSONAS: readonly PersonaEntry[] = [
  {
    id: "gardener",
    nameId: "public.home.personas.gardener.name",
    defaultName: "Gardeners",
    roleId: "public.home.personas.gardener.role",
    defaultRole: "Document the work — soil turned, seedlings planted, hours given.",
    bodyId: "public.home.personas.gardener.body",
    defaultBody:
      "A gardener walks a place every season — mapping soil, planting trees, capturing what was done. The Green Goods app turns those moments into a public record without taking the gardener out of the field.",
    ctaId: "public.home.personas.gardener.cta",
    defaultCta: "Install the field app",
    cta: { type: "install" },
  },
  {
    id: "operator",
    nameId: "public.home.personas.operator.name",
    defaultName: "Operators",
    roleId: "public.home.personas.operator.role",
    defaultRole: "Run the garden — assemble the season's plan, accept gardeners, confirm the work.",
    bodyId: "public.home.personas.operator.body",
    defaultBody:
      "Operators are the steady hand of a garden — the one who calls the season's plan, who decides what counts, who approves a gardener's first work. They are the connective tissue between a place's intentions and its proof.",
    ctaId: "public.home.personas.operator.cta",
    defaultCta: "Read the operator guide",
    cta: { type: "external", href: "https://docs.greengoods.app/community/operator-guide" },
  },
  {
    id: "evaluator",
    nameId: "public.home.personas.evaluator.name",
    defaultName: "Evaluators",
    roleId: "public.home.personas.evaluator.role",
    defaultRole: "Verify the record — review submitted work, sign off on confidence and method.",
    bodyId: "public.home.personas.evaluator.body",
    defaultBody:
      "Evaluators are the trust layer of the public record — domain experts who review submitted work, sign off with a confidence band, and name the verification method behind each approval. Their care is what turns a field log into evidence.",
    ctaId: "public.home.personas.evaluator.cta",
    defaultCta: "Read the evaluator guide",
    cta: { type: "external", href: "https://docs.greengoods.app/community/evaluator-guide" },
  },
  {
    id: "funder",
    nameId: "public.home.personas.funder.name",
    defaultName: "Funders",
    roleId: "public.home.personas.funder.role",
    defaultRole: "Resource the work — fund a vault, sponsor an action, hold an Impact Certificate.",
    bodyId: "public.home.personas.funder.body",
    defaultBody:
      "Funders make seasons possible — by donating directly to a Garden's shared fund, by endowing a vault whose yield supports many seasons, or by holding an Impact Certificate as a record of regenerative outcomes. Each path lands with a Garden, not a platform.",
    ctaId: "public.home.personas.funder.cta",
    defaultCta: "See how contributions land",
    cta: { type: "internal", to: "/fund" },
  },
  {
    id: "community",
    nameId: "public.home.personas.community.name",
    defaultName: "Community",
    roleId: "public.home.personas.community.role",
    defaultRole: "Show up locally — visit, witness, mentor, share the season's story.",
    bodyId: "public.home.personas.community.body",
    defaultBody:
      "A garden is held by the people around it — neighbors who visit on a Saturday, elders who mentor a first season, friends who share the season's story. Community shows up in the places where the work happens, and the public record is for them too.",
    ctaId: "public.home.personas.community.cta",
    defaultCta: "Find a garden near you",
    cta: { type: "internal", to: "/gardens" },
  },
] as const;

interface PersonaRowProps {
  persona: PersonaEntry;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}

function PersonaRow({ persona, expanded, onToggle, isLast }: PersonaRowProps) {
  const { formatMessage } = useIntl();

  return (
    <div className={cn("border-t border-stroke-soft-200", isLast ? "border-b" : null)}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`persona-body-${persona.id}`}
        onClick={onToggle}
        className={cn(
          "group flex w-full items-baseline gap-4 py-6 text-left",
          "transition-colors duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
          "motion-safe:hover:bg-bg-weak-50/60 motion-safe:focus-visible:bg-bg-weak-50/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-white-0",
          "md:py-7"
        )}
      >
        <span className="grid flex-1 grid-cols-1 items-baseline gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8">
          <span
            className={cn(
              "font-serif text-2xl font-normal leading-[1.1] tracking-[-0.012em] text-text-strong-950 md:text-3xl",
              "transition-colors duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
              "group-hover:text-primary-action group-focus-visible:text-primary-action"
            )}
          >
            {formatMessage({ id: persona.nameId, defaultMessage: persona.defaultName })}
          </span>
          <span className="text-base leading-[1.55] text-text-sub-600 md:text-lg">
            {formatMessage({ id: persona.roleId, defaultMessage: persona.defaultRole })}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 font-mono text-sm text-text-soft-400 transition-transform duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
            "motion-safe:group-hover:text-primary-action motion-safe:group-focus-visible:text-primary-action",
            expanded ? "rotate-90" : null
          )}
        >
          →
        </span>
      </button>

      <div
        id={`persona-body-${persona.id}`}
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 pb-7 md:max-w-3xl md:pl-0">
            <p className="text-sm leading-[1.65] text-text-sub-600 md:text-base">
              {formatMessage({ id: persona.bodyId, defaultMessage: persona.defaultBody })}
            </p>
            <div>
              {persona.cta.type === "install" ? (
                <PublicInstallAction>
                  {({ href, onClick, dataInstallAction }) => (
                    <a
                      href={href}
                      onClick={onClick}
                      data-install-action={dataInstallAction}
                      className="inline-flex cursor-pointer items-center gap-2 border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover"
                    >
                      {formatMessage({
                        id: persona.ctaId,
                        defaultMessage: persona.defaultCta,
                      })}
                      <span aria-hidden="true">→</span>
                    </a>
                  )}
                </PublicInstallAction>
              ) : persona.cta.type === "internal" ? (
                <EditorialLinkArrow to={persona.cta.to}>
                  {formatMessage({ id: persona.ctaId, defaultMessage: persona.defaultCta })}
                </EditorialLinkArrow>
              ) : (
                <EditorialLinkArrow to={persona.cta.href} external>
                  {formatMessage({ id: persona.ctaId, defaultMessage: persona.defaultCta })}
                </EditorialLinkArrow>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "Who tends a garden" — five-persona narrative on the home page.
 *
 * Sits between PublicRecordLoop (the abstract cycle) and PublicFundingBridge
 * (the funder action) so the visitor walks: cycle → people → action. Each
 * row is a disclosure: collapsed shows name + role, expanded reveals a
 * paragraph and a role-specific call-to-action. Only one row open at a time.
 *
 * Neutral palette on purpose — domain colors here would muddle the semantic
 * (a "solar-tinted" Gardener row would read as "Gardener works on Solar").
 * The cascade reveal + hover highlight + expand interaction provide the
 * dynamic warmth without color confusion.
 *
 * Keyboard / screen-reader contract:
 *   • Each row is a `<button>` with `aria-expanded` and `aria-controls`.
 *   • Tab cycles through row toggles, then through the CTA inside the
 *     expanded body once a row is open.
 *   • Reduced-motion honored — the grid-rows transition relies on a CSS
 *     duration custom property; we don't animate explicit pixel values.
 */
export function PublicWhoTendsAGarden() {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();
  const [expanded, setExpanded] = useState<PersonaId | null>(null);

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal bg-bg-weak-50 px-6 py-16 sm:px-10 md:py-24"
      aria-labelledby="public-home-personas-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <header className="border-b border-stroke-soft-200 pb-6">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.home.personas.kicker",
              defaultMessage: "§ — Who tends a garden",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-home-personas-title">
            {formatMessage({
              id: "public.home.personas.title",
              defaultMessage: "It takes more than gardeners.",
            })}
          </EditorialHeading>
          <EditorialLede className="mt-4 max-w-2xl">
            {formatMessage({
              id: "public.home.personas.lede",
              defaultMessage:
                "Healthy places grow when many hands and eyes meet around the same record. Five people show up here, each making the proof true in their own way.",
            })}
          </EditorialLede>
        </header>

        <div className="mt-2">
          {PERSONAS.map((persona, idx) => (
            <PersonaRow
              key={persona.id}
              persona={persona}
              expanded={expanded === persona.id}
              onToggle={() =>
                setExpanded((current) => (current === persona.id ? null : persona.id))
              }
              isLast={idx === PERSONAS.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
