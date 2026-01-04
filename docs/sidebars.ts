import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Green Goods Documentation Sidebar
 * 
 * Mirrors the structure from GitBook SUMMARY.md
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
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
        'welcome/quickstart-developer',
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
      label: 'Developer Documentation',
      items: [
        {
          type: 'category',
          label: 'Getting Started',
          items: [
            'developer/getting-started',
            'developer/installation',
          ],
        },
        {
          type: 'category',
          label: 'Architecture & Packages',
          items: [
            'developer/architecture/monorepo-structure',
            'developer/architecture/diagrams',
            'developer/architecture/client-package',
            'developer/architecture/admin-package',
            'developer/architecture/indexer-package',
            'developer/architecture/telegram-bot',
            'developer/architecture/contracts-package',
            'developer/architecture',
          ],
        },
        {
          type: 'category',
          label: 'Testing & Development',
          items: [
            'developer/testing',
            'developer/cursor-workflows',
            'developer/n8n-automation',
            'developer/api-reference',
            'developer/contracts-handbook',
            'developer/ipfs-deployment',
            'developer/karma-gap',
            'developer/theming',
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
};

export default sidebars;
