import { RiCoinFill, RiSeedlingLine, RiTreeLine } from "@remixicon/react";
import { forwardRef, memo } from "react";
import { FixedSizeList as List } from "react-window";
import { useIntl } from "react-intl";
import getTag from "@/utils/app/tags";
import { Badge } from "../UI/Badge/Badge";
import { Card } from "../UI/Card/Card";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
}

interface AssessmentListProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
}

const AssessmentCard = memo(function AssessmentCard({
  assessment,
}: {
  assessment: GardenAssessment;
}) {
  const intl = useIntl();
  return (
    <Card key={assessment.id} className="flex flex-col gap-2">
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
        {intl.formatMessage({ id: "app.garden.assessments.issues" })}
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
            {intl.formatMessage({ id: "app.garden.assessments.observed" })}
          </Badge>
          <div className="px-2 pb-2">
            {assessment.treeGenusesObserved.length + assessment.weedGenusesObserved.length}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiCoinFill className="w-4 h-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.co2Stock" })}
          </Badge>
          <div className="px-2 pb-2">{assessment.carbonTonStock} T</div>
        </div>
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiSeedlingLine className="w-4 h-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.soilMoisture" })}
          </Badge>
          <div className="px-2 pb-2">
            {assessment.soilMoisturePercentage > 0 ? assessment.soilMoisturePercentage : "-"}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiCoinFill className="w-4 h-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.co2Potential" })}
          </Badge>
          <div className="px-2 pb-2">{assessment.carbonTonPotential} T</div>
        </div>
      </div>
      <hr className="my-2" />
    </Card>
  );
});

const AssessmentList = ({ assessments, asessmentFetchStatus }: AssessmentListProps) => {
  const intl = useIntl();
  switch (asessmentFetchStatus) {
    case "pending":
      return (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border border-slate-200 rounded-xl bg-white">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
              <div className="flex flex-wrap gap-2 mb-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[...Array(4)].map((_, k) => (
                  <div key={k} className="flex flex-col gap-2">
                    <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "success":
      return assessments.length ? (
        assessments.length > 40 ? (
          <List height={600} itemCount={assessments.length} itemSize={200} width={"100%"}>
            {({ index, style }: { index: number; style: React.CSSProperties }) => (
              <div style={style} className="px-0.5">
                <AssessmentCard assessment={assessments[index]} />
              </div>
            )}
          </List>
        ) : (
          assessments.map((a) => <AssessmentCard key={a.id} assessment={a} />)
        )
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
  ({ assessments, asessmentFetchStatus }, ref) => {
    return (
      <ul className="flex flex-col gap-2" ref={ref}>
        <AssessmentList assessments={assessments} asessmentFetchStatus={asessmentFetchStatus} />
      </ul>
    );
  }
);
