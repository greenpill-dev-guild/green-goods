import { RiCloseFill } from "@remixicon/react";
import { UseFieldArrayRemove, UseFormRegister } from "react-hook-form";

import { FormText } from "../Form/Text";
import { FormInput } from "../Form/Input";

import {
  cardContentStyles,
  cardStyles,
  cardTitleStyles,
} from "../../views/Gardens/Viewer";

interface MilestoneFormProps extends TMilestone {
  index: number;
  register: UseFormRegister<TCreateProposal>;
  onRemove: UseFieldArrayRemove;
}

export const MilestoneForm: React.FC<MilestoneFormProps> = ({
  index,
  register,
  onRemove,
}) => {
  return (
    <div className={`${cardStyles}`}>
      <div
        className={`${cardTitleStyles} flex w-full justify-between items-center`}
      >
        <p className="">Milestone {index}</p>
        <button
          className="btn btn-square bg-teal-100"
          onClick={() => onRemove(index)}
        >
          <RiCloseFill className="w-6 h-6" />
        </button>
      </div>
      <div className={`${cardContentStyles}`}>
        <div className="flex w-full">
          <FormInput
            label="Name"
            // className="flex-[2]"
            placeholder="Ex. ..."
            {...register(`milestones.${index}.name`)}
          />
          <FormInput
            label="Budget"
            // className="flex-1"
            placeholder="Ex. 1200"
            {...register(`milestones.${index}.budget`)}
          />
        </div>
        <FormText
          rows={2}
          label="Description"
          placeholder="Provide a short description of this milestone."
          {...register(`milestones.${index}.description`)}
        />
      </div>
    </div>
  );
};
