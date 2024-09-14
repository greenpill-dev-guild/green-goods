import React from "react";

interface WorkIntroProps {
  title?: string;
  description: string;
}

export const WorkIntro: React.FC<WorkIntroProps> = ({ title, description }) => {
  return (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
};
