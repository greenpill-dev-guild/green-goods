import {
  useApp,
  useInstallGuidance,
  usePublicInstallHandler,
  usePublicStats,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { Navigate, useLocation } from "react-router-dom";
import { EditorialGhostButton, EditorialPrimaryLink } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFeaturedGardens } from "@/components/Public/PublicFeaturedGardens";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicGetInTouch } from "@/components/Public/PublicGetInTouch";
import { PublicProofBand } from "@/components/Public/PublicProofBand";
import { PublicRecordLoop } from "@/components/Public/PublicRecordLoop";
import { publicCuration } from "@/content/publicCuration";

/**
 * Home — the editorial public homepage at browser `/`.
 *
 * PWA presentation users are redirected to `/home` (the auth'd dashboard).
 * Browser users see the editorial gateway under `PublicShell` (no bottom AppBar).
 * Honors `?redirectTo=` for PWA presentation users so deep links flow through.
 *
 * Composition order matches the editorial dialect:
 *   Hero → Featured Gardens → Living Public Record → Regenerative Loop →
 *   Get In Touch → Footer.
 */
export default function Home() {
  const { formatMessage } = useIntl();
  const {
    isPwaPresentation,
    isMobile,
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    promptInstall,
  } = useApp();
  const location = useLocation();
  const stats = usePublicStats();
  const guidance = useInstallGuidance(
    platform,
    isInstalled,
    wasInstalled,
    deferredPrompt,
    isMobile
  );
  const handleInstallClick = usePublicInstallHandler(guidance, promptInstall);

  if (isPwaPresentation) {
    const redirectTo = new URLSearchParams(location.search).get("redirectTo");
    return <Navigate to={redirectTo || "/home"} replace />;
  }

  const counts = stats.data ?? {
    gardenCount: 0,
    contributorCount: 0,
    fieldNoteCount: 0,
    attestationCount: 0,
  };

  // On mobile, "Install App" is the primary CTA so a phone visitor lands on
  // the install path; desktop keeps "Explore Gardens" as primary.
  const installLabelId = isInstalled ? "public.nav.openApp" : "public.nav.installApp";
  const installDefault = isInstalled ? "Open App" : "Install App";
  const installLabel = formatMessage({ id: installLabelId, defaultMessage: installDefault });
  const exploreLabel = formatMessage({
    id: "public.home.hero.exploreGardens",
    defaultMessage: "Explore Gardens",
  });

  const heroActions = isMobile ? (
    <>
      <EditorialGhostButton
        onClick={handleInstallClick}
        data-install-action={guidance.primaryAction.type}
      >
        {installLabel}
      </EditorialGhostButton>
      <EditorialPrimaryLink to="/gardens">{exploreLabel}</EditorialPrimaryLink>
    </>
  ) : (
    <>
      <EditorialPrimaryLink to="/gardens">{exploreLabel}</EditorialPrimaryLink>
      <EditorialGhostButton
        onClick={handleInstallClick}
        data-install-action={guidance.primaryAction.type}
      >
        {installLabel}
      </EditorialGhostButton>
    </>
  );

  return (
    <>
      <PublicEditorialHero
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-home-hero-title"
        title={
          <>
            {formatMessage({
              id: "public.home.hero.title.line1",
              defaultMessage: "From good intentions to ",
            })}
            <em className="font-serif italic">
              {formatMessage({
                id: "public.home.hero.title.line2",
                defaultMessage: "green outcomes",
              })}
            </em>
            .
          </>
        }
        lede={formatMessage({
          id: "public.home.hero.lede",
          defaultMessage:
            "Communities document, verify, and fund regenerative work — Garden by Garden. A quiet, public record of what restores soil, water, and the people who tend them.",
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
      <PublicGetInTouch />
      <PublicFooter />
    </>
  );
}
