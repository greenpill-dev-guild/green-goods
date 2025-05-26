import { RiTreeLine, RiSeedlingLine, RiCoinFill } from "@remixicon/react";

import { BeatLoader } from "../UI/Loader";
import { Badge } from "../UI/Badge/Badge";
import { Card } from "../UI/Card/Card";
import { forwardRef } from "react";
import { useIntl } from "react-intl";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
  handleScroll: (event: React.UIEvent<HTMLUListElement, UIEvent>) => void;
}

export const GardenAssessments = forwardRef<
  HTMLUListElement,
  GardenAssessmentsProps
>(({ assessments, asessmentFetchStatus, handleScroll }, ref) => {
  const intl = useIntl();
  const AsessmentList = () => {
    switch (asessmentFetchStatus) {
      case "pending":
        return <BeatLoader />;
      case "success":
        return assessments.length ? (
          assessments.map((assessment, index) => (
            <Card
              key={assessment.id}
              className="flex flex-col gap-2 p-4"
              // onClick={() =>
              //   navigate(
              //     `/home/${assessment.gardenAddress}/assessments/${assessment.id}`
              //   )
              // }
            >
              <h6>
                #{index + 1}{" "}
                {intl.formatMessage({
                  id: "app.garden.assessments.title",
                  description: "Assessment title",
                })}
              </h6>
              <span className="text-xs uppercase">
                {intl.formatMessage({ id: "app.garden.assessments.tags" })}
              </span>
              <ul className="flex flex-wrap gap-2">
                {assessment.tags.map((tag, index) => (
                  <Badge variant="pill" key={index} tint="primary">
                    {tag}
                  </Badge>
                ))}
              </ul>
              <span className="text-xs uppercase">
                {intl.formatMessage({ id: "app.garden.assessments.issues" })}
              </span>
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
                    {intl.formatMessage({
                      id: "app.garden.assessments.observed",
                    })}
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
                    {intl.formatMessage({
                      id: "app.garden.assessments.co2Stock",
                    })}
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
                    {intl.formatMessage({
                      id: "app.garden.assessments.soilMoisture",
                    })}
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
                    {intl.formatMessage({
                      id: "app.garden.assessments.co2Potential",
                    })}
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
          <p className="grid p-8 place-items-center text-sm text-center italic text-gray-400">
            {intl.formatMessage({
              id: "app.garden.assessments.noAssesment",
              description: "No assessments yet",
            })}
          </p>
        );
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            {intl.formatMessage({
              id: "app.garden.assessments.errorLoadingWorks",
              description: "Error loading works",
            })}
          </p>
        );
    }
  };

  return (
    <ul className="flex flex-col gap-2" ref={ref} onScroll={handleScroll}>
      <AsessmentList />
    </ul>
  );
});
