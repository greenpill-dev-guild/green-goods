import { Button } from "@green-goods/shared/components/Button";
import { usePublicStats } from "@green-goods/shared/hooks/public/usePublicStats";
import { useApp } from "@green-goods/shared/providers/App";
import { useIntl } from "react-intl";
import {
  EditorialGhostLink,
  EditorialPrimaryLink,
  editorialTitleTags,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFeaturedGardens } from "@/components/Public/PublicFeaturedGardens";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicFundingBridge } from "@/components/Public/PublicFundingBridge";
import { PublicGetInTouch } from "@/components/Public/PublicGetInTouch";
import { PublicInstallAction } from "@/components/Public/PublicInstallAction";
import { PublicProofBand } from "@/components/Public/PublicProofBand";
import { PublicRecordLoop } from "@/components/Public/PublicRecordLoop";
import { PublicWhoTendsAGarden } from "@/components/Public/PublicWhoTendsAGarden";
import { publicCuration } from "@/content/publicCuration";

/**
 * Home — the editorial public homepage at browser `/`.
 *
 * `/` is always the public website. Installed PWA sessions enter the app
 * through the manifest `start_url` at `/home`.
 *
 * Composition order matches the editorial dialect:
 *   Hero → Featured Gardens → Living Public Record → Regenerative Loop →
 *   Who Tends a Garden → Funding Bridge → Get In Touch → Footer.
 */
export default function Home() {
  const { formatMessage } = useIntl();
  const { isMobile } = useApp();
  const stats = usePublicStats();

  const counts = stats.data ?? {
    gardenCount: 0,
    contributorCount: 0,
    fieldNoteCount: 0,
    attestationCount: 0,
  };

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
            "Green Goods helps community projects document environmental work, have it reviewed by local stewards, and connect with funding. Explore what’s been done, meet the people doing it, and support what comes next.",
        })}
        actions={heroActions}
      />
      <PublicFeaturedGardens />
      <PublicProofBand
        gardens={counts.gardenCount}
        contributors={counts.contributorCount}
        works={counts.fieldNoteCount}
        assessments={counts.attestationCount}
        isLoading={stats.isLoading}
      />
      <PublicRecordLoop />
      <PublicWhoTendsAGarden />
      <PublicFundingBridge />
      <PublicGetInTouch />
      <PublicFooter />
    </>
  );
}
