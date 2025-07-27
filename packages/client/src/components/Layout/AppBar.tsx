import {
  type RemixiconComponentType,
  RiHomeFill,
  RiHomeLine,
  RiPlantFill,
  RiPlantLine,
  RiUserFill,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useNavigateToTop } from "@/utils/useNavigateToTop";

export const AppBar = () => {
  const { pathname } = useLocation();
  const isGarden = pathname.startsWith("/garden");
  const intl = useIntl();
  const navigate = useNavigateToTop();

  const tabs: {
    path: string;
    title: string;
    ActiveIcon: RemixiconComponentType;
    InactiveIcon: RemixiconComponentType;
  }[] = [
    {
      path: "/home",
      title: intl.formatMessage({ id: "app.home" }),
      ActiveIcon: RiHomeFill,
      InactiveIcon: RiHomeLine,
    },
    {
      path: "/garden",
      title: intl.formatMessage({ id: "app.garden" }),
      ActiveIcon: RiPlantFill,
      InactiveIcon: RiPlantLine,
    },
    {
      path: "/profile",
      title: intl.formatMessage({ id: "app.profile" }),
      ActiveIcon: RiUserFill,
      InactiveIcon: RiUserLine,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed bottom-0 bg-white border-t border-t-stroke-soft-200 flex flex-row justify-evenly items-center w-full py-3 z-[10000] transition-transform duration-300",
        isGarden ? "translate-y-full" : "translate-y-0"
      )}
    >
      {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => (
        <NavLink
          key={title}
          to={path}
          onClick={() => navigate(path)}
          aria-label={title}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center",
              isActive
                ? "tab-active text-primary focus:outline-hidden"
                : "text-slate-400"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <ActiveIcon className="w-6 h-6" aria-hidden="true" />
              ) : (
                <InactiveIcon className="w-6 h-6" aria-hidden="true" />
              )}
              <p className={`text-sm ${isActive ? "text-primary" : ""}`}>{title}</p>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
