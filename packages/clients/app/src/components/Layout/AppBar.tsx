import { Link, useLocation } from "react-router-dom";
import { a, config, useSpring } from "@react-spring/web";

import HomeIcon from "../../assets/icons/waves.svg?react";
import ContributeIcon from "../../assets/icons/add.svg?react";
import ProfileIcon from "../../assets/icons/profile.svg?react";

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
    path: "/home",
    title: "Home",
    Icon: HomeIcon,
  },
  {
    path: "/contribute",
    title: "Contribute",
    Icon: ContributeIcon,
  },
  {
    path: "/profile",
    title: "Profile",
    Icon: ProfileIcon,
  },
];

export const Appbar = () => {
  const { pathname } = useLocation();

  const spring = useSpring({
    from: {
      opacity: 0,
      transform: "translateY(100%)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0)",
    },
    config: {
      ...config.slow,
      friction: 48,
      clamp: true,
    },
  });

  return (
    <a.nav
      className={
        "btm-nav z-20 bg-base-100 py-9 fixed bottom-0 rounded-t-2xl w-full"
      }
      style={spring}
    >
      {tabs.map(({ path, Icon, title }) => (
        <Link to={path} key={title}>
          <button
            className={`flex flex-col items-center ${
              pathname === path
                ? "active tab-active fill-stone-950"
                : "fill-stone-500"
            }`}
          >
            <Icon width={36} height={36} />
            <p
              className={`text-sm tracking-wide ${
                pathname === path ? "text-primary" : "text-neutral"
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
