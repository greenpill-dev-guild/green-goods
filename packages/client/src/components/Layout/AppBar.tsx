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
    <nav className={"btm-nav z-10 w-full rounded-t-2xl py-9 bg-[#F4E0CC]"}>
      {tabs.map(({ path, Icon, title }) => (
        <Link to={path} key={title}>
          <button
            className={`flex flex-col items-center ${
              pathname === path ?
                "active tab-active text-[#367D42] focus:outline-none hover:text-[#367D42]"
              : "text-stone-700"
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
