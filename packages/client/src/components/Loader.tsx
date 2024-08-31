import React from "react";

export const CircleLoader: React.FC = () => {
  return (
    <div className="grid place-items-center w-full h-full">
      <div
        className="relative h-12 w-12"
        // style={spring}
      >
        <div
          className="loader bg-[#171d1d]"
          style={{
            top: "50%",
            left: "0%",
            animationDelay: "0s",
          }}
        />
        <div
          className="loader bg-[#171d1d]"
          style={{
            top: "0%",
            left: "50%",
            animationDelay: "0.25s",
          }}
        />
        <div
          className="loader bg-[#171d1d]"
          style={{
            top: "50%",
            left: "100%",
            animationDelay: "0.5s",
          }}
        />
        <div
          className="loader bg-[#171d1d]"
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
