import type React from "react";
import { useParams } from "react-router-dom";
import { useGardens } from "@/hooks/useBaseLists";
import { DEFAULT_CHAIN_ID } from "@/config";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import { TopNav } from "@/components/UI/TopNav/TopNav";

type GardenAssessmentProps = {};

export const GardenAssessment: React.FC<GardenAssessmentProps> = () => {
  const { id, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const { data: gardens = [] } = useGardens(DEFAULT_CHAIN_ID);
  const garden = gardens.find((g) => g.id === id) || null;

  const assessment = garden?.assessments.find((assessment) => assessment.id === assessmentId);

  if (!assessment || !garden)
    return (
      <article>
        <TopNav onBackClick={() => window.history.back()} />
        <div className="padded pt-16">
          <WorkViewSkeleton showMedia={false} showActions={false} numDetails={2} />
        </div>
      </article>
    );

  return <div className="" />;
};
