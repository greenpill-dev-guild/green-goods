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

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          {
            from: [
              '/welcome/quickstart-gardener',
              '/gardeners/logging-work',
              '/welcome/why-green-goods',
              '/welcome/who-is-it-for',
              '/welcome/what-you-can-do',
            ],
            to: '/gardener/get-started',
          },
          {
            from: ['/gardeners/tracking-contributions'],
            to: '/community/gardener-guide/earning-badges',
          },
          {from: ['/gardeners/best-practices'], to: '/gardener/submit-work-mdr'},
          {
            from: ['/welcome/quickstart-operator', '/operators/managing-gardens'],
            to: '/operator/get-started-and-roles',
          },
          {from: ['/operators/managing-actions'], to: '/operator/create-garden'},
          {from: ['/operators/reviewing-work'], to: '/operator/review-work'},
          {from: ['/operators/reporting-impact'], to: '/community/evaluator-guide/reporting-analytics'},
          {
            from: ['/welcome/quickstart-evaluator', '/evaluators/accessing-data'],
            to: '/evaluator/get-started',
          },
          {from: ['/evaluators/exploring-gardens'], to: '/evaluator/verify-attestation-chains'},
          {
            from: ['/evaluators/using-attestation-data'],
            to: '/evaluator/verify-attestation-chains',
          },
          {
            from: ['/evaluators/external-frameworks'],
            to: '/evaluator/verify-attestation-chains',
          },
          {
            from: [
              '/welcome/quickstart-developer',
              '/developer',
              '/developer/index',
              '/developer/installation',
              '/developer/contributing',
              '/developer/client',
              '/developer/admin',
              '/developer/shared',
            ],
            to: '/developers/getting-started',
          },
          {from: ['/developer/architecture', '/developer/diagrams'], to: '/developers/architecture'},
          {
            from: [
              '/developer/contracts',
              '/developer/hypercerts',
              '/developer/error-handling',
              '/developer/gardener-accounts',
              '/developer/theming',
            ],
            to: '/developers/getting-started',
          },
          {
            from: [
              '/developer/indexer',
              '/developer/ipfs-deployment',
              '/developer/karma-gap',
              '/developer/n8n-automation',
              '/developer/n8n-story-workflow',
              '/developer/claude-agent-teams',
              '/developer/cursor-workflows',
              '/developer/auto-translation-flow',
              '/developer/translation-troubleshooting',
            ],
            to: '/developers/integrations',
          },
          {
            from: [
              '/developer/releasing',
              '/developer/testing',
              '/developer/docs-contributing',
              '/developer/docs-deployment',
              '/developer/monitoring',
              '/developer/contracts-handbook',
            ],
            to: '/builders/deployments/status',
          },
          {from: ['/developer/api-reference'], to: '/developers/reference/api-index'},
          {
            from: ['/developer/claude-mcp-workflows', '/developer/agent'],
            to: '/developers/reference/agent-mcp-guide',
          },
          {
            from: [
              '/concepts/roles',
              '/concepts/gardens-and-work',
            ],
            to: '/gardener/get-started',
          },
          {
            from: ['/concepts/mdr-workflow'],
            to: '/gardener/submit-work-mdr',
          },
          {
            from: ['/concepts/attestations'],
            to: '/evaluator/verify-attestation-chains',
          },
          {
            from: ['/concepts/hypercerts'],
            to: '/operator/mint-and-list-hypercerts',
          },
          {
            from: ['/features/overview', '/features/core-features'],
            to: '/',
          },
          {
            from: ['/community/welcome'],
            to: '/',
          },
          {
            from: [
              '/community/what-is-a-garden',
              '/community/making-assessments',
              '/community/taking-action',
              '/community/work-submissions',
              '/community/documenting-impact',
              '/community/impact-to-funding',
            ],
            to: '/',
          },
          {
            from: [
              '/community/how-it-works/mdr-workflow',
              '/community/how-it-works/frictionless-onboarding',
              '/community/how-it-works/pwa-experience',
              '/community/how-it-works/work-logging',
              '/community/how-it-works/automated-reporting',
              '/community/how-it-works/onchain-verification',
              '/community/how-it-works/localization',
            ],
            to: '/community/how-it-works',
          },
          {
            from: [
              '/community/why-we-build/vision-and-goals',
              '/community/why-we-build/regen-stack',
            ],
            to: '/community/why-we-build',
          },
          {
            from: ['/features/architecture'],
            to: '/developers/architecture',
          },
          {
            from: [
              '/specs',
              '/specs/index',
              '/specs/action-registry-v1',
              '/specs/cookie-jar',
              '/specs/cookie-jar/index',
              '/specs/ens',
              '/specs/ens/index',
              '/specs/gardens',
              '/specs/gardens/gardens-overview',
              '/specs/hypercerts',
              '/specs/hypercerts/index',
              '/specs/juicebox',
              '/specs/juicebox/index',
              '/specs/octant',
              '/specs/octant/octant-overview',
              '/specs/yield-splitting',
              '/specs/yield-splitting/index',
            ],
            to: '/developers/reference',
          },
          {
            from: [
              '/prd',
              '/prd/index',
              '/prd/green-goods-v1',
              '/developers/reference/prd',
              '/developers/reference/specs',
              '/developers/reference/legacy',
            ],
            to: '/developers/reference',
          },
        ],
      },
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
          sidebarId: 'buildersSidebar',
          position: 'left',
          label: 'Builders',
        },
        {
          href: 'https://greengoods.app',
          label: 'App',
          position: 'right',
        },
        {
          href: 'https://admin.greengoods.app',
          label: 'Dashboard',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            { label: 'Welcome to Green Goods', to: '/' },
            { label: 'How It Works', to: '/community/how-it-works' },
            { label: 'Why We Build', to: '/community/why-we-build' },
            { label: 'Gardener Guide', to: '/community/gardener-guide/joining-a-garden' },
          ],
        },
        {
          title: 'Builders',
          items: [
            { label: 'Getting Started', to: '/developers/getting-started' },
            { label: 'Architecture', to: '/developers/architecture' },
            { label: 'Integrations', to: '/developers/integrations' },
            { label: 'How To Contribute', to: '/builders/how-to-contribute' },
          ],
        },
        {
          title: 'Connect',
          items: [
            { label: 'Telegram', href: 'https://t.me/+N3o3_43iRec1Y2Jh' },
            { label: 'X (Twitter)', href: 'https://x.com/greengoodsapp' },
            { label: 'GitHub', href: 'https://github.com/greenpill-dev-guild/green-goods' },
            { label: 'Blog', href: 'https://paragraph.com/@greenpilldevguild' },
          ],
        },
        {
          title: 'Resources',
          items: [
            { label: 'FAQ', to: '/reference/faq' },
            { label: 'Glossary', to: '/glossary' },
            { label: 'Changelog', to: '/reference/changelog' },
            { label: 'Credits', to: '/reference/credits' },
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
