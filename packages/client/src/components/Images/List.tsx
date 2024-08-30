import {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormRegister,
} from "react-hook-form";
import { RiAddFill } from "@remixicon/react";

import { Button } from "../Button";
import { MediaForm } from "./Form";

interface MediaListProps {
  register: UseFormRegister<WorkDraft>;
  media: FieldArrayWithId<WorkDraft>[];
  addMedia: UseFieldArrayAppend<WorkDraft>;
  removeMedia: UseFieldArrayRemove;
}

export const MediaList: React.FC<MediaListProps> = ({
  register,
  media,
  addMedia,
  removeMedia,
}) => {
  function handleAddMedia() {
    addMedia({
      name: "",
      budget: 0,
      description: "",
    });
  }

  return (
    <>
      <ul>
        {media?.length > 0 &&
          media.map((milestone, index) => (
            <li key={milestone.id}>
              <MediaForm
                {...milestone}
                register={register}
                index={index}
                onRemove={removeMedia}
              />
            </li>
          ))}
      </ul>
      <Button
        type="button"
        onClick={handleAddMedia}
        label="Add Media"
        Icon={RiAddFill}
        size="small"
        className="self-end"
      />
    </>
  );
};
