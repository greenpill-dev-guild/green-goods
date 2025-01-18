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
        assessments.map((assessment) => (
          <li
            key={assessment.id}
            className="flex flex-col gap-2"
            onClick={() =>
              navigate(
                `/gardens/${assessment.gardenAddress}/assessments/${assessment.id}`
              )
            }
          >
            <h3>{assessment.tags}</h3>
            <p>{assessment.issues}</p>
          </li>
        ))
      : <p className="grid p-8 place-items-center text-sm text-center italic">
          No assessments yet, get started by clicking a garden above
        </p>
      }
    </ul>
  );
};
