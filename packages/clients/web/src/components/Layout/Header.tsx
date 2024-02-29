import React from "react";

// import { RC as MenuIcon } from "../../assets/menu.svg";

interface HeaderProps {
  isStarted?: boolean;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header
      className={`bg-base-100 py-2 px-8 flex items-center justify-between border-b-2`}
    >
      <h1 className="font-bold text-4xl">WAVES</h1>
      <div>
        <button className="btn btn-sm btn-primary">Login</button>
      </div>
    </header>
  );
};
