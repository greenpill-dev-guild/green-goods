import { APP_NAME } from "@green-goods/shared/config";
import { useApp } from "@green-goods/shared/providers";
import { type RemixiconComponentType, RiGithubLine, RiTwitterLine } from "@remixicon/react";
import type React from "react";

type LandingHeaderProps = Record<string, never>;

const links: Link<RemixiconComponentType>[] = [
  {
    title: "twitter",
    Icon: RiTwitterLine,
    link: "https://x.com/greengoodsapp",
  },
  {
    title: "github",
    Icon: RiGithubLine,
    link: "https://github.com/greenpill-dev-guild/green-goods",
  },
];

export const LandingHeader: React.FC<LandingHeaderProps> = () => {
  const { isMobile } = useApp();

  const filterLinks = isMobile ? links.filter(({ title }) => title === "twitter") : links;

  return (
    <header className="w-full h-16 lg:h-24 flex justify-between items-center py-4 lg:py-6 text-[#367D42]">
      <div className="flex items-center space-x-2">
        <img src="/icon.png" alt="APP_NAME Logo" className=" w-12 lg:w-20" />
        <h1 className="text-xl lg:text-3xl font-bold">{APP_NAME}</h1>
      </div>
      <div className="flex gap-2">
        {filterLinks.map(({ Icon, link, action, title }) => (
          <a
            key={title}
            href={link}
            target="_blank"
            rel="noreferrer"
            aria-label={`Visit our ${title}`}
            className="text-[#367D42] hover:text-[#D2B48C] bg-bg-weak-50 hover:bg-bg-soft-200 p-2 rounded-full transition-colors grid place-items-center"
            onClick={action}
          >
            <Icon size={28} />
          </a>
        ))}
      </div>
    </header>
  );
};

// Keep backward-compatible alias
export const Header = LandingHeader;
