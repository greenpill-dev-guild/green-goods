"use client";

import {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormRegister,
} from "react-hook-form";
import { RiAddFill } from "@remixicon/react";

import { Button } from "../Button";
import { MilestoneForm } from "./Form";

interface MilestoneListProps {
  register: UseFormRegister<TCreateProposal>;
  milestones: FieldArrayWithId<TCreateProposal, "milestones", "id">[];
  addMilestone: UseFieldArrayAppend<TCreateProposal, "milestones">;
  removeMilestone: UseFieldArrayRemove;
}

export const MilestoneList: React.FC<MilestoneListProps> = ({
  register,
  milestones,
  addMilestone,
  removeMilestone,
}) => {
  function handleAddMilestone() {
    addMilestone({
      name: "",
      budget: 0,
      description: "",
    });
  }

  return (
    <>
      <ul>
        {milestones?.length > 0 &&
          milestones.map((milestone, index) => (
            <li key={milestone.id}>
              <MilestoneForm
                {...milestone}
                register={register}
                index={index}
                onRemove={removeMilestone}
              />
            </li>
          ))}
      </ul>
      <Button
        type="button"
        onClick={handleAddMilestone}
        label="Add Milestone"
        Icon={RiAddFill}
        size="small"
        className="self-end"
      />
    </>
  );
};
