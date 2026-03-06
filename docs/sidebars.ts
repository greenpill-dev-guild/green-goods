import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Green Goods Documentation Sidebars
 *
 * Architecture:
 * - Two audience-based sidebars: Community (all users) and Builders (developers)
 * - Existing docs are referenced by their original IDs (no file moves needed)
 * - New pages live in community/ and builders/ directories
 * - Home page (community/welcome) serves as the root `/` page
 *
 * Sidebar counts:
 * - Gardener Guide: 5 items
 * - Operator Guide: 9 items
 * - Evaluator Guide: 5 items
 * - Community Member Guide: 2 items
 * - Funder Guide: 2 items
 */
const sidebars: SidebarsConfig = {
  communitySidebar: [
    {
      type: 'doc',
      id: 'community/welcome',
      label: 'Welcome to Green Goods',
    },
    {
      type: 'doc',
      id: 'community/how-it-works',
      label: 'How It Works',
    },
    {
      type: 'doc',
      id: 'community/why-we-build',
      label: 'Why We Build',
    },
    {
      type: 'doc',
      id: 'community/where-were-headed',
      label: 'Where We\'re Headed',
    },
    {
      type: 'category',
      label: 'Gardener Guide',
      items: [
        {type: 'doc', id: 'community/gardener-guide/joining-a-garden', label: 'Joining A Garden'},
        {type: 'doc', id: 'gardener/submit-work-mdr', label: 'Uploading Your Work'},
        {type: 'doc', id: 'community/gardener-guide/garden-payouts', label: 'Garden Payouts'},
        {type: 'doc', id: 'community/gardener-guide/voting-governance', label: 'Voting & Governance'},
        {type: 'doc', id: 'community/gardener-guide/earning-badges', label: 'Earning Badges & Rewards'},
      ],
    },
    {
      type: 'category',
      label: 'Operator Guide',
      items: [
        {type: 'doc', id: 'operator/create-garden', label: 'Creating A Garden'},
        {type: 'doc', id: 'operator/create-assessments', label: 'Making An Assessment'},
        {type: 'doc', id: 'operator/review-work', label: 'Reviewing Work'},
        {type: 'doc', id: 'operator/mint-and-list-hypercerts', label: 'Creating Impact Certificates'},
        {type: 'doc', id: 'community/operator-guide/managing-certificates', label: 'Managing Certificates'},
        {type: 'doc', id: 'operator/vaults-and-treasury', label: 'Managing Endowments'},
        {type: 'doc', id: 'community/operator-guide/managing-payouts', label: 'Managing Payouts'},
        {type: 'doc', id: 'operator/conviction-and-signal-pools', label: 'Managing Governance'},
        {type: 'doc', id: 'community/operator-guide/earning-recognition', label: 'Earning Recognition'},
      ],
    },
    {
      type: 'category',
      label: 'Evaluator Guide',
      items: [
        {type: 'doc', id: 'community/evaluator-guide/joining-a-garden', label: 'Joining A Garden'},
        {type: 'doc', id: 'evaluator/verify-attestation-chains', label: 'Making Assessments'},
        {type: 'doc', id: 'community/evaluator-guide/evaluating-certificates', label: 'Evaluating Impact Certificates'},
        {type: 'doc', id: 'community/evaluator-guide/reporting-analytics', label: 'Reporting & Analytics'},
        {type: 'doc', id: 'community/evaluator-guide/earning-badges', label: 'Earning Badges'},
      ],
    },
    {
      type: 'category',
      label: 'Community Member Guide',
      items: [
        {type: 'doc', id: 'community/community-member-guide/getting-involved', label: 'Getting Involved'},
        {type: 'doc', id: 'community/community-member-guide/conviction-voting', label: 'Conviction Voting'},
      ],
    },
    {
      type: 'category',
      label: 'Funder Guide',
      items: [
        {type: 'doc', id: 'community/funder-guide/getting-started', label: 'Getting Started'},
        {type: 'doc', id: 'community/funder-guide/vaults-and-hypercerts', label: 'Vaults & Hypercerts'},
      ],
    },
    {type: 'doc', id: 'reference/faq', label: 'FAQ'},
    {type: 'doc', id: 'glossary', label: 'Glossary'},
  ],

  buildersSidebar: [
    {
      type: 'doc',
      id: 'developers/getting-started',
      label: 'Getting Started',
    },
    {
      type: 'doc',
      id: 'builders/how-to-contribute',
      label: 'How To Contribute',
    },
    {
      type: 'doc',
      id: 'developers/architecture',
      label: 'Green Goods Architecture',
    },
    {
      type: 'category',
      label: 'Green Goods Packages',
      items: [
        {type: 'doc', id: 'builders/packages/contracts', label: 'Contracts'},
        {type: 'doc', id: 'builders/packages/indexer', label: 'Indexer'},
        {type: 'doc', id: 'builders/packages/agent', label: 'Agent'},
        {type: 'doc', id: 'builders/packages/ops', label: 'Ops'},
        {type: 'doc', id: 'builders/packages/admin', label: 'Admin'},
        {type: 'doc', id: 'builders/packages/client', label: 'Client'},
        {type: 'doc', id: 'builders/packages/shared', label: 'Shared'},
      ],
    },
    {
      type: 'category',
      label: 'Product Specifications',
      items: [
        {type: 'doc', id: 'builders/specs/v0-1', label: 'v0.1'},
        {type: 'doc', id: 'builders/specs/v0-4', label: 'v0.4'},
        {type: 'doc', id: 'builders/specs/v1-0', label: 'v1.0'},
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        {type: 'doc', id: 'developers/integrations', label: 'Overview'},
        {type: 'doc', id: 'builders/integrations/eas', label: 'EAS'},
        {type: 'doc', id: 'builders/integrations/tokenbound', label: 'Tokenbound Accounts'},
        {type: 'doc', id: 'builders/integrations/passkey', label: 'Passkey'},
        {type: 'doc', id: 'builders/integrations/karma', label: 'Karma'},
        {type: 'doc', id: 'builders/integrations/ens', label: 'ENS'},
        {type: 'doc', id: 'builders/integrations/hats', label: 'Hats Protocol'},
        {type: 'doc', id: 'builders/integrations/hypercerts', label: 'Hypercerts'},
        {type: 'doc', id: 'builders/integrations/octant', label: 'Octant Vaults'},
        {type: 'doc', id: 'builders/integrations/gardens', label: 'Gardens Conviction Voting'},
        {type: 'doc', id: 'builders/integrations/cookie-jar', label: 'Cookie Jar'},
        {type: 'doc', id: 'builders/integrations/greenwill', label: 'GreenWill (Coming Soon)'},
        {type: 'doc', id: 'builders/integrations/unlock', label: 'Unlock Protocol (Coming Soon)'},
        {type: 'doc', id: 'builders/integrations/silvi', label: 'Silvi (Coming Soon)'},
      ],
    },
    {
      type: 'category',
      label: 'Agentic Development',
      items: [
        {type: 'doc', id: 'builders/agentic/core-philosophies', label: 'Core Philosophies'},
        {type: 'doc', id: 'builders/agentic/prompt-engineering', label: 'Prompt Engineering'},
        {type: 'doc', id: 'builders/agentic/context-engineering', label: 'Context Engineering'},
        {type: 'doc', id: 'builders/agentic/intent-engineering', label: 'Intent Engineering'},
        {type: 'doc', id: 'builders/agentic/spec-engineering', label: 'Specification Engineering'},
        {
          type: 'category',
          label: 'Agent-Based Tools',
          items: [
            {type: 'doc', id: 'builders/agentic/claude-code', label: 'Claude Code'},
            {type: 'doc', id: 'builders/agentic/codex', label: 'Codex'},
            {type: 'doc', id: 'builders/agentic/openclaw', label: 'OpenClaw'},
            {type: 'doc', id: 'builders/agentic/gemini', label: 'Gemini'},
          ],
        },
        {type: 'doc', id: 'developers/reference/agent-mcp-guide', label: 'MCP Guide'},
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      items: [
        {type: 'doc', id: 'builders/testing/forge', label: 'Forge Contract Testing'},
        {type: 'doc', id: 'builders/testing/playwright', label: 'Playwright E2E'},
        {type: 'doc', id: 'builders/testing/vitest', label: 'Vitest'},
        {type: 'doc', id: 'builders/testing/rtl', label: 'React Testing Library'},
        {type: 'doc', id: 'builders/testing/storybook', label: 'Storybook'},
      ],
    },
    {
      type: 'category',
      label: 'Quality Assurance',
      items: [
        {type: 'doc', id: 'builders/quality/test-cases', label: 'Test Cases'},
        {type: 'doc', id: 'builders/quality/regression', label: 'Regression Testing'},
        {type: 'doc', id: 'builders/quality/agentic-eval', label: 'Agentic Evaluation'},
        {type: 'doc', id: 'builders/quality/husky', label: 'Husky'},
        {type: 'doc', id: 'builders/quality/gh-actions', label: 'GitHub Actions'},
      ],
    },
    {
      type: 'category',
      label: 'Build & Deployments',
      items: [
        {type: 'doc', id: 'builders/deployments/status', label: 'Deployment Status'},
        {type: 'doc', id: 'builders/deployments/contracts-deploy', label: 'Contracts'},
        {type: 'doc', id: 'builders/deployments/indexer-deploy', label: 'Indexer'},
        {type: 'doc', id: 'builders/deployments/client-deploy', label: 'Client PWA'},
        {type: 'doc', id: 'builders/deployments/admin-deploy', label: 'Admin Dashboard'},
        {type: 'doc', id: 'builders/deployments/agent-deploy', label: 'Agent'},
      ],
    },
    {type: 'doc', id: 'reference/changelog', label: 'Changelog'},
    {type: 'doc', id: 'reference/design-research', label: 'Design & Research'},
    {type: 'doc', id: 'reference/credits', label: 'Credits & Licenses'},
    {type: 'doc', id: 'builders/glossary', label: 'Builder Glossary'},
  ],
};

export default sidebars;
