import { a, config, useSpring } from "@react-spring/web";
import { Link, useLocation } from "react-router-dom";

import { RC as WorldIcon } from "../../assets/world.svg";
import { RC as ProfileIcon } from "../../assets/profile.svg";
import { RC as DashboardIcon } from "../../assets/dashboard.svg";
import { useApp } from "../../hooks/providers/app";

const tabs: {
  path: string;
  title: string;
  Icon: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & {
      title?: string | undefined;
    }
  >;
}[] = [
  {
    path: "/art",
    title: "Art",
    Icon: ProfileIcon,
  },
  {
    path: "/synths",
    title: "Synths",
    Icon: DashboardIcon,
  },
  {
    path: "/waves",
    title: "Waves",
    Icon: DashboardIcon,
  },
  {
    path: "/events",
    title: "Events",
    Icon: WorldIcon,
  },
];

export const Navigation = () => {
  const { pathname } = useLocation();
  const {} = useApp();

  const spring = useSpring({
    from: {
      opacity: 0,
      // transform: "translateY(100%)",
    },
    to: {
      opacity: 1,
      // transform: "translateY(0)",
    },
    config: {
      ...config.slow,
      friction: 48,
      clamp: true,
    },
  });

  return (
    <a.nav
      className={"bg-base-100 py-6 px-8 w-full border-r-2 flex flex-col gap-1"}
      style={spring}
    >
      {tabs.map(({ path, Icon, title }) => (
        <Link to={path} key={title}>
          <button
            className={`flex flex-col sm:flex-row sm:gap-2  px-1.5 py-3 rounded-xl items-center w-full ${
              pathname === path
                ? "active tab-active fill-black bg-stone-200"
                : "fill-stone-500"
            }`}
          >
            <Icon width={32} height={32} />
            <p
              className={`text-sm sm:text-xl tracking-wider ${
                pathname === path ? "font-semibold" : ""
              }`}
            >
              {title}
            </p>
          </button>
        </Link>
      ))}
    </a.nav>
  );
};
