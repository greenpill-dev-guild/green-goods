import {
  RiGithubFill,
  RiTwitterFill,
  RemixiconComponentType,
} from "@remixicon/react";
import React from "react";

interface HeaderProps {}

const links: Link<RemixiconComponentType>[] = [
  {
    title: "twitter",
    Icon: RiTwitterFill,
    link: "https://x.com/greengoodsapp",
  },
  {
    title: "github",
    Icon: RiGithubFill,
    link: "https://github.com/greenpill-dev-guild/green-goods",
  },
];

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="w-full flex justify-between items-center p-4 md:p-6">
      <div className="flex items-center space-x-2">
        <img
          src="/icon.png"
          alt="APP_NAME Logo"
          className="h-8 w-8 md:h-10 md:w-10"
        />
        <h1 className="text-xl md:text-2xl font-bold text-white">APP_NAME</h1>
      </div>
      <div className="hidden md:flex">
        {links.map(({ Icon, link, action }, idx) => (
          <a
            key={idx}
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-white"
            onClick={action}
          >
            <Icon size={24} />
          </a>
        ))}
      </div>
    </header>
  );
};
