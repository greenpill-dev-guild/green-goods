import { Link, useLocation } from "react-router-dom";

import {
  RiHomeFill,
  RiPlantFill,
  RiUserFill,
  RiHomeLine,
  RiPlantLine,
  RiUserLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { cn } from "@/utils/cn";

const tabs: {
  path: string;
  title: string;
  ActiveIcon: RemixiconComponentType;
  InactiveIcon: RemixiconComponentType;
}[] = [
  {
    path: "/gardens",
    title: "Home",
    ActiveIcon: RiHomeFill,
    InactiveIcon: RiHomeLine,
  },
  {
    path: "/garden",
    title: "Garden",
    ActiveIcon: RiPlantFill,
    InactiveIcon: RiPlantLine,
  },
  {
    path: "/profile",
    title: "Profile",
    ActiveIcon: RiUserFill,
    InactiveIcon: RiUserLine,
  },
];

export const AppBar = () => {
  const { pathname } = useLocation();

  return (
    <nav className={"bg-white border-t border-t-gray-300 flex flex-row gap-2 justify-evenly items-center w-full py-4 z-[10000]"}>
      {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => {
        const isActive = pathname === path;
        return (
        <Link to={path} key={title}>
          <button
            className={cn("flex flex-col items-center",
              isActive && "active tab-active text-greengoods-green focus:outline-hidden active-text-red-500",
              !isActive && "text-slate-700")
            }
            type="button"
          >
            {pathname === path ?
              <ActiveIcon className="w-6 h-6" />
            : <InactiveIcon className="w-6 h-6" />}
            <p
              className={`text-sm tracking-wide ${
                pathname === path ? "text-[#367D42]" : ""
              }`}
            >
              {title}
            </p>
          </button>
        </Link>
      )})}
    </nav>
  );
};
