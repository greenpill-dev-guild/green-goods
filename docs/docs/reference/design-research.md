---
title: Design & Research
slug: /reference/design-research
audience: all
owner: docs
last_verified: 2026-07-29
feature_status: Live
source_of_truth:
  - docs/docs/community/operator-guide/creating-a-garden.mdx
  - docs/docs/community/gardener-guide/joining-a-garden.mdx
---

# Design & Research

Design resources, research materials, and product vision documents for Green Goods.

The page and current design practice are **live**. Commitment Pooling and Community Needs & Signals are **planned** until implementation and runtime proof exist. In this page, **reported** means an authorized executor recorded a Celo transaction reference; it does not prove receipt. **Oracle-confirmed** means an authenticated CCIP acknowledgment reported the bounded executor outcome for the expected execution key and attempt. The executor checks call success and exact balance deltas, but the acknowledgment tuple does not carry or authenticate a finalized receipt or exact `Transfer` logs. The outer transaction sender may be a scoped Zodiac executor. **Evidence-gated** behavior remains blocked until its named research or operational proof exists.

**Researching impact methodology? Read these four in order.** The [Regenerative Design Framework](/reference/regenerative-design-framework) sets the design lens. The [Glossary](/glossary) defines the four action domains and the entities every record uses. [How It Works](/community/how-it-works) explains the work and approval attestations that count as evidence. [Reporting and GAP](/community/operator-guide/reporting-and-gap) shows how approved work rolls up into reports funders can read. The materials below are the source documents behind that chain.

---

## Product Vision

### Blog Posts

**Simplifying Impact Capture and Exchange**
- Full product vision and problem statement
- Read: [Paragraph Blog](https://paragraph.com/@greenpilldevguild/green-goods-simplifying-impact-capture-and-exchange)

### Project Tracker

**DevSpot Project Page**
- Current features and roadmap
- Visit: [devspot.app/projects/466](https://devspot.app/en/projects/466)

---

## Design Resources

### Figma Designs

**UI/UX Design System**
- Complete component library
- Mobile and desktop views
- Interactive prototypes
- View: [Figma Board](https://www.figma.com/design/aNmqUjGZ5wR4eNaRqfhbQZ/Green-Goods)

Design embeds are intentionally omitted in docs to keep pages fast on low-bandwidth connections.

### Miro Board

**Product Strategy & User Flows**
- Impact mapping
- User journey diagrams
- Feature planning
- View: [Miro Board](https://miro.com/app/board/uXjVKfMOhPY=/)

### Video Demos

**Product Walkthrough**
- Complete feature demonstration
- User flow examples
- Watch: [Loom Video](https://www.loom.com/share/e09225ec813147a6aacd4dc8816ce8be?sid=985a42f4-574b-499d-9dc8-03051b797f3d)

Video preview image is omitted; use the Loom link above for the latest walkthrough.

---

## Research & Impact

### Eight Forms of Capital

Green Goods uses a holistic framework for impact measurement:

1. **Living Capital**: Biodiversity, ecosystems
2. **Material Capital**: Physical resources
3. **Financial Capital**: Money and assets
4. **Social Capital**: Relationships, community
5. **Intellectual Capital**: Knowledge, skills
6. **Experiential Capital**: Wisdom, practices
7. **Spiritual Capital**: Meaning, purpose
8. **Cultural Capital**: Traditions, identity

> The numbering above is presentational. The canonical machine ordering is the `Capital` enum — Social (0), Material (1), Financial (2), Living (3), Intellectual (4), Experiential (5), Spiritual (6), Cultural (7).

**Origin**: From Ethan Roland and Gregory Landua's work in regenerative design.

**Application in Green Goods**:
- Actions tagged by relevant capitals
- Assessments measure across all capitals
- Holistic impact tracking

---

## User Research

### User Personas

The page itself documents the live Green Goods design and research practice. The five scenarios below are **target personas and planned journeys** for Commitment Pooling and Community Needs & Signals; they are research inputs, not claims that those product flows are already available. Live feature documentation remains in the linked operator and gardener guides until implementation ships.

The planned surface boundary is explicit: Community Needs & Signals is an independent PWA at `community.greengoods.app` with Needs / Create / Profile; operator pools, triage, and evaluator lineage/export live in admin under `/community`; public funder discovery stays in existing Green Goods browser surfaces. Need kinds are Request, Offer, and Initiative. Need state keeps moderation (`none`, `acknowledged`, `merged`, `hidden`, `declined`) separate from progress (`open`, `committed`, `in-progress`, `addressed`). Domains are derived from repeatable commitment requirements rather than entered as a second positional array. A DomainImpact requirement pairs a registered action UID with a required count, and action UID `0` remains valid. The eventual implementation bound is set by contract-gas and indexer benchmarks, not presented as a four-action product rule.

Planned commitments support a team from the start: one accountable lead plus zero or more contributors tied to approved Work or confirmed evidence. The roster freezes atomically on every transition to ReadyForConfirmation and on direct dispute resolution to Fulfilled, every team member is excluded from confirming their own delivery, and only the lead consumes the commitment register's accountable-provider slot. At certification, fulfilled commitments receive equal budgets inside the Hypercert gardener class; within each commitment, the cycle's opened policy, or the immutable cycle-less 20/80 default, divides units among eligible contributors with deterministic remainder handling. New commitments cannot become Ready or resolve directly to Fulfilled without verified contribution. An inconsistent legacy or indexed commitment with no eligible contributor blocks certificate expansion until governed migration or source-data correction restores canonical on-chain credit; there is no automatic lead or metadata-only fallback.

Settlement stays simple by making the garden account the funding boundary. Commitment support reaches or is held by the garden Safe, then one stable Commitment Payout Plan accounts for the garden-retained amount and separate contributor child payouts. Its complete recognition vector is bound to a snapshot hash; payment weights derive from an atomic amount vector, and any divergence requires a stored reason. Explicit finalization verifies conservation before dispatch and completes a zero-child all-retained plan without CCIP or a self-transfer. Child cancellation never clears the parent pointer, and a failed child payout never reverses commitment fulfillment, Hypercert recognition, or successful sibling receipts.

#### Gardener: Maria

**Who she is**: Community volunteer at a campus garden in Awka, Nigeria. Uses a mid-range Android phone with intermittent mobile data. No prior experience with apps beyond WhatsApp. Paid by the day for solar panel maintenance and tree planting.

**Target journey (planned)**: Maria arrives before her solar-panel cleaning shift. She captures a photo and short voice note; Green Goods saves it even when the connection drops. At the weekly gathering she takes the accountable lead on a tool-shed commitment and adds Ana and João as contributors. Approved Work and evidence preserve who contributed instead of flattening the group into one provider. The beneficiary confirms the team result, the Hypercert records their contribution-weighted recognition, and the garden Safe pays each member through a finalized child payout plan while retaining an explicit amount for shared costs. A member reward is shown as received only after the authenticated CCIP acknowledgment records successful Celo execution. G$ remains on Celo, and Maria never bridges a token or holds CELO.

**What success feels like**: "I shared the work, kept my promise, and can see that the support arrived." The app never asks her to think about chains, attestations, or transaction mechanics.

**What failure feels like**: A spinning loader after she submitted. She closes the app, unsure if her work was captured. She will not reopen it voluntarily -- she will ask her operator in person. If this happens twice, she stops using the app entirely.

**Frustration points**: Long forms, confusing labels, any interruption to the capture-submit-done loop. If the app feels like a government form, she stops using it.

**Design implication**: Every Gardener-facing decision must survive the "would Maria try again after this?" test.

#### Operator: David

**Who he is**: Community coordinator managing a coastal restoration project in Muizenberg, Cape Town. Oversees 20 gardeners across waste collection and food systems actions. Web3-familiar but not a developer. Spends 2-4 hours per week on garden management.

**Target journey (planned)**: David opens admin `/community` before a community gathering. He reviews new Requests, Offers, and Initiatives, acknowledges them with zero or more domains, merges one duplicate with a visible rationale, and prepares a print-legible gathering view. After the group agrees on priorities, he seeds bounded commitments with units, repeatable action/count requirements where DomainImpact requires them, an accountable lead, contributor policy, evidence, confirmation rules, and declared support. After fulfillment he reviews the contribution-derived recognition weights, records any reasoned payment correction, makes the garden-retained amount explicit, and follows each contributor child payout without maintaining a second spreadsheet.

**What success feels like**: "I turned what the community agreed into clear work without losing anyone's words." The workspace feels like an operating tool, not a protocol console.

**What failure feels like**: Spending an hour on what should have been a batch operation. Or a funder asking for data he cannot export, forcing him to screenshot tables into a slide deck.

**Frustration points**: One-at-a-time approval flows, configuration that requires reading Solidity, reports that need technical parsing before they are shareable.

**Design implication**: Every Operator workflow must be measured by "could David finish this before his coffee gets cold?"

#### Evaluator: Dr. Chen

**Who she is**: Environmental researcher partnered with AgroforestDAO in Minas Gerais, Brazil. Evaluates garden impact seasonally, not daily. Comfortable with data queries and attestation chains. Needs structured rubrics that map to academic and compliance frameworks.

**Target journey (planned)**: At season close, Dr. Chen traces a community Need through its linked commitment, approved work, baseline and delta assessment, and testimony. Cross-domain commitments retain optional domain arrays and positional registry-validated action arrays rather than being forced into one category. She exports CSV or JSON evidence lineage and can distinguish evaluator conclusions, operator records, community witness statements, reported transfers, and oracle-verified settlement.

**What success feels like**: "I have a publishable dataset with cryptographic provenance that I can cite in a peer-reviewed journal." The data export maps cleanly to her research methodology.

**What failure feels like**: Spending time on assessments that lack the metadata she needs -- no GPS coordinates, no timestamps, no photo EXIF data. Or discovering that the export format requires hours of manual transformation before it fits her analysis pipeline.

**Frustration points**: Free-text-only assessments with no structured rubric. Vague impact language that cannot be operationalized. Data exports that lose attestation linkage.

**Design implication**: Evaluator features must produce research-grade artifacts, not just internal reports.

#### Funder: Amara

**Who she is**: Impact fund manager at a mid-size foundation evaluating 20-30 projects per quarter. Comfortable with dashboards and financial reporting tools but does not read Solidity. Needs verified, auditable impact data to justify allocations to her board.

**Target journey (planned)**: Before a quarterly allocation meeting, Amara browses recent community Requests, Offers, and Initiatives in existing Green Goods public-browser surfaces without a performance leaderboard. She opens one garden's story, follows the Need → promise → work → proof chain, and supports the garden through the existing direct-donation or endowment path. A receipt-checked FundingAttribution shows the context of her contribution without pretending it created per-Need escrow or gave her control over garden allocation. Reported and oracle-verified G$ settlement remain visibly distinct.

**What success feels like**: "I can show my board exactly where the money went and what it produced, with proof that no one fabricated the numbers." The dashboard gives her confidence that this is not just another NGO spreadsheet.

**What failure feels like**: Self-reported numbers with no verification trail. Data lag beyond 24 hours without explanation. Reports that require a developer to interpret.

**Frustration points**: Hype without substance. "Impact" claims backed by nothing auditable. Blockchain jargon in what should be a financial reporting interface.

**Design implication**: Funder features must produce exportable, auditable artifacts that distinguish verified impact from self-report.

#### Community Member: Kwame

**Who he is**: Local resident whose neighborhood benefits from a school garden program. He may not do formal fieldwork, but he can name a request, offer a resource, or help organize a shared initiative. He uses a smartphone with tech comfort similar to Maria and usually enters through a garden QR or gathering.

**Target journey (planned)**: Kwame hears that elders need reliable market rides. He opens the independent Community PWA without signing in, reads the desired outcome, and taps Agree. On his first action he creates a passkey account; the action stays safely queued while the operator confirms membership. Membership persistence remains evidence-gated. Later he sees moderation and progress separately: the Need is acknowledged, a ride commitment is seeded, work is in progress, and neighbors have added testimony.

**What success feels like**: "I said what mattered and can see what happened next." He does not need to understand the protocol — only that his words, the garden's response, and the resulting work remain connected.

**What failure feels like**: His recording disappears, the app cannot explain why his action is waiting, or the final work is disconnected from what the community originally described.

**Frustration points**: Jargon-heavy governance UI, forced domain classification, unclear membership waiting states, and no visible feedback loop.

**Design implication**: Community features must use plain Request / Offer / Initiative language and show a legible need → promise → work → proof thread without protocol vocabulary.

### Operator Context Profiles

When the Operator archetype is ambiguous, these constraint profiles differentiate by garden domain. David is still the named Operator persona -- these describe the operational constraints he would face in different contexts.

| Context | Representative Garden | Key Constraints | UX Implications |
|---------|----------------------|-----------------|-----------------|
| **Low-power infrastructure** | TAS HUB (Awka, Nigeria) | Frequent power outages, solar-dependent connectivity, campus schedule | Batch operations must complete in single sessions. Offline queue is non-negotiable. Avoid features requiring sustained connectivity. |
| **Research-focused** | AgroforestDAO (Minas Gerais, Brazil) | Scientific data standards, Portuguese language, seasonal evaluation cadence | Assessment forms must support structured metadata. Export formats must be research-grade. Localization is critical. |
| **Education-integrated** | Greenpill Kenya (Nairobi) | Public-goods curriculum, mixed adult/student participants, sustainability education alignment | Action schemas need education-domain metrics (participants engaged, curricula completed). UX must accommodate supervised student use. |
| **Community food systems** | Muizenberg (Cape Town, South Africa) | Organic waste tracking, composting cycles, harvest documentation, community market integration | Actions span longer time cycles (composting). Photo evidence may span weeks. Work submissions need temporal metadata. |

**Usage rule**: When a UX decision depends on operational context (e.g., "should this feature work offline?" or "does this export need research-grade structure?"), check which garden domain is relevant and apply that row's constraints. When no specific domain applies, default to David's profile.

---

## Design Principles

### 1. Mobile-First

**Why**: Regenerative work happens in the field, not at desks.

**How**: Touch-optimized UI, camera-centric, minimal typing.

### 2. Offline-Capable

**Why**: Remote areas lack reliable connectivity.

**How**: Local-first storage, background sync, resilient design.

### 3. Simple Over Complex

**Why**: Reduce barriers to impact documentation.

**How**: MDR workflow (3 steps), clear language, guided flows.

### 4. Transparent & Verifiable

**Why**: Build trust with funders and community.

**How**: Named data ownership, public protocol records where appropriate, open source, and precise evidence labels. A reported Celo transaction is not receipt proof; only the authenticated CCIP acknowledgment may produce an oracle-verified settlement state.

### 5. Community-Governed

**Why**: Local communities know their needs best.

**How**: Operator validation, garden autonomy, no central authority.

---

## Academic References

### Regenerative Agriculture

- Rodale Institute: "Regenerative Organic Agriculture and Climate Change"
- Savory Institute: "Holistic Management Framework"

### Blockchain for Social Good

- Gitcoin: "Quadratic Funding for Public Goods"
- Optimism: "Retroactive Public Goods Funding"
- Hypercerts: "A New Primitive for Public Goods Funding"

### Impact Measurement

- Doughnut Economics: Kate Raworth
- Eight Forms of Capital: Ethan Roland & Gregory Landua
- Theory of Change: Carol Weiss

---

## Case Studies

### Planned Pilot Case Studies

The pilot intends to document these only after participant approval and verified evidence; this list is not a claim that case studies are complete:
- Pilot gardens
- Impact metrics
- Funder testimonials
- Gardener success stories

Follow updates on [X](https://x.com/greengoodsapp) and the [Dev Guild Blog](https://paragraph.com/@greenpilldevguild).

---

## Product Iterations

### Pilot Targets — Not Results

These targets are measured from the first instrumented pilot task through **2026-09-30**. Reports must include numerator, denominator, sample size, observation window, excluded states, and qualitative context. They must not expose wallet addresses, join-request identities, or participant identifiers.

| Target by 2026-09-30 | Measurement contract |
|---|---|
| At least 90% passkey onboarding completion | Participating gardeners who complete passkey setup divided by those who start their first authenticated action. |
| At least 99% eligible offline-job sync success | Eligible queued jobs that reach confirmed submission divided by all eligible jobs that begin a normal send attempt; exclude user-cancelled jobs and time spent in `waiting_for_hat`. A separate retry-recovery cut may use only jobs that entered retry as both numerator population and denominator. |
| At least 95% operator validation completion without data repair | Eligible triage, seeding, and confirmation tasks completed without a corrective data edit divided by observed eligible tasks. |
| Median field submission time at or below 2 minutes | Median from first input to locally saved/submitted state, compared with a separately measured pre-pilot baseline. Do not assume a five-minute baseline. |

These targets do not establish product effectiveness on their own. Pair them with comprehension, operator workload, recovery-path observations, and participant correction of the resulting mandate artifacts.

---

## External Links

### Related Projects

- **EAS**: [attest.sh](https://attest.sh)
- **Karma GAP**: [gap.karmahq.xyz](https://gap.karmahq.xyz/)
- **Hypercerts**: [hypercerts.org](https://hypercerts.org)
- **Pimlico**: [pimlico.io](https://pimlico.io)
- **Envio**: [envio.dev](https://envio.dev)

### Regenerative Finance Ecosystem

- **Gitcoin**: [gitcoin.co](https://gitcoin.co)
- **Celo**: [celo.org](https://celo.org)
- **ReFi DAO**: [refidao.com](https://refidao.com)

---

## Open Research Areas

Current research directions:
- AI-assisted impact verification
- Satellite imagery integration
- Predictive impact models
- Cross-garden coordination patterns
- Impact market mechanisms

**Collaborate with us**: [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
