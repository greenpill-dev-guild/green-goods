import type React from "react";
import { useParams } from "react-router-dom";

import { useGarden } from "@/providers/garden";

import { CircleLoader } from "@/components/Loader";

interface GardenAssessmentProps {}

export const GardenAssessment: React.FC<GardenAssessmentProps> = ({}) => {
  const { id, assessmentId } = useParams<{
    id: string;
    assessmentId: string;
  }>();

  const { garden } = useGarden(id!);

  const assessment = garden?.assessments.find(
    (assessment) => assessment.id === assessmentId
  );

  if (!assessment || !garden)
    return (
      <div className="w-full h-full grid place-items-center">
        <CircleLoader />
      </div>
    );

  return <div className="" />;
};
