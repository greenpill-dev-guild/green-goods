import { usePublicCommitmentImpact } from "@green-goods/shared/hooks/public/usePublicCommitmentImpact";
import { usePublicStats } from "@green-goods/shared/hooks/public/usePublicStats";
import { PublicFeaturedGardens } from "@/components/Public/PublicFeaturedGardens";
import { PublicProofBand } from "@/components/Public/PublicProofBand";

/** The homepage can paint its reading content before the evidence transports load. */
export default function PublicHomeEvidence() {
  const stats = usePublicStats();
  const commitments = usePublicCommitmentImpact();
  const counts = stats.data ?? {
    gardenCount: 0,
    contributorCount: 0,
    fieldNoteCount: 0,
    attestationCount: 0,
  };
  return (
    <>
      <PublicFeaturedGardens />
      <PublicProofBand
        gardens={counts.gardenCount}
        contributors={counts.contributorCount}
        works={counts.fieldNoteCount}
        assessments={counts.attestationCount}
        commitmentsKept={commitments.data?.commitmentsFulfilled ?? null}
        isLoading={stats.isLoading}
        isCommitmentsLoading={commitments.isLoading}
      />
    </>
  );
}
