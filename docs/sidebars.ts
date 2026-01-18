import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Green Goods Documentation Sidebars
 * 
 * Two separate navigation structures:
 * - usersSidebar: For gardeners, operators, evaluators
 * - developersSidebar: For developers and contributors
 */
const sidebars: SidebarsConfig = {
  // ============================================================================
  // USERS SIDEBAR - Gardeners, Operators, Evaluators
  // ============================================================================
  usersSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Welcome to Green Goods',
      collapsed: false,
      items: [
        'welcome/why-green-goods',
        'welcome/who-is-it-for',
        'welcome/what-you-can-do',
      ],
    },
    {
      type: 'category',
      label: 'Quick Start',
      collapsed: false,
      items: [
        'welcome/quickstart-gardener',
        'welcome/quickstart-operator',
        'welcome/quickstart-evaluator',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/roles',
        'concepts/gardens-and-work',
        'concepts/mdr-workflow',
        'concepts/attestations',
        'concepts/hypercerts',
      ],
    },
    {
      type: 'category',
      label: 'Product Features',
      items: [
        'features/overview',
        'features/core-features',
        'features/architecture',
      ],
    },
    {
      type: 'category',
      label: 'How-To Guides',
      items: [
        {
          type: 'category',
          label: 'For Gardeners',
          items: [
            'guides/gardeners/logging-work',
            'guides/gardeners/tracking-contributions',
            'guides/gardeners/best-practices',
          ],
        },
        {
          type: 'category',
          label: 'For Garden Operators',
          items: [
            'guides/operators/managing-gardens',
            'guides/operators/managing-actions',
            'guides/operators/reviewing-work',
            'guides/operators/reporting-impact',
          ],
        },
        {
          type: 'category',
          label: 'For Impact Evaluators',
          items: [
            'guides/evaluators/accessing-data',
            'guides/evaluators/exploring-gardens',
            'guides/evaluators/using-attestation-data',
            'guides/evaluators/external-frameworks',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/faq',
        'reference/changelog',
        'reference/design-research',
        'reference/credits',
        'glossary',
      ],
    },
  ],

  // ============================================================================
  // DEVELOPERS SIDEBAR - Technical Documentation
  // ============================================================================
  developersSidebar: [
    {
      type: 'doc',
      id: 'welcome/quickstart-developer',
      label: 'Developer Quickstart',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'developer/getting-started',
        'developer/installation',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'developer/architecture',
        'developer/architecture/monorepo-structure',
        'developer/architecture/diagrams',
        {
          type: 'category',
          label: 'Package Architecture',
          items: [
            'developer/architecture/client-package',
            'developer/architecture/admin-package',
            'developer/architecture/indexer-package',
            'developer/architecture/contracts-package',
            'developer/architecture/telegram-bot',
            'developer/architecture/gardener-accounts',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Testing & Development',
      items: [
        'developer/testing',
        'developer/cursor-workflows',
        'developer/n8n-automation',
      ],
    },
    {
      type: 'category',
      label: 'Deployment & Operations',
      items: [
        'developer/releasing',
        'developer/contracts-handbook',
        'developer/ipfs-deployment',
        'developer/monitoring',
        'developer/karma-gap',
      ],
    },
    {
      type: 'category',
      label: 'API & Integrations',
      items: [
        'developer/api-reference',
        'developer/theming',
        'developer/auto-translation-flow',
        'developer/translation-troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'developer/contributing',
        'developer/docs-contributing',
        'developer/docs-deployment',
      ],
    },
  ],
};

export default sidebars;
