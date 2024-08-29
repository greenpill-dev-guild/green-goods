import { Link, useLocation } from "react-router-dom";
// import { a, config, useSpring } from "@react-spring/web";

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
    path: "/home",
    title: "Home",
    Icon: RiHome2Fill,
  },
  {
    path: "/contribute",
    title: "Contribute",
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

  // const spring = useSpring({
  //   from: {
  //     opacity: 0,
  //     transform: "translateY(100%)",
  //   },
  //   to: {
  //     opacity: 1,
  //     transform: "translateY(0)",
  //   },
  //   config: {
  //     ...config.slow,
  //     friction: 48,
  //     clamp: true,
  //   },
  // });

  return (
    <nav
      className={
        "btm-nav z-20 bg-base-100 py-9 fixed bottom-0 rounded-t-2xl w-full"
      }
      // style={spring}
    >
      {tabs.map(({ path, Icon, title }) => (
        <Link to={path} key={title}>
          <button
            className={`flex flex-col items-center ${
              pathname === path ?
                "active tab-active fill-stone-950"
              : "fill-stone-500"
            }`}
          >
            <Icon className="w-6 h-6" />
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
    </nav>
  );
};

// import Link from "next/link";
// import { useTranslations } from "next-intl";
// import { usePathname } from "next/navigation";
// import { RiHome2Fill, PlusCircleIcon, UserCircleIcon } from "lucide-react";

// const linkClasses =
//   "flex-1 flex flex-col items-center text-slate-800 hover:text-teal-700 py-2 focus:outline-none focus:text-teal-700";

// export const Navbar = () => {
//   const pathname = usePathname();
//   const t = useTranslations("Navigation");

//   if (
//     pathname.includes("proposals") ||
//     pathname.includes("profile") ||
//     pathname.includes("create")
//   ) {
//     return (
//       <div className="fixed bottom-0 left-0 right-0 h-[4.5rem] shadow-sm bg-slate-50 font-medium border-t border-slate-100 rounded-t-md py-3 px-4 flex justify-around items-center w-full">
//         <Link
//           href="/proposals"
//           className={`${linkClasses} ${pathname.includes("proposals") && "text-teal-800"}`}
//         >
//           <RiHome2Fill className="h-6 w-6" />
//           <span className=" mt-1">{t("link1")}</span>
//         </Link>
//         <Link
//           href="/create/proposal"
//           className={`${linkClasses} ${pathname.includes("create") && "text-teal-800"}`}
//         >
//           <PlusCircleIcon className="h-6 w-6" />
//           <span className=" mt-1">{t("link2")}</span>
//         </Link>
//         <Link
//           href="/profile"
//           className={`${linkClasses} ${pathname.includes("profile") && "text-teal-800"}`}
//         >
//           <UserCircleIcon className="h-6 w-6" />
//           <span className=" mt-1">{t("link3")}</span>
//         </Link>
//       </div>
//     );
//   }

//   return null;
// };
