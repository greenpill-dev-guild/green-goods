import { Link, useLocation } from "react-router-dom";

import {
  RiHome2Fill,
  RiCrossFill,
  RiProfileFill,
  RemixiconComponentType,
} from "@remixicon/react";

const tabs: {
  path: string;
  title: string;
  Icon: RemixiconComponentType;
}[] = [
  {
    path: "/gardens",
    title: "Home",
    Icon: RiHome2Fill,
  },
  {
    path: "/garden",
    title: "Garden",
    Icon: RiCrossFill,
  },
  {
    path: "/profile",
    title: "Profile",
    Icon: RiProfileFill,
  },
];

export const Appbar = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className={
        "btm-nav z-20 bg-base-100 py-9 fixed bottom-0 rounded-t-2xl w-full"
      }
      // className="fixed bottom-0 left-0 right-0 h-[4.5rem] shadow-sm bg-slate-50 font-medium border-t border-slate-100 rounded-t-md py-3 px-4 flex justify-around items-center w-full">
      // style={spring}
    >
      {tabs.map(({ path, Icon, title }) => (
        <Link to={path} key={title}>
          <button
            // const linkClasses =
            //   "flex-1 flex flex-col items-center text-slate-800 hover:text-teal-700 py-2 focus:outline-none focus:text-teal-700";

            className={`flex flex-col items-center ${
              pathname === path ? "active tab-active" : ""
            }`}
          >
            <Icon className="w-6 h-6" />
            <p
              className={`text-sm tracking-wide ${
                pathname === path ? "t" : ""
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
