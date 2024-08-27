interface MilestoneCardProps extends TMilestone {}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  name,
  budget,
  description,
}) => {
  return (
    <div className="border flex flex-col">
      <div className="flex w-full">
        <h4 className="">{name}</h4>
        <h4 className="">{budget}</h4>
      </div>
      <p className="">{description}</p>
    </div>
  );
};
