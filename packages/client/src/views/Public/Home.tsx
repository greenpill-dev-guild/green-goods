import { useApp, usePublicStats } from "@green-goods/shared";
import { Navigate, useLocation } from "react-router-dom";
import { PublicFeaturedGardens } from "@/components/Public/PublicFeaturedGardens";
import { PublicGetInTouch } from "@/components/Public/PublicGetInTouch";
import { PublicHero } from "@/components/Public/PublicHero";
import { PublicInstallCta } from "@/components/Public/PublicInstallCta";
import { PublicProofBand } from "@/components/Public/PublicProofBand";
import { PublicRecordLoop } from "@/components/Public/PublicRecordLoop";

/**
 * Home — the editorial public homepage at browser `/`.
 *
 * PWA presentation users are redirected to `/home` (the auth'd dashboard).
 * Browser users see the editorial gateway under `PublicShell` (no bottom AppBar).
 * Honors `?redirectTo=` for PWA presentation users so deep links flow through.
 */
export default function Home() {
  const { isPwaPresentation } = useApp();
  const location = useLocation();
  const stats = usePublicStats();

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

  return (
    <>
      <PublicHero />
      <PublicFeaturedGardens />
      <PublicProofBand
        gardens={counts.gardenCount}
        contributors={counts.contributorCount}
        works={counts.fieldNoteCount}
        assessments={counts.attestationCount}
        isLoading={stats.isLoading}
      />
      <PublicRecordLoop />
      <PublicInstallCta />
      <PublicGetInTouch />
    </>
  );
}
