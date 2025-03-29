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
import { useNavigateToTop } from "@/utils/useNavigateToTop";

const tabs: {
  path: string;
  title: string;
  ActiveIcon: RemixiconComponentType;
  InactiveIcon: RemixiconComponentType;
}[] = [
  {
    path: "/home",
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

  const navigate = useNavigateToTop();

  return (
    <nav
      className={
        "fixed bottom-0 bg-white border-t border-t-stroke-soft-200 flex flex-row justify-evenly items-center w-full py-3 z-[10000]"
      }
    >
      {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => {
        const isActive = pathname.startsWith(path);
        return (
          <Link to={path} key={title} onClick={() => navigate(path)}>
            <button
              className={cn(
                "flex flex-col items-center",
                isActive &&
                  "active tab-active text-primary focus:outline-hidden active-text-red-500",
                !isActive && "text-slate-400"
              )}
              type="button"
            >
              {pathname.startsWith(path) ? (
                <ActiveIcon className="w-6 h-6" />
              ) : (
                <InactiveIcon className="w-6 h-6" />
              )}
              <p
                className={`text-sm ${pathname.startsWith(path) ? "text-primary" : ""}`}
              >
                {title}
              </p>
            </button>
          </Link>
        );
      })}
    </nav>
  );
};
