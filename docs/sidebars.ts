import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// A page's own `sidebar_label` wins over the label given here, so each label below repeats the
// page's. Change the page (or, for a generated page, its renderer) to rename an entry.
const sidebars: SidebarsConfig = {
  communitySidebar: [
    {type: 'doc', id: 'community/welcome', label: 'Welcome to Green Goods'},
    {type: 'doc', id: 'community/how-it-works', label: 'How It Works'},
    {type: 'doc', id: 'community/why-we-build', label: 'Why We Build'},
    {
      type: 'category',
      label: 'Gardener',
      link: {type: 'doc', id: 'community/gardener-guide/index'},
      items: [
        {type: 'doc', id: 'community/gardener-guide/installing-and-updating', label: 'Install and Update'},
        {type: 'doc', id: 'community/gardener-guide/joining-a-garden', label: 'Join a Garden'},
        {type: 'doc', id: 'community/gardener-guide/uploading-your-work', label: 'Submit Work'},
        {type: 'doc', id: 'community/gardener-guide/track-status-and-attestations', label: 'Track Your Work'},
        {type: 'doc', id: 'community/gardener-guide/commitments', label: 'Make a Promise'},
        {type: 'doc', id: 'community/gardener-guide/keep-a-promise', label: 'Keep a Promise'},
        {type: 'doc', id: 'community/gardener-guide/confirm-a-promise', label: 'Confirm a Promise'},
        {type: 'doc', id: 'community/gardener-guide/recovery-and-sync', label: 'Recover Unsent Work'},
      ],
    },
    {
      type: 'category',
      label: 'Steward',
      link: {type: 'doc', id: 'community/steward-guide/index'},
      items: [
        {type: 'doc', id: 'community/steward-guide/managing-members', label: 'Manage Members'},
        // Stewards write assessments too, and an assessment comes before the work it frames.
        // The page lives in the Evaluator guide; this entry links to it.
        {type: 'ref', id: 'community/evaluator-guide/making-an-assessment', label: 'Make an Initial Assessment'},
        {type: 'doc', id: 'community/steward-guide/reviewing-work', label: 'Review Work'},
        {type: 'doc', id: 'community/steward-guide/commitment-pooling', label: 'Open a Pool'},
        {type: 'doc', id: 'community/steward-guide/seed-promises', label: 'Seed Promises'},
        {type: 'doc', id: 'community/steward-guide/review-promises', label: 'Review Promises'},
        {type: 'doc', id: 'community/steward-guide/end-a-season', label: 'End a Season'},
        {type: 'doc', id: 'community/steward-guide/creating-impact-certificates', label: 'Mint Impact Certificate'},
        {type: 'doc', id: 'community/steward-guide/funding-and-governance', label: 'Manage Garden Funding'},
      ],
    },
    {
      type: 'category',
      label: 'Evaluator',
      link: {type: 'doc', id: 'community/evaluator-guide/index'},
      items: [
        {type: 'doc', id: 'community/evaluator-guide/making-an-assessment', label: 'Make an Initial Assessment'},
      ],
    },
    {
      type: 'category',
      label: 'Funder',
      link: {type: 'doc', id: 'community/funder-guide/index'},
      items: [
        {type: 'doc', id: 'community/funder-guide/donating-to-a-garden', label: 'Donate to a Garden'},
        {type: 'doc', id: 'community/funder-guide/funding-a-garden', label: 'Endow a Garden'},
        {type: 'doc', id: 'community/funder-guide/withdraw-from-a-vault', label: 'Remove an Endowment'},
      ],
    },
    {type: 'doc', id: 'reference/faq', label: 'FAQ'},
    {type: 'doc', id: 'reference/glossary.generated', label: 'Glossary'},
    {
      type: 'category',
      label: 'Brand',
      collapsed: false,
      items: [
        {type: 'doc', id: 'reference/brand-voice', label: 'Voice'},
        {type: 'doc', id: 'reference/brand', label: 'Kit'},
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
        {type: 'doc', id: 'builders/architecture/personas', label: 'Personas and Surfaces'},
        {type: 'doc', id: 'builders/architecture/anatomy', label: 'Anatomy of a Work Submission'},
        {type: 'doc', id: 'builders/architecture/data-model', label: 'Data Model & Ontology'},
        {type: 'doc', id: 'builders/architecture/entity-matrix', label: 'Entity Matrix'},
        {type: 'doc', id: 'builders/architecture/design', label: 'Design'},
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      link: {type: 'doc', id: 'builders/packages/index'},
      items: [
        {type: 'doc', id: 'builders/packages/contracts', label: 'Contracts'},
        {type: 'doc', id: 'builders/packages/indexer', label: 'Indexer'},
        {type: 'doc', id: 'builders/packages/shared', label: 'Shared'},
        {type: 'doc', id: 'builders/packages/agent', label: 'Agent'},
        {type: 'doc', id: 'builders/packages/qa', label: 'QA'},
        {type: 'doc', id: 'builders/packages/admin', label: 'Admin'},
        {type: 'doc', id: 'builders/packages/client', label: 'Client'},
        {type: 'doc', id: 'builders/packages/api-index', label: 'API Index'},
        {type: 'doc', id: 'builders/packages/commands', label: 'Command inventory'},
        {type: 'doc', id: 'builders/packages/contract-operations', label: 'Contract operations'},
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
        {type: 'doc', id: 'builders/integrations/unlock', label: 'Unlock Protocol'},
      ],
    },
    {
      type: 'category',
      label: 'Agentic Development',
      link: {type: 'doc', id: 'builders/agentic/index'},
      items: [
        {type: 'doc', id: 'builders/agentic/skills', label: 'Skills'},
        {type: 'doc', id: 'builders/agentic/task-routing', label: 'Task Routing'},
        {type: 'doc', id: 'builders/agentic/mcp-guide', label: 'MCP Guide'},
      ],
    },
    {
      type: 'category',
      label: 'Testing & QA',
      link: {type: 'doc', id: 'builders/testing/index'},
      items: [
        {type: 'doc', id: 'builders/quality/product-experience-qa', label: 'Product QA'},
        {type: 'doc', id: 'builders/quality/automated-qa', label: 'Automated QA'},
        {type: 'doc', id: 'builders/quality/test-cases', label: 'Test Cases'},
        {type: 'doc', id: 'builders/quality/gh-actions', label: 'CI & GitHub Actions'},
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        {type: 'doc', id: 'community/steward-guide/creating-a-garden', label: 'Create a Garden'},
        {type: 'doc', id: 'community/steward-guide/managing-actions', label: 'Manage Actions'},
        {type: 'doc', id: 'builders/reference/deployments', label: 'Deployments & Addresses'},
        {type: 'doc', id: 'builders/reference/economics-explorer', label: 'Economics Explorer'},
        {type: 'doc', id: 'reference/ontology.generated', label: 'Ontology'},
        {type: 'doc', id: 'builders/reference/license', label: 'License'},
      ],
    },
  ],
};

export default sidebars;
