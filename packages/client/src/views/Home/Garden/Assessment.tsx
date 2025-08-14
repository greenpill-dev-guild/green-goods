import type React from "react";
import { useParams, useRouteLoaderData } from "react-router-dom";
import { WorkViewSkeleton } from "@/components/UI/WorkView/WorkView";
import { TopNav } from "@/components/UI/TopNav/TopNav";

type GardenAssessmentProps = {};

export const GardenAssessment: React.FC<GardenAssessmentProps> = () => {
  const { assessmentId } = useParams<{
    id: string;
    assessmentId: string;
  }>();

  const loader = useRouteLoaderData("garden") as { garden: Garden } | null;
  const garden = loader?.garden;

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
