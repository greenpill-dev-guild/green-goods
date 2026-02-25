import type { FC, ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export const PhoneFrame: FC<PhoneFrameProps> = ({ children, className }) => {
  return (
    <div
      className={`relative rounded-[2.5rem] bg-bg-strong-950 shadow-xl p-2${className ? ` ${className}` : ""}`}
    >
      {/* Dynamic island */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
      {/* Screen */}
      <div className="rounded-[2rem] overflow-hidden aspect-[9/19.5] bg-black">{children}</div>
    </div>
  );
};
