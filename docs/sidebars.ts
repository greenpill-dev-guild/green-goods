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
    // Current guide focus: join + submit. Other pages remain in the repo for
    // reference and can return to the sidebar after this week's user-guide pass.
    {
      type: 'category',
      label: 'Gardener Guide',
      link: {
        type: 'doc',
        id: 'community/gardener-guide/index',
      },
      items: [
        {type: 'doc', id: 'community/gardener-guide/joining-a-garden', label: 'Join a Garden'},
        {type: 'doc', id: 'community/gardener-guide/uploading-your-work', label: 'Submit Work'},
      ],
    },

    // ── Operator Guide ──
    // Current guide focus: create/assess/approve/certify. Other operator pages stay in
    // the repo and can be re-surfaced after this week's user-guide pass.
    {
      type: 'category',
      label: 'Operator Guide',
      link: {
        type: 'doc',
        id: 'community/operator-guide/index',
      },
      items: [
        {type: 'doc', id: 'community/operator-guide/creating-a-garden', label: 'Create a Garden'},
        {type: 'doc', id: 'community/operator-guide/making-an-assessment', label: 'Make an Assessment'},
        {type: 'doc', id: 'community/operator-guide/reviewing-work', label: 'Review and Approve Work'},
        {type: 'doc', id: 'community/operator-guide/creating-impact-certificates', label: 'Mint Impact Certificate'},
      ],
    },

    // ── Funder Guide ──
    // Current guide focus: donate + endow + remove. Other funder pages stay in the repo.
    {
      type: 'category',
      label: 'Funder Guide',
      link: {
        type: 'doc',
        id: 'community/funder-guide/index',
      },
      items: [
        {type: 'doc', id: 'community/funder-guide/donating-to-a-garden', label: 'Donate to a Garden'},
        {type: 'doc', id: 'community/funder-guide/funding-a-garden', label: 'Endow a Garden'},
        {type: 'doc', id: 'community/funder-guide/withdraw-from-a-vault', label: 'Remove an Endowment'},
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

    // ── User Journeys (canonical cross-package choreography) ──
    {
      type: 'category',
      label: 'User Journeys',
      link: {
        type: 'generated-index',
        description:
          'Canonical user journeys + persona-surface map. Cross-package choreography for the five canonical Green Goods personas.',
      },
      items: [
        {type: 'doc', id: 'builders/journeys/onboarding', label: 'Onboarding'},
        {type: 'doc', id: 'builders/journeys/work-submission', label: 'Work Submission'},
        {type: 'doc', id: 'builders/journeys/evaluation', label: 'Evaluation'},
        {type: 'doc', id: 'builders/journeys/funding', label: 'Funding'},
        {type: 'doc', id: 'builders/journeys/harvest', label: 'Harvest'},
        {type: 'doc', id: 'builders/journeys/persona-surfaces', label: 'Persona Surfaces'},
      ],
    },

    // ── Packages (6 items) ──
    {
      type: 'category',
      label: 'Packages',
      link: {
        type: 'generated-index',
        description:
          'The 6 packages that make up the Green Goods monorepo.',
      },
      items: [
        {type: 'doc', id: 'builders/packages/contracts', label: 'Contracts'},
        {type: 'doc', id: 'builders/packages/indexer', label: 'Indexer'},
        {type: 'doc', id: 'builders/packages/agent', label: 'Agent'},
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

    // ── Integrations ──
    {
      type: 'category',
      label: 'Integrations',
      link: {
        type: 'generated-index',
        description:
          'External protocols and services integrated into Green Goods.',
      },
      items: [
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
        {type: 'doc', id: 'builders/agentic/friction-engineering', label: 'Friction Engineering'},
        {type: 'doc', id: 'builders/agentic/prompting-green-goods', label: 'Prompting Green Goods'},
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
        {type: 'doc', id: 'builders/quality/artifact-freshness', label: 'Artifact Freshness'},
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
        {type: 'doc', id: 'builders/deployments/releasing', label: 'Releasing'},
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
    {
      type: 'doc',
      id: 'reference/proposals/octant-green-goods-proposal-pack-2026-04-01',
      label: 'Octant Proposal Pack',
    },
    {
      type: 'doc',
      id: 'reference/proposals/urban-greening-comment-package-2026-04-03',
      label: 'Urban Greening Comment Pack',
    },
    {type: 'doc', id: 'reference/credits', label: 'Credits & Licenses'},
  ],
};

export default sidebars;
