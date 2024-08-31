// import {
//   RiTwitterFill,
//   RiGithubFill,
//   RemixiconComponentType,
// } from "@remixicon/react";
import React from "react";

interface FooterProps {}

// interface Link {
//   title: string;
//   Icon: RemixiconComponentType;
//   link: string;
//   action?: () => void;
// }

// const links: Link[] = [
//   { title: "x", Icon: RiTwitterFill, link: "https://x.com/gp_dev_guild" },
//   {
//     title: "github",
//     Icon: RiGithubFill,
//     link: "https://github.com/greenpill-dev-guild",
//   },
// ];

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="footer h-[5rem] border-t lg:border-none border-stone-200 flex flex-col gap-2 py-2 lg:flex-row items-center justify-between  lg:gap-4">
      <div className="">
        <p>
          Built by <b className="text-[#367D42]">Greenpill Dev Guild</b>
        </p>
      </div>
      {/* <nav className="flex gap-4">
        {links.map(({ Icon, title }) => (
          <a
            key={title}
            // href={link}
            target="_blank"
            className={`p-1.5 grid place-items-center rounded-full bg-black text-white`}
          >
            <Icon className="w-5 h-5" />
          </a>
        ))}
      </nav> */}
    </footer>
  );
};
