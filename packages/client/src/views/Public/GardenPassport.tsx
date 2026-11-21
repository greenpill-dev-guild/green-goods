import { usePublicGardenPassport } from "@green-goods/shared/commitment-pooling/public";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { usePublicGardenDetail } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import { publicGardenHelpers } from "@green-goods/shared/hooks/public/usePublicGardens";
import type { Address } from "@green-goods/shared/types/domain";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import {
  EditorialGhostButton,
  EditorialGhostLink,
  EditorialPrimaryLink,
  EditorialSkeleton,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicReadUnavailable } from "@/components/Public/PublicReadUnavailable";
import { getPublicHeroImage } from "@/content/publicCuration";
import { GardenPassportRecord } from "./GardenPassportRecord";

/**
 * GardenPassport: the public passport at `/gardens/:id/passport` (DL-201).
 *
 * One garden's record for a funder: what it promised, what support reached it, what it delivered
 * and what is still to deliver, each figure in its own unit with its window, freshness and
 * source. An editorial page in the garden page's grammar, not a dashboard: one sentence, a
 * four-line ledger, then vouchers and G$ in numbered sections.
 *
 * A passport exists only for a garden whose stewards agreed to publish one. Every other garden's
 * passport address says so and reads nothing. Figures are live records only: nothing here is
 * simulated, and a source that could not be read says so instead of showing a zero.
 */
export default function GardenPassport() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const chainId = DEFAULT_CHAIN_ID;
  const detail = usePublicGardenDetail(id, { chainId });
  const garden = detail.data?.garden ?? null;
  const state = usePublicGardenPassport(garden ? (garden.id as Address) : undefined, { chainId });

  if (detail.isError && !detail.data) {
    return (
      <PassportStatePage
        titleId="public-passport-unavailable-title"
        title={formatMessage({ id: "public.gardenDetail.unavailable" })}
        lede={formatMessage({ id: "public.gardenDetail.unavailableHelp" })}
        actions={
          <EditorialGhostButton onClick={() => void detail.refetch()}>
            {formatMessage({ id: "public.gardenDetail.retry", defaultMessage: "Try Again" })}
          </EditorialGhostButton>
        }
      />
    );
  }
  if (!detail.isLoading && !garden) {
    return (
      <PassportStatePage
        titleId="public-passport-not-found-title"
        title={formatMessage({ id: "public.gardenDetail.notFound" })}
        lede={formatMessage({
          id: "public.passport.notFoundHelp",
          defaultMessage: "No garden answers to this address, so there is no passport to read.",
        })}
        actions={
          <EditorialPrimaryLink to="/gardens">
            {formatMessage({ id: "public.gardenDetail.backToGardens" })}
          </EditorialPrimaryLink>
        }
      />
    );
  }

  const name = garden?.name ?? "";
  const slug = garden ? publicGardenHelpers.deriveSlug(name, garden.id) : (id ?? "");
  const gardenHref = `/gardens/${encodeURIComponent(slug)}`;
  const listed = detail.data ? !detail.data.unlisted : false;

  return (
    <>
      {/* An unpublished passport, like an unlisted garden, stays out of search results. */}
      {!state.published || !listed ? (
        <Helmet>
          <meta name="robots" content="noindex" />
        </Helmet>
      ) : null}
      <PublicEditorialHero
        variant="banner"
        imageSrc={garden?.bannerImage || getPublicHeroImage("gardens")}
        imageFallbackSrc={getPublicHeroImage("gardens")}
        imageAlt=""
        titleId="public-passport-title"
        title={
          garden
            ? formatMessage(
                { id: "public.passport.title", defaultMessage: "Passport of {name}" },
                { name }
              )
            : " "
        }
        lede={formatMessage({
          id: "public.passport.lede",
          defaultMessage:
            "A public record of what this garden promised, the support that reached it, what it delivered and what is still to come.",
        })}
      />

      <div className="bg-bg-weak-50 px-6 pt-16 pb-16 sm:px-10 sm:pt-20 md:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-16">
          <Link
            to={gardenHref}
            viewTransition
            className="inline-flex min-h-11 items-center gap-2 self-start break-words text-sm font-medium text-primary-action underline underline-offset-4 transition-colors hover:text-primary-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-action"
          >
            <span aria-hidden="true">←</span>
            {name ||
              formatMessage({ id: "public.sharedLink.garden", defaultMessage: "View Garden" })}
          </Link>

          {!garden || state.isPending ? (
            <div aria-busy="true" className="flex flex-col gap-4">
              <EditorialSkeleton className="h-8 w-full max-w-3xl" />
              <EditorialSkeleton className="h-8 w-2/3 max-w-2xl" />
              <EditorialSkeleton className="mt-8 h-5 w-1/2" />
              <EditorialSkeleton className="h-5 w-1/3" />
            </div>
          ) : !state.published ? (
            <div className="flex max-w-2xl flex-col gap-4">
              <p className="font-serif text-2xl leading-snug text-text-strong-950 md:text-3xl">
                {formatMessage({
                  id: "public.passport.unpublished",
                  defaultMessage: "This garden has not published a passport.",
                })}
              </p>
              <p className="text-base leading-relaxed text-text-sub-600">
                {formatMessage({ id: "public.passport.unpublishedHelp" })}
              </p>
              <div className="mt-2">
                <EditorialGhostLink to={gardenHref}>
                  {formatMessage({
                    id: "public.passport.viewGarden",
                    defaultMessage: "View the Garden",
                  })}
                </EditorialGhostLink>
              </div>
            </div>
          ) : !state.passport ? (
            // The whole read failed: a failed read is never drawn as an empty passport.
            <PublicReadUnavailable onRetry={state.refetch} />
          ) : (
            <GardenPassportRecord
              passport={state.passport}
              onRetry={state.refetch}
              gardenHref={gardenHref}
              fundHref={listed ? `/fund?garden=${encodeURIComponent(slug)}` : undefined}
            />
          )}
        </div>
      </div>
      <PublicFooter variant="soil" />
    </>
  );
}

/** A passport address with no garden behind it, or one whose garden could not be read. */
function PassportStatePage({
  titleId,
  title,
  lede,
  actions,
}: {
  titleId: string;
  title: string;
  lede: string;
  actions: ReactNode;
}) {
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("gardens")}
        imageAlt=""
        titleId={titleId}
        title={title}
        lede={lede}
        actions={actions}
      />
      <div className="flex-1 bg-bg-weak-50 pt-36 sm:pt-40" />
      <PublicFooter variant="soil" />
    </>
  );
}
