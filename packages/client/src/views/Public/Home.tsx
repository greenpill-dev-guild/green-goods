import { useApp, usePublicStats } from "@green-goods/shared";
import { useIntl } from "react-intl";
import {
  EditorialGhostLink,
  EditorialPrimaryButton,
  EditorialPrimaryLink,
  EditorialTitleAccent,
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
 *   Funding Bridge → Get In Touch → Footer.
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

  // Mobile: lead with the app CTA so a phone visitor lands on the install
  // path, then offer Explore as the secondary route. Desktop drops the
  // secondary entirely — Explore Gardens is the only above-the-fold CTA.
  const exploreLabel = formatMessage({
    id: "public.home.hero.exploreGardens",
    defaultMessage: "Explore Gardens",
  });

  const heroActions = isMobile ? (
    <>
      <PublicInstallAction>
        {({ label, onClick, dataInstallAction }) => (
          <EditorialPrimaryButton onClick={onClick} data-install-action={dataInstallAction}>
            {label}
          </EditorialPrimaryButton>
        )}
      </PublicInstallAction>
      <EditorialGhostLink to="/gardens">{exploreLabel}</EditorialGhostLink>
    </>
  ) : (
    <EditorialPrimaryLink to="/gardens">{exploreLabel}</EditorialPrimaryLink>
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
              "From <accent>good</accent> intentions to <noBreak><accent>green</accent> outcomes</noBreak>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
            noBreak: (chunks) => <span className="whitespace-nowrap">{chunks}</span>,
          }
        )}
        lede={formatMessage({
          id: "public.home.hero.lede",
          defaultMessage:
            "Green Goods makes regenerative work easier to support across solar, agroforestry, education, and waste, turning everyday contributions into a trusted public record of how places grow healthier together.",
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
