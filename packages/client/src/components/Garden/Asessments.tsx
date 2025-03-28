import { RiTreeLine, RiSeedlingLine, RiCoinFill } from "@remixicon/react";

import { CircleLoader } from "../Loader";
import { Badge } from "../UI/Badge/Badge";
import { Card } from "../UI/Card/Card";
import { useNavigateToTop } from "@/utils/useNavigateToTop";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
}

export const GardenAssessments: React.FC<GardenAssessmentsProps> = ({
  assessments,
  asessmentFetchStatus,
}) => {
  const navigate = useNavigateToTop();

  const AsessmentList = () => {
    switch (asessmentFetchStatus) {
      case "pending":
        return <CircleLoader />;
      case "success":
        return assessments.length ? (
          assessments.map((assessment, index) => (
            <Card
              key={assessment.id}
              className="flex flex-col gap-2 p-4"
              onClick={() =>
                navigate(
                  `/gardens/${assessment.gardenAddress}/assessments/${assessment.id}`
                )
              }
            >
              <h6>#{index + 1} Assessment</h6>
              <span className="text-xs">TAGS</span>
              <ul className="flex flex-wrap gap-2">
                {assessment.tags.map((tag, index) => (
                  <Badge variant="pill" key={index} tint="primary">
                    {tag}
                  </Badge>
                ))}
              </ul>
              <span className="text-xs">ISSUES</span>
              <ul className="flex flex-wrap gap-2">
                {assessment.issues.map((issue, index) => (
                  <Badge variant="pill" key={index} tint="tertiary">
                    {issue}
                  </Badge>
                ))}
              </ul>
              <hr className="my-2" />
              <div className="grid-cols-2 grid-flow-row-dense grid text-sm">
                <div className="flex flex-col gap-1">
                  <Badge
                    leadingIcon={
                      <RiTreeLine className="w-4 h-4 text-primary" />
                    }
                    variant="pill"
                  >
                    Observed
                  </Badge>
                  <div className="px-2 pb-2">
                    {assessment.treeGenusesObserved.length +
                      assessment.weedGenusesObserved.length}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Badge
                    leadingIcon={
                      <RiCoinFill className="w-4 h-4 text-primary" />
                    }
                    variant="pill"
                  >
                    CO2 Stock
                  </Badge>
                  <div className="px-2 pb-2">{assessment.carbonTonStock} T</div>
                </div>
                <div>
                  <Badge
                    leadingIcon={
                      <RiSeedlingLine className="w-4 h-4 text-primary" />
                    }
                    variant="pill"
                  >
                    Soil Moisture
                  </Badge>
                  <div className="px-2 pb-2">
                    {assessment.soilMoisturePercentage > 0
                      ? assessment.soilMoisturePercentage
                      : "-"}
                  </div>
                </div>
                <div>
                  <Badge
                    leadingIcon={
                      <RiCoinFill className="w-4 h-4 text-primary" />
                    }
                    variant="pill"
                  >
                    CO2 Potential
                  </Badge>
                  <div className="px-2 pb-2">
                    {assessment.carbonTonPotential} T
                  </div>
                </div>
              </div>
              <hr className="my-2" />
            </Card>
          ))
        ) : (
          <p className="grid p-8 place-items-center text-sm text-center italic">
            No assessments yet, get started by clicking a garden above
          </p>
        );
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            Error loading works
          </p>
        );
    }
  };

  return (
    <ul className="flex flex-col gap-2">
      <AsessmentList />
    </ul>
  );
};
