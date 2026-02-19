import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Green Goods Documentation Sidebars
 *
 * Role-first information architecture:
 * - gardenerSidebar
 * - operatorSidebar
 * - evaluatorSidebar
 * - developersSidebar
 * - referenceSidebar
 */
const sidebars: SidebarsConfig = {
  gardenerSidebar: [
    {
      type: 'doc',
      id: 'gardener/get-started',
      label: 'Get Started',
    },
    {
      type: 'category',
      label: 'Journey',
      collapsed: false,
      items: [
        'gardener/submit-work-mdr',
        'gardener/offline-sync-and-drafts',
        'gardener/track-status-and-attestations',
        'gardener/common-errors',
      ],
    },
  ],

  operatorSidebar: [
    {
      type: 'doc',
      id: 'operator/get-started-and-roles',
      label: 'Get Started',
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
      label: 'Treasury & Governance',
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
      label: 'Get Started',
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
      ],
    },
  ],

  referenceSidebar: [
    {
      type: 'doc',
      id: 'reference/faq',
      label: 'FAQ',
    },
    {
      type: 'doc',
      id: 'reference/changelog',
      label: 'Changelog',
    },
    {
      type: 'doc',
      id: 'glossary',
      label: 'Glossary',
    },
    {
      type: 'doc',
      id: 'reference/credits',
      label: 'Credits',
    },
  ],
};

export default sidebars;
