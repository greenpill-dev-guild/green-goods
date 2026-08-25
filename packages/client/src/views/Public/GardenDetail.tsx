import type { Address } from "@green-goods/shared/types/domain";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  publicGardenHelpers,
  usePublicGardens,
} from "@green-goods/shared/hooks/public/usePublicGardens";
import { useHypercerts } from "@green-goods/shared/hooks/hypercerts/useHypercerts";
import { usePublicGardenDetail } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { EditorialGhostLink, EditorialPrimaryLink } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicInstallCta } from "@/components/Public/PublicInstallCta";
import { getPublicHeroImage } from "@/content/publicCuration";
import { StatCell } from "./GardenDetailAtoms";
import { CommitmentsSection } from "./GardenDetailCommitments";
import { FieldNotesSection } from "./GardenDetailFieldNotes";
import { CertificatesSection, OperatorsSection } from "./GardenDetailSections";
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
 * Every section always renders. A Garden with no certificates says so rather
 * than dropping the section, which keeps the ordinals stable between Gardens
 * and gives the commitments section (§ 02) a defined pre-launch home for a
 * Garden whose pool is not open yet.
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
  const { hypercerts = [], isLoading: hypercertsLoading } = useHypercerts({
    gardenId: garden?.id,
  });

  const identity = useMemo(() => {
    if (garden) {
      return {
        name: garden.name,
        location: garden.location,
        description: garden.description,
        bannerImage: garden.bannerImage,
        slug: publicGardenHelpers.deriveSlug(garden.name ?? "", garden.id),
        operators: (garden.operators ?? []) as Address[],
      };
    }
    if (summary) {
      return {
        name: summary.name,
        location: summary.location,
        description: summary.description,
        bannerImage: summary.bannerImage,
        slug: summary.slug,
        operators: summary.operators,
      };
    }
    return null;
  }, [garden, summary]);

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

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={identity?.bannerImage || getPublicHeroImage("gardens")}
        imageFallbackSrc={getPublicHeroImage("gardens")}
        imageAlt=""
        titleId="public-garden-detail-title"
        kicker={identity?.location || undefined}
        title={identity?.name || " "}
        lede={
          identity?.description ||
          formatMessage({
            id: "public.gardenDetail.place.empty",
            defaultMessage: "Garden narrative will appear here as it is published.",
          })
        }
        actions={
          <EditorialGhostLink to="/gardens">
            <span aria-hidden="true">←</span>
            {formatMessage({
              id: "public.gardenDetail.backToArchive",
              defaultMessage: "All Gardens",
            })}
          </EditorialGhostLink>
        }
      />

      <div className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-20">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-stroke-soft-200 py-8 sm:grid-cols-4">
            <StatCell
              label={formatMessage({
                id: "public.gardenDetail.stats.entries",
                defaultMessage: "Entries",
              })}
              value={detail?.totalFieldNotes}
              loading={detailLoading}
              unavailable={worksUnavailable}
            />
            <StatCell
              label={formatMessage({
                id: "public.gardenDetail.stats.handsAtWork",
                defaultMessage: "Hands at work",
              })}
              value={detail?.contributors.length}
              loading={detailLoading}
              unavailable={worksUnavailable}
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

          <CertificatesSection certificates={hypercerts} loading={hypercertsLoading} />

          <OperatorsSection operators={identity?.operators ?? []} loading={detailLoading} />

          <div className="flex flex-wrap items-center gap-3 border-t border-stroke-soft-200 pt-10">
            <EditorialPrimaryLink to={fundHref}>
              {formatMessage({
                id: "public.gardenDetail.support",
                defaultMessage: "Support this Garden",
              })}
            </EditorialPrimaryLink>
            <EditorialGhostLink to="/impact">
              {formatMessage({
                id: "public.gardenDetail.evidence.cta",
                defaultMessage: "View public evidence",
              })}
            </EditorialGhostLink>
          </div>
        </div>
      </div>

      <PublicInstallCta />
      <PublicFooter variant="soil" />
    </>
  );
}

function GardenUnavailable({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-32 sm:px-10">
        <h1 className="font-serif text-3xl text-text-strong-950">
          {formatMessage({
            id: "public.gardenDetail.unavailable",
            defaultMessage: "This Garden could not be loaded",
          })}
        </h1>
        <p className="mt-3 text-sm text-text-sub-600">
          {formatMessage({
            id: "public.gardenDetail.unavailableHelp",
            defaultMessage:
              "We could not read this Garden's public record right now. Try again in a moment.",
          })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-2.5 text-sm font-medium text-text-strong-950 hover:bg-bg-weak-50"
          >
            {formatMessage({ id: "public.gardenDetail.retry", defaultMessage: "Try again" })}
          </button>
          <Link
            to="/gardens"
            viewTransition
            className="inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-text-sub-600 hover:text-text-strong-950"
          >
            {formatMessage({
              id: "public.gardenDetail.backToGardens",
              defaultMessage: "Browse Gardens",
            })}
          </Link>
        </div>
      </div>
      <PublicFooter variant="soil" />
    </>
  );
}

function GardenNotFound() {
  const { formatMessage } = useIntl();
  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-32 sm:px-10">
        <h1 className="font-serif text-3xl text-text-strong-950">
          {formatMessage({
            id: "public.gardenDetail.notFound",
            defaultMessage: "Garden not found",
          })}
        </h1>
        <p className="mt-3 text-sm text-text-sub-600">
          {formatMessage({
            id: "public.gardenDetail.notFoundHelp",
            defaultMessage:
              "The link may be stale. Browse all Gardens to find what you're looking for.",
          })}
        </p>
        <Link
          to="/gardens"
          viewTransition
          className="mt-6 inline-flex rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-2.5 text-sm font-medium text-text-strong-950 hover:bg-bg-weak-50"
        >
          {formatMessage({
            id: "public.gardenDetail.backToGardens",
            defaultMessage: "Browse Gardens",
          })}
        </Link>
      </div>
      <PublicFooter variant="soil" />
    </>
  );
}
