import { useInViewReveal } from "@green-goods/shared";
import { useIntl } from "react-intl";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

interface GlossaryTerm {
  id: string;
  labelId: string;
  defaultLabel: string;
  bodyId: string;
  defaultBody: string;
  /** Path on the docs subdomain. Joined to `https://docs.greengoods.app`. */
  docsPath: string;
}

/**
 * Editorial glossary — short, scannable definitions for the public site.
 *
 * Curated from `docs/docs/reference/glossary-community.md` (the canonical
 * vocabulary). Each entry is a one-sentence plain-language gloss with a
 * deeper link into the docs glossary for full definition + cross-references.
 *
 * Order: alphabetical so the visitor can skim. Term names use the canonical
 * casing from the docs glossary.
 */
const TERMS: readonly GlossaryTerm[] = [
  {
    id: "action",
    labelId: "public.glossary.term.action.label",
    defaultLabel: "Action",
    bodyId: "public.glossary.term.action.body",
    defaultBody:
      "A documented activity a gardener can perform — the unit of work template. Each Action names what to do, what to capture, and what proof comes next.",
    docsPath: "/glossary#action",
  },
  {
    id: "assessment",
    labelId: "public.glossary.term.assessment.label",
    defaultLabel: "Assessment",
    bodyId: "public.glossary.term.assessment.body",
    defaultBody:
      "The diagnosis-and-plan stage of a Garden's season — written by operators and evaluators to name what the place needs and what counts as good.",
    docsPath: "/glossary#assessment",
  },
  {
    id: "cookieJar",
    labelId: "public.glossary.term.cookieJar.label",
    defaultLabel: "Cookie Jar",
    bodyId: "public.glossary.term.cookieJar.body",
    defaultBody:
      "A shared fund where supporters donate to a Garden's near-term Work. Cookie Jars are allowlist-gated so the right hands can claim from them.",
    docsPath: "/glossary#cookie-jar",
  },
  {
    id: "evaluator",
    labelId: "public.glossary.term.evaluator.label",
    defaultLabel: "Evaluator",
    bodyId: "public.glossary.term.evaluator.body",
    defaultBody:
      "A domain expert who reviews submitted Work and signs off with a confidence band and verification method. Their care is what turns a field log into evidence.",
    docsPath: "/glossary#evaluator",
  },
  {
    id: "garden",
    labelId: "public.glossary.term.garden.label",
    defaultLabel: "Garden",
    bodyId: "public.glossary.term.garden.body",
    defaultBody:
      "A community of gardeners doing regenerative work in a place. Each Garden has its own Vault, operator, and gardeners, and its own public record.",
    docsPath: "/glossary#garden",
  },
  {
    id: "gardener",
    labelId: "public.glossary.term.gardener.label",
    defaultLabel: "Gardener",
    bodyId: "public.glossary.term.gardener.body",
    defaultBody:
      "A person who documents Work in the field — soil turned, seedlings planted, hours given — using the Green Goods app, even offline.",
    docsPath: "/glossary#gardener",
  },
  {
    id: "impactCertificate",
    labelId: "public.glossary.term.impactCertificate.label",
    defaultLabel: "Impact Certificate",
    bodyId: "public.glossary.term.impactCertificate.body",
    defaultBody:
      "A bundle of the season's approved Work, evaluator-verified and anchored to a public blockchain so the record stays readable beyond any one platform.",
    docsPath: "/glossary#impact-certificate",
  },
  {
    id: "operator",
    labelId: "public.glossary.term.operator.label",
    defaultLabel: "Operator",
    bodyId: "public.glossary.term.operator.body",
    defaultBody:
      "The person who runs a Garden — assembling the season's plan, accepting gardeners, and confirming the Work that gets recorded.",
    docsPath: "/glossary#operator",
  },
  {
    id: "vault",
    labelId: "public.glossary.term.vault.label",
    defaultLabel: "Vault",
    bodyId: "public.glossary.term.vault.body",
    defaultBody:
      "A long-term deposit attached to a Garden whose yield supports the Garden's Work over many seasons. Endowing a Vault keeps the principal in place.",
    docsPath: "/glossary#vault",
  },
  {
    id: "work",
    labelId: "public.glossary.term.work.label",
    defaultLabel: "Work",
    bodyId: "public.glossary.term.work.body",
    defaultBody:
      "A specific instance of an Action performed by a gardener — captured with photo, description, and metadata, then attested on-chain after operator approval.",
    docsPath: "/glossary#work",
  },
] as const;

const DOCS_BASE = "https://docs.greengoods.app";

/**
 * Glossary — public-editorial vocabulary at /glossary.
 *
 * Short, scannable definitions that lower the barrier for non-web3 visitors
 * who hit terms like "Hypercert", "Vault", "Attestation". Each entry links
 * to the canonical docs glossary for fuller definition and cross-references.
 *
 * Linked from PublicFooter and from PublicReadDeeper instances that touch
 * vocabulary-heavy surfaces.
 */
export default function GlossaryPage() {
  const { formatMessage } = useIntl();
  const { ref: termsRef, revealed: termsRevealed } = useInViewReveal<HTMLElement>();

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-glossary-hero-title"
        title={formatMessage(
          {
            id: "public.glossary.heroTitle",
            defaultMessage: "A field <accent>vocabulary</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.glossary.heroLede",
          defaultMessage:
            "Plain-language definitions for the words you'll meet here. Click any term to read the canonical entry in the docs glossary.",
        })}
      />

      <section
        ref={termsRef}
        data-revealed={termsRevealed}
        className="editorial-section-reveal bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pt-40 md:pb-28"
        aria-labelledby="public-glossary-terms-title"
      >
        <div className="editorial-cascade mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.glossary.kicker",
                defaultMessage: "§ 01 — Terms",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-glossary-terms-title">
              {formatMessage({
                id: "public.glossary.title",
                defaultMessage: "Words the public record uses.",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-4 max-w-2xl">
              {formatMessage({
                id: "public.glossary.lede",
                defaultMessage:
                  "Each definition is a starting line. The docs glossary holds the full entry, with cross-references and technical detail for builders.",
              })}
            </EditorialLede>
          </header>

          <dl className="mt-8 divide-y divide-stroke-soft-200 border-b border-stroke-soft-200">
            {TERMS.map((term) => (
              <div
                key={term.id}
                className="grid grid-cols-1 gap-3 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-baseline md:gap-8 md:py-7"
              >
                <dt className="font-serif text-2xl font-normal leading-[1.1] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
                  {formatMessage({ id: term.labelId, defaultMessage: term.defaultLabel })}
                </dt>
                <dd className="text-base leading-[1.6] text-text-sub-600 md:text-lg">
                  {formatMessage({ id: term.bodyId, defaultMessage: term.defaultBody })}
                </dd>
                <div className="md:justify-self-end">
                  <EditorialLinkArrow to={`${DOCS_BASE}${term.docsPath}`} external>
                    {formatMessage({
                      id: "public.glossary.readDocs",
                      defaultMessage: "Read in docs",
                    })}
                  </EditorialLinkArrow>
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-12 border-t border-stroke-soft-200 pt-6">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
              {formatMessage({
                id: "public.glossary.canonicalKicker",
                defaultMessage: "Canonical source",
              })}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-[1.6] text-text-sub-600 md:text-base">
              {formatMessage({
                id: "public.glossary.canonicalBody",
                defaultMessage:
                  "The docs glossary is the source of truth for vocabulary across code, copy, and design prompts. Builder terms (Allowlist, Bundler, ERC-4337) live there too.",
              })}
            </p>
            <div className="mt-4">
              <EditorialLinkArrow to={`${DOCS_BASE}/glossary`} external>
                {formatMessage({
                  id: "public.glossary.openDocsGlossary",
                  defaultMessage: "Open the full docs glossary",
                })}
              </EditorialLinkArrow>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter variant="soil" />
    </>
  );
}
