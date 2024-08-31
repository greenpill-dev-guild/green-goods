interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
}

export const GardenAssessments: React.FC<GardenAssessmentsProps> = ({
  assessments,
}) => {
  return (
    <ul className="flex flex-col gap-2">
      {assessments.map((assessment) => (
        <li key={assessment.id}>
          <h3>{assessment.tags}</h3>
          <p>{assessment.issues}</p>
        </li>
      ))}
    </ul>
  );
};
