import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// Code blocks sit on the DesignMD `code-surface` colors (docs/DESIGN.md) rather
// than the stock Prism theme grounds, so dark code blocks stay on the warm
// neutral ladder instead of Dracula's cold #282A36.
const prismLight = {
  ...prismThemes.github,
  plain: {...prismThemes.github.plain, backgroundColor: '#F5F5F5'},
};
const prismDark = {
  ...prismThemes.dracula,
  plain: {...prismThemes.dracula.plain, backgroundColor: '#292929'},
};

const config: Config = {
  title: 'Green Goods Documentation',
  tagline: 'Bringing community and environmental actions on-chain',
  favicon: 'img/favicon.ico', // Green Goods favicon from client app

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
      useCssCascadeLayers: true,
      siteStorageNamespacing: false,
      fasterByDefault: true,
      mdx1CompatDisabledByDefault: false,
    },
  },

  // Canonical production URL. Vercel owns deployment and the custom domain.
  url: 'https://docs.greengoods.app',
  baseUrl: '/',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  clientModules: [
    './src/clientModules/buildersAccent.ts',
    './src/clientModules/mermaidExpand.ts',
  ],

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
            'https://github.com/greenpill-dev-guild/green-goods/edit/main/docs/',
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
          {from: ['/builders/deployments/gh-actions'], to: '/builders/quality/gh-actions'},
          {from: ['/builders/deployments/status'], to: '/builders/reference/deployments'},
          {from: ['/builders/specs/revenue-explorer'], to: '/builders/reference/economics-explorer'},
          {from: ['/reference/design-research'], to: '/builders/architecture/design'},
          {
            from: [
              '/builders/testing/forge',
              '/builders/testing/playwright',
              '/builders/testing/vitest',
              '/builders/testing/storybook',
            ],
            to: '/builders/testing',
          },
          {
            from: ['/builders/architecture/erd', '/builders/architecture/sequence-diagrams'],
            to: '/builders/architecture/data-model',
          },
          {from: ['/builders/integrations/entity-matrix'], to: '/builders/architecture/entity-matrix'},
          {from: ['/builders/integrations/overview'], to: '/builders/integrations'},
          {
            from: [
              '/builders/journeys/onboarding',
              '/builders/journeys/work-submission',
              '/builders/journeys/evaluation',
              '/builders/journeys/funding',
            ],
            to: '/builders/architecture/anatomy',
          },
          {from: ['/builders/journeys/persona-surfaces'], to: '/builders/reference/persona-surfaces'},
          {from: ['/builders/env-management'], to: '/builders/getting-started'},
          {
            from: [
              '/builders/ethereum-alignment',
              '/builders/architecture/local-vs-global',
              '/builders/architecture/modular-approach',
            ],
            to: '/builders/architecture',
          },
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
            to: '/community/gardener-guide/track-status-and-attestations',
          },
          {from: ['/gardeners/best-practices'], to: '/community/gardener-guide/uploading-your-work'},
          {
            from: ['/welcome/quickstart-operator', '/operators/managing-gardens'],
            to: '/community/steward-guide/creating-a-garden',
          },
          {from: ['/operators/managing-actions'], to: '/community/steward-guide/creating-a-garden'},
          {from: ['/operators/reviewing-work'], to: '/community/steward-guide/reviewing-work'},
          {from: ['/operators/reporting-impact'], to: '/community/steward-guide/creating-impact-certificates'},
          {
            from: ['/welcome/quickstart-evaluator', '/evaluators/accessing-data'],
            to: '/community/how-it-works',
          },
          {from: ['/evaluators/exploring-gardens'], to: '/community/how-it-works'},
          {
            from: ['/evaluators/using-attestation-data'],
            to: '/builders/integrations/eas',
          },
          {
            from: ['/evaluators/external-frameworks'],
            to: '/community/steward-guide/making-an-assessment',
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
            to: '/builders/integrations',
          },
          {
            from: [
              '/developer/testing',
              '/developer/docs-contributing',
              '/developer/docs-deployment',
              '/developer/monitoring',
              '/developer/contracts-handbook',
            ],
            to: '/builders/reference/deployments',
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
            to: '/community/how-it-works',
          },
          {
            from: ['/concepts/hypercerts'],
            to: '/community/steward-guide/creating-impact-certificates',
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
            from: ['/community/green-goods-claims.generated'],
            to: '/community/green-goods-claims',
          },
          {
            from: ['/reference/ontology.generated'],
            to: '/reference/ontology',
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
          {from: ['/developers/integrations'], to: '/builders/integrations'},
          {from: ['/developers/build-patterns', '/builders/build-patterns'], to: '/builders/getting-started'},
          {from: ['/developers/operations', '/builders/operations'], to: '/builders/getting-started'},
          {from: ['/developers/reference'], to: '/builders/getting-started'},
          {from: ['/developers/reference/entity-matrix'], to: '/builders/architecture/entity-matrix'},
          {from: ['/developers/reference/api-index'], to: '/builders/packages/api-index'},
          {from: ['/developers/reference/docs-writing-guide'], to: '/builders/how-to-contribute'},
          {from: ['/developers/reference/deployment-indexer-status'], to: '/builders/reference/deployments'},
          {from: ['/developers/reference/agent-mcp-guide'], to: '/builders/agentic/mcp-guide'},
          {from: ['/developers/reference/docs-frontmatter-contract'], to: '/builders/how-to-contribute'},
          {
            from: ['/builders/deployments/admin-deploy'],
            to: '/builders/packages/admin',
          },
          {
            from: ['/builders/deployments/agent-deploy'],
            to: '/builders/packages/agent',
          },
          {
            from: ['/builders/deployments/client-deploy'],
            to: '/builders/packages/client',
          },
          {
            from: ['/builders/deployments/contracts-deploy'],
            to: '/builders/packages/contracts',
          },
          {
            from: ['/builders/deployments/indexer-deploy'],
            to: '/builders/packages/indexer',
          },

          // Historical specifications now resolve to concise milestone notes. The
          // original text remains available through Git history.
          {from: ['/builders/specs/v0-1'], to: '/reference/product-history#v01'},
          {from: ['/builders/specs/v0-4'], to: '/reference/product-history#v04'},
          {from: ['/builders/specs/v1-0'], to: '/reference/product-history#v10'},
          {
            from: ['/builders/specs/did-ethr-modernization-proposal-2026-03'],
            to: '/reference/product-history#did-ethr-modernization',
          },
          {
            from: [
              '/builders/specs/greenwill-badging-impact-framework-2026-03',
              '/builders/specs/greenwill-gif-analysis-2026-03',
              '/builders/specs/greenwill-gif-evaluation-plan-2026-03',
              '/builders/specs/greenwill-gif-implementation-spec-2026-03',
              '/builders/specs/greenwill-gif-one-pager-2026-03',
            ],
            to: '/reference/product-history#greenwill-research',
          },
          {
            from: ['/builders/specs/opencred-vc-login-for-geographic-garden-access-2026-03'],
            to: '/reference/product-history#opencred-vc-login',
          },
          {
            from: ['/builders/specs/passkey-server-hardening-and-recovery-ready-auth-2026-03'],
            to: '/reference/product-history#passkey-recovery-hardening',
          },

          // concepts/ → community pillar pages
          {from: ['/concepts/impact-model'], to: '/community/how-it-works'},
          {from: ['/concepts/strategy-and-goals'], to: '/community/why-we-build'},
          {from: ['/concepts/mission-and-values'], to: '/community/why-we-build'},
          {from: ['/concepts/communities'], to: '/'},

          // Operator Guide was renamed to Steward Guide; the old URLs are live links.
          {from: ['/community/operator-guide/cookie-jars'], to: '/community/steward-guide/funding-and-governance'},
          {from: ['/community/operator-guide/creating-a-garden'], to: '/community/steward-guide/creating-a-garden'},
          {from: ['/community/operator-guide/creating-impact-certificates'], to: '/community/steward-guide/creating-impact-certificates'},
          {from: ['/community/operator-guide/earning-recognition'], to: '/community/steward-guide/creating-impact-certificates'},
          {from: ['/community/operator-guide'], to: '/community/steward-guide'},
          {from: ['/community/operator-guide/making-an-assessment'], to: '/community/steward-guide/making-an-assessment'},
          {from: ['/community/operator-guide/managing-actions'], to: '/community/steward-guide/managing-actions'},
          {from: ['/community/operator-guide/managing-certificates'], to: '/community/steward-guide/creating-impact-certificates'},
          {from: ['/community/operator-guide/managing-endowments'], to: '/community/steward-guide/funding-and-governance'},
          {from: ['/community/operator-guide/managing-governance'], to: '/community/steward-guide/funding-and-governance'},
          {from: ['/community/operator-guide/managing-payouts'], to: '/community/steward-guide/funding-and-governance'},
          {from: ['/community/operator-guide/reporting-and-gap'], to: '/community/steward-guide/making-an-assessment'},
          {from: ['/community/operator-guide/reviewing-work'], to: '/community/steward-guide/reviewing-work'},
          // operator/ → community/steward-guide/
          {from: ['/operator/create-garden'], to: '/community/steward-guide/creating-a-garden'},
          {from: ['/operator/create-assessments'], to: '/community/steward-guide/making-an-assessment'},
          {from: ['/operator/review-work'], to: '/community/steward-guide/reviewing-work'},
          {from: ['/operator/mint-and-list-hypercerts'], to: '/community/steward-guide/creating-impact-certificates'},
          {from: ['/operator/vaults-and-treasury'], to: '/community/steward-guide/funding-and-governance'},
          {from: ['/operator/conviction-and-signal-pools'], to: '/community/steward-guide/funding-and-governance'},
          {from: ['/operator/get-started-and-roles'], to: '/community/steward-guide/creating-a-garden'},
          {from: ['/operator/manage-actions'], to: '/community/steward-guide/managing-actions'},
          {from: ['/operator/reporting-and-gap'], to: '/community/steward-guide/making-an-assessment'},
          {from: ['/operator/cookie-jars'], to: '/community/steward-guide/funding-and-governance'},

          // gardener/ → community/gardener-guide/
          {from: ['/gardener/submit-work-mdr'], to: '/community/gardener-guide/uploading-your-work'},
          {from: ['/gardener/get-started'], to: '/community/gardener-guide/joining-a-garden'},
          {from: ['/gardener/common-errors'], to: '/community/gardener-guide/recovery-and-sync'},
          {from: ['/gardener/offline-sync-and-drafts'], to: '/community/gardener-guide/recovery-and-sync'},
          {from: ['/gardener/track-status-and-attestations'], to: '/community/gardener-guide/track-status-and-attestations'},

          // evaluator/ legacy routes now point to visible docs until evaluator flows return
          {from: ['/community/evaluator-guide'], to: '/community/how-it-works'},
          {from: ['/evaluator/verify-attestation-chains'], to: '/builders/integrations/eas'},
          {from: ['/evaluator/get-started'], to: '/community/how-it-works'},
          {from: ['/evaluator/cross-framework-mapping'], to: '/community/steward-guide/making-an-assessment'},
          {from: ['/evaluator/export-and-analysis'], to: '/community/steward-guide/making-an-assessment'},
          {from: ['/evaluator/query-eas'], to: '/builders/integrations/eas'},
          {from: ['/evaluator/query-indexer'], to: '/builders/packages/api-index'},
          {from: ['/builders/glossary'], to: '/glossary'},
          {from: ['/reference/changelog'], to: '/reference/product-history'},
          {
            from: ['/reference/regenerative-design-framework'],
            to: '/builders/architecture/design#sources',
          },
          {
            from: ['/reference/regenerative-design-principles'],
            to: '/builders/architecture/design#seven-principles',
          },
          {
            from: [
              '/community/gardener-guide/common-errors',
              '/community/gardener-guide/offline-sync-and-drafts',
            ],
            to: '/community/gardener-guide/recovery-and-sync',
          },
          {
            from: [
              '/community/gardener-guide/earning-badges',
              '/community/gardener-guide/garden-payouts',
              '/community/gardener-guide/voting-governance',
            ],
            to: '/community/how-it-works',
          },
          {
            from: [
              '/community/steward-guide/cookie-jars',
              '/community/steward-guide/managing-endowments',
              '/community/steward-guide/managing-governance',
              '/community/steward-guide/managing-payouts',
            ],
            to: '/community/steward-guide/funding-and-governance',
          },
          {
            from: [
              '/community/steward-guide/earning-recognition',
              '/community/steward-guide/managing-certificates',
            ],
            to: '/community/steward-guide/creating-impact-certificates',
          },
          {
            from: ['/community/steward-guide/reporting-and-gap'],
            to: '/community/steward-guide/making-an-assessment',
          },
          {
            from: [
              '/community/funder-guide/getting-started',
              '/community/funder-guide/vaults-and-hypercerts',
            ],
            to: '/community/funder-guide',
          },
          {
            from: ['/community/funder-guide/earning-recognition'],
            to: '/community/how-it-works',
          },
          {
            from: [
              '/community/evaluator-guide/joining-a-garden',
              '/community/evaluator-guide/making-assessments',
              '/community/evaluator-guide/cross-framework-mapping',
              '/community/evaluator-guide/export-and-analysis',
            ],
            to: '/community/steward-guide/making-an-assessment',
          },
          {
            from: ['/community/evaluator-guide/query-eas'],
            to: '/builders/integrations/eas',
          },
          {
            from: [
              '/community/evaluator-guide/query-indexer',
              '/community/evaluator-guide/reporting-analytics',
            ],
            to: '/builders/packages/api-index',
          },
          {
            from: ['/community/evaluator-guide/evaluating-certificates'],
            to: '/community/steward-guide/creating-impact-certificates',
          },
          {
            from: ['/community/community-member-guide/getting-involved'],
            to: '/community/how-it-works',
          },
          {
            from: ['/community/community-member-guide/conviction-voting'],
            to: '/community/steward-guide/funding-and-governance',
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
        // The docs preset publishes at `/`; the search plugin defaults to `/docs`.
        // Keep these aligned so postBuild indexes every live documentation route.
        docsRouteBasePath: '/',
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
    mermaid: {
      theme: {
        light: 'base',
        dark: 'base',
      },
      options: {
        themeVariables: {
          // Typography — match docs site font
          fontFamily: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',

          // Primary (green) — nodes, default elements
          primaryColor: '#dcfce7',
          primaryTextColor: '#14532d',
          primaryBorderColor: '#16a34a',
          lineColor: '#16a34a',

          // Secondary (blue) — alternate nodes
          secondaryColor: '#dbeafe',
          secondaryTextColor: '#1e3a5f',
          secondaryBorderColor: '#1d4ed8',

          // Tertiary (purple) — decision nodes, highlights
          tertiaryColor: '#ede9fe',
          tertiaryTextColor: '#4c1d95',
          tertiaryBorderColor: '#7c3aed',

          // Notes (amber)
          noteBkgColor: '#fffbeb',
          noteTextColor: '#92400e',
          noteBorderColor: '#f59e0b',

          // Subgraph / cluster styling
          clusterBkg: '#f0fdf4',
          clusterBorder: '#bbf7d0',

          // Edge labels
          edgeLabelBackground: '#f5f5f5',

          // Sequence diagram actors
          actorBkg: '#dcfce7',
          actorBorder: '#16a34a',
          actorTextColor: '#14532d',
          signalColor: '#16a34a',
          signalTextColor: '#14532d',
          activationBkgColor: '#dbeafe',
          activationBorderColor: '#1d4ed8',
        },
      },
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
          sidebarId: 'communitySidebar',
          position: 'left',
          label: 'Community',
        },
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
            { label: 'Steward Guide', to: '/community/steward-guide/' },
            { label: 'Funder Guide', to: '/community/funder-guide/' },
          ],
        },
        {
          title: 'Builders',
          items: [
            { label: 'Getting Started', to: '/builders/getting-started' },
            { label: 'Architecture', to: '/builders/architecture' },
            { label: 'Integrations', to: '/builders/integrations' },
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
            { label: 'Product History', to: '/reference/product-history' },
            { label: 'Credits', to: '/reference/credits' },
          ],
        },
      ],
      logo: {
        alt: 'Green Goods',
        src: 'img/green-goods-logo.png',
        width: 80,
      },
      copyright: `Making grassroots conservation visible, verifiable, and funded.<br/>Copyright © ${new Date().getFullYear()} Greenpill Dev Guild.`,
    },
    prism: {
      theme: prismLight,
      darkTheme: prismDark,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
