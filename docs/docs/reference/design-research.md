---
title: Design & Research
slug: /reference/design-research
audience: all
owner: docs
last_verified: 2026-04-02
feature_status: Live
source_of_truth:
  - docs/docs/community/operator-guide/creating-a-garden.mdx
  - docs/docs/community/gardener-guide/joining-a-garden.mdx
---

# Design & Research

Design resources, research materials, and product vision documents for Green Goods.

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

#### Gardener: Maria

**Who she is**: Community volunteer at a campus garden in Awka, Nigeria. Uses a mid-range Android phone with intermittent mobile data. No prior experience with apps beyond WhatsApp. Paid by the day for solar panel maintenance and tree planting.

**A day in her life**: Maria arrives at the campus garden at 7 AM before her solar panel cleaning shift. She opens Green Goods (which she treats the same as WhatsApp), takes a photo of the panel she is about to clean, adds a short note, and taps submit. The whole thing takes under a minute. By the time she finishes the panel row at 8:15 AM, the submission has synced in the background. She checks at lunch and sees a green checkmark -- her operator approved it.

**What success feels like**: "I took the photo, tapped submit, and the money arrived." The app never asked her to think about what blockchain means.

**What failure feels like**: A spinning loader after she submitted. She closes the app, unsure if her work was captured. She will not reopen it voluntarily -- she will ask her operator in person. If this happens twice, she stops using the app entirely.

**Frustration points**: Long forms, confusing labels, any interruption to the capture-submit-done loop. If the app feels like a government form, she stops using it.

**Design implication**: Every Gardener-facing decision must survive the "would Maria try again after this?" test.

#### Operator: David

**Who he is**: Community coordinator managing a coastal restoration project in Muizenberg, Cape Town. Oversees 20 gardeners across waste collection and food systems actions. Web3-familiar but not a developer. Spends 2-4 hours per week on garden management.

**A day in his life**: David opens the admin dashboard at 9 AM with coffee. He has 12 pending work submissions from yesterday. He scans the photos and notes, batch-approves the 10 that look good, flags 2 for follow-up. At 11 AM he has a funder call -- he pulls an export of this month's verified work counts and assessment scores. In the afternoon he adds a new "beach cleanup" action to the garden and assigns an evaluator to next month's assessment cycle.

**What success feels like**: "I reviewed everything in 10 minutes and had the report ready before my call." The dashboard feels like a command center, not a chore.

**What failure feels like**: Spending an hour on what should have been a batch operation. Or a funder asking for data he cannot export, forcing him to screenshot tables into a slide deck.

**Frustration points**: One-at-a-time approval flows, configuration that requires reading Solidity, reports that need technical parsing before they are shareable.

**Design implication**: Every Operator workflow must be measured by "could David finish this before his coffee gets cold?"

#### Evaluator: Dr. Chen

**Who she is**: Environmental researcher partnered with AgroforestDAO in Minas Gerais, Brazil. Evaluates garden impact seasonally, not daily. Comfortable with data queries and attestation chains. Needs structured rubrics that map to academic and compliance frameworks.

**A day in her life**: At the end of the growing season, Dr. Chen logs into the evaluator view and reviews the past quarter's approved work across 3 gardens against each garden's assessment baseline. She scores the realized impact across the Eight Forms of Capital rubric with evidence references, exports the data as CSV for her research paper, and verifies the attestation chain to confirm nothing was tampered with since submission.

**What success feels like**: "I have a publishable dataset with cryptographic provenance that I can cite in a peer-reviewed journal." The data export maps cleanly to her research methodology.

**What failure feels like**: Spending time on assessments that lack the metadata she needs -- no GPS coordinates, no timestamps, no photo EXIF data. Or discovering that the export format requires hours of manual transformation before it fits her analysis pipeline.

**Frustration points**: Free-text-only assessments with no structured rubric. Vague impact language that cannot be operationalized. Data exports that lose attestation linkage.

**Design implication**: Evaluator features must produce research-grade artifacts, not just internal reports.

#### Funder: Amara

**Who she is**: Impact fund manager at a mid-size foundation evaluating 20-30 projects per quarter. Comfortable with dashboards and financial reporting tools but does not read Solidity. Needs verified, auditable impact data to justify allocations to her board.

**A day in her life**: Before a quarterly allocation meeting, Amara opens the funder dashboard to compare garden performance across regions. She deposits into an Octant vault for a high-performing garden and purchases a Hypercert from another. She exports a one-page impact summary showing verified work counts, assessment scores, and attestation hashes -- her board requires cryptographic proof, not self-reported metrics.

**What success feels like**: "I can show my board exactly where the money went and what it produced, with proof that no one fabricated the numbers." The dashboard gives her confidence that this is not just another NGO spreadsheet.

**What failure feels like**: Self-reported numbers with no verification trail. Data lag beyond 24 hours without explanation. Reports that require a developer to interpret.

**Frustration points**: Hype without substance. "Impact" claims backed by nothing auditable. Blockchain jargon in what should be a financial reporting interface.

**Design implication**: Funder features must produce exportable, auditable artifacts that distinguish verified impact from self-report.

#### Community Member: Kwame

**Who he is**: Local resident in Nairobi whose neighborhood benefits from a school garden program. Does not do fieldwork himself but cares about what work gets prioritized. Uses a smartphone, tech comfort similar to Maria. Engages through governance, not submissions.

**A day in his life**: Kwame hears from a neighbor that the local garden has a new proposal to add litter cleanup actions alongside the existing tree planting. He opens the app, finds the active conviction vote, and signals his support. He checks back a few days later to see if the proposal passed and whether the new actions are live.

**What success feels like**: "I had a say in what work happens in my neighborhood, and the result was fair." He does not need to understand the protocol -- just that his voice counted.

**What failure feels like**: He cannot find the vote. The UI uses words like "conviction" and "signal pool" that mean nothing to him. Or the outcome feels disconnected from what the community actually wanted.

**Frustration points**: Jargon-heavy governance UI, feeling like his vote does not matter, no clear feedback loop showing what changed as a result.

**Design implication**: Community governance features must be comprehensible without protocol knowledge. "Conviction voting" needs plain-language framing.

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

**How**: On-chain attestations, public data, open source.

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

### Case Studies in Progress

We are documenting real-world deployments and impact stories:
- Pilot gardens
- Impact metrics
- Funder testimonials
- Gardener success stories

Follow updates on [X](https://x.com/greengoodsapp) and the [Dev Guild Blog](https://paragraph.com/@greenpilldevguild).

---

## Product Iterations

### MVP Learnings

**What Worked**:
- Passkey authentication adoption (90%+ of gardeners)
- Offline queue reliability (99%+ sync success)
- Operator validation model (95%+ approval rates)

**What We Improved**:
- Reduced submission time: 5 min → 2 min
- Simplified action creation
- Enhanced analytics
- Better mobile performance

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
