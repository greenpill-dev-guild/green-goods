import type React from "react";
import { BeatLoader as Beat } from "react-spinners";

export const CircleLoader: React.FC = () => {
  return (
    <div className="grid place-items-center w-full h-full">
      <div className="relative h-12 w-12 translate-x-[-25%]">
        <div
          className="loader bg-primary"
          style={{
            top: "50%",
            left: "0%",
            animationDelay: "0s",
          }}
        />
        <div
          className="loader bg-primary"
          style={{
            top: "0%",
            left: "50%",
            animationDelay: "0.25s",
          }}
        />
        <div
          className="loader bg-primary"
          style={{
            top: "50%",
            left: "100%",
            animationDelay: "0.5s",
          }}
        />
        <div
          className="loader bg-primary"
          style={{
            top: "100%",
            left: "50%",
            animationDelay: "0.75s",
          }}
        />
      </div>
    </div>
  );
};

export const BeatLoader: React.FC = () => (
  <div className="flex justify-center w-full">
    <Beat color="oklch(72.3% 0.219 149.579)" />
  </div>
);
