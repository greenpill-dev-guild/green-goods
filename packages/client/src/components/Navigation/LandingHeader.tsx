import { APP_NAME, type Link, useApp } from "@green-goods/shared";
import { type RemixiconComponentType, RiGithubLine, RiTwitterLine } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";

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
  const intl = useIntl();
  const { isMobile } = useApp();

  const filterLinks = isMobile ? links.filter(({ title }) => title === "twitter") : links;

  return (
    <header className="w-full h-16 lg:h-24 flex justify-between items-center py-4 lg:py-6 text-primary-dark">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary-base focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
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
            aria-label={intl.formatMessage(
              { id: "app.landing.header.socialLink" },
              { platform: title }
            )}
            className="text-primary-dark hover:text-text-sub-600 bg-bg-weak-50 hover:bg-bg-soft-200 p-2 rounded-full transition-colors grid place-items-center"
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
