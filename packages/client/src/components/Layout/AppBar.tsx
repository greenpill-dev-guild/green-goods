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
import { useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useNavigateToTop } from "@/utils/useNavigateToTop";
import { PersistentLink, useDeepLinkPersistence } from "@/components/Navigation/PersistentLink";

export const AppBar = () => {
  const { pathname } = useLocation();
  const isGarden = pathname.startsWith("/garden");
  const intl = useIntl();
  const navigate = useNavigateToTop();
  const { shouldPreserveRoute } = useDeepLinkPersistence();

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
      className={cn(
        "fixed bottom-0 bg-white border-t border-t-stroke-soft-200 flex flex-row justify-evenly items-center w-full py-3 z-[10000] transition-transform duration-300",
        isGarden ? "translate-y-full" : "translate-y-0"
      )}
    >
      {tabs.map(({ path, ActiveIcon, InactiveIcon, title }) => {
        const isActive = pathname.startsWith(path);
        return (
          <PersistentLink 
            to={path} 
            key={title} 
            onClick={() => navigate(path)}
            preventRedirect={shouldPreserveRoute()}
            className="focus:outline-none"
          >
            <button
              className={cn(
                "flex flex-col items-center transition-colors duration-200",
                isActive &&
                  "active tab-active text-primary focus:outline-hidden",
                !isActive && "text-slate-400 hover:text-slate-600"
              )}
              type="button"
              aria-label={`Navigate to ${title}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {pathname.startsWith(path) ? (
                <ActiveIcon className="w-6 h-6" aria-hidden="true" />
              ) : (
                <InactiveIcon className="w-6 h-6" aria-hidden="true" />
              )}
              <p className={`text-sm ${pathname.startsWith(path) ? "text-primary" : ""}`}>
                {title}
              </p>
            </button>
          </PersistentLink>
        );
      })}
    </nav>
  );
};
