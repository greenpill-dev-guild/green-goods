---
title: Glossary
slug: /glossary
sidebar_label: Glossary
audience: all
owner: docs
last_verified: 2026-07-03
feature_status: Live
source_of_truth:
  - docs/docs/reference/banned-vocabulary.json
  - packages/shared/src/ontology/green-goods-ontology.json
  - docs/docs/builders/glossary.mdx
  - docs/docs/community/welcome.mdx
  - DESIGN.md
  - .claude/skills/design/prompt-contract.md
  - .claude/skills/design/client-prompt-contract.md
  - CLAUDE.md
keywords:
  - glossary
  - vocabulary
  - design
  - personas
  - surfaces
---

# Glossary

The canonical vocabulary for Green Goods. Every other doc, prompt contract, and lint rule references this file.

This glossary captures four kinds of vocabulary:

1. **Domain entities** — the 10 things the system tracks.
2. **Personas** — the 5 people the system serves.
3. **Surfaces** — the 4 places people interact with the system.
4. **Banned vocabulary** — terms that violate the regenerative-design lens, partitioned into lint-enforced (cross-surface) and AI-prompt-only (admin-only / client-only).

Looking for technical builder terms (Allowlist, Bundler, ERC-4337, Foundry, etc.)? See the [Builder Glossary](/builders/glossary).

The machine-readable companion (consumed by `bun run lint:vocab`) is [`docs/docs/reference/banned-vocabulary.json`](https://github.com/greenpill-dev-guild/green-goods/blob/main/docs/docs/reference/banned-vocabulary.json). The two stay in sync because the markdown table below quotes the JSON's `linter_enforced.terms` array verbatim.

---

## Domain Entities

The 10 entities the system tracks. Use the canonical form in code (types, hooks, props), in copy (UI strings, docs), and in prompts to AI design tools.

| Term | Type | Allowed surfaces | Definition |
|------|------|------------------|------------|
| **Garden** | entity | admin · client · agent · public · docs | A community of gardeners rooted in a place, represented on-chain as an ERC-721 garden token whose ERC-6551 token-bound account holds the garden's treasury, role Hats, and metadata. |
| **Action** | entity | admin · client · agent · public · docs | A documented activity a gardener can perform — the unit of work template (e.g. "Plant native species", "Remove invasive growth"). |
| **Work** | entity | admin · client · agent · public · docs | One documented instance of an Action performed by a gardener — media, notes, and metadata submitted as an EAS Work attestation for operator review; approval records a separate Work Approval attestation. |
| **Assessment** | entity | admin · client · public · docs | An up-front baseline and strategy for a garden — domain, diagnosis, SMART outcome targets, selected Actions, reporting period — authored by an evaluator or operator before work begins, mirrored to a Karma GAP milestone when that module is active; explicitly not a review of submitted Work (that is Work Approval). |
| **Hypercert** | entity | admin · client · public · docs | An on-chain claim of impact bundling approved Work into a fractional impact certificate. Funders hold fractions; gardeners hold contribution credit. |
| **Vault** | entity | admin · client · public · docs | The garden's treasury. Funders deposit; the garden's Tokenbound Account holds; yield splits flow to operators / gardeners / community per configured ratios. |
| **Cookie Jar** | entity | admin · client · public · docs | A garden-scoped emergency or discretionary fund with rate-limited withdrawals. Allowlisted members can claim within the configured cap. |
| **Attestation** | entity | admin · client · public · docs | An EAS (Ethereum Attestation Service) record. Used for Work submissions, Assessment outcomes, and other off-chain-verifiable claims. |
| **Hat** | entity | admin · client · public · docs | A Hats Protocol role token. Determines on-chain authority — operator hats approve Work, gardener hats submit Work, evaluator hats author Assessments. Work review is never the evaluator's job. |
| **Season** | entity | admin · client · agent · public · docs | A bounded period (typically a quarter) during which a garden runs a coordinated set of Actions and Assessments. Pacing primitive — never a countdown. |

### Planned Commitment Pooling entities

These terms are `spec` in the ontology sidecar: the contracts behind them are live on Arbitrum, but no in-app surface exists yet, so they are not part of the live ten-entity table above. Plans, prototypes, and implementation handoffs use this same language.

- **Commitment Pool**: a garden-anchored container that registers, curates, and reconciles commitments under a charter — one pool per garden, holding promises, never funds. Not a Gardens V2 signal pool.
- **Commitment Cycle**: a bounded run of a pool — a Season or a shorter campaign — that gives reconciliation a clear close. A pool's Season cycle is the on-chain form of the garden's existing Season, not a second kind of Season.
- **Commitment Series**: one durable identity for an offer used over time ("offer over time"), so a repeated offer is set up once and reused; zero means "offer once".
- **Commitment**: a promise with one accountable lead, an optional contributor team, repeatable requirements, evidence or Work, and direction-aware confirmation.
- **Commitment Contributor**: a person on a commitment's roster whose approved Work or confirmed evidence can earn Hypercert recognition and a contributor payout; one roster member is the accountable lead.
- **Commitment Payout Plan**: a garden-managed split of a fulfilled commitment's declared support into an explicit garden-retained amount and contributor child payouts. Its complete recognition vector is hash-bound, payment weights derive from amounts, and explicit finalization freezes it before dispatch.

### Planned Community Needs entities

- **Need**: a community-authored problem statement paired with a mandatory desired outcome, recorded against the garden. A Need has no request/offer direction — direction belongs to the commitment that answers it. Architecture is locked; nothing is deployed or user-visible yet.

For planned pooled commitments, recognition and payment are related but distinct. Hypercert gardener shares record contribution to impact. Within each fulfilled commitment, 20% is shared equally among eligible contributors and 80% follows verified contribution; zero eligible contributors block certificate expansion rather than defaulting to the lead. Recognition seeds a payout plan, while the garden may retain an explicit amount and a steward may change the atomic amount vector only with a stored reason when the derived payment weights diverge. Finalization proves conservation before any child dispatch.

---

## Personas

The 5 people Green Goods serves. Use the canonical form in copy, design prompts, and product specs. The same person can hold multiple roles in the same garden.

| Term | Type | Allowed surfaces | Definition |
|------|------|------------------|------------|
| **Gardener** | persona | admin · client · agent · public · docs | A person doing regenerative Work in a garden. Submits Work, holds gardener Hats, receives credit toward Hypercerts and yield splits. |
| **Operator** | persona | admin · client · agent · public · docs | A person who runs a garden — creates Actions, approves Work, configures Vault and Hat hierarchy. Holds operator Hats. |
| **Evaluator** | persona | admin · client · public · docs | A person who authors garden Assessments — baselines, targets, and scored outcomes — and certifies impact. Often domain experts (botanists, soil scientists, community elders). Reviewing and approving Work is the operator's job, not the evaluator's. |
| **Funder** | persona | admin · client · public · docs | A person or org who deposits into a garden's Vault, holds Hypercert fractions, receives yield distributions per configured splits. |
| **Community Member** | persona | client · public · docs | A local resident affected by a Garden's Work. Signals or attests that Work exists and is healthy, and helps prioritize future Actions through public signal and conviction flows. |

---

## Surfaces

The 4 places where people interact with Green Goods. Each has a canonical identity that the design system enforces — never mix surface dialects.

| Term | Type | Allowed surfaces | Definition |
|------|------|------------------|------------|
| **Admin** | surface | self | Operator cockpit. `packages/admin`. Restrained M3 v0.192 anatomy, Plus Jakarta Sans, transparent admin AppBar root, Controlled Chrome glass only on Navigation/FAB, solid dense surfaces everywhere else (dialogs and the account side sheet included). Litmus: appropriate for Linear / GitHub / Stripe Dashboard. |
| **Client PWA** | surface | self | Gardener-facing app. `packages/client`. Warm Earth garden-journal feel, Inter typography, bottom AppBar (installed PWA) or SiteHeader hamburger (browser). Hero moments live here, never in admin. |
| **Agent** | surface | self | Conversational gardener interface — telegram, SMS, WhatsApp. `packages/agent`. Natural-language Work submission, status pings, garden updates. No visual chrome. |
| **Public browser** | surface | self | Public-facing web for funders / community members. Editorial typography (Fraunces / Lora / Newsreader for headlines, Inter for body). Garden discovery, impact pages, funding flows. Never appears in installed PWA. |

---

## Design Vocabulary

This section is the anchor target for [`prompt-contract.md`](https://github.com/greenpill-dev-guild/green-goods/blob/main/.claude/skills/design/prompt-contract.md) (admin) and [`client-prompt-contract.md`](https://github.com/greenpill-dev-guild/green-goods/blob/main/.claude/skills/design/client-prompt-contract.md) (client). Every cross-surface domain term used in AI-prompt vocabulary lives in the three sections above:

- **Domain Entities** (Garden, Action, Work, Assessment, Hypercert, Vault, Cookie Jar, Attestation, Hat, Season) — see [Domain Entities](#domain-entities).
- **Personas** (Gardener, Operator, Evaluator, Funder, Community Member) — see [Personas](#personas).
- **Surfaces** (Admin, Client PWA, Agent, Public browser) — see [Surfaces](#surfaces).

Surface-specific component vocabulary (e.g. `CanvasLayout`, `MainSheet`, `RightSheet`, `AdminFab`, presentation-mode loaders, `PublicShell`, `AppShell`, `SiteHeader`) lives in the prompt-contracts themselves — those are admin / client component palettes, not cross-surface domain terms.

The voice and tone framework (Grounded · Inviting · Honest · Active) lives in [`DESIGN.md § Voice & Copy`](https://github.com/greenpill-dev-guild/green-goods/blob/main/DESIGN.md) — the positive expression of this glossary.

---

## Banned Vocabulary

Three categories. Lint-enforced bans run on every commit and CI; AI-prompt bans are documentation surfaces consumed by AI design tools and coding agents.

The structured machine-readable source is [`docs/docs/reference/banned-vocabulary.json`](https://github.com/greenpill-dev-guild/green-goods/blob/main/docs/docs/reference/banned-vocabulary.json). The tables below mirror the JSON for human readers.

### Lint-Enforced (cross-surface)

Enforced by `bun run lint:vocab` on user-facing strings in `packages/{shared,client,admin}/src/i18n/*.json`. These terms violate the regenerative-design lens (Lens 1) — they signal growth-hacking / FOMO patterns that gamify rather than ground.

| Phrase | Banned in | Rationale |
|--------|-----------|-----------|
| `streak` | cross-surface | Compulsion mechanic — punishes life events, pressures performative continuity over real care. |
| `countdown` | cross-surface | Manufactures artificial urgency; ecological time is seasonal, not minute-by-minute. |
| `leaderboard` | cross-surface | Competitive comparison reframes regenerative work as zero-sum. We surface verified impact, not rankings. |
| `FOMO` | cross-surface | Engineered scarcity panic. Gardens grow on abundance, not anxiety. |
| `urgent` | cross-surface (growth-hacking umbrella) | False urgency in product copy — a gardener's pace is calm. Reserve "urgent" for genuine safety / system warnings (which use `Alert` semantics, not body copy). |
| `limited time` | cross-surface (growth-hacking umbrella) | Scarcity-driven CTA framing. Seasonal windows are real; "limited time" copy is not how we describe them. |
| `re-engagement` | cross-surface (growth-hacking umbrella) | Treats people as funnel metrics. Gardeners return because the work matters, not because we re-engaged them. |
| `retention hook` | cross-surface (growth-hacking umbrella) | Product-team euphemism for compulsion mechanic. Same lens violation as `streak`. |

The 4 terms tagged `growth-hacking umbrella` are what `CLAUDE.md` and design briefs collectively refer to as "growth-hacking language." The full enforced set is 8 terms.

**Source of truth:** `linter_enforced.terms` in [`banned-vocabulary.json`](https://github.com/greenpill-dev-guild/green-goods/blob/main/docs/docs/reference/banned-vocabulary.json). Editing the script's regex without updating the JSON breaks the contract — always edit the JSON.

### Admin-Only Banned (AI Prompt Vocabulary)

Banned in AI-prompt vocabulary when generating admin-cockpit screens. Not a runtime check — these are documentation surfaces for AI design tools and coding agents.

Source: `prompt_vocabulary_admin_banned` in [`banned-vocabulary.json`](https://github.com/greenpill-dev-guild/green-goods/blob/main/docs/docs/reference/banned-vocabulary.json), and [`.claude/skills/design/prompt-contract.md § Never Use`](https://github.com/greenpill-dev-guild/green-goods/blob/main/.claude/skills/design/prompt-contract.md).

| Phrase | Banned in | Rationale |
|--------|-----------|-----------|
| `hero moment` | admin only | Hero moments are reserved for celebratory client PWA flows (garden creation, first work submission, Hypercert mint). The admin cockpit stays restrained. |
| `gallery` | admin only | Marketing-page framing. Admin shows workbench rows, lists, and inspectors — not curated visual galleries. |
| `decorative gradient` | admin only | Decoration without function. Admin uses solid surfaces; material treatment is reserved for Navigation/FAB. |
| `marketing banner` | admin only | Promotional surface framing. Admin is operator-internal — no banners, no landing-page energy. |
| `AppBar glass` / `glass outside Navigation/FAB` | admin only | The admin AppBar root stays transparent over the workspace canvas. Liquid / frosted material treatment is restricted to Navigation/FAB; dense data surfaces, dialogs, and the account side sheet must be solid for legibility and operator focus. |

The full prompt-vocabulary admin ban list (including `hero section`, `celebration`, `masonry gallery`, `ambient gradient wash`, `promo band`, `landing-page`, `dashboard card mosaic`, `feature cards`, `floating stats`, `stat chips floating above content`, `liquid`, `frosted`) lives in `prompt_vocabulary_admin_banned` of the JSON sidecar — they expand the categories above.

### Client-Only Banned (AI Prompt Vocabulary)

Banned in AI-prompt vocabulary when generating client PWA screens. Not a runtime check.

Source: `prompt_vocabulary_client_banned` in [`banned-vocabulary.json`](https://github.com/greenpill-dev-guild/green-goods/blob/main/docs/docs/reference/banned-vocabulary.json), and [`.claude/skills/design/client-prompt-contract.md § Never Use`](https://github.com/greenpill-dev-guild/green-goods/blob/main/.claude/skills/design/client-prompt-contract.md).

| Phrase | Banned in | Rationale |
|--------|-----------|-----------|
| `operator cockpit` | client only | Admin-surface framing. The client is a garden journal, not an operator cockpit. |
| `utility copy` | client only | Admin-only voice register. Client copy is warm and narrative ("Let's see what's grown in your garden"), not terse task framing. |
| `KPI tile` | client only | Dashboard framing. The client surfaces story and place, not key-performance-indicator tiles. |
| `dashboard` | client only | Operator-cockpit framing. The client is a journal — it tells the story of the work. |
| `Plus Jakarta Sans` | client only | Admin-only typography. Client uses Inter throughout the PWA; editorial serif (Fraunces / Lora / Newsreader) appears only on the public browser site. |

The full prompt-vocabulary client ban list (including `workbench row`, `inspector pattern`, `metric grid`, `trading floor`, `financial terminal`, `gamification`, `dark pattern`) lives in `prompt_vocabulary_client_banned` of the JSON sidecar.

---

## How to Update This Glossary

1. **Adding a domain entity, persona, or surface**: edit the markdown table above and update the relevant Docusaurus pages that introduce the term. Entities also need a TypeScript type in `@green-goods/shared` and likely a contract or hook surface.
2. **Adding a lint-enforced banned term**: edit `linter_enforced.terms` in [`banned-vocabulary.json`](https://github.com/greenpill-dev-guild/green-goods/blob/main/docs/docs/reference/banned-vocabulary.json), add a row to the table above, and run `bun run lint:vocab` to confirm the new term enforces. The bash regex rebuilds from the JSON automatically — do not edit the script's term list directly.
3. **Adding an admin-only or client-only AI-prompt banned term**: edit the matching `prompt_vocabulary_*_banned` array in the JSON, add a row to the table above, and update the `§ Never Use` section in the matching prompt-contract.
4. **Removing a term**: requires explicit design review — these are load-bearing for both human and AI consumers. Raise it with maintainers first (Discord, tracked in Linear); do not remove silently.

The glossary file and the JSON sidecar are siblings — if you edit one without the other, the cross-references break and the linter falls out of sync with the docs.

---

## Term Reference (Community-Facing Definitions)

The structured tables above are the canonical vocabulary contract. The longer entries below are the community-facing prose definitions used in onboarding docs, FAQ answers, and gardener / operator guides. Both surfaces describe the same concepts — start with the tables for the contract, read the entries below for context.

---

### Action
A task or bounty available for gardeners to complete within a garden. Actions define specific regenerative activities (like planting trees, litter cleanup, or biodiversity surveys) with clear instructions, metrics, and optional time windows. Each action is registered on-chain and tracks completion statistics.

### Assessment
A garden's baseline and strategy, created up front (typically at onboarding): the domain, a diagnosis of the current situation, SMART-outcome targets, the selected actions, and the reporting period. It sets what success looks like *before* the work it frames, so that later work approvals and impact certificates have a baseline to measure against. It is not a review of submitted work — that is [Work Approval](#work-approval).

### Attestation
An on-chain record created using the Ethereum Attestation Service (EAS). Green Goods uses three attestation types: work submissions, work approvals, and garden assessments. Attestations are permanent, cryptographically signed records that prove specific claims about impact work.

### Community Member
Local residents living in the bioregion affected by a Garden's Work. Community Members use public signal and conviction flows to attest that Work exists and is healthy, hold the Garden accountable, and prioritize future Actions.

### Cookie Jar
A garden-scoped fund for small, frequent payouts. Supporters put money in, and allowlisted members (like active gardeners) can withdraw up to a capped amount per period. Cookie jars cover near-term operational needs, while the [Vault](#vault) holds the garden's long-term endowment.

### Domain
The category of regenerative work a garden does — *where* the work happens. Green Goods recognizes four action domains: **Agroforestry**, **Waste Management**, **Solar (Hub Development)**, and **Education** (the on-chain `Domain` enum: `SOLAR`, `AGRO`, `EDU`, `WASTE`). A domain is neither an outcome nor a form of capital — carbon and biodiversity, for example, are [outcomes](#outcome), not domains.

### EAS (Ethereum Attestation Service)
A protocol for making on-chain and off-chain attestations about any subject. Green Goods uses EAS to create verifiable records of gardener work, operator approvals, and garden assessments. Learn more at [attest.sh](https://attest.sh).

### Eight Forms of Capital
A holistic framework for measuring wealth and impact beyond money:
1. **Living Capital**: Biodiversity, soil health, water quality
2. **Material Capital**: Physical resources and infrastructure
3. **Financial Capital**: Money and financial assets
4. **Social Capital**: Relationships and community trust
5. **Intellectual Capital**: Knowledge and skills
6. **Experiential Capital**: Lived wisdom and cultural practices
7. **Spiritual Capital**: Sense of meaning and purpose
8. **Cultural Capital**: Traditions and shared identity

Green Goods assessments track impact across all eight capitals.

> The numbering above is presentational. The canonical machine ordering is the `Capital` enum: Social (0), Material (1), Financial (2), Living (3), Intellectual (4), Experiential (5), Spiritual (6), Cultural (7).

### Evaluator
Impact assessors who author garden assessments and certify impact across the Eight Forms of Capital. Evaluators set the baselines and success criteria that frame a season's work and score its outcomes; reviewing and approving submitted Work is the operator's job.

### Funder
Capital allocators who deposit into Octant Vaults, purchase Hypercerts, and contribute to funding flows that sustain garden operations. Funders support regenerative work through yield-generating deposits and direct impact investment.

### Garden
A community hub for regenerative work, represented as an NFT using the ERC-6551 Tokenbound Account standard. Each Garden has its own smart contract account that can hold assets, manage members, and coordinate impact work. Gardens are localized to specific bioregions and serve as hubs for coordinating regenerative and community action.

### Garden Operator {#operator}
Trusted coordinators who manage gardens and validate gardener submissions. Operators review work submissions, approve or reject them with feedback, and oversee garden membership. Operators have elevated permissions within assigned gardens, and garden creation depends on current permission policy.

### Gardener
Community members who perform on-the-ground regenerative work. Gardeners submit work through the Green Goods PWA using the MDR (Media-Details-Review) workflow, documenting their contributions with photos and metrics. Gardeners can belong to multiple gardens and earn recognition for verified work.

### Hat
A Hats Protocol role token that defines what someone can do in a garden. Operator hats can approve Work, gardener hats can submit Work, and evaluator hats can attest to impact. Because roles are on-chain tokens, permissions stay transparent and portable across the tools a garden uses.

### Hypercert
A semi-fungible token representing a claim of impact work. Hypercerts enable retroactive funding by allowing impact to be certified, tracked, and fractionally owned. In Green Goods, hypercert mint/list workflows are implemented but may be activation-pending depending on deployment and indexing status. Note: "Impact Tokens" are the broader concept (verified impact work tokenized via Karma GAP attestations), while Hypercerts are the specific tokenized certificates that represent fractional ownership of those impact claims. Learn more at [hypercerts.org](https://hypercerts.org) and [Mint and List Hypercerts](/community/operator-guide/creating-impact-certificates).

### Impact Certificate
The community-facing name for a [Hypercert](#hypercert): a bundle of a garden's approved Work, minted as a certificate that funders can hold fractions of. If you see "Impact Certificate" in the app and "Hypercert" in technical docs, they are the same thing.

### Impact Token
A token representing verified impact work that can be traded, funded, or used to unlock benefits. Green Goods uses Karma GAP attestations as the foundation for impact tokenization. Impact Tokens are the broader concept; see [Hypercert](#hypercert) for the specific tokenized certificate implementation.

### Indicator
A measurable signal of progress toward an [outcome](#outcome) — the unit a metric is counted in (trees planted, kWh generated, kg diverted, participants verified).

### IPFS (InterPlanetary File System)
A distributed file storage system. Green Goods stores work photos, metadata, and action instructions in IPFS through the Pinata-backed upload path, with content identifiers (CIDs) referenced in on-chain attestations.

### Karma GAP (Grantee Accountability Protocol)
A standardized protocol for on-chain impact reporting. In Green Goods, Karma GAP integration is module-driven and deployment-dependent rather than something to assume on every chain by default. When that module is active, operators can sync approved work and garden/project state into GAP-compatible attestations.

### MDR (Media-Details-Review)
The three-step workflow for submitting work in the Green Goods PWA:
1. **Media**: Capture before/after photos or video
2. **Details**: Fill in task information, metrics, and feedback
3. **Review**: Preview submission and confirm

This pattern ensures high-quality documentation and reduces submission errors.

### On-Chain
Data or transactions permanently recorded on a blockchain. Green Goods stores attestations on-chain for verifiability, while larger data (photos, metadata) is stored off-chain in IPFS and referenced by on-chain records.

### Outcome
The change an impact claim asserts — what will change and by how much. In Green Goods, outcomes are the SMART targets set in an [assessment](#assessment) and filled by approved work over the reporting period. Outcomes accrue to the [Eight Forms of Capital](#eight-forms-of-capital); they are not [domains](#domain).

### Owner
Administrators with full control over garden configuration, role assignments, and governance settings. Owners can promote gardeners to operators, configure actions, and manage the garden's on-chain infrastructure.

### Passkey
A cryptographic credential stored on your device (like Face ID or fingerprint) that enables passwordless authentication. Green Goods uses passkeys with Pimlico smart accounts to provide gardeners with a seamless, web2-like experience without managing private keys.

### PWA (Progressive Web App)
A web application that can be installed on mobile devices and work offline. The Green Goods client is a PWA, enabling gardeners to document work in the field even without internet connectivity. Work is queued locally and synced when back online.

### Resolver
Smart contracts that execute custom logic when attestations are created. Green Goods resolvers enforce permissions (only gardeners can submit, only operators can approve), emit events, and trigger Karma GAP integration for impact reporting.

### Schema
A structured template that defines the format of an attestation. Green Goods uses three schemas:
- **Work Submission Schema**: Captures gardener work with media and metadata
- **Work Approval Schema**: Records operator validation decisions
- **Assessment Schema**: Records a garden's baseline strategy kernel — domain, diagnosis, SMART-outcome targets, selected actions, and reporting period — set up front, before the work it frames

### Season
A bounded period, typically a quarter, during which a garden runs a coordinated set of Actions and Assessments. Seasons give gardens a shared rhythm for planning, documenting, and reporting. They are a pacing tool, never a countdown.

### Smart Account (Account Abstraction)
A smart contract-based wallet that enables gasless transactions, social recovery, and improved UX. Green Goods gardeners use Kernel smart accounts powered by Pimlico, allowing them to submit work without paying gas fees or managing seed phrases.

### Vault
A garden's long-term treasury, powered by Octant. Funders deposit assets that stay in place as principal, and the yield those assets generate is harvested and split to support operators, gardeners, and community initiatives. Depositors can withdraw their principal later; see [Endow a Garden](/community/funder-guide/funding-a-garden) for how it works.

### Work
A specific instance of an [Action](#action) performed by a gardener, captured with photos, a description, and metrics. Work is recorded as a permanent on-chain attestation the moment it is submitted; operator review then adds a separate, linked [Work Approval](#work-approval) attestation. Work is the umbrella term; [Work Submission](#work-submission) and [Work Approval](#work-approval) are its two halves.

### Work Approval
The validation step where operators review submitted work and either approve or reject it with constructive feedback. The approval is its own on-chain attestation, linked to the work it reviews — it never creates the work record, which already exists from submission. Karma GAP reporting is module-driven and currently manual (a linked project UID), not automatic.

### Work Submission
Documentation of completed regenerative work submitted by a gardener. Work submissions follow the MDR workflow and include before/after photos, task details, metrics, and metadata. Media is stored in IPFS and the submission is recorded on-chain via an EAS attestation immediately — before, not after, review.
