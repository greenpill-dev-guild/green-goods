import { RiTreeLine, RiSeedlingLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
}

export const GardenAssessments: React.FC<GardenAssessmentsProps> = ({
  assessments,
}) => {
  const navigate = useNavigate();

  return (
    <ul className="flex flex-col gap-2">
      {assessments.length ?
        assessments.map((assessment, index) => (
          <li
            key={assessment.id}
            className="flex flex-col gap-2 border-2 border-slate-100 rounded-xl p-4"
            onClick={() =>
              navigate(
                `/gardens/${assessment.gardenAddress}/assessments/${assessment.id}`
              )
            }
          >
            <h4>#{index + 1} Assessment</h4>
            <h6 className="text-sm">TAGS</h6>
            <ul className="flex flex-wrap gap-2">
              {assessment.tags.map((tag, index) => (
                <li key={index} className="px-2 py-1 bg-teal-100 rounded-full">
                  {tag}
                </li>
              ))}
            </ul>
            <h6>ISSUES</h6>
            <ul className="flex flex-wrap gap-2">
              {assessment.issues.map((issue, index) => (
                <li
                  key={index}
                  className="px-2 py-1 bg-sky-200-100 rounded-full"
                >
                  {issue}
                </li>
              ))}
            </ul>
            <hr />
            <div className="grid-cols-2 grid-flow-row-dense grid">
              <div>
                <h6 className="text-sm flex">
                  <RiTreeLine />
                  Species Observed
                </h6>
                <span>
                  {assessment.treeGenusesObserved.length +
                    assessment.weedGenusesObserved.length}
                </span>
              </div>
              <div>
                <h6 className="text-sm flex">Carbon Ton Stock</h6>
                <span>{assessment.carbonTonStock}</span>
              </div>
              <div>
                <h6 className="text-sm flex">
                  <RiSeedlingLine />
                  Soil Moisture
                </h6>
                <span>{assessment.soilMoisturePercentage}</span>
              </div>
              <div>
                <h6 className="text-sm">Carbon Ton Potential</h6>
                <span>{assessment.carbonTonPotential} T</span>
              </div>
            </div>
          </li>
        ))
      : <p className="grid p-8 place-items-center text-sm text-center italic">
          No assessments yet, get started by clicking a garden above
        </p>
      }
    </ul>
  );
};
