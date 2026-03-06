# CharmVerse Migration & Docs Platform Research

> Scraped from Greenpill Dev Guild CharmVerse workspace on 2026-02-28
> Research into CRDT + Git collaborative markdown solutions

---

## Part 1: CharmVerse Content Map

### Workspace Structure

```
Greenpill Dev Guild (40,017/100,000 blocks)
├── Home (landing page with links, events, socials)
├── Regen Stack/
│   ├── GreenWill
│   └── Green Goods/                    ← PRIMARY TARGET
│       ├── [PAGE] CIDS MAPPING         ← System architecture + CIDS logic model
│       ├── [PAGE] Garden Operator Survey ← User research questions
│       ├── [PAGE] Gitbook Docs Skeleton ← FULL DOCS OUTLINE (gold!)
│       ├── [DB:14] MRV Tools           ← Landscape of 14 MRV competitors
│       ├── [DB:20] Garden Communities   ← 20 garden communities (LATAM focus)
│       ├── [DB:27] Partnerships & Integrations ← Quarterly roadmap + 27 partners
│       ├── [DB:15] Feature Specs       ← Feature hierarchy + priority matrix
│       ├── [DB:17] Funding Landscape   ← 17 funding sources scored
│       ├── [DB:12] Entity Matrix       ← Cross-protocol entity mapping
│       ├── Public Goods Resources
│       └── Squad Staking
├── Community
├── Growth
├── Product/
│   ├── Research
│   ├── QA (Quality Analysis)
│   ├── PRDs                            ← 2 active PRDs with SDG mapping
│   └── Hackathons
├── Engineering/
│   ├── [PAGE] Tech Stack               ← Full stack documentation
│   ├── [PAGE] Design Patterns
│   ├── [DB] Bounties
│   └── [DB] Specifications
├── Capital/
│   ├── Tools & Subscriptions
│   ├── Working Capital / Payouts
│   ├── Fundraising Projects
│   ├── Q4 2024 / Q1-Q3 2025
│   ├── Wallets / Treasury / Multisigs
└── Leads
```

---

## Part 2: Key Content Extracted

### 2.1 Gitbook Docs Skeleton (MOST IMPORTANT)

The planned documentation structure for docs.greengoods.app:

```
Welcome to Green Goods
├── Introduction & Quick Start
├── What you can do with Green Goods (high-level use cases)
├── Who is Green Goods for?
│   ├── Gardeners
│   ├── Garden Operators
│   ├── Impact Evaluators
│   └── Developers
├── Why Green Goods
│   ├── Capturing impact is tedious → Simple 3 step flow
│   ├── Grassroots work isn't valued → Onchain attestation + tokenization
│   └── Bioregions have many interests → Hyper localized hubs
│
Core Concepts
├── Roles & Responsibilities
│   ├── Gardener / Garden Operator / Impact Evaluator
├── Gardens, Assessments, Actions & Work
│   ├── What is a Garden?
│   ├── Making Assessments / Taking Action
│   ├── Work Submissions & Approvals
│   └── MDR Workflow (Media → Details → Review)
├── Ethereum Attestations
│   ├── What is an attestation?
│   ├── How approvals become on-chain records
│   └── Why verifiability matters
├── Impact Certificates (In Development)
│   └── Aggregating impact into Hypercerts
├── Local Endowments (In Development)
│   └── Funding Gardens with DeFi Yield (Octant)
├── Glossary
│
Product Features
├── Product Overview / Vision & Goals
├── Core Features
│   ├── Frictionless onboarding (passkey, AA)
│   ├── PWA experience (mobile-first)
│   ├── Work logging with MDR
│   ├── Automated Impact Reporting on Karma
│   ├── On-chain verification & rewards
│   ├── Localization & language support
│   └── Offline-first
├── System Architecture (Non-technical)
│   └── High-level diagram
│
How To Guides
├── For Gardeners
│   ├── Gardener Quickstart (signup, join garden, first task)
│   ├── Logging Work (capture media, fill details, review & submit)
│   ├── Tracking Your Contributions (history, statuses, feedback)
│   └── Best Practices
├── For Garden Operators
│   ├── Operator Quickstart
│   ├── Managing Gardens (create, edit, multiple gardens)
│   ├── Creating & Managing Actions
│   ├── Reviewing & Approving Work
│   └── Reporting & Impact (history, exports, Hypercerts)
├── For Impact Evaluators
│   ├── Evaluator Quickstart
│   ├── Exploring Gardens & Work
│   ├── Using Attestation & Hypercerts Data
│   └── Integrating with External Frameworks
│
Developer Documentation
├── Getting Started
│   ├── Overview for Builders (monorepo, tech stack)
│   ├── Installation & Environment Setup
│   ├── How to Contribute
│   └── Roadmap & Open Issues
├── Architecture & Packages
│   ├── Monorepo Structure
│   ├── Client (PWA) - React, routing, state
│   ├── Admin - React, routing, state
│   ├── Indexer - on-chain, GraphQL
│   └── Contracts - attestation, tokenbound, Karma GAP, Hypercerts
├── Testing & QA
│   ├── Testing Overview (Vitest, Playwright, Foundry)
│   ├── Running Tests / Adding New Tests
│   └── QA Process
├── API & Integration Reference
│   ├── API Reference / Contract Reference
│   └── Example Integrations
│
Reference & Meta
├── FAQ (general, role-specific, technical)
├── Changelog / Release Notes
├── Design & Research
└── Credits & Licenses
```

### 2.2 CIDS MAPPING (System Architecture)

**Greengoods CIDS System** - Garden-centered architecture:

- **User** → Identity Layer (Passkey-native Auth) → Account Abstraction Wallets
- **Log Action** → PWA / Mobile Client → ENS Subnames
- **Integrations**: Green Line Telegram Bot
- **Sends data for Work Approval** → Garden Management Dashboard
- **Attest to** → EAS → Karma GAP updates

**CIDS Chain (Logic Model) per Action:**
1. Activity → What do we do?
2. Output → What is created immediately?
3. Outcome → What changes in the short term?
4. Impact → What long-term transformation occurs?

**Next Steps:** Map correlations between action outputs and outcomes, aggregate same action outcomes.

### 2.3 Entity Matrix (Cross-Protocol Rosetta Stone)

| Green Goods | Karma GAP | Hypercerts | Octant | Gardens |
|---|---|---|---|---|
| Garden | Project | Hypercert Holder | Vault Owner | Community |
| Assessment | Project Milestone | Hypercert Data | | |
| Action | Partial Project Update | Hypercert Data | | |
| Work | Partial Project Update | Hypercert Data | | |
| Work Approval | Partial Project Update | Hypercert Data | | |
| Garden Operator | Project Owner | Creator | Vault Admin, TAM Operator | Council Member |
| Gardener | Project Member | Creator | TAM Proposer | Community Member |
| Community Member | Project Explorer | Evaluator | TAM Voter | Community Member |
| Funder/Evaluator | Grant Evaluator | Funder | Vault Depositor | Community Funder |
| Data Scientist | Grant Evaluator | Evaluator | — | Community Eval |

Additional protocol columns: Hats Protocol, Silvi, Cookie Jar, Unlock, ENS, Lido, FTC

### 2.4 Partnerships & Integrations Roadmap

**Q4 2025 (Complete):**
- Karma GAP ✅ — Impact Reporting, Capital Allocation
- Pimlico ✅ — Identity
- EAS ✅ — Identity, Reputation

**Q1 2026 (In Progress):**
- Hypercerts 🚧 — Impact Measurement, Capital Allocation, Capital Formation
- Octant Vaults 🚧 — Capital Allocation, Capital Formation
- Hats Protocol — Identity, Reputation
- Unlock Protocol 🚧 — Reputation
- GreenWill — Reputation, Governance
- Gardens — Governance, Capital Allocation

**Q2 2026:**
- Cookie Jar — Governance, Capital Allocation
- Locale Network — Impact Reporting
- Silvi 🚧 — Impact Reporting, Impact Measurement
- ENS 🚧 — Identity
- Trust Graph — Reputation, Governance

**Q3 2026:**
- Sarafu Network
- Eco-certs — Impact Measurement, Capital Allocation
- Flow State — Governance, Capital Allocation
- Juicebox — Capital Formation

### 2.5 Feature Specs Hierarchy

**Admin Dashboard:** Notifications, Profile, Dashboard (Your Gardens, Work Completed, Impact Generated), Gardens (Filter → Garden → Assessments/Work/Impact), Actions (Filter → Action), Contracts, Deployment

**Client App features** (by grant source):
- Core (Arb in ReFi): Home, Garden, Notifications, Work, Insights, Details, Assessments, Impact, Gardeners, Media, Review, Profile, Account, Help
- Governance (Arb New Ideas): Governance, Garden Pools/Voting, Funding, Vaults/Endowment, Hypercerts/Assets, Impact
- Identity (Unlock Celo): Hats/Roles, Trust Graph/Reputation, Badges, GreenWill
- Payments (VeBetter Rewards): Cookie Jar/Payouts, Wallet, Send
- Revenue (Octant Epoch 10): Revnet & Streams
- Community (Celo/Grassroots): Commitment Pools/Vouchers

### 2.6 Tech Stack

| Layer | Core Libraries |
|---|---|
| UI | React, Storybook, TailwindCSS, React Spring, TypeScript |
| State | React Hooks, React Context, React Query, XState, Zustand |
| API | GraphQL, Envio (blockchain indexer) |
| Contracts | OpenZeppelin, EAS, Tokenbound (ERC-6551), Solidity, Foundry |
| Database | Supabase, PostgreSQL |
| Testing/CI | Biome, OxLint, Vitest, Playwright, Husky, GitHub Actions, Vercel |

### 2.7 Garden Communities (20 entries)

Greenpill Dominican Republic, Agroforest DAO, Barichara Regeneration Fund, Diamante Baru Bioregional Co., GainForest, Greenpill Kenya, Greenpill London Ontario, Greenpill New York City, Greenpill Nigeria, Greenpill Ottawa, and ~10 more. Primarily LATAM-based.

### 2.8 MRV Tools Landscape (14 entries)

Impact Miner, Silvi, Planta, iNaturalist, KOKO DAO, Treegens, GainForest, AI For Trees, Treejer Protocol, Endangered Tokens, and 4 more. Columns: Version, Tech Stack, Features, Impact Measurement, Distribution (mostly unfilled).

### 2.9 Funding Landscape (17 sources, scored)

Top scoring: PG Tooling (9/3/3), Greenpill Network (9/1/2), Arbitrum (8/7/5), Vrbs (7/3/3), Celo PG (7/5/4), VeChain (6/7/4), Optimism (6/6/-)

### 2.10 Garden Operator Survey Questions

Name, Description, Type of gardening, Needs, Tools used, Web3 tools, Assessments performed, Pilot duration, Garden size, Workflow, Team size, Interest in ecological credits, Daily activity registration method.

---

## Part 3: CRDT + Git Collaborative Docs Research

### The Problem

CharmVerse provides a nice collaborative editing UX (like Notion/Google Docs) but:
- Data is locked in their platform (no Git history, no ownership)
- API key appears expired/invalid (401 on all endpoints)
- 40K/100K block usage — growing
- No versioning, branching, or PR-based review workflows
- Can't integrate with CI/CD or code review

**Goal:** Find a solution that combines:
1. **Git as source of truth** (markdown files in GitHub repo)
2. **CRDT-based real-time collaboration** (Google Docs-like UX)
3. **Good visual editor** (non-devs can contribute)
4. **Open/self-hostable** (data ownership)

### Option Analysis

#### A. GitBook (with GitHub Sync) — RECOMMENDED FOR QUICK WIN

- **Bidirectional GitHub sync** — edits in GitBook auto-commit to GitHub, GitHub commits auto-update GitBook
- WYSIWYG block editor + Markdown support
- Free for open-source projects
- Great for mixed teams (devs commit via GitHub, non-devs edit in GitBook)
- Already referenced in CharmVerse ("Gitbook Docs Skeleton" page exists!)
- Custom domains (docs.greengoods.app)

**Limitations:** Not self-hosted, proprietary editor, limited customization

#### B. Mintlify — BEST DEVELOPER DOCS

- MDX-based (Markdown + React components)
- Git-native: all content lives in a GitHub repo
- Beautiful default theme, API reference auto-generation
- CLI for local preview (`mintlify dev`)
- Custom domains supported
- Reduces manual API docs work by ~60%

**Limitations:** Paid for teams, less CRDT-like collaboration (PR-based)

#### C. Docusaurus + HackMD — BEST OPEN SOURCE COMBO

- **Docusaurus** (Meta, open source): Static site generator from Markdown, fully customizable, self-hosted
- **HackMD**: CRDT-based real-time Markdown editor with GitHub sync
  - HackMD Hub app syncs notes to GitHub repos
  - VS Code extension for local editing
  - Future: Automerge CRDT for local-first support
- Workflow: Edit in HackMD (collaborative) → push to GitHub → Docusaurus builds/deploys

**Limitations:** Two separate tools, more setup/maintenance

#### D. Wiki.js — BEST SELF-HOSTED ALL-IN-ONE

- Open source wiki with built-in Git sync
- Saves all content as .md files synced to remote Git repository
- WYSIWYG + Markdown + raw HTML editors
- Built-in authentication, search, permissions
- PostgreSQL backend

**Limitations:** Wiki-style, less "docs site" polish than GitBook/Mintlify

#### E. Yjs + TipTap + Custom Build — BEST FOR FULL CONTROL

- **Yjs** CRDT library: network-agnostic, offline-first, shared cursors
- **TipTap** rich text editor (used by Notion, CharmVerse itself)
- Git sync via custom middleware (save CRDT state → serialize to Markdown → commit)
- Used by Frappe Drive (production-grade example)

**Limitations:** Significant engineering effort, maintenance burden

#### F. Obsidian + Relay + Git Plugin — BEST FOR NOTE-TAKING TEAMS

- **Obsidian**: Local-first Markdown editor, excellent UX
- **Relay plugin**: CRDT-based real-time collaboration (Yjs)
- **Git plugin**: Auto-commit/push to GitHub
- Markdown files are the source of truth on disk

**Limitations:** Desktop app only, each user needs Obsidian setup, not a "docs site"

### Recommendation Matrix

| Criteria | GitBook | Mintlify | Docusaurus+HackMD | Wiki.js | Custom Yjs |
|---|---|---|---|---|---|
| Git as source of truth | ✅ bidirectional | ✅ native | ✅ via HackMD | ✅ built-in | ✅ custom |
| Real-time collab (CRDT) | ✅ built-in | ❌ PR-based | ✅ HackMD | ❌ | ✅ Yjs |
| Non-dev friendly | ✅ excellent | ⚠️ okay | ⚠️ HackMD only | ✅ good | ❌ needs building |
| Self-hostable | ❌ | ❌ | ✅ Docusaurus | ✅ | ✅ |
| Setup effort | Low | Low | Medium | Medium | Very High |
| Custom domain | ✅ | ✅ | ✅ | ✅ | ✅ |
| Free for OSS | ✅ | ❌ | ✅ | ✅ | ✅ |
| API docs | ⚠️ basic | ✅ excellent | ⚠️ plugin | ❌ | ❌ |

### Top Recommendation: GitBook → Mintlify Migration Path

**Phase 1 (Now):** GitBook with GitHub Sync
- Already planned (Gitbook Docs Skeleton exists in CharmVerse)
- Fastest time to docs.greengoods.app
- Bidirectional sync means GitHub is source of truth from day 1
- Non-devs can edit, devs can PR
- Free for open-source

**Phase 2 (When needed):** Evaluate Mintlify
- Better API reference generation
- Better developer-facing docs
- Since content is already in GitHub as Markdown, migration is trivial
- Switch the renderer, keep the content

**Phase 3 (Stretch):** Docusaurus for full control
- If GitBook/Mintlify constraints become blocking
- Full React customization
- Self-hosted, zero vendor lock-in
- All content already in GitHub from Phase 1

### The CRDT + Git "Holy Grail" Pattern

The emerging pattern in 2025-2026 for combining CRDT and Git:

```
┌─────────────────────────────────────────┐
│           Collaborative Editor           │
│   (GitBook / HackMD / TipTap+Yjs)      │
│   CRDT for real-time conflict-free      │
│   editing between multiple cursors       │
└──────────────┬──────────────────────────┘
               │ serialize to Markdown
               ▼
┌─────────────────────────────────────────┐
│           Git Repository (GitHub)        │
│   Markdown files = source of truth      │
│   PRs for review, CI for validation     │
│   Version history, blame, branching     │
└──────────────┬──────────────────────────┘
               │ build & deploy
               ▼
┌─────────────────────────────────────────┐
│           Static Site / Docs Portal      │
│   (GitBook hosted / Docusaurus / etc)   │
│   docs.greengoods.app                   │
└─────────────────────────────────────────┘
```

Key insight: **CRDT handles the "collaboration" layer (real-time multi-user editing), Git handles the "persistence" layer (history, review, deployment)**. They're complementary, not competing. GitBook already implements this pattern internally.

---

## Part 4: Migration Plan

### Content to Migrate from CharmVerse → docs.greengoods.app

| CharmVerse Page | Docs Section | Priority |
|---|---|---|
| Gitbook Docs Skeleton | **Site structure** (use as-is) | P0 |
| CIDS MAPPING | Core Concepts → System Architecture | P1 |
| Entity Matrix | Reference → Protocol Mapping | P1 |
| Tech Stack | Developer Docs → Tech Stack | P1 |
| Feature Specs | Product Features (hierarchy) | P1 |
| Partnerships & Integrations | Reference → Integrations Roadmap | P2 |
| Garden Communities | Community → Active Gardens | P2 |
| Garden Operator Survey | Research → User Research | P3 |
| MRV Tools | Research → MRV Landscape | P3 |
| Funding Landscape | Internal (don't publish) | P3 |

### Content NOT in CharmVerse (needs writing)

These sections from the Gitbook Docs Skeleton have no corresponding CharmVerse content:
- How-To Guides (Gardener, Operator, Evaluator quickstarts)
- Installation & Environment Setup (partially in CLAUDE.md)
- API & Contract Reference
- FAQ
- Changelog / Release Notes

### Migration Steps

1. **Create GitHub repo or directory** for docs (e.g., `docs/` in monorepo or separate `docs.greengoods.app` repo)
2. **Set up GitBook** with GitHub Sync pointing to the docs directory
3. **Convert CharmVerse content** to Markdown files following the skeleton structure
4. **Connect custom domain** docs.greengoods.app
5. **Populate developer docs** from existing CLAUDE.md + codebase context
6. **Write how-to guides** based on actual app workflows
7. **Archive CharmVerse** pages that have been migrated (add redirect notes)

---

## Part 5: API Key Issue

The CharmVerse API key `a7d9294b78576e46406edb2c213b9bceda5384ab` returns 401 on all endpoints:
- `GET /spaces/search` → 401
- `GET /pages/{id}` → 401
- `GET /proposals` → 401
- `GET /rewards` → 401

Per API docs, keys must be requested via their Discord server. The key may be:
- Expired
- A partner key missing required `?spaceId=` parameter
- Revoked

**Action needed:** Request a new API key from CharmVerse Discord, or use browser automation (as done in this session) for bulk content extraction.

---

## Part 6: Extended CharmVerse Content (Second Pass)

### 6.1 Impact Profile (Growth → Impact Profile)

The guild's "About" page — rich content for the docs landing page:

**Mission:** Foster positive-sum actions where impact = profit.

**Regenerative Stack (4 products):**
1. **Green Goods** — Biodiversity regeneration on-chain, mobile PWA, verifiable impact attestations
2. **GreenWill** — Verifiable credentials mini-app for regen leaders, reputation tracking
3. **Allo Alliance** — On-chain capital allocation (QF, conviction voting, gamified grants)
4. **Public Goods Staking Protocol** — Squad staking for collective Ethereum validation, public goods funding streams

**Services Provided:**
- Educational & Technical Workshops (Hypercerts, Karma Gap, Passport, Allo)
- Grant Program Design & Operations
- Graphic Design & Branding
- Web3 Tech Consultation

**Prior Accomplishments:** Allo Yeeter (multi-address fund allocation), Allo Advancement (Gitcoin builder rounds), Impact Reef (qualitative data capture), Grant Ships (gamified grant allocation on Arbitrum)

### 6.2 Design Patterns (Engineering → Design Patterns)

Comprehensive technical pattern documentation — maps directly to Developer Docs:

| Pattern | Description | Green Goods Use Case |
|---|---|---|
| **PWA** | Progressive Web Apps, offline caching, installable | Mobile-first Green Goods & Commons experience |
| **State Machines** | XState for controlled data flow | Critical user actions, error/success states |
| **Attestations (EAS)** | Schema-based on-chain data attestation | Capturing biodiversity work |
| **Account Abstraction** | ERC-4337, sponsored transactions, Privy/Pimlico | Non-web3 user onboarding, gas sponsorship |
| **Tokenbound Accounts** | ERC-6551, NFTs with smart accounts | User profiles, Garden NFTs |
| **Hypercerts** | ERC-1155 impact fractions | Capturing/rewarding garden impact |
| **NFT Contracts** | ERC-721 for memberships & governance | Guild tokens, asset tokenization |
| **Upgradeable Contracts** | (Planned) | Contract upgrades |
| **DeFi & Staking** | (Planned) | Octant vaults, yield |
| **Tokenization (ERC-20)** | (Planned) | Garden tokens |
| **Conviction Voting** | (Planned) | Governance |
| **Agentic Flows** | (Planned) | AI/bot automation |

### 6.3 Our Values (Community → Our Values)

5 core values for the guild:
1. **Embrace Regenerative Principles** — Ecological restoration, social equity, sustainable development
2. **Foster Collaborative Innovation** — Share knowledge freely, advance collective goals
3. **Engage in Continuous Learning** — Web3 + regen practices, workshops, hackathons
4. **Use Resources Sustainably** — Energy-efficient coding, minimize carbon footprint
5. **Engage with the Community** — Local/global awareness, community-led initiatives

### 6.4 QA (Product → QA)

Structured QA system:
- **QA Test Cases** (30 entries) — Columns: Name, User Role, Platform, Status, Priority, Type, Story
- **QA Test Runs** — Execution tracking
- **QA Test Executions** — Device/platform/OS/browser matrix
- **QA Internal Testing** — Internal testing docs

**QA Workflow documented:**
1. Identify user story on GitHub
2. Create test case with pre-conditions, steps, expected results
3. Set user role, platform, priority → mark "Ready"
4. Create Test Execution row → select test cases → fill device matrix
5. Execute, capture notes/media → update pass/fail status

### 6.5 Research (Product → Research)

- **Allo Yeeter Research Hub** — Research for Allo Yeeter product
- **Web3 Tooling in ReFi Communities Research** — User research for Greenpill Writers Guild & Carbon Copy
  - ReFi Community Interview Guide
  - Google User Survey
  - Greenpill Toolkit Miro Board
- **User Research Registry** — Research participant tracking

### 6.6 Growth Section

- **Impact Profile** (see 6.1 above)
- **GTMs** (database) — Go-to-market strategies
- **Funding** (database) — Funding tracking
- **Partnerships** (database) — Partnership pipeline

### 6.7 Proposals (Top-Level)

18 grant proposals in Retro Evaluation:
- Hup (atenyun.eth, Growth)
- Enhancing Ecocerts: From Creation to Cross-Chain (ninagirl.eth, Growth)
- DAO.archi: Open Social Layer for DAO Coordination (proofoftom.eth, Pilot)
- Impact Cards — Interoperable, Version-Locked (forkinwisdom.eth, Pilot)
- P2E Inferno App (dannithomx.eth, Pilot)
- Funding Readiness Framework by CARBON Copy (Pilot)
- Taiwan Hypercerts Dashboard (swiftevo.eth, Pilot)
- Relay Funder (sara@relayfunder, Pilot)
- +10 more

Columns: Title, Author, Category, Grant Type (Growth/Pilot), Step (Retro Evaluation)

### 6.8 Capital Section

Operational/financial management (internal, not for public docs):
- Tools & Subscriptions
- Working Capital → Payouts
- Fundraising Projects
- Quarterly budgets (Q4 2024, Q1-Q3 2025)
- Wallets, Treasury, Multisigs

### 6.9 Bounties & Specifications (Engineering)

Databases for engineering task management — not explored in detail but available for task tracking context.

---

## Part 7: Revised Platform Recommendation (Docusaurus-First)

> **Update:** The project is already using Docusaurus for docs.greengoods.app.
> This changes the recommendation from "choose a platform" to "choose a collaborative editing layer for Docusaurus."

### Revised Option Analysis

#### A. Dhub — STRONGEST RECOMMENDATION

**The Git-based CMS built specifically for Docusaurus.**

| Feature | Details |
|---|---|
| **Docusaurus MDX native** | Understands admonitions, tables, code blocks natively |
| **WYSIWYG editor** | Notion-like, no Markdown syntax needed |
| **GitHub two-way sync** | Push, pull, create PRs from editor |
| **Non-dev access** | Team members edit without GitHub accounts, names show in commit history |
| **Real-time collab** | Multiple editors simultaneously (Starter+ plans) |
| **i18n** | Works with Docusaurus i18n out of the box |
| **Versioning** | Supports Docusaurus versioned docs folders |
| **Image handling** | Drag & drop → saves to /static, generates correct paths |
| **AI features** | Coming soon: Claude Sonnet for content generation & review |

**Pricing:**
- **Hobby (Free):** 1 user, personal GitHub, public repos only
- **Starter ($16/mo):** 2 seats, real-time collab, GitHub Orgs, private repos
- **Team ($50/mo):** 10 seats at $6/user/mo

**Why best for Green Goods:** Since the repo is open-source on GitHub, the free tier works for a single editor. Starter ($16/mo) enables collaborative editing for 2 people. The content stays in your GitHub repo as standard Docusaurus MDX — zero vendor lock-in.

#### B. HackMD — GOOD COLLABORATIVE DRAFTING LAYER

**Real-time CRDT Markdown editor with GitHub sync.**

| Feature | Details |
|---|---|
| **CRDT editing** | Real-time multi-user with shared cursors |
| **GitHub sync** | HackMD Hub app syncs individual notes to repo files |
| **Workflow** | Draft in HackMD → push to GitHub → Docusaurus builds |
| **VS Code extension** | Edit HackMD notes from VS Code |

**Limitations for Docusaurus:**
- Syncs individual notes, not a full docs tree
- Doesn't understand Docusaurus MDX natively (no admonitions, sidebar)
- Two-step workflow (edit in HackMD, then sync)
- Commercial product, no self-hosted option for GitHub sync

**Self-hosted alternative: HedgeDoc**
- Fork of HackMD/CodiMD, AGPL-3.0 licensed
- Great real-time collab
- **NO GitHub sync** (long-standing feature request, never implemented)
- Would require custom scripting to export → commit to GitHub
- Less suitable for Docusaurus workflow

#### C. Wiki.js — VIABLE BUT DIFFERENT PARADIGM

**Self-hosted wiki with Git sync.**

| Feature | Details |
|---|---|
| **Git sync** | Saves all content as .md files to Git repo |
| **WYSIWYG + Markdown editors** | Multiple editor modes |
| **Auth & permissions** | Built-in user management |
| **Self-hosted** | Full data ownership |

**Limitations for Docusaurus:**
- Wiki-style navigation, not docs-site structure
- Doesn't understand Docusaurus frontmatter/MDX
- Would need post-processing to convert Wiki.js Markdown → Docusaurus MDX
- Git sync is one-way (Wiki.js → Git), not bidirectional from GitHub → Wiki.js

#### D. CloudCannon — WORTH EVALUATING

**Git-based CMS that supports Docusaurus projects.**
- Connect GitHub repo, provides web editing interface
- Live preview for Docusaurus
- Editorial workflow with review/approval
- Not CRDT-based (PR workflow instead)

### Revised Recommendation

```
┌──────────────────────────────────────────────────────┐
│                   RECOMMENDED STACK                    │
│                                                        │
│   Editing:    Dhub (WYSIWYG for non-devs)             │
│               + GitHub (direct commits for devs)      │
│               + HackMD (for collaborative drafting)   │
│                                                        │
│   Storage:    GitHub repo (Markdown/MDX files)        │
│                                                        │
│   Rendering:  Docusaurus (already in use)             │
│                                                        │
│   Hosting:    Vercel / GitHub Pages                   │
│                                                        │
│   Domain:     docs.greengoods.app                     │
└──────────────────────────────────────────────────────┘
```

**Workflow for different personas:**
- **Developers**: Edit MDX files in VS Code → commit → Docusaurus builds
- **Product/Content**: Edit in Dhub (WYSIWYG) → auto-commits to GitHub → Docusaurus builds
- **Collaborative drafting**: Start in HackMD → when ready, push to GitHub repo
- **Review**: All changes go through GitHub PRs when needed

---

## Part 8: Updated Migration Priority Map

### What to migrate first (by docs skeleton section)

| Skeleton Section | Source | Content Exists? | Priority |
|---|---|---|---|
| Welcome / Intro | Impact Profile + Home page | ✅ Rich | P0 |
| Core Concepts: Roles | Entity Matrix | ✅ Detailed | P0 |
| Core Concepts: Gardens/Work | CIDS MAPPING + Feature Specs | ✅ Architecture | P0 |
| Core Concepts: Attestations | Design Patterns (EAS) | ✅ With resources | P1 |
| Core Concepts: Hypercerts | Design Patterns | ✅ With resources | P1 |
| Product Features | Feature Specs hierarchy | ✅ Complete | P1 |
| System Architecture | CIDS MAPPING diagram | ✅ Visual | P1 |
| Developer: Tech Stack | Tech Stack page | ✅ Comprehensive | P1 |
| Developer: Design Patterns | Design Patterns page | ✅ 7+ patterns | P1 |
| Developer: Setup | CLAUDE.md (in repo) | ✅ Detailed | P1 |
| Integrations Roadmap | Partnerships & Integrations | ✅ 27 entries | P2 |
| Community: Values | Our Values | ✅ 5 values | P2 |
| QA Process | QA section | ✅ 30 test cases | P2 |
| How-To: Gardener | — | ❌ Needs writing | P2 |
| How-To: Operator | — | ❌ Needs writing | P2 |
| How-To: Evaluator | — | ❌ Needs writing | P3 |
| API Reference | — | ❌ Needs generation | P3 |
| Contract Reference | — | ❌ Needs generation | P3 |
| FAQ | — | ❌ Needs writing | P3 |
| Changelog | Git history | ⚠️ Extractable | P3 |
