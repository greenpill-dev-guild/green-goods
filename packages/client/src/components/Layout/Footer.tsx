import {
  RiTelegramFill,
  RiDiscordFill,
  RiTwitterFill,
  RiGithubFill,
  RemixiconComponentType,
} from "@remixicon/react";
import React from "react";

interface FooterProps {}

interface Link {
  title: string;
  Icon: RemixiconComponentType;
  link: string;
  action?: () => void;
}

const links: Link[] = [
  { title: "x", Icon: RiTwitterFill, link: "https://x.com/gp_dev_guild" },
  {
    title: "discord",
    Icon: RiDiscordFill,
    link: "https://discord.com/gp_dev_guild",
  },
  {
    title: "telegram",
    Icon: RiTelegramFill,
    link: "https://t.me/gp_dev_guild",
  },
  {
    title: "github",
    Icon: RiGithubFill,
    link: "https://github.com/greenpill-dev-guild",
  },
];

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="footer p-6 border-t border-gray-200">
      <div className="flex items-center justify-between gap-4 w-full max-w-screen-xl flex-nowrap mx-auto">
        <aside className="flex gap-3 items-center">
          {/* <Image
            alt="Impact Garden Logo"
            src={"/icon.png"}
            className=""
            width={24}
            height={24}
          /> */}
          <p>
            Impact Reef is built by <b>Greenpill Dev Guild</b>
          </p>
        </aside>
        <nav className="flex gap-3">
          {links.map(({ Icon, title }) => (
            <a
              key={title}
              // href={link}
              target="_blank"
              className={`p-1.5 grid place-items-center rounded-full bg-black text-white`}
            >
              <Icon className="w-4 h-4" />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};
