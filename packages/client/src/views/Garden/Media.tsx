import type React from "react";
import { useState } from "react";
import { RiCloseLine, RiImageFill } from "@remixicon/react";

import { FormInfo } from "@/components/UI/Form/Info";
import { Books } from "@/assets/Books";
import { Badge } from "@/components/UI/Badge/Badge";

interface WorkMediaProps {
  instruction: string;
  needed: string[];
  optional: string[];
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
}

export const WorkMedia: React.FC<WorkMediaProps> = ({
  instruction,
  needed,
  optional,
  images,
  setImages,
}) => {
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  // @dev @ Afo- preview modal
  const disablePreview = true;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setImages((prevImages) => [...prevImages, ...Array.from(files)]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title="Upload Media" info={instruction} Icon={RiImageFill} />
      <div className="">
        <div className="text-xs tracking-tight mb-1 uppercase">needed</div>
        <div className="flex gap-1 flex-wrap">
          {needed.map((item) => (
            <Badge
              key={item}
              className="capitalize"
              variant="pill"
              tint="primary"
            >
              {item.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>
      <div className="">
        <div className="text-xs tracking-tight mb-1 uppercase">optional</div>
        <div className="flex gap-1 flex-wrap">
          {optional.map((item) => (
            <Badge
              key={item}
              className="capitalize"
              variant="pill"
              tint="primary"
            >
              {item.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>
      <input
        id="work-media-upload"
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        multiple
        className="input input-bordered hidden"
      />
      <div className="flex flex-col gap-4">
        {images.length ? (
          images.map((file, index) => (
            <div key={file.name} className="carousel-item relative">
              <img
                src={URL.createObjectURL(file)}
                alt={`Uploaded ${index}`}
                className="w-full aspect-square object-cover rounded-lg"
              />
              <button
                className="flex items-center w-8 h-8 p-1 bg-white border border-stroke-sub-300 rounded-lg absolute top-2 right-2"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                type="button"
              >
                <RiCloseLine className="w-8 h-8" />
              </button>
            </div>
          ))
        ) : (
          <div className="pt-8 px-4 grid place-items-center">
            <Books />
          </div>
        )}
      </div>
      {!disablePreview && previewModalOpen && (
        <dialog
          className="modal modal-open" // @dev styles here are probably missing form daisy
          onClick={() => setPreviewModalOpen(false)}
        >
          <div className="modal-box relative">
            <label
              onClick={() => setPreviewModalOpen(false)}
              className="btn btn-sm btn-circle absolute right-2 top-2"
            >
              ✕
            </label>
            <div className="carousel w-full">
              {images.map((file, index) => (
                <div key={index} className="carousel-item w-full">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index}`}
                    className="w-full h-64 object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};
