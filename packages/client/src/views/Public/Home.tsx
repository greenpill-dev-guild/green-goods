import { usePublicStats } from "@green-goods/shared/hooks/public/usePublicStats";
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

  const heroActions = (
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
