import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Green Goods Documentation Sidebars
 *
 * Two-track audience architecture:
 * - Community: All users (gardeners, operators, evaluators, funders, community members)
 * - Builders: Developers contributing to the Green Goods codebase
 *
 * Community pages live under docs/community/ with role-specific guides.
 * Builder pages live under docs/builders/ with technical docs.
 */
const sidebars: SidebarsConfig = {
  communitySidebar: [
    // ── Pillar Pages (flat narrative scrolls) ──
    {
      type: 'doc',
      id: 'community/welcome',
      label: 'Green Goods',
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
      label: "Where We're Headed",
    },
    // ── Gardener Guide (5 items) ──
    {
      type: 'category',
      label: 'Gardener Guide',
      link: {
        type: 'generated-index',
        description:
          'Gardeners document real-world conservation and regenerative work using the Green Goods mobile app. Follow these guides to join a garden, submit work, earn payouts, and build your on-chain reputation. Learn how the MDR workflow captures evidence and how verified work builds your on-chain reputation.',
      },
      items: [
        {type: 'doc', id: 'community/gardener-guide/joining-a-garden', label: 'Joining A Garden'},
        {type: 'doc', id: 'community/gardener-guide/uploading-your-work', label: 'Uploading Your Work'},
        {type: 'doc', id: 'community/gardener-guide/garden-payouts', label: 'Garden Payouts'},
        {type: 'doc', id: 'community/gardener-guide/voting-governance', label: 'Voting & Governance'},
        {type: 'doc', id: 'community/gardener-guide/earning-badges', label: 'Earning Badges & Rewards'},
      ],
    },

    // ── Operator Guide (9 items) ──
    {
      type: 'category',
      label: 'Operator Guide',
      link: {
        type: 'generated-index',
        description:
          'Operators create and manage gardens — defining conservation actions, reviewing submitted work, minting impact certificates, and overseeing endowments and payouts. From garden setup to Hypercert minting and endowment management, these guides cover the full operator lifecycle.',
      },
      items: [
        {type: 'doc', id: 'community/operator-guide/creating-a-garden', label: 'Creating A Garden'},
        {type: 'doc', id: 'community/operator-guide/making-an-assessment', label: 'Making An Assessment'},
        {type: 'doc', id: 'community/operator-guide/reviewing-work', label: 'Reviewing Work'},
        {type: 'doc', id: 'community/operator-guide/creating-impact-certificates', label: 'Creating Impact Certificates'},
        {type: 'doc', id: 'community/operator-guide/managing-certificates', label: 'Managing Certificates & Work'},
        {type: 'doc', id: 'community/operator-guide/managing-endowments', label: 'Managing Endowments'},
        {type: 'doc', id: 'community/operator-guide/managing-payouts', label: 'Managing Payouts'},
        {type: 'doc', id: 'community/operator-guide/managing-governance', label: 'Managing Governance'},
        {type: 'doc', id: 'community/operator-guide/earning-recognition', label: 'Earning Recognition'},
      ],
    },

    // ── Evaluator Guide (4 items) ──
    {
      type: 'category',
      label: 'Evaluator Guide',
      link: {
        type: 'generated-index',
        description:
          'Evaluators verify conservation work and assess impact certificates. Learn how to join a garden as an evaluator, conduct assessments, and earn recognition for your expertise. Includes querying the indexer, exporting data for analysis, and understanding the attestation chain.',
      },
      items: [
        {type: 'doc', id: 'community/evaluator-guide/joining-a-garden', label: 'Joining A Garden'},
        {type: 'doc', id: 'community/evaluator-guide/making-assessments', label: 'Making Assessments'},
        {type: 'doc', id: 'community/evaluator-guide/evaluating-certificates', label: 'Evaluating Impact Certificates'},
        {type: 'doc', id: 'community/evaluator-guide/earning-badges', label: 'Earning Recognition'},
      ],
    },

    // ── Funder Guide (2 items) ──
    {
      type: 'category',
      label: 'Funder Guide',
      link: {
        type: 'generated-index',
        description:
          'Funders support conservation gardens by depositing into endowment vaults and purchasing impact certificates. Discover how to fund a garden and track your impact. Understand how Octant Vaults generate yield for garden operations and how Hypercert purchases directly fund verified impact.',
      },
      items: [
        {type: 'doc', id: 'community/funder-guide/funding-a-garden', label: 'Funding A Garden'},
        {type: 'doc', id: 'community/funder-guide/earning-recognition', label: 'Earning Recognition'},
      ],
    },

    // ── Community Guide (2 items) ──
    {
      type: 'category',
      label: 'Community Guide',
      link: {
        type: 'generated-index',
        description:
          'Community members participate in garden governance through conviction voting and earn rewards for their engagement. Get started with voting and community participation. Conviction voting lets your support grow over time, prioritizing the work your community values most.',
      },
      items: [
        {type: 'doc', id: 'community/community-member-guide/getting-involved', label: 'Voting In Gardens'},
        {type: 'doc', id: 'community/community-member-guide/conviction-voting', label: 'Earning Rewards'},
      ],
    },

    {type: 'doc', id: 'reference/faq', label: 'FAQ'},
    {type: 'doc', id: 'reference/glossary-community', label: 'Glossary'},
  ],

  buildersSidebar: [
    // ── Top-Level Flat Pages ──
    {
      type: 'doc',
      id: 'builders/getting-started',
      label: 'Getting Started',
    },
    {
      type: 'doc',
      id: 'builders/how-to-contribute',
      label: 'How To Contribute',
    },
    {
      type: 'doc',
      id: 'builders/ethereum-alignment',
      label: 'Ethereum Alignment',
    },

    // ── Architecture (category with index + 4 sub-pages) ──
    {
      type: 'category',
      label: 'Architecture',
      link: {
        type: 'doc',
        id: 'builders/architecture',
      },
      items: [
        {type: 'doc', id: 'builders/architecture/local-vs-global', label: 'Local vs Global Balance'},
        {type: 'doc', id: 'builders/architecture/erd', label: 'Entity Relationship Diagram'},
        {type: 'doc', id: 'builders/architecture/modular-approach', label: 'Modular Approach'},
        {type: 'doc', id: 'builders/architecture/sequence-diagrams', label: 'Sequence Diagrams'},
      ],
    },

    // ── Packages (7 items) ──
    {
      type: 'category',
      label: 'Packages',
      link: {
        type: 'generated-index',
        description:
          'The 7 packages that make up the Green Goods monorepo.',
      },
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

    // ── Product Specifications (3 items) ──
    {
      type: 'category',
      label: 'Product Specifications',
      link: {
        type: 'generated-index',
        description:
          'Product specifications from v0.1 through v1.0.',
      },
      items: [
        {type: 'doc', id: 'builders/specs/v0-1', label: 'v0.1 — Privy, EAS, Pimlico, Tokenbound'},
        {type: 'doc', id: 'builders/specs/v0-4', label: 'v0.4 — Passkey, EAS, Pimlico, Tokenbound, Karma'},
        {type: 'doc', id: 'builders/specs/v1-0', label: 'v1.0 — Hypercerts, Octant, Gardens, Cookie Jar'},
      ],
    },

    // ── Integrations (12 items) ──
    {
      type: 'category',
      label: 'Integrations',
      link: {
        type: 'generated-index',
        description:
          'External protocols and services integrated into Green Goods.',
      },
      items: [
        {type: 'doc', id: 'builders/integrations/entity-matrix', label: 'Entity Matrix'},
        {type: 'doc', id: 'builders/integrations/overview', label: 'Overview'},
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
      ],
    },

    // ── Agentic Development ──
    {
      type: 'category',
      label: 'Agentic Development',
      link: {
        type: 'generated-index',
        description:
          'AI-powered development practices and agent-based tooling.',
      },
      items: [
        {type: 'doc', id: 'builders/agentic/core-philosophies', label: 'Core Philosophies'},
        {type: 'doc', id: 'builders/agentic/prompt-engineering', label: 'Prompt Engineering'},
        {type: 'doc', id: 'builders/agentic/context-engineering', label: 'Context Engineering'},
        {type: 'doc', id: 'builders/agentic/intent-engineering', label: 'Intent Engineering'},
        {type: 'doc', id: 'builders/agentic/spec-engineering', label: 'Specification Engineering'},
        {
          type: 'category',
          label: 'Agent-Based Tools',
          link: {
            type: 'generated-index',
            description:
              'Specific AI coding tools used in the project.',
          },
          items: [
            {type: 'doc', id: 'builders/agentic/claude-code', label: 'Claude Code'},
            {type: 'doc', id: 'builders/agentic/codex', label: 'Codex'},
            {type: 'doc', id: 'builders/agentic/openclaw', label: 'OpenClaw'},
            {type: 'doc', id: 'builders/agentic/gemini', label: 'Gemini'},
          ],
        },
        {type: 'doc', id: 'builders/agentic/mcp-guide', label: 'MCP Guide'},
      ],
    },

    // ── Testing (5 items) ──
    {
      type: 'category',
      label: 'Testing',
      link: {
        type: 'generated-index',
        description:
          'Testing frameworks and strategies across the monorepo.',
      },
      items: [
        {type: 'doc', id: 'builders/testing/forge', label: 'Forge Contract Testing'},
        {type: 'doc', id: 'builders/testing/playwright', label: 'Playwright E2E'},
        {type: 'doc', id: 'builders/testing/vitest', label: 'Vitest'},
        {type: 'doc', id: 'builders/testing/rtl', label: 'React Testing Library'},
        {type: 'doc', id: 'builders/testing/storybook', label: 'Storybook'},
      ],
    },

    // ── Quality Assurance (5 items) ──
    {
      type: 'category',
      label: 'Quality Assurance',
      link: {
        type: 'generated-index',
        description:
          'Quality gates, regression testing, and CI/CD pipelines.',
      },
      items: [
        {type: 'doc', id: 'builders/quality/test-cases', label: 'Test Cases'},
        {type: 'doc', id: 'builders/quality/regression', label: 'Regression Testing'},
        {type: 'doc', id: 'builders/quality/agentic-eval', label: 'Agentic Evaluation'},
        {type: 'doc', id: 'builders/quality/husky', label: 'Husky'},
        {type: 'doc', id: 'builders/quality/gh-actions', label: 'GitHub Actions'},
      ],
    },

    // ── Build & Deployments (6 items) ──
    {
      type: 'category',
      label: 'Build & Deployments',
      link: {
        type: 'generated-index',
        description:
          'Build processes and deployment guides for each package.',
      },
      items: [
        {type: 'doc', id: 'builders/deployments/status', label: 'Deployment Status'},
        {type: 'doc', id: 'builders/deployments/contracts-deploy', label: 'Contracts'},
        {type: 'doc', id: 'builders/deployments/indexer-deploy', label: 'Indexer'},
        {type: 'doc', id: 'builders/deployments/client-deploy', label: 'Client PWA'},
        {type: 'doc', id: 'builders/deployments/admin-deploy', label: 'Admin Dashboard'},
        {type: 'doc', id: 'builders/deployments/agent-deploy', label: 'Agent'},
      ],
    },

    {type: 'doc', id: 'builders/glossary', label: 'Builder Glossary'},
    {type: 'doc', id: 'reference/changelog', label: 'Changelog'},
    {type: 'doc', id: 'reference/design-research', label: 'Design & Research'},
    {type: 'doc', id: 'reference/credits', label: 'Credits & Licenses'},
  ],
};

export default sidebars;
