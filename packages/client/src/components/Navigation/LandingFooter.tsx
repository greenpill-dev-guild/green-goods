import type React from "react";

type LandingFooterProps = Record<string, never>;

export const LandingFooter: React.FC<LandingFooterProps> = () => {
  return (
    <footer className="h-[5rem] flex flex-col gap-2 py-2 lg:flex-row items-center justify-between lg:gap-4">
      <div className="">
        <p>
          Built by <b className="text-[#367D42]">Greenpill Dev Guild</b>
        </p>
      </div>
    </footer>
  );
};

// Keep backward-compatible alias
export const Footer = LandingFooter;
