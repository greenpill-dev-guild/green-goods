# Green Goods — Copy & Voice Guide

> Feed this file to any copywriting agent (Antigravity, Gemini, Claude) alongside the relevant DESIGN.md for visual context. Specify which surface you're writing for.

## Brand Voice

**Green Goods speaks like:** A knowledgeable neighbor who runs the community garden. Warm but not gushing. Practical but not clinical. They know soil science but explain it by pointing at the compost pile.

**Voice pillars:**

| Pillar | Means | Doesn't Mean |
|--------|-------|------------|
| **Grounded** | Concrete, specific, rooted in real action | Jargon-heavy, academic, blockchain-first |
| **Inviting** | Welcoming, assumes good intent, lowers barriers | Sycophantic, over-enthusiastic, exclamation-heavy |
| **Honest** | Transparent about what works and what's experimental | Hedging, corporate disclaimers, vague promises |
| **Active** | Action-oriented, present-tense, you-centered | Passive voice, abstract nouns, bureaucratic |

**One-sentence test:** If it could appear on a government form, rewrite it. If it could appear on a hand-painted garden sign, it's close.

---

## Tone Spectrum

Tone shifts by context while voice stays constant:

| Context | Tone | Example |
|---------|------|---------|
| **Onboarding** | Encouraging, patient | "Start by describing what you see. We'll help with the rest." |
| **Submitting work** | Supportive, clear | "Add a photo and a few words about what you did today." |
| **Hero moments** | Celebratory, genuine | "Your first contribution. This garden is growing because of you." |
| **Errors** | Calm, constructive | "That didn't go through. Your work is saved — try again when you're ready." |
| **Offline** | Reassuring, matter-of-fact | "You're offline. Everything is saved locally and will sync when you reconnect." |
| **Admin / operator** | Efficient, status-oriented | "3 submissions pending review. 1 flagged for follow-up." |
| **Funding / impact** | Respectful, concrete | "This garden has documented 47 actions across 3 seasons." |

---

## Per-Surface Copy Patterns

### Browser (Funders / Community Members)

- **Headlines:** Editorial, evocative, magazine-weight. "The gardens growing a new kind of evidence."
- **Subheads:** Bridge emotion and information. "Community-documented impact, verified on-chain."
- **Garden descriptions:** Place-first. Lead with where the garden is and what it grows, not the technology.
- **Impact numbers:** Let them breathe. "47 documented actions" > "47 actions have been documented by community members."
- **CTAs:** Warm imperative. "Fund this garden" not "Contribute now."

### PWA (Gardeners)

- **Instructions:** Direct, second-person. "Describe what you did" not "Please provide a description."
- **Labels:** Short, noun-based. "Photo," "Method," "Confidence."
- **Empty states:** Encouraging, suggest next action. "No work yet. Start by documenting what you see."
- **Sync status:** Calm indicators. "Saved locally" / "Synced" / "Syncing..."
- **Errors:** Never blame the user. "We couldn't submit that" not "Your submission failed."

### Admin (Operators / Evaluators)

- **Copy mode:** Utility only. Status language and task framing.
- **Headers:** Functional nouns. "Review Queue," "Garden Settings," "Member Activity."
- **Status text:** Counts + state. "3 pending · 1 flagged · 12 approved"
- **Actions:** Verb-first. "Approve," "Request changes," "Flag for review."
- **Never:** Marketing copy, exclamatory language, homepage-style prose.

---

## Terminology

| Use | Don't Use | Why |
|-----|-----------|-----|
| Garden | Project, organization, DAO | Gardens are the metaphor. |
| Gardener | User, contributor, member | People who do the work have a name. |
| Operator | Admin, manager | They operate the garden. |
| Evaluator | Reviewer, auditor, assessor | They evaluate impact, not audit compliance. |
| Funder | Donor, investor, backer | Funding a garden, not donating to a cause. |
| Community member | Visitor, viewer, spectator | Part of the community, not an audience. |
| Work | Task, activity, submission | Regenerative work is the core concept. |
| Action | Action type, template | The thing a gardener can do. |
| Fund | Donate, contribute, invest | Funding a garden. |
| Impact | Output, result, metric | Bridges community and chain. |
| Document | Log, record, capture | Gardeners document their work. |

---

## Writing Checklist

Before shipping copy:

- [ ] Is it concrete? (Can the reader picture it?)
- [ ] Is it active? (Subject → verb → object?)
- [ ] Is the audience right? (Gardener ≠ operator ≠ funder)
- [ ] Is blockchain invisible? (On-chain = implementation, not copy)
- [ ] Would it make sense to someone who's never heard of web3?
- [ ] Is it shorter than your first draft?

---

## Using With AI Tools

When feeding this to a copywriting agent (Antigravity, Gemini, Claude):

1. Paste this full file as voice/tone context
2. Specify the surface (browser / PWA / admin)
3. Include the relevant DESIGN.md (foundation + surface) for visual context
4. Ask the agent to draft, then review against the checklist

**Example prompt:**
> Using the attached COPY_PROMPT.md as voice/tone guide and DESIGN.md as visual context, write copy for the Green Goods homepage (browser mode). The audience is funders and community members. Use the editorial lookbook tone. Draft 3 options for the hero headline and subhead.
