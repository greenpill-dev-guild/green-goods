import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  communitySidebar: [
    {type: 'doc', id: 'community/welcome', label: 'Welcome'},
    {type: 'doc', id: 'community/how-it-works', label: 'How It Works'},
    {type: 'doc', id: 'community/why-we-build', label: 'Why We Build'},
    {
      type: 'category',
      label: 'Gardener',
      link: {type: 'doc', id: 'community/gardener-guide/index'},
      items: [
        {type: 'doc', id: 'community/gardener-guide/joining-a-garden', label: 'Join a Garden'},
        {type: 'doc', id: 'community/gardener-guide/uploading-your-work', label: 'Submit Work'},
        {type: 'doc', id: 'community/gardener-guide/recovery-and-sync', label: 'Recovery and Sync'},
        {type: 'doc', id: 'community/gardener-guide/track-status-and-attestations', label: 'Track Status'},
      ],
    },
    {
      type: 'category',
      label: 'Steward and Evaluator',
      link: {type: 'doc', id: 'community/steward-guide/index'},
      items: [
        {type: 'doc', id: 'community/steward-guide/creating-a-garden', label: 'Create a Garden'},
        {type: 'doc', id: 'community/steward-guide/managing-actions', label: 'Manage Actions'},
        {type: 'doc', id: 'community/steward-guide/making-an-assessment', label: 'Create an Assessment'},
        {type: 'doc', id: 'community/steward-guide/reviewing-work', label: 'Review Work'},
        {type: 'doc', id: 'community/steward-guide/creating-impact-certificates', label: 'Mint Impact Certificate'},
        {type: 'doc', id: 'community/steward-guide/funding-and-governance', label: 'Funding and Governance'},
      ],
    },
    {
      type: 'category',
      label: 'Funder',
      link: {type: 'doc', id: 'community/funder-guide/index'},
      items: [
        {type: 'doc', id: 'community/funder-guide/donating-to-a-garden', label: 'Donate'},
        {type: 'doc', id: 'community/funder-guide/funding-a-garden', label: 'Endow'},
        {type: 'doc', id: 'community/funder-guide/withdraw-from-a-vault', label: 'Remove an Endowment'},
      ],
    },
    {type: 'doc', id: 'community/green-goods-claims.generated', label: 'Honest Claims'},
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        {type: 'doc', id: 'reference/faq', label: 'FAQ'},
        {type: 'doc', id: 'reference/glossary.generated', label: 'Glossary'},
        {type: 'doc', id: 'reference/ontology.generated', label: 'Formal Ontology'},
        {type: 'doc', id: 'reference/product-history', label: 'Product History'},
        {type: 'doc', id: 'reference/design-research', label: 'Design Rationale'},
        {type: 'doc', id: 'reference/credits', label: 'Credits'},
      ],
    },
  ],

  buildersSidebar: [
    {type: 'doc', id: 'builders/getting-started', label: 'Getting Started'},
    {type: 'doc', id: 'builders/how-to-contribute', label: 'First Contribution'},
    {
      type: 'category',
      label: 'Architecture',
      link: {type: 'doc', id: 'builders/architecture'},
      items: [
        {type: 'doc', id: 'builders/architecture/anatomy', label: 'Anatomy of a Work Submission'},
        {type: 'doc', id: 'builders/architecture/data-model', label: 'Data Model & Ontology'},
        {type: 'doc', id: 'builders/architecture/entity-matrix', label: 'Entity Matrix'},
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      link: {type: 'doc', id: 'builders/packages/index'},
      items: [
        {type: 'doc', id: 'builders/packages/contracts', label: 'Contracts'},
        {type: 'doc', id: 'builders/packages/shared', label: 'Shared'},
        {type: 'doc', id: 'builders/packages/client', label: 'Client'},
        {type: 'doc', id: 'builders/packages/admin', label: 'Admin'},
        {type: 'doc', id: 'builders/packages/agent', label: 'Agent'},
        {type: 'doc', id: 'builders/packages/indexer', label: 'Indexer'},
        {type: 'doc', id: 'builders/packages/qa', label: 'QA'},
        {type: 'doc', id: 'builders/packages/api-index', label: 'API Index'},
      ],
    },
    {
      type: 'category',
      label: 'Product Specifications',
      link: {type: 'generated-index', description: 'The retained interactive specification.'},
      items: [
        {type: 'doc', id: 'builders/specs/revenue-explorer', label: 'Revenue Explorer'},
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      link: {type: 'doc', id: 'builders/integrations/index'},
      items: [
        {type: 'doc', id: 'builders/integrations/eas', label: 'EAS'},
        {type: 'doc', id: 'builders/integrations/hats', label: 'Hats Protocol'},
        {type: 'doc', id: 'builders/integrations/tokenbound', label: 'Tokenbound Accounts'},
        {type: 'doc', id: 'builders/integrations/passkey', label: 'Passkeys'},
        {type: 'doc', id: 'builders/integrations/octant', label: 'Octant'},
        {type: 'doc', id: 'builders/integrations/gardens', label: 'Gardens'},
        {type: 'doc', id: 'builders/integrations/hypercerts', label: 'Hypercerts'},
        {type: 'doc', id: 'builders/integrations/karma', label: 'Karma GAP'},
        {type: 'doc', id: 'builders/integrations/ens', label: 'ENS'},
        {type: 'doc', id: 'builders/integrations/cookie-jar', label: 'Cookie Jar'},
      ],
    },
    {
      type: 'category',
      label: 'Agentic Development',
      link: {type: 'generated-index', description: 'Agent tools and task-to-skill routing.'},
      items: [
        {type: 'doc', id: 'builders/agentic/skills', label: 'Skills'},
        {type: 'doc', id: 'builders/agentic/task-routing', label: 'Task Routing'},
        {type: 'doc', id: 'builders/agentic/mcp-guide', label: 'MCP Guide'},
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      link: {type: 'generated-index', description: 'How and when to use the repository test tools.'},
      items: [
        {type: 'doc', id: 'builders/testing/forge', label: 'Forge'},
        {type: 'doc', id: 'builders/testing/playwright', label: 'Playwright'},
        {type: 'doc', id: 'builders/testing/vitest', label: 'Vitest'},
        {type: 'doc', id: 'builders/testing/storybook', label: 'Storybook'},
      ],
    },
    {
      type: 'category',
      label: 'Quality Assurance',
      link: {type: 'generated-index', description: 'How we QA the product experience, and the test-case catalog.'},
      items: [
        {type: 'doc', id: 'builders/quality/product-experience-qa', label: 'Product Experience QA'},
        {type: 'doc', id: 'builders/quality/test-cases', label: 'Test Cases'},
      ],
    },
    {
      type: 'category',
      label: 'Build, CI, and Deployments',
      link: {type: 'generated-index', description: 'CI workflows, checked-in deployment state, and release navigation.'},
      items: [
        {type: 'doc', id: 'builders/deployments/gh-actions', label: 'GitHub Actions'},
        {type: 'doc', id: 'builders/deployments/status', label: 'Deployment Status'},
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        {type: 'doc', id: 'builders/reference/persona-surfaces', label: 'Persona Surfaces'},
      ],
    },
  ],
};

export default sidebars;
