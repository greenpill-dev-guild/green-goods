import { useApp, usePublicStats } from "@green-goods/shared";
import { Navigate, useLocation } from "react-router-dom";
import {
  PublicFeaturedGardens,
  PublicGetInTouch,
  PublicHero,
  PublicInstallCta,
  PublicProofBand,
  PublicRecordLoop,
} from "@/components/Public";

/**
 * Home — the editorial public homepage at browser `/`.
 *
 * Installed PWA users are redirected to `/home` (the auth'd dashboard).
 * Browser users see the editorial gateway under `PublicShell` (no bottom AppBar).
 * Honors `?redirectTo=` for installed users so deep links flow through.
 */
export default function Home() {
  const { isInstalled } = useApp();
  const location = useLocation();
  const stats = usePublicStats();

  if (isInstalled) {
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
