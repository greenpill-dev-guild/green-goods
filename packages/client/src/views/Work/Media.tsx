import React, { useState } from "react";
import { RiCloseLine, RiImageFill } from "@remixicon/react";

import { FormInfo } from "@/components/Form/Info";
import { Books } from "@/assets/Books";

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
    <div>
      <FormInfo title="Upload Media" info={instruction} Icon={RiImageFill} />
      <div className="tracking-tight text-xs mb-3">
        <h6 className="mb-1">NEEDED</h6>
        <ul className="flex gap-1 flex-wrap">
          {needed.map((item) => (
            <li
              key={item}
              className="capitalize rounded-full p-1 px-1.5 bg-teal-500 text-white"
            >
              {item.replace("_", " ")}
            </li>
          ))}
        </ul>
      </div>
      <div className="tracking-tight text-xs mb-6">
        <h6 className="mb-1">OPTIONAL</h6>
        <ul className="flex gap-1 flex-wrap">
          {optional.map((item) => (
            <li
              key={item}
              className="capitalize rounded-full p-1 px-1.5 bg-teal-500 text-white"
            >
              {item.replace("_", " ")}
            </li>
          ))}
        </ul>
      </div>
      <input
        id="work-media-upload"
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        multiple
        className="input input-bordered hidden"
      />
      <ul className="flex flex-col gap-4">
        {images.length ?
          images.map((file, index) => (
            <li
              key={index}
              className="carousel-item relative"
              onClick={() => setPreviewModalOpen(true)}
            >
              <img
                src={URL.createObjectURL(file)}
                alt={`Uploaded ${index}`}
                className="w-full aspect-square object-cover rounded-lg"
              />
              <button
                className="flex items-center w-8 h-8 p-1 bg-white border border-slate-200 rounded-lg absolute top-2 right-2"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                type="button"
              >
                <RiCloseLine className="w-8 h-8" />
              </button>
            </li>
          ))
        : <li className="pt-8 px-4 grid place-items-center">
            <p className="text-center text-lg font-medium mb-3">
              No images added yet. Click on upload button
            </p>
            <Books />
          </li>
        }
      </ul>
      {previewModalOpen && (
        <dialog
          className="modal modal-open"
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
