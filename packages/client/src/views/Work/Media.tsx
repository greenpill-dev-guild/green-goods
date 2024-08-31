import React, { useState } from "react";

interface WorkMediaProps {
  title?: string;
  description?: string;
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
}

export const WorkMedia: React.FC<WorkMediaProps> = ({
  title,
  description,
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
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Upload Images</span>
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          multiple
          className="input input-bordered"
        />
      </div>
      <div className="carousel carousel-center rounded-box space-x-4 mb-4">
        {images.map((file, index) => (
          <div
            key={index}
            className="carousel-item relative"
            onClick={() => setPreviewModalOpen(true)}
          >
            <img
              src={URL.createObjectURL(file)}
              alt={`Uploaded ${index}`}
              className="w-40 h-40 object-cover"
            />
            <button
              className="btn btn-sm btn-circle absolute top-2 right-2"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(index);
              }}
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
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
