import { useDropzone } from "react-dropzone";
import React, { useEffect, useState } from "react";

interface CampaignMediaProps {}

export const CampaignMedia: React.FC<CampaignMediaProps> = () => {
  const [file, setFile] = useState<File | null>(null);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "image/*": [],
    },
    onDrop: (acceptedFiles) => {
      setFile(
        Object.assign(acceptedFiles[0], {
          preview: URL.createObjectURL(acceptedFiles[0]),
        })
      );
    },
  });

  useEffect(() => {
    // Make sure to revoke the data uris to avoid memory leaks, will run on unmount
    return () => {
      // @ts-ignores
      file && URL.revokeObjectURL(file.preview);
    };
  }, []);

  return (
    <section className="container">
      <div {...getRootProps({ className: "dropzone" })}>
        <input {...getInputProps()} />
        <p>Drag 'n' drop some files here, or click to select files</p>
      </div>
      <div key={file?.name}>
        <div>
          <img
            // @ts-ignore
            src={file?.preview}
            // Revoke data uri after image is loaded
            onLoad={() => {
              // @ts-ignore
              URL.revokeObjectURL(file.preview);
            }}
          />
        </div>
      </div>
    </section>
  );
};
