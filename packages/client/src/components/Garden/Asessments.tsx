import { RiCoinFill, RiSeedlingLine, RiTreeLine } from "@remixicon/react";
import { forwardRef, type UIEvent } from "react";
import { useIntl } from "react-intl";
import getTag from "@/utils/tags";
import { Badge } from "../UI/Badge/Badge";
import { Card } from "../UI/Card/Card";
import { BeatLoader } from "../UI/Loader";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
  handleScroll: (event: UIEvent<HTMLUListElement>) => void;
}

interface AssessmentListProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
}

const AssessmentList = ({ assessments, asessmentFetchStatus }: AssessmentListProps) => {
  const intl = useIntl();
  switch (asessmentFetchStatus) {
    case "pending":
      return <BeatLoader />;
    case "success":
      return assessments.length ? (
        assessments.map((assessment) => (
          <Card key={assessment.id} className="flex flex-col gap-2 p-4">
            <h6>
              #{assessment.id.slice(0, 4)}{" "}
              {intl.formatMessage({
                id: "app.garden.assessments.title",
                description: "Assessment title",
              })}
            </h6>
            <span className="text-xs uppercase">
              {intl.formatMessage({ id: "app.garden.assessments.tags" })}
            </span>
            <ul className="flex flex-wrap gap-2">
              {assessment.tags.map((tag) => (
                <Badge variant="pill" key={`${assessment.id}-${tag}`} tint="primary">
                  {getTag(intl, tag)}
                </Badge>
              ))}
            </ul>
            <span className="text-xs uppercase">
              {intl.formatMessage({
                id: "app.garden.assessments.issues",
              })}
            </span>
            <ul className="flex flex-wrap gap-2">
              {assessment.issues.map((issue) => (
                <Badge variant="pill" key={`${assessment.id}-${issue}`} tint="tertiary">
                  {getTag(intl, issue)}
                </Badge>
              ))}
            </ul>
            <hr className="my-2" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <Badge leadingIcon={<RiTreeLine className="w-4 h-4 text-primary" />} variant="pill">
                  {intl.formatMessage({
                    id: "app.garden.assessments.observed",
                  })}
                </Badge>
                <div className="px-2 pb-2">
                  {assessment.treeGenusesObserved.length + assessment.weedGenusesObserved.length}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Badge leadingIcon={<RiCoinFill className="w-4 h-4 text-primary" />} variant="pill">
                  {intl.formatMessage({
                    id: "app.garden.assessments.co2Stock",
                  })}
                </Badge>
                <div className="px-2 pb-2">{assessment.carbonTonStock} T</div>
              </div>
              <div className="flex flex-col gap-1">
                <Badge
                  leadingIcon={<RiSeedlingLine className="w-4 h-4 text-primary" />}
                  variant="pill"
                >
                  {intl.formatMessage({
                    id: "app.garden.assessments.soilMoisture",
                  })}
                </Badge>
                <div className="px-2 pb-2">
                  {assessment.soilMoisturePercentage > 0 ? assessment.soilMoisturePercentage : "-"}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Badge leadingIcon={<RiCoinFill className="w-4 h-4 text-primary" />} variant="pill">
                  {intl.formatMessage({
                    id: "app.garden.assessments.co2Potential",
                  })}
                </Badge>
                <div className="px-2 pb-2">{assessment.carbonTonPotential} T</div>
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

export const GardenAssessments = forwardRef<HTMLUListElement, GardenAssessmentsProps>(
  ({ assessments, asessmentFetchStatus, handleScroll }, ref) => {
    return (
      <ul className="flex flex-col gap-2" ref={ref} onScroll={handleScroll}>
        <AssessmentList assessments={assessments} asessmentFetchStatus={asessmentFetchStatus} />
      </ul>
    );
  }
);
