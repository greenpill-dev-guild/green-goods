import { Button } from "@green-goods/shared/components/Button";
import { useApp } from "@green-goods/shared/providers/App";
import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { lazy, Suspense } from "react";
import { useIntl } from "react-intl";
import {
  EditorialGhostLink,
  EditorialPrimaryLink,
  editorialTitleTags,
  EditorialMediaCardSkeleton,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicFundingBridge } from "@/components/Public/PublicFundingBridge";
import { PublicGetInTouch } from "@/components/Public/PublicGetInTouch";
import { PublicInstallAction } from "@/components/Public/PublicInstallAction";
import { PublicRecordLoop } from "@/components/Public/PublicRecordLoop";
import { PublicWhoTendsAGarden } from "@/components/Public/PublicWhoTendsAGarden";
import { publicCuration } from "@/content/publicCuration";

const PublicHomeEvidence = lazy(() => import("./HomeEvidence"));

/**
 * Home — the editorial public homepage at browser `/`.
 *
 * `/` is always the public website. Installed PWA sessions enter the app
 * through the manifest `start_url` at `/home`.
 *
 * Composition order matches the editorial dialect:
 *   Hero → Featured Gardens → Living Public Record → How it works (the
 *   Needs → Commitment → Work → Learnings cycle) → Who Tends a Garden →
 *   Funding Bridge → Get In Touch → Footer.
 */
export default function Home() {
  const { formatMessage } = useIntl();
  const { isMobile } = useApp();
  const { ref: evidenceRef, revealed: evidenceVisible } = useInViewReveal<HTMLDivElement>({
    threshold: 0.01,
    rootMargin: "0px",
  });
  const exploreLabel = formatMessage({
    id: "public.home.hero.exploreGardens",
    defaultMessage: "Explore Gardens",
  });

  // A phone visitor is on the device they would garden with, so the hero leads
  // with the install path and keeps Explore Gardens as the editorial route.
  // Desktop carries Install App in the header, so its hero pairs discovery with
  // funding. `isMobile` is the device, not the width: a narrow desktop window
  // keeps the desktop pair (DESIGN.browser.md § Homepage).
  const heroActions = isMobile ? (
    <>
      <PublicInstallAction>
        {({ label, href, onClick, disabled, dataInstallAction }) => (
          <Button asChild size="lg">
            <a
              href={href}
              onClick={onClick}
              aria-disabled={disabled || undefined}
              data-install-action={dataInstallAction}
            >
              {label}
            </a>
          </Button>
        )}
      </PublicInstallAction>
      <EditorialGhostLink to="/gardens" size="lg">
        {exploreLabel}
      </EditorialGhostLink>
    </>
  ) : (
    <>
      <EditorialPrimaryLink to="/gardens" size="lg">
        {exploreLabel}
      </EditorialPrimaryLink>
      <EditorialGhostLink to="/fund" size="lg">
        {formatMessage({ id: "public.home.hero.support", defaultMessage: "Support a Garden" })}
      </EditorialGhostLink>
    </>
  );

  return (
    <>
      <PublicEditorialHero
        imageSrc={publicCuration.heroImagePath}
        imageWidth={1672}
        imageHeight={941}
        portraitImageSrc="/images/hero-home-portrait.avif"
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-home-hero-title"
        title={formatMessage(
          {
            id: "public.home.hero.title",
            defaultMessage:
              "<line>From <accent>good</accent></line> <line>intentions to</line> <line><accent>green</accent> outcomes</line>",
          },
          editorialTitleTags
        )}
        lede={formatMessage({
          id: "public.home.hero.lede",
          defaultMessage:
            "Green Goods helps communities name their needs, make promises, document regenerative work, review it together, and turn the record into support. Explore the work, meet the people, and help fund what comes next.",
        })}
        actions={heroActions}
      />
      <div ref={evidenceRef}>
        {evidenceVisible ? (
          <Suspense fallback={<EvidenceSkeleton />}>
            <PublicHomeEvidence />
          </Suspense>
        ) : (
          <EvidenceSkeleton />
        )}
      </div>
      <PublicRecordLoop />
      <PublicWhoTendsAGarden />
      <PublicFundingBridge />
      <PublicGetInTouch />
      <PublicFooter />
    </>
  );
}

function EvidenceSkeleton() {
  return (
    <div className="bg-bg-weak-50 px-6 py-16 sm:px-10 md:py-20" aria-busy="true">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2">
        <EditorialMediaCardSkeleton mediaClassName="aspect-[4/3]" />
        <EditorialMediaCardSkeleton mediaClassName="aspect-[4/3]" />
      </div>
    </div>
  );
}
