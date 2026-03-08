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
            to: '/community/gardener-guide/joining-a-garden',
          },
          {
            from: ['/gardeners/tracking-contributions'],
            to: '/community/gardener-guide/earning-badges',
          },
          {from: ['/gardeners/best-practices'], to: '/community/gardener-guide/uploading-your-work'},
          {
            from: ['/welcome/quickstart-operator', '/operators/managing-gardens'],
            to: '/community/operator-guide/creating-a-garden',
          },
          {from: ['/operators/managing-actions'], to: '/community/operator-guide/creating-a-garden'},
          {from: ['/operators/reviewing-work'], to: '/community/operator-guide/reviewing-work'},
          {from: ['/operators/reporting-impact'], to: '/community/evaluator-guide/reporting-analytics'},
          {
            from: ['/welcome/quickstart-evaluator', '/evaluators/accessing-data'],
            to: '/community/evaluator-guide/joining-a-garden',
          },
          {from: ['/evaluators/exploring-gardens'], to: '/community/evaluator-guide/making-assessments'},
          {
            from: ['/evaluators/using-attestation-data'],
            to: '/community/evaluator-guide/making-assessments',
          },
          {
            from: ['/evaluators/external-frameworks'],
            to: '/community/evaluator-guide/making-assessments',
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
            to: '/builders/getting-started',
          },
          {from: ['/developer/architecture', '/developer/diagrams'], to: '/builders/architecture'},
          {
            from: [
              '/developer/contracts',
              '/developer/hypercerts',
              '/developer/error-handling',
              '/developer/gardener-accounts',
              '/developer/theming',
            ],
            to: '/builders/getting-started',
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
            to: '/builders/integrations/overview',
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
          {from: ['/developer/api-reference'], to: '/builders/packages/api-index'},
          {
            from: ['/developer/claude-mcp-workflows', '/developer/agent'],
            to: '/builders/agentic/mcp-guide',
          },
          {
            from: [
              '/concepts/roles',
              '/concepts/gardens-and-work',
            ],
            to: '/community/gardener-guide/joining-a-garden',
          },
          {
            from: ['/concepts/mdr-workflow'],
            to: '/community/gardener-guide/uploading-your-work',
          },
          {
            from: ['/concepts/attestations'],
            to: '/community/evaluator-guide/making-assessments',
          },
          {
            from: ['/concepts/hypercerts'],
            to: '/community/operator-guide/creating-impact-certificates',
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
            to: '/builders/architecture',
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
            to: '/builders/getting-started',
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
            to: '/builders/getting-started',
          },

          // === Docs restructuring redirects (v1.1 consolidation) ===

          // developers/ → builders/
          {from: ['/developers/getting-started'], to: '/builders/getting-started'},
          {from: ['/developers/architecture'], to: '/builders/architecture'},
          {from: ['/developers/integrations'], to: '/builders/integrations/overview'},
          {from: ['/developers/build-patterns'], to: '/builders/build-patterns'},
          {from: ['/developers/operations'], to: '/builders/operations'},
          {from: ['/developers/reference'], to: '/builders/getting-started'},
          {from: ['/developers/reference/entity-matrix'], to: '/builders/integrations/entity-matrix'},
          {from: ['/developers/reference/api-index'], to: '/builders/packages/api-index'},
          {from: ['/developers/reference/docs-writing-guide'], to: '/builders/how-to-contribute'},
          {from: ['/developers/reference/deployment-indexer-status'], to: '/builders/deployments/status'},
          {from: ['/developers/reference/agent-mcp-guide'], to: '/builders/agentic/mcp-guide'},
          {from: ['/developers/reference/docs-frontmatter-contract'], to: '/builders/how-to-contribute'},

          // concepts/ → community pillar pages
          {from: ['/concepts/impact-model'], to: '/community/how-it-works'},
          {from: ['/concepts/strategy-and-goals'], to: '/community/where-were-headed'},
          {from: ['/concepts/mission-and-values'], to: '/community/why-we-build'},
          {from: ['/concepts/communities'], to: '/'},

          // operator/ → community/operator-guide/
          {from: ['/operator/create-garden'], to: '/community/operator-guide/creating-a-garden'},
          {from: ['/operator/create-assessments'], to: '/community/operator-guide/making-an-assessment'},
          {from: ['/operator/review-work'], to: '/community/operator-guide/reviewing-work'},
          {from: ['/operator/mint-and-list-hypercerts'], to: '/community/operator-guide/creating-impact-certificates'},
          {from: ['/operator/vaults-and-treasury'], to: '/community/operator-guide/managing-endowments'},
          {from: ['/operator/conviction-and-signal-pools'], to: '/community/operator-guide/managing-governance'},
          {from: ['/operator/get-started-and-roles'], to: '/community/operator-guide/creating-a-garden'},
          {from: ['/operator/manage-actions'], to: '/community/operator-guide/managing-actions'},
          {from: ['/operator/reporting-and-gap'], to: '/community/operator-guide/reporting-and-gap'},
          {from: ['/operator/cookie-jars'], to: '/community/operator-guide/cookie-jars'},
          {from: ['/operator/troubleshooting'], to: '/community/operator-guide/troubleshooting'},

          // gardener/ → community/gardener-guide/
          {from: ['/gardener/submit-work-mdr'], to: '/community/gardener-guide/uploading-your-work'},
          {from: ['/gardener/get-started'], to: '/community/gardener-guide/joining-a-garden'},
          {from: ['/gardener/common-errors'], to: '/community/gardener-guide/common-errors'},
          {from: ['/gardener/offline-sync-and-drafts'], to: '/community/gardener-guide/offline-sync-and-drafts'},
          {from: ['/gardener/track-status-and-attestations'], to: '/community/gardener-guide/track-status-and-attestations'},

          // evaluator/ → community/evaluator-guide/
          {from: ['/evaluator/verify-attestation-chains'], to: '/community/evaluator-guide/making-assessments'},
          {from: ['/evaluator/get-started'], to: '/community/evaluator-guide/joining-a-garden'},
          {from: ['/evaluator/cross-framework-mapping'], to: '/community/evaluator-guide/cross-framework-mapping'},
          {from: ['/evaluator/export-and-analysis'], to: '/community/evaluator-guide/export-and-analysis'},
          {from: ['/evaluator/query-eas'], to: '/community/evaluator-guide/query-eas'},
          {from: ['/evaluator/query-indexer'], to: '/community/evaluator-guide/query-indexer'},
          {from: ['/evaluator/troubleshooting'], to: '/community/evaluator-guide/troubleshooting'},
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
            { label: 'Getting Started', to: '/builders/getting-started' },
            { label: 'Architecture', to: '/builders/architecture' },
            { label: 'Integrations', to: '/builders/integrations/overview' },
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
