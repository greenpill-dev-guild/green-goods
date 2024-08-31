interface WorkReviewProps {
  title: string;
  description: string;
  images: File[];
  plantSelection: string[];
  plantCount: number;
  feedback: string;
}

export const WorkReview: React.FC<WorkReviewProps> = ({
  title,
  description,
  images,
  plantSelection,
  plantCount,
  feedback,
}) => {
  return (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      <ul className="flex gap-3">
        {images.map((file, index) => (
          <div key={index} className="carousel-item w-full">
            <img
              src={URL.createObjectURL(file)}
              alt={`Preview ${index}`}
              className="w-full h-64 object-cover"
            />
          </div>
        ))}
      </ul>
      <h3>Plant Selection</h3>
      <ul>
        {plantSelection.map((plant) => (
          <li key={plant}>{plant}</li>
        ))}
      </ul>
      <h3>Plant Count</h3>
      <p>{plantCount}</p>
      <h3>Feedback</h3>
      <p>{feedback}</p>
    </div>
  );
};
