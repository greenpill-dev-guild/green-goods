# Ecosystem — Relational Architecture

Design for webs of people, not isolated users. Every surface exists in an ecosystem where one person's experience shapes another's. This lens complements the Adaptive Surface (information hierarchy) and Inclusive Design (accessibility) with a third question: **whose experience composes with whose?**

Based on [User Ecosystem Thinking](https://www.rethinkingusers.com/) (Youngblood, Chesluk, Haidary — BIS Publishers, 2021) and the EPIC 2023 paper "Toward an Ethnography of Friction and Ease in Complex Systems."

---

## The 15 User Archetypes

Archetypes categorize relationships by **function**, not identity. Unlike personas (who someone *is*), archetypes describe *how someone relates to the artifact*. A single person occupies multiple archetypes simultaneously and transitions between them.

| # | Archetype | Definition | Green Goods Example |
|---|-----------|-----------|-------------------|
| 1 | **Direct** | Engages the solution directly and personally | Gardener submitting work via MDR flow |
| 2 | **Indirect** | Experiences the solution through another's use | Neighbor whose street is cleaner because gardeners documented waste collection |
| 3 | **Intermediary** | Enables others to engage through their own engagement | Operator onboarding gardeners (B2B2C distribution channel) |
| 4 | **Governing** | Engagement significantly affects another's quality of engagement | Operator approving/rejecting work; Owner assigning roles via Hats |
| 5 | **Dependent** | Engages as enabled by another user | Gardener depends on Operator creating garden and actions first |
| 6 | **Terminal** | The focus of another's use — not a user themselves | Community whose impact is being measured |
| 7 | **Surrogate** | Engages as a stand-in for another | Operator submitting work on behalf of a gardener without a phone |
| 8 | **Serial** | Engages in a chain of others engaging | Attestation chain: Gardener → Operator → Evaluator → Funder |
| 9 | **Parallel** | Engages alongside others who engage similarly | Multiple gardeners submitting to the same action |
| 10 | **Complementary** | Engages alongside others who engage differently | Gardener and Funder both interact with the same Hypercert — one created it, the other purchases it |
| 11 | **Generative** | Engagement alters the solution itself | Operator configuring new actions, creating assessment frameworks |
| 12 | **Oblique** | Engages through byproducts of others' engagements | Researcher finding attestation data on EAS explorer — never touched Green Goods |
| 13 | **Ambient** | Engages through the solution's effect on their environment | Community members benefiting from regenerative work without knowing attestations exist |
| 14 | **Autonomic** | Engages automatically, without conscious awareness | On-chain contracts, indexer, EAS resolver — non-human actors processing attestations |
| 15 | **Conglomerate** | Engages intimately, technology as extension of self | A gardener for whom the app has become "just how I document my work" |

**Design rule**: When you can only name Direct and Governing users, you have not mapped the ecosystem. The difficulty of populating the other archetypes is itself diagnostic — it reveals blind spots.

---

## Green Goods Ecosystem Map

```
                          TERMINAL
                    Communities benefiting
                    from regenerative work
                             │
                        impact flows to
                             │
     AMBIENT          ┌──────┴──────┐          OBLIQUE
   Neighbors     ◄────│    DIRECT    │────►   Researchers
   Bystanders         │   Maria      │        using EAS
                      │   David      │        data
                      │   Dr. Chen   │
                      │   Amara      │
                      │   Kwame      │
                      └───┬────┬─────┘
                          │    │
            ┌─────────────┘    └─────────────┐
            │                                │
      GOVERNING                        AUTONOMIC
    Operators (approve)              EAS Resolver
    Owners (assign roles)            Envio Indexer
    Hats Protocol                    Smart Contracts
            │                        Job Queue
       enables                            │
            │                     enforces rules on
      DEPENDENT                           │
    Gardeners                        all Direct Users
    (need operator setup)
```

**Multi-archetype nexus**: David (Operator) occupies four archetypes simultaneously:
- **Direct** — uses admin dashboard
- **Governing** — approves/rejects work, shaping Maria's experience
- **Intermediary** — onboards gardeners (B2B2C channel)
- **Generative** — creates actions and assessment frameworks, reshaping what the system *is*

Each archetype has different UX needs. Governing-David needs blast radius awareness (who does this approval affect?). Intermediary-David needs onboarding efficiency (how fast can he get a gardener started?). Designing for one flat "Operator" persona misses the relational complexity.

---

## Three Systems Phenomena

What to look for once you have expanded your view beyond the direct user:

### Interconnectedness

No user's experience is independent. Maria's submission experience is shaped by whether David approved her last submission quickly or slowly, which depends on whether Dr. Chen's assessment framework gave David clear criteria, which depends on whether Amara's funding report asked for data the assessment framework doesn't capture.

**Design implication**: When modifying a surface, trace the relational chain. Who upstream provides the data shown here? Who downstream acts on what happens here? Show those connections in the UI where they matter.

### Synthesis

The whole exceeds the sum of its parts. Optimizing Maria's MDR flow + David's batch approval + Dr. Chen's rubric + Amara's export *individually* does not guarantee the combined system works.

**Design implication**: Test flows end-to-end across archetypes, not just within a single user's journey. Does the chain from capture → verification → certification → funding actually produce the emergent outcome?

### Emergence

Some experiences aren't attributable to any single design decision. When a garden community develops shared understanding of "what good work looks like" through repeated submission-approval cycles, that's an emergent property — produced by interaction patterns, not designed explicitly.

**Design implication**: Create conditions for positive emergence (consistent feedback loops, transparent criteria) and watch for negative emergence (gaming, rubber-stamp approvals, community distrust).

---

## Three Frictions That Hide Ecosystems

These meta-frictions explain why design teams systematically miss ecosystem complexity:

| Friction | What It Hides | Green Goods Manifestation |
|----------|--------------|--------------------------|
| **Availability** | Who gets studied is constrained by who we scope as "users" | We study gardeners and operators. We never study community members who benefit from garden work but never open the app. |
| **Dissonant Knowledge** | Systemic insights that don't fit organizational frames get dismissed as scope creep | If we discover operators submit work on behalf of gardeners (Surrogate), that insight has no slot in our persona model. |
| **Entrenched Praxis** | Habitual methods reproduce simplistic models | One persona per role. One journey map per persona. The method itself encodes the 1:1 assumption. |

**Breaking the cycle**: The archetype cards give teams shared vocabulary for systemic observations. "This is a Surrogate User pattern" is more actionable than "sometimes operators do stuff for gardeners."

---

## Ecosystem-Aware Design Patterns

### 1. Relational Disclosure

Extends the Jarvis Principle ([interaction.md](./interaction.md)) with a relational dimension. At each disclosure layer, surface *whose experience connects to this one*.

| Layer | Standard (Jarvis) | Ecosystem Extension |
|-------|-------------------|-------------------|
| **Glance** | Title, status, one metric | + Who is waiting on this? (governing/dependent indicator) |
| **Scan** | Summary, actions | + Where in the chain is this? (serial position indicator) |
| **Engage** | Full detail | + Who else is affected? (complementary/parallel users) |
| **Deep Dive** | Raw data, audit trail | + Full ecosystem trace (attestation chain visualization) |

Example: When David reviews Maria's work submission, the Glance layer shows her photo and note. The Scan layer adds: "1 of 12 pending · Amara's Q2 report includes this garden." This is ecosystem-aware disclosure — it surfaces the Governing → Complementary user relationship without cluttering the primary view.

### 2. Cascade Awareness

When one user's action affects another user's experience, make the cascade visible *before* the action is taken.

| Action | Cascade | UI Pattern |
|--------|---------|-----------|
| Operator rejects work | Gardener sees rejection; Funder's verified count decreases | Confirmation shows: "Maria will see this rejection. Q2 verified count: 47 → 46." |
| Owner removes operator role | All gardeners in that garden lose their reviewer | Warning: "12 gardeners will have no active reviewer." |
| Evaluator publishes assessment | Assessment becomes part of garden's Hypercert metadata | Preview: "This assessment will appear in the impact certificate Amara purchased." |
| Gardener submits work | Enters operator's review queue; adds to garden's pending count | Confirmation: "David will review this. Currently 3 pending in his queue." |

**Design rule**: The higher the governing power, the more cascade context is mandatory. Owners see full blast radius. Gardeners see only their own downstream (submission → pending → approved).

### 3. Autonomic User Surfaces

On-chain contracts, indexers, and resolvers are Autonomic Users — non-human actors whose behavior shapes every other user's experience. Make their state visible rather than treating them as invisible infrastructure.

| Autonomic Actor | What It Does | Surface Pattern |
|-----------------|-------------|-----------------|
| **EAS Resolver** | Validates attestation schema | Status indicator: "Verifying schema..." → "Confirmed" or "Schema mismatch — contact operator" |
| **Envio Indexer** | Materializes on-chain events | Sync indicator: "Last indexed: 2 min ago" (staleness, not loading spinner) |
| **Job Queue** | Queues offline submissions | SyncStatusBar: "3 queued · will sync when online" |
| **Smart Contracts** | Enforce role-based access | Permission indicator: "Your role: Gardener · Can submit work, cannot approve" |

**Material guidance**: Autonomic user surfaces are **Ambient Display** paradigm ([SKILL.md](./SKILL.md)) — Thin material, peripheral, glanceable. They should never demand attention unless something breaks. When an autonomic actor fails (resolver rejects, indexer falls behind), promote to **Command Surface** paradigm with Thick material.

### 4. Multi-Archetype Transitions

Users shift between archetypes during a session. Design for the transition, not just the state.

| Transition | Trigger | UI Pattern |
|------------|---------|-----------|
| David: Direct → Governing | Opens review queue | Dashboard shifts from personal metrics to review-mode with cascade indicators |
| Maria: Direct → Conglomerate | Habitual daily use | Interface simplifies over time — fewer onboarding cues, tighter MDR flow |
| Kwame: Ambient → Direct | Neighbor tells him about a vote | Low-barrier entry: deep link to specific vote with plain-language context |
| Amara: Direct → Complementary | Views a Hypercert created by Dr. Chen's assessment | Certificate view shows the full provenance chain, not just the final artifact |

**Design rule**: Transitions should feel like *focus shifts*, not *mode switches*. The adaptive surface paradigm applies — the user shifts attention between surfaces without the interface rebuilding itself.

### 5. Surrogate User Support

When one person acts on behalf of another (operator submitting for a gardener), the interface must distinguish the surrogate from the direct user. This pattern exists in the field but has no designed support.

```
┌─────────────────────────────────────┐
│  Submitting as:  Maria Okafor       │
│  Submitted by:   David (Operator)   │
│  ─────────────────────────────────  │
│  [Photo] [Details] [Submit]         │
└─────────────────────────────────────┘
```

**Data integrity**: Surrogate submissions must record both the surrogate (who submitted) and the attributed gardener (whose work it is). The attestation must reflect the actual worker, not the submitter. This intersects with `product.md` Data Integrity Requirement #4 (no self-attestation): the surrogate cannot also approve the work they submitted.

---

## Ecosystem Readiness Checklist

Run alongside the Spatial Readiness Checklist ([references.md](./references.md)) for views that involve multiple user types:

```
Ecosystem Readiness Check
│
├─ [ ] Multi-archetype awareness?
│      Does this surface serve users in different archetype roles?
│      If yes, does the UI adapt to the active archetype?
│
├─ [ ] Cascade visibility?
│      When a governing action affects dependent users, is the
│      blast radius shown before the action is confirmed?
│
├─ [ ] Serial chain position?
│      If this entity flows through multiple users (attestation chain),
│      is the current position in the chain visible?
│
├─ [ ] Autonomic actors surfaced?
│      Are contract/indexer/resolver states visible as ambient
│      indicators, not hidden behind generic loading states?
│
├─ [ ] Surrogate distinction?
│      If one user can act on behalf of another, does the UI
│      distinguish who submitted from who is attributed?
│
├─ [ ] Terminal user presence?
│      Does the interface remind users that real communities are
│      the ultimate beneficiaries, not just data points?
│
└─ [ ] Ecosystem tested end-to-end?
       Has the flow been tested across archetype transitions
       (submit → review → assess → fund), not just within one role?
```

---

## When to Apply This Lens

Not every surface needs ecosystem analysis. Use this lens when:

- The surface involves **governing actions** (approvals, role assignments, configuration changes)
- The data flows through a **serial chain** (attestation lifecycle: submit → approve → assess → certify → fund)
- **Autonomous actors** gate the experience (resolver validation, indexer sync, job queue)
- A user can act as a **surrogate** for another
- The design decision affects **users who will never see the interface** (terminal, ambient, oblique users)

For simple, single-user surfaces (a form, a settings page, a static view), the Adaptive Surface and Inclusive Design lenses are sufficient.

---

## References

| Source | Authority On |
|--------|-------------|
| **Rethinking Users** (Youngblood, Chesluk, Haidary — BIS 2021) | 15 archetypes, 6 exercise cards, ecosystem mapping toolkit |
| **EPIC 2023** — "Toward an Ethnography of Friction and Ease in Complex Systems" | Three frictions, three systems phenomena, theoretical foundation |
| **NNGroup** — "User-Ecosystem Thinking: An Anthropologic Approach to Design" | Practitioner-oriented framework summary |
| **MHCLG Digital** — "Applying User Ecosystem Thinking in Funding Service" | UK gov case study: workshop format, surprises, outcomes |
| **Green Goods Personas** | `docs/docs/reference/design-research.md#user-personas` — Maria, David, Dr. Chen, Amara, Kwame |
| **Green Goods Tone** | `.claude/context/product.md` § Persona & Tone Quick-Reference |
