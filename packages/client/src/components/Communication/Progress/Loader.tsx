import type React from "react";
import { BeatLoader as Beat } from "react-spinners";

export const BeatLoader: React.FC = () => (
  <div className="flex justify-center w-full">
    <Beat color="rgb(var(--primary-base))" />
  </div>
);
