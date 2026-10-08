import type { Address } from "@green-goods/shared/types/domain";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  publicGardenHelpers,
  usePublicGardens,
} from "@green-goods/shared/hooks/public/usePublicGardens";
import { useHypercerts } from "@green-goods/shared/hooks/hypercerts/useHypercerts";
import { usePublicGardenDetail } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import {
  EditorialGhostButton,
  EditorialGhostLink,
  EditorialHeading,
  EditorialPrimaryLink,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicGardenCard } from "@/components/Public/PublicGardenCard";
import { PublicInstallCta } from "@/components/Public/PublicInstallCta";
import { getPublicHeroImage } from "@/content/publicCuration";
import { getPublicGardenDescription } from "@/content/publicGardenNarrative";
import { StatCell } from "./GardenDetailAtoms";
import { CommitmentsSection } from "./GardenDetailCommitments";
import { FieldNotesSection } from "./GardenDetailFieldNotes";
import { CertificatesSection, StewardsSection } from "./GardenDetailSections";
import { rememberGardenReturn } from "./gardenReturnFocus";

/**
 * GardenDetail — the public Garden page at `/gardens/:id`.
 *
 * Ordinary editorial page, composed from the same primitives as `/gardens` and
 * `/impact`: banner hero, four-cell record strip, then numbered full-width
 * sections. It replaced a Radix modal that had been wired to this route inside
 * an unrelated homepage-polish commit; `DESIGN.browser.md` § `/gardens/:id` had
 * described a page the whole time.
 *
 * Approved work and local coordinators lead the page. Confirmed empty
 * certificate and pre-launch pool sections are omitted; failed reads retain
 * their recovery state.
 *
 * Identity paints from the `usePublicGardens` list — normally warm in cache
 * from the archive the reader just clicked — so the name is on screen before
 * the detail query resolves. Where the two disagree the detail hook wins.
 */
export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const { data: gardens = [] } = usePublicGardens();
  // Pinned so the field-note explorer links resolve against the same chain the
  // notes were read from.
  const chainId = DEFAULT_CHAIN_ID;
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailFailed,
    refetch: refetchDetail,
  } = usePublicGardenDetail(id, { chainId });

  const summary = useMemo(() => {
    if (!id) return undefined;
    const lower = id.trim().toLowerCase();
    const exact = gardens.find(
      (g) => g.id.toLowerCase() === lower || g.address.toLowerCase() === lower
    );
    if (exact) return exact;
    // Ambiguous slugs resolve to nothing rather than to an arbitrary Garden.
    const slugMatches = gardens.filter(
      (g) => publicGardenHelpers.deriveSlug(g.name, g.id) === lower
    );
    return slugMatches.length === 1 ? slugMatches[0] : undefined;
  }, [gardens, id]);

  const garden = detail?.garden ?? null;
  const {
    hypercerts = [],
    isLoading: hypercertsLoading,
    hasError: hypercertsUnavailable,
    refetch: refetchHypercerts,
  } = useHypercerts({
    gardenId: garden?.id,
  });

  const identity = useMemo(() => {
    if (garden) {
      return {
        name: garden.name,
        location: garden.location,
        description: getPublicGardenDescription(garden, formatMessage),
        bannerImage: garden.bannerImage,
        slug: publicGardenHelpers.deriveSlug(garden.name ?? "", garden.id),
        stewards: (garden.stewards ?? []) as Address[],
      };
    }
    if (summary) {
      return {
        name: summary.name,
        location: summary.location,
        description: getPublicGardenDescription(summary, formatMessage),
        bannerImage: summary.bannerImage,
        slug: summary.slug,
        stewards: summary.stewards,
      };
    }
    return null;
  }, [garden, summary, formatMessage]);
  // Hand the archive a focus target for the reader's way back.
  useEffect(() => {
    rememberGardenReturn(identity?.slug);
  }, [identity?.slug]);

  // A failed indexer read is not a missing Garden. `getGardens` times out in
  // production, and falling through to not-found told the reader their Garden
  // does not exist — the same "publish an unknown as a fact" failure the stat
  // strip's em dash exists to prevent.
  if (detailFailed && !detail) return <GardenUnavailable onRetry={() => void refetchDetail()} />;
  if (!detailLoading && !garden) return <GardenNotFound />;

  const worksUnavailable = detail?.unavailableSources.works ?? false;
  const assessmentsUnavailable = detail?.unavailableSources.assessments ?? false;
  const fundHref = identity ? `/fund?garden=${encodeURIComponent(identity.slug)}` : "/fund";

  const unlisted = detail?.unlisted ?? false;
  // The detail decides; until it arrives, only the archive's own card proves a Garden listed.
  const listed = detail ? !detail.unlisted : Boolean(summary);

  return (
    <>
      {/* Unlisted means unlisted to crawlers too. */}
      {unlisted ? (
        <Helmet>
          <meta name="robots" content="noindex" />
        </Helmet>
      ) : null}
      <PublicEditorialHero
        variant="banner"
        imageSrc={identity?.bannerImage || getPublicHeroImage("gardens")}
        imageFallbackSrc={getPublicHeroImage("gardens")}
        imageAlt=""
        titleId="public-garden-detail-title"
        title={identity?.name || " "}
        lede={
          identity?.location ? (
            <span className="block min-h-[2lh] break-words">{identity.location}</span>
          ) : undefined
        }
        publicationMark={
          unlisted
            ? formatMessage({
                id: "public.gardenDetail.unlisted",
                defaultMessage: "This Garden is not in the public lists.",
              })
            : undefined
        }
      />

      <div className="bg-bg-weak-50 px-6 pt-16 pb-16 sm:px-10 sm:pt-20 md:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-20">
          <div className="space-y-8">
            <Link
              to="/gardens"
              viewTransition
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-action underline underline-offset-4 transition-colors hover:text-primary-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-action"
            >
              <span aria-hidden="true">←</span>
              {formatMessage({
                id: "public.gardenDetail.backToArchive",
                defaultMessage: "All Gardens",
              })}
            </Link>
            <section aria-labelledby="public-garden-description-title" className="max-w-3xl">
              <EditorialHeading id="public-garden-description-title" size="sub">
                {formatMessage({
                  id: "public.gardenDetail.description.heading",
                  defaultMessage: "About this garden",
                })}
              </EditorialHeading>
              <p className="mt-4 whitespace-pre-line break-words text-base leading-relaxed text-text-sub-600 sm:text-lg">
                {identity?.description ||
                  formatMessage({
                    id: "public.gardenDetail.place.empty",
                    defaultMessage: "Garden narrative will appear here as it is published.",
                  })}
              </p>
            </section>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-stroke-soft-200 py-8 sm:grid-cols-4">
            <StatCell
              label={formatMessage({
                id: "public.gardenDetail.stats.entries",
                defaultMessage: "Approved work",
              })}
              value={detail?.totalFieldNotes}
              loading={detailLoading}
              unavailable={worksUnavailable}
            />
            <StatCell
              label={formatMessage({
                id: "public.gardenDetail.stats.handsAtWork",
                defaultMessage: "Garden members",
              })}
              value={detail?.gardenerCount}
              loading={detailLoading}
              // Read from the Garden's role lists, so a failed work read cannot hide it.
              unavailable={false}
            />
            <StatCell
              label={formatMessage({
                id: "public.gardenDetail.stats.assessments",
                defaultMessage: "Assessments",
              })}
              value={detail?.assessmentCount}
              loading={detailLoading}
              unavailable={assessmentsUnavailable}
            />
            <StatCell
              label={formatMessage({
                id: "public.gardenDetail.stats.certificates",
                defaultMessage: "Certificates",
              })}
              value={garden ? hypercerts.length : undefined}
              loading={detailLoading || hypercertsLoading}
              unavailable={false}
            />
          </dl>

          <FieldNotesSection
            // Remount per Garden: the section survives a /gardens/a -> /gardens/b
            // param change, and its local page window must not carry over.
            key={id}
            chainId={chainId}
            notes={detail?.fieldNotes ?? []}
            total={detail?.totalFieldNotes ?? 0}
            loading={detailLoading}
            unavailable={worksUnavailable}
          />

          <CommitmentsSection
            // Remount per Garden for the same reason as field notes: the
            // finished-cycle page window must not carry over.
            key={`commitments:${id}`}
            gardenAddress={garden ? (garden.id as Address) : undefined}
            chainId={chainId}
            gardenLoading={detailLoading}
          />

          <CertificatesSection
            certificates={hypercerts}
            loading={detailLoading || hypercertsLoading}
            unavailable={hypercertsUnavailable}
            onRetry={() => void refetchHypercerts()}
          />

          <StewardsSection stewards={identity?.stewards ?? []} loading={detailLoading} />

          <div className="border-t border-stroke-soft-200 pt-10">
            <p className="mb-6 max-w-2xl text-base leading-relaxed text-text-sub-600">
              {formatMessage({ id: "public.gardenDetail.supportHelp" })}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {/* The funding list leaves an unlisted Garden out, so its link would find nothing. */}
              {listed ? (
                <EditorialPrimaryLink to={fundHref}>
                  {formatMessage({
                    id: "public.gardenDetail.support",
                    defaultMessage: "Support This Garden",
                  })}
                </EditorialPrimaryLink>
              ) : null}
              <EditorialGhostLink to="/impact">
                {formatMessage({
                  id: "public.gardenDetail.evidence.cta",
                  defaultMessage: "View Public Evidence",
                })}
              </EditorialGhostLink>
              <EditorialGhostLink to="/#contact">
                {formatMessage({ id: "public.gardenDetail.discussFunding" })}
              </EditorialGhostLink>
            </div>
          </div>
        </div>
      </div>

      <PublicInstallCta destination={garden ? `/home/${garden.id}` : undefined} />
      <PublicFooter variant="soil" />
    </>
  );
}

function GardenUnavailable({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("gardens")}
        imageAlt=""
        titleId="public-garden-unavailable-title"
        title={formatMessage({
          id: "public.gardenDetail.unavailable",
          defaultMessage: "This Garden could not be loaded",
        })}
        lede={formatMessage({
          id: "public.gardenDetail.unavailableHelp",
          defaultMessage:
            "We could not read this Garden's public record right now. Try again in a moment.",
        })}
        actions={
          <EditorialGhostButton onClick={onRetry}>
            {formatMessage({ id: "public.gardenDetail.retry", defaultMessage: "Try Again" })}
          </EditorialGhostButton>
        }
      />
      <GardenRecoverySection />
      <PublicFooter variant="soil" />
    </>
  );
}

function GardenNotFound() {
  const { formatMessage } = useIntl();
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("gardens")}
        imageAlt=""
        titleId="public-garden-not-found-title"
        title={formatMessage({
          id: "public.gardenDetail.notFound",
          defaultMessage: "Garden not found",
        })}
        lede={formatMessage({
          id: "public.sharedLink.unavailableHelp",
          defaultMessage:
            "This record may require sign-in or may no longer be available. Open it in the app and sign in to check access.",
        })}
      />
      <GardenRecoverySection />
      <PublicFooter variant="soil" />
    </>
  );
}

function GardenRecoverySection() {
  const { formatMessage } = useIntl();
  const { data: gardens = [] } = usePublicGardens();
  const suggestions = [...gardens]
    .sort((left, right) => right.lastActivityAt - left.lastActivityAt)
    .slice(0, 3);

  return (
    <section
      className="flex-1 bg-bg-soft-200 px-6 pt-36 pb-12 dark:bg-bg-surface-800 sm:px-10 sm:pt-40 sm:pb-16"
      aria-labelledby="public-garden-explore-title"
    >
      <div className="mx-auto max-w-7xl">
        <EditorialHeading id="public-garden-explore-title" className="text-center">
          {formatMessage({
            id: "public.gardenDetail.explore.title",
            defaultMessage: "Find a garden to explore",
          })}
        </EditorialHeading>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-text-sub-600">
          {formatMessage({
            id: "public.gardenDetail.explore.help",
            defaultMessage:
              "Explore Gardens, follow their documented work, and see the evidence communities share.",
          })}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <EditorialPrimaryLink to="/gardens">
            {formatMessage({
              id: "public.gardenDetail.backToGardens",
              defaultMessage: "Browse Gardens",
            })}
          </EditorialPrimaryLink>
          <EditorialGhostLink to="/impact">
            {formatMessage({
              id: "public.gardenDetail.evidence.cta",
              defaultMessage: "View Public Evidence",
            })}
          </EditorialGhostLink>
        </div>
        {suggestions.length > 0 ? (
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((garden) => (
              <PublicGardenCard key={garden.id} garden={garden} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
