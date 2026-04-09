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
    // ── Gardener Guide ──
    {
      type: 'category',
      label: 'Gardener Guide',
      link: {
        type: 'generated-index',
        description:
          'Gardeners document real-world conservation and regenerative work using the Green Goods app. Start with joining a garden, then move through submitting work, tracking status, payouts, governance, and reputation-building without guessing what comes next.',
      },
      items: [
        {type: 'doc', id: 'community/gardener-guide/joining-a-garden', label: 'Joining A Garden'},
        {type: 'doc', id: 'community/gardener-guide/uploading-your-work', label: 'Uploading Your Work'},
        {type: 'doc', id: 'community/gardener-guide/track-status-and-attestations', label: 'Track Status & Attestations'},
        {type: 'doc', id: 'community/gardener-guide/garden-payouts', label: 'Garden Payouts'},
        {type: 'doc', id: 'community/gardener-guide/voting-governance', label: 'Voting & Governance'},
        {type: 'doc', id: 'community/gardener-guide/earning-badges', label: 'Earning Badges & Rewards'},
        {type: 'doc', id: 'community/gardener-guide/common-errors', label: 'Common Errors'},
      ],
    },

    // ── Operator Guide ──
    {
      type: 'category',
      label: 'Operator Guide',
      link: {
        type: 'generated-index',
        description:
          "Operators run the day-to-day garden workflow: garden setup, action readiness, work review, assessments, Hypercert creation, treasury operations, and governance. Where a flow also needs deployer access, the guide now calls that out directly.",
      },
      items: [
        {type: 'doc', id: 'community/operator-guide/creating-a-garden', label: 'Creating A Garden'},
        {type: 'doc', id: 'community/operator-guide/managing-actions', label: 'Managing Actions'},
        {type: 'doc', id: 'community/operator-guide/reviewing-work', label: 'Reviewing Work'},
        {type: 'doc', id: 'community/operator-guide/making-an-assessment', label: 'Making An Assessment'},
        {type: 'doc', id: 'community/operator-guide/creating-impact-certificates', label: 'Creating Impact Certificates'},
        {type: 'doc', id: 'community/operator-guide/managing-endowments', label: 'Managing Endowments'},
        {type: 'doc', id: 'community/operator-guide/managing-payouts', label: 'Managing Payouts'},
        {type: 'doc', id: 'community/operator-guide/managing-governance', label: 'Managing Governance'},
        {type: 'doc', id: 'community/operator-guide/reporting-and-gap', label: 'Reporting & GAP'},
        {type: 'doc', id: 'community/operator-guide/troubleshooting', label: 'Troubleshooting'},
        {type: 'doc', id: 'community/operator-guide/managing-certificates', label: 'Managing Certificates & Work'},
        {type: 'doc', id: 'community/operator-guide/earning-recognition', label: 'Earning Recognition'},
      ],
    },

    // ── Funder Guide ──
    {
      type: 'category',
      label: 'Funder Guide',
      link: {
        type: 'generated-index',
        description:
          'Funders support gardens through treasury deposits and, where available, Hypercert-backed impact opportunities. These guides focus on the clearest current flow first, then explain the more advanced certificate path without overpromising.',
      },
      items: [
        {type: 'doc', id: 'community/funder-guide/getting-started', label: 'Getting Started'},
        {type: 'doc', id: 'community/funder-guide/funding-a-garden', label: 'Funding A Garden'},
        {type: 'doc', id: 'community/funder-guide/vaults-and-hypercerts', label: 'Vaults & Hypercerts'},
        {type: 'doc', id: 'community/funder-guide/earning-recognition', label: 'Earning Recognition'},
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
          'Product specifications and strategy tools for Green Goods.',
      },
      items: [
        {type: 'doc', id: 'builders/specs/v0-1', label: 'v0.1 — Privy, EAS, Pimlico, Tokenbound'},
        {type: 'doc', id: 'builders/specs/v0-4', label: 'v0.4 — Passkey, EAS, Pimlico, Tokenbound, Karma'},
        {type: 'doc', id: 'builders/specs/v1-0', label: 'v1.0 — Hypercerts, Octant, Gardens, Cookie Jar'},
        {type: 'doc', id: 'builders/specs/revenue-explorer', label: 'Protocol Revenue Explorer'},
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
