import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Green Goods Documentation',
  tagline: 'Bringing community and environmental actions onchain',
  favicon: 'img/favicon.ico', // Green Goods favicon from client app

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.greengoods.app',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'greenpill-dev-guild',
  projectName: 'green-goods',
  deploymentBranch: 'main',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/', // Docs at root URL
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/greenpill-dev-guild/green-goods/tree/main/docs/docs/',
        },
        blog: false, // Using external Paragraph blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  // Enable Mermaid diagrams
  markdown: {
    mermaid: true,
  },
  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  themeConfig: {
    // Social card for link previews (Twitter, Telegram, etc.)
    image: 'img/green-goods-social-card.webp',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Green Goods',
      logo: {
        alt: 'Green Goods Logo',
        src: 'img/green-goods-logo.png',
        srcDark: 'img/green-goods-logo.png', // Same logo for dark mode
        style: { height: '32px', width: 'auto' }, // Preserve aspect ratio (819x464 = 1.76:1)
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'usersSidebar',
          position: 'left',
          label: 'Users',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developersSidebar',
          position: 'left',
          label: 'Developers',
        },
        {
          href: 'https://paragraph.com/@greenpilldevguild',
          label: 'Blog',
          position: 'left',
        },
        {
          href: 'https://greengoods.app',
          label: 'App',
          position: 'right',
        },
        {
          href: 'https://github.com/greenpill-dev-guild/green-goods',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Users',
          items: [
            {
              label: 'Gardener Guide',
              to: '/welcome/quickstart-gardener',
            },
            {
              label: 'Operator Guide',
              to: '/welcome/quickstart-operator',
            },
            {
              label: 'Evaluator Guide',
              to: '/welcome/quickstart-evaluator',
            },
          ],
        },
        {
          title: 'Developers',
          items: [
            {
              label: 'Developer Quickstart',
              to: '/welcome/quickstart-developer',
            },
            {
              label: 'Architecture',
              to: '/developer/architecture',
            },
            {
              label: 'API Reference',
              to: '/developer/api-reference',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Telegram',
              href: 'https://t.me/+N3o3_43iRec1Y2Jh',
            },
            {
              label: 'X (Twitter)',
              href: 'https://x.com/greengoodsapp',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/greenpill-dev-guild/green-goods',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'App',
              href: 'https://greengoods.app',
            },
            {
              label: 'Admin Dashboard',
              href: 'https://admin.greengoods.app',
            },
            {
              label: 'Dev Guild Blog',
              href: 'https://paragraph.com/@greenpilldevguild',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Greenpill Dev Guild. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
