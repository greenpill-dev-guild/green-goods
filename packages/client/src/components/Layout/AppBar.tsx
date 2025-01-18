import { Link, useLocation } from "react-router-dom";

import {
  RiHomeFill,
  RiPlantFill,
  RiUserFill,
  RiHomeLine,
  RiPlantLine,
  RiUserLine,
  RemixiconComponentType,
} from "@remixicon/react";

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
    <nav className={"btm-nav z-10 w-full rounded-t-2xl py-9 bg-[#F4E0CC]"}>
      {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => (
        <Link to={path} key={title}>
          <button
            className={`flex flex-col items-center ${
              pathname === path ?
                "active tab-active text-[#367D42] focus:outline-none hover:text-[#367D42]"
              : "text-stone-700"
            }`}
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
      ))}
    </nav>
  );
};
