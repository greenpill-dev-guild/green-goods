import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Green Goods Documentation Sidebars
 *
 * Architecture:
 * - Home page (intro.md) serves as the about flow and entry point
 * - conceptsSidebar — linked from home, no navbar item, navigable between concept pages
 * - gardenerSidebar, operatorSidebar, evaluatorSidebar — role-specific guides (navbar)
 * - developersSidebar — developer reference (navbar)
 */
const sidebars: SidebarsConfig = {
  conceptsSidebar: [
    { type: 'doc', id: 'intro', label: 'What is Green Goods' },
    'concepts/impact-model',
    'concepts/mission-and-values',
    { type: 'doc', id: 'concepts/strategy-and-goals', label: 'Strategy & Goals' },
    { type: 'doc', id: 'concepts/communities', label: 'Communities' },
  ],

  gardenerSidebar: [
    {
      type: 'doc',
      id: 'gardener/get-started',
      label: 'Gardener Guide',
    },
    {
      type: 'category',
      label: 'Journey',
      collapsed: false,
      items: [
        { type: 'doc', id: 'gardener/submit-work-mdr', label: 'Document Your Work' },
        { type: 'doc', id: 'gardener/offline-sync-and-drafts', label: 'Working Offline' },
        { type: 'doc', id: 'gardener/track-status-and-attestations', label: 'Track Your Progress' },
        { type: 'doc', id: 'gardener/common-errors', label: 'Troubleshooting' },
      ],
    },
  ],

  operatorSidebar: [
    {
      type: 'doc',
      id: 'operator/get-started-and-roles',
      label: 'Operator Guide',
    },
    {
      type: 'category',
      label: 'Core Workflows',
      collapsed: false,
      items: [
        'operator/create-garden',
        'operator/manage-actions',
        'operator/review-work',
        'operator/create-assessments',
        'operator/mint-and-list-hypercerts',
      ],
    },
    {
      type: 'category',
      label: 'Endowments & Governance',
      items: [
        'operator/vaults-and-treasury',
        'operator/cookie-jars',
        'operator/conviction-and-signal-pools',
      ],
    },
    {
      type: 'category',
      label: 'Reporting',
      items: [
        'operator/reporting-and-gap',
        'operator/troubleshooting',
      ],
    },
  ],

  evaluatorSidebar: [
    {
      type: 'doc',
      id: 'evaluator/get-started',
      label: 'Evaluator Guide',
    },
    {
      type: 'category',
      label: 'Data Access',
      collapsed: false,
      items: [
        'evaluator/query-indexer',
        'evaluator/query-eas',
        'evaluator/verify-attestation-chains',
        'evaluator/cross-framework-mapping',
        'evaluator/export-and-analysis',
        'evaluator/troubleshooting',
      ],
    },
  ],

  developersSidebar: [
    {
      type: 'doc',
      id: 'developers/getting-started',
      label: 'Getting Started',
    },
    {
      type: 'doc',
      id: 'developers/architecture',
      label: 'Architecture',
    },
    {
      type: 'doc',
      id: 'developers/build-patterns',
      label: 'Build Patterns',
    },
    {
      type: 'doc',
      id: 'developers/integrations',
      label: 'Integrations',
    },
    {
      type: 'doc',
      id: 'developers/operations',
      label: 'Operations',
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'developers/reference/index',
        'developers/reference/api-index',
        'developers/reference/deployment-indexer-status',
        'developers/reference/agent-mcp-guide',
        'developers/reference/docs-frontmatter-contract',
        'developers/reference/docs-writing-guide',
        'developers/reference/entity-matrix',
        'reference/changelog',
      ],
    },
  ],
};

export default sidebars;
